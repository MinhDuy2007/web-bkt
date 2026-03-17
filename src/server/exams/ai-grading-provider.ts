import { AuthError } from "@/server/auth/errors";
import { layBienMoiTruongServer } from "@/server/config/env";
import type {
  ClassExamAttemptAnswerRecord,
  ClassExamQuestionRecord,
  ClassExamAttemptRecord,
} from "@/types/exam";

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
  responseJson: Record<string, unknown>;
};

export interface AiEssayGradingProvider {
  generateEssaySuggestion(
    input: GenerateAiEssaySuggestionInput,
  ): Promise<GenerateAiEssaySuggestionOutput>;
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
    nhanXet.push("Bài làm có độ phủ ý khá tốt ở mức gợi ý.");
  } else if (scoreRatio >= 0.55) {
    nhanXet.push("Bài làm có ý chính nhưng cần triển khai sâu hơn.");
  } else {
    nhanXet.push("Bài làm còn ngắn và chưa đủ ý để đạt điểm cao.");
  }

  if (expectedMinWords > 0) {
    nhanXet.push(`Độ dài hiện tại khoảng ${wordCount} từ so với mức gợi ý ${expectedMinWords} từ.`);
  } else {
    nhanXet.push(`Độ dài hiện tại khoảng ${wordCount} từ.`);
  }

  if (!/[.!?]/u.test(answerText)) {
    nhanXet.push("Nên tách ý rõ hơn để giáo viên dễ theo dõi lập luận.");
  }

  return nhanXet.join(" ");
}

class MockAiEssayGradingProvider implements AiEssayGradingProvider {
  async generateEssaySuggestion(
    input: GenerateAiEssaySuggestionInput,
  ): Promise<GenerateAiEssaySuggestionOutput> {
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
    const confidenceScore = Math.round(Math.min(0.92, 0.4 + scoreRatio * 0.45) * 100) / 100;

    return {
      suggestedPoints,
      suggestedFeedback: taoNhanXetGiaLap(answerText, scoreRatio, expectedMinWords),
      confidenceScore,
      providerKind: "mock",
      modelName: layBienMoiTruongServer().aiGradingModelName,
      promptVersion: "essay-v1",
      responseJson: {
        reasoning: {
          expectedMinWords,
          detectedWordCount: wordCount,
          scoreRatio,
          structureBonus,
          keywordBonus,
        },
      },
    };
  }
}

let cachedProvider: AiEssayGradingProvider | null = null;

export function layAiEssayGradingProvider(): AiEssayGradingProvider {
  const env = layBienMoiTruongServer();
  if (env.aiGradingProviderMode === "disabled") {
    throw new AuthError({
      code: "AI_GRADING_DISABLED",
      message: "Tinh nang AI-assisted grading dang bi tat o moi truong hien tai.",
      statusCode: 503,
    });
  }

  if (!cachedProvider) {
    cachedProvider = new MockAiEssayGradingProvider();
  }

  return cachedProvider;
}
