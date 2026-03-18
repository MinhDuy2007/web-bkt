import { AuthError } from "@/server/auth/errors";
import {
  datLaiBienMoiTruongServerChoTest,
  layBienMoiTruongServer,
} from "@/server/config/env";
import type {
  ClassExamAttemptAnswerRecord,
  ClassExamAttemptRecord,
  ClassExamQuestionRecord,
  AiGradingUsageLogStatus,
} from "@/types/exam";

const AI_PROVIDER_ERROR_BODY_MAX_LENGTH = 2000;

export type GenerateAiEssaySuggestionInput = {
  answer: ClassExamAttemptAnswerRecord;
  question: ClassExamQuestionRecord;
  attempt: ClassExamAttemptRecord;
};

export type GenerateAiEssaySuggestionOutput = {
  suggestedPoints: number;
  suggestedFeedback: string | null;
  confidenceScore: number | null;
  providerKind: string;
  modelName: string;
  promptVersion: string | null;
  latencyMs: number | null;
  responseId: string | null;
  responseJson: Record<string, unknown>;
  usageJson: Record<string, unknown>;
};

export interface AiEssayGradingProvider {
  generateEssaySuggestion(
    input: GenerateAiEssaySuggestionInput,
  ): Promise<GenerateAiEssaySuggestionOutput>;
}

export class AiGradingProviderCallError extends AuthError {
  readonly providerKind: string;
  readonly modelName: string;
  readonly promptVersion: string | null;
  readonly requestStatus: AiGradingUsageLogStatus;
  readonly latencyMs: number | null;
  readonly metadataJson: Record<string, unknown>;

  constructor(options: {
    code: string;
    message: string;
    statusCode: number;
    providerKind: string;
    modelName: string;
    promptVersion: string | null;
    requestStatus: AiGradingUsageLogStatus;
    latencyMs: number | null;
    metadataJson?: Record<string, unknown>;
  }) {
    super({
      code: options.code,
      message: options.message,
      statusCode: options.statusCode,
    });
    this.providerKind = options.providerKind;
    this.modelName = options.modelName;
    this.promptVersion = options.promptVersion;
    this.requestStatus = options.requestStatus;
    this.latencyMs = options.latencyMs;
    this.metadataJson = options.metadataJson ?? {};
  }
}

function demSoTu(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter((item) => item.length > 0).length;
}

function taoNhanXetGiaLap(
  answerText: string,
  scoreRatio: number,
  expectedMinWords: number,
): string {
  const wordCount = demSoTu(answerText);
  const nhanXet: string[] = [];

  if (scoreRatio >= 0.85) {
    nhanXet.push("Bai lam co do phu y kha tot o muc goi y.");
  } else if (scoreRatio >= 0.55) {
    nhanXet.push("Bai lam co y chinh nhung can trien khai sau hon.");
  } else {
    nhanXet.push("Bai lam con ngan va chua du y de dat diem cao.");
  }

  if (expectedMinWords > 0) {
    nhanXet.push(`Do dai hien tai khoang ${wordCount} tu so voi muc goi y ${expectedMinWords} tu.`);
  } else {
    nhanXet.push(`Do dai hien tai khoang ${wordCount} tu.`);
  }

  if (!/[.!?]/u.test(answerText)) {
    nhanXet.push("Nen tach y ro hon de giao vien de theo doi lap luan.");
  }

  return nhanXet.join(" ");
}

function lamTron2ChuSo(value: number): number {
  return Math.round(value * 100) / 100;
}

function taoPromptHeThong(questionPoints: number): string {
  return [
    "Ban la tro ly ho tro giao vien cham tu luan.",
    "Chi tra ve du lieu JSON dung schema da yeu cau.",
    `suggestedPoints phai nam trong khoang 0 den ${questionPoints}.`,
    "confidenceScore phai nam trong khoang 0 den 1.",
    "suggestedFeedback ngan gon, trung tinh, huu ich cho giao vien va hoc sinh.",
    "Khong duoc tuyen bo day la diem cuoi cung. Day chi la goi y cho giao vien tham khao.",
  ].join(" ");
}

function taoPromptNguoiDung(input: GenerateAiEssaySuggestionInput): string {
  const expectedMinWords =
    typeof input.question.metadataJson.expectedMinWords === "number"
      ? Number(input.question.metadataJson.expectedMinWords)
      : 0;

  return [
    `De bai: ${input.question.promptText}`,
    `So diem toi da: ${input.question.points}`,
    `So tu goi y toi thieu: ${expectedMinWords}`,
    "Yeu cau:",
    "- Danh gia muc do day du cua cau tra loi.",
    "- Danh gia lap luan va muc do ro rang.",
    "- Khong ket luan day la diem chinh thuc.",
    `Cau tra loi cua hoc sinh: ${input.answer.answerText ?? ""}`,
  ].join("\n");
}

function taoResponseJsonSchema(questionPoints: number): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      suggestedPoints: {
        type: "number",
        minimum: 0,
        maximum: questionPoints,
      },
      suggestedFeedback: {
        type: ["string", "null"],
      },
      confidenceScore: {
        type: ["number", "null"],
        minimum: 0,
        maximum: 1,
      },
    },
    required: ["suggestedPoints", "suggestedFeedback", "confidenceScore"],
  };
}

function taoNoiDungRequestOpenAi(input: GenerateAiEssaySuggestionInput) {
  const env = layBienMoiTruongServer();
  return {
    model: env.aiGradingModelName,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: taoPromptHeThong(input.question.points),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: taoPromptNguoiDung(input),
          },
        ],
      },
    ],
    max_output_tokens: 600,
    text: {
      format: {
        type: "json_schema",
        name: "essay_grading_suggestion",
        strict: true,
        schema: taoResponseJsonSchema(input.question.points),
      },
    },
  };
}

function docOutputTextTuResponse(responseBody: Record<string, unknown>): string | null {
  const outputText = responseBody.output_text;
  if (typeof outputText === "string" && outputText.trim().length > 0) {
    return outputText;
  }

  const output = Array.isArray(responseBody.output) ? responseBody.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content as unknown[])
      : [];
    for (const chunk of content) {
      if (!chunk || typeof chunk !== "object") {
        continue;
      }

      const text = (chunk as { text?: unknown }).text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    }
  }

  return null;
}

function docJsonTuOutputText(outputText: string): {
  suggestedPoints: number;
  suggestedFeedback: string | null;
  confidenceScore: number | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new AuthError({
      code: "AI_PROVIDER_RESPONSE_INVALID",
      message: "Provider AI tra ve output khong dung JSON hop le.",
      statusCode: 502,
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AuthError({
      code: "AI_PROVIDER_RESPONSE_INVALID",
      message: "Provider AI tra ve output JSON khong dung schema mong doi.",
      statusCode: 502,
    });
  }

  const data = parsed as Record<string, unknown>;
  const suggestedPoints = data.suggestedPoints;
  const suggestedFeedback = data.suggestedFeedback;
  const confidenceScore = data.confidenceScore;

  if (typeof suggestedPoints !== "number" || !Number.isFinite(suggestedPoints)) {
    throw new AuthError({
      code: "AI_PROVIDER_RESPONSE_INVALID",
      message: "Provider AI tra ve suggestedPoints khong hop le.",
      statusCode: 502,
    });
  }

  if (suggestedFeedback !== null && typeof suggestedFeedback !== "string") {
    throw new AuthError({
      code: "AI_PROVIDER_RESPONSE_INVALID",
      message: "Provider AI tra ve suggestedFeedback khong hop le.",
      statusCode: 502,
    });
  }

  if (
    confidenceScore !== null &&
    (typeof confidenceScore !== "number" || !Number.isFinite(confidenceScore))
  ) {
    throw new AuthError({
      code: "AI_PROVIDER_RESPONSE_INVALID",
      message: "Provider AI tra ve confidenceScore khong hop le.",
      statusCode: 502,
    });
  }

  return {
    suggestedPoints,
    suggestedFeedback,
    confidenceScore,
  };
}

function catNganChuoi(rawValue: string): string {
  if (rawValue.length <= AI_PROVIDER_ERROR_BODY_MAX_LENGTH) {
    return rawValue;
  }

  return `${rawValue.slice(0, AI_PROVIDER_ERROR_BODY_MAX_LENGTH)}...`;
}

function docLatencyMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function taoThongTinUsage(responseBody: Record<string, unknown>): Record<string, unknown> {
  const usage = responseBody.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return {};
  }

  return usage as Record<string, unknown>;
}

class MockAiEssayGradingProvider implements AiEssayGradingProvider {
  async generateEssaySuggestion(
    input: GenerateAiEssaySuggestionInput,
  ): Promise<GenerateAiEssaySuggestionOutput> {
    const env = layBienMoiTruongServer();
    const answerText = input.answer.answerText?.trim() ?? "";
    const expectedMinWords =
      typeof input.question.metadataJson.expectedMinWords === "number"
        ? Number(input.question.metadataJson.expectedMinWords)
        : 0;
    const wordCount = demSoTu(answerText);
    const baseRatio =
      expectedMinWords > 0 ? Math.min(1, wordCount / expectedMinWords) : Math.min(1, wordCount / 80);
    const structureBonus = /[.!?]/u.test(answerText) ? 0.08 : 0;
    const keywordBonus =
      input.question.promptText
        .toLowerCase()
        .split(/\s+/u)
        .filter((item) => item.length >= 5)
        .some((keyword) => answerText.toLowerCase().includes(keyword))
        ? 0.05
        : 0;

    const scoreRatio = Math.min(1, baseRatio + structureBonus + keywordBonus);
    const suggestedPoints = Math.round(input.question.points * scoreRatio * 4) / 4;
    const confidenceScore = lamTron2ChuSo(Math.min(0.92, 0.4 + scoreRatio * 0.45));

    return {
      suggestedPoints,
      suggestedFeedback: taoNhanXetGiaLap(answerText, scoreRatio, expectedMinWords),
      confidenceScore,
      providerKind: "mock",
      modelName: env.aiGradingModelName,
      promptVersion: env.aiGradingPromptVersion,
      latencyMs: 0,
      responseId: null,
      responseJson: {
        reasoning: {
          expectedMinWords,
          detectedWordCount: wordCount,
          scoreRatio,
          structureBonus,
          keywordBonus,
        },
      },
      usageJson: {},
    };
  }
}

class OpenAiEssayGradingProvider implements AiEssayGradingProvider {
  async generateEssaySuggestion(
    input: GenerateAiEssaySuggestionInput,
  ): Promise<GenerateAiEssaySuggestionOutput> {
    const env = layBienMoiTruongServer();
    const requestBody = taoNoiDungRequestOpenAi(input);
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetch(`${env.openaiApiBaseUrl}/responses`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.openaiApiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(env.aiGradingTimeoutMs),
      });
    } catch (error) {
      const requestStatus: AiGradingUsageLogStatus =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
          ? "timeout"
          : "failed";
      const message =
        requestStatus === "timeout"
          ? "Provider AI vuot qua thoi gian cho phep khi tao goi y cham essay."
          : "Khong the ket noi provider AI de tao goi y cham essay.";

      throw new AiGradingProviderCallError({
        code: requestStatus === "timeout" ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_REQUEST_FAILED",
        message,
        statusCode: requestStatus === "timeout" ? 504 : 502,
        providerKind: "openai",
        modelName: env.aiGradingModelName,
        promptVersion: env.aiGradingPromptVersion,
        requestStatus,
        latencyMs: docLatencyMs(startedAt),
        metadataJson: {
          errorName: error instanceof Error ? error.name : typeof error,
        },
      });
    }

    let responseText = "";
    try {
      responseText = await response.text();
    } catch {
      responseText = "";
    }

    let responseBody: Record<string, unknown> = {};
    if (responseText.trim().length > 0) {
      try {
        const parsed = JSON.parse(responseText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          responseBody = parsed as Record<string, unknown>;
        }
      } catch {
        responseBody = {
          rawText: catNganChuoi(responseText),
        };
      }
    }

    if (!response.ok) {
      const statusCode = response.status === 408 || response.status === 504 ? 504 : 502;
      const requestStatus: AiGradingUsageLogStatus =
        response.status === 408 || response.status === 504 ? "timeout" : "failed";
      throw new AiGradingProviderCallError({
        code: requestStatus === "timeout" ? "AI_PROVIDER_TIMEOUT" : "AI_PROVIDER_HTTP_ERROR",
        message:
          requestStatus === "timeout"
            ? "Provider AI het thoi gian xu ly request essay grading."
            : "Provider AI tra ve loi khi tao goi y cham essay.",
        statusCode,
        providerKind: "openai",
        modelName: env.aiGradingModelName,
        promptVersion: env.aiGradingPromptVersion,
        requestStatus,
        latencyMs: docLatencyMs(startedAt),
        metadataJson: {
          httpStatus: response.status,
          responseBody,
        },
      });
    }

    const outputText = docOutputTextTuResponse(responseBody);
    if (!outputText) {
      throw new AiGradingProviderCallError({
        code: "AI_PROVIDER_RESPONSE_INVALID",
        message: "Provider AI khong tra ve output_text hop le.",
        statusCode: 502,
        providerKind: "openai",
        modelName: env.aiGradingModelName,
        promptVersion: env.aiGradingPromptVersion,
        requestStatus: "failed",
        latencyMs: docLatencyMs(startedAt),
        metadataJson: {
          responseBody,
        },
      });
    }

    let output;
    try {
      output = docJsonTuOutputText(outputText);
    } catch (error) {
      if (error instanceof AuthError) {
        throw new AiGradingProviderCallError({
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          providerKind: "openai",
          modelName: env.aiGradingModelName,
          promptVersion: env.aiGradingPromptVersion,
          requestStatus: "failed",
          latencyMs: docLatencyMs(startedAt),
          metadataJson: {
            outputText: catNganChuoi(outputText),
            responseBody,
          },
        });
      }
      throw error;
    }

    if (output.suggestedPoints < 0 || output.suggestedPoints > input.question.points) {
      throw new AiGradingProviderCallError({
        code: "AI_SUGGESTED_POINTS_OUT_OF_RANGE",
        message: "Provider AI tra ve suggestedPoints vuot gioi han diem cua cau hoi.",
        statusCode: 502,
        providerKind: "openai",
        modelName: env.aiGradingModelName,
        promptVersion: env.aiGradingPromptVersion,
        requestStatus: "failed",
        latencyMs: docLatencyMs(startedAt),
        metadataJson: {
          suggestedPoints: output.suggestedPoints,
          questionPoints: input.question.points,
          responseBody,
        },
      });
    }

    if (
      output.confidenceScore !== null &&
      (output.confidenceScore < 0 || output.confidenceScore > 1)
    ) {
      throw new AiGradingProviderCallError({
        code: "AI_PROVIDER_RESPONSE_INVALID",
        message: "Provider AI tra ve confidenceScore nam ngoai khoang 0..1.",
        statusCode: 502,
        providerKind: "openai",
        modelName: env.aiGradingModelName,
        promptVersion: env.aiGradingPromptVersion,
        requestStatus: "failed",
        latencyMs: docLatencyMs(startedAt),
        metadataJson: {
          confidenceScore: output.confidenceScore,
          responseBody,
        },
      });
    }

    return {
      suggestedPoints: lamTron2ChuSo(output.suggestedPoints),
      suggestedFeedback:
        output.suggestedFeedback && output.suggestedFeedback.trim().length > 0
          ? output.suggestedFeedback.trim()
          : null,
      confidenceScore:
        output.confidenceScore === null ? null : lamTron2ChuSo(output.confidenceScore),
      providerKind: "openai",
      modelName:
        typeof responseBody.model === "string" && responseBody.model.trim().length > 0
          ? responseBody.model
          : env.aiGradingModelName,
      promptVersion: env.aiGradingPromptVersion,
      latencyMs: docLatencyMs(startedAt),
      responseId: typeof responseBody.id === "string" ? responseBody.id : null,
      responseJson: {
        responseId: typeof responseBody.id === "string" ? responseBody.id : null,
        outputText: catNganChuoi(outputText),
      },
      usageJson: taoThongTinUsage(responseBody),
    };
  }
}

let cachedProvider: AiEssayGradingProvider | null = null;
let cachedProviderKey: string | null = null;
let testProviderOverride: AiEssayGradingProvider | null = null;

function taoProviderCacheKey(): string {
  const env = layBienMoiTruongServer();
  return [
    env.aiGradingProviderMode,
    env.aiGradingModelName,
    env.aiGradingTimeoutMs,
    env.aiGradingPromptVersion,
    env.openaiApiBaseUrl,
  ].join("|");
}

export function layAiEssayGradingProvider(): AiEssayGradingProvider {
  const env = layBienMoiTruongServer();
  if (env.aiGradingProviderMode === "disabled") {
    throw new AuthError({
      code: "AI_GRADING_DISABLED",
      message: "Tinh nang AI-assisted grading dang bi tat o moi truong hien tai.",
      statusCode: 503,
    });
  }

  if (testProviderOverride) {
    return testProviderOverride;
  }

  const cacheKey = taoProviderCacheKey();
  if (!cachedProvider || cachedProviderKey !== cacheKey) {
    cachedProvider = env.aiGradingProviderMode === "openai"
      ? new OpenAiEssayGradingProvider()
      : new MockAiEssayGradingProvider();
    cachedProviderKey = cacheKey;
  }

  return cachedProvider;
}

export function datAiEssayGradingProviderChoTest(provider: AiEssayGradingProvider | null): void {
  testProviderOverride = provider;
  cachedProvider = null;
  cachedProviderKey = null;
  datLaiBienMoiTruongServerChoTest();
}
