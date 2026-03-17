import { AuthError } from "@/server/auth/errors";
import {
  batBuocQuyenNguoiDungCoBan,
  batBuocQuyenTaoLop,
} from "@/server/auth/permissions";
import { layPhienDangNhap } from "@/server/auth/service";
import { layAiEssayGradingProvider } from "@/server/exams/ai-grading-provider";
import { layExamRepository } from "@/server/exams/repository";
import type {
  AnswerKeyPayload,
  CreateClassExamInput,
  CreateExamQuestionInput,
  GradeEssayAttemptAnswerInput,
  GetStudentExamPlayerInput,
  ListEssayAnswersForManualGradingInput,
  SubmitClassExamAttemptInput,
  UpsertAttemptAnswerInput,
  UpdateExamQuestionInput,
} from "@/server/exams/repository/exam-repository";
import type {
  AiEssayGradingSuggestionItemRecord,
  ClassExamAttemptAnswerItemRecord,
  ClassExamAttemptRecord,
  ClassExamQuestionItemRecord,
  ClassExamQuestionType,
  ClassExamStatus,
  EssayManualGradingQueueItemRecord,
  GradeEssayAttemptAnswerResult,
  MyCreatedClassExamItem,
  ReviewAiEssaySuggestionResult,
  StartClassExamResult,
  StudentExamPlayerRecord,
  StudentExamResultRecord,
  SubmitClassExamAttemptResult,
} from "@/types/exam";

const MA_KY_TU = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MA_LOP_PATTERN = /^[A-Z0-9]{4,16}$/;
const MA_BAI_KIEM_TRA_PATTERN = /^[A-Z0-9]{6,16}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TaoBaiKiemTraTheoLopPayload = {
  classCode: string;
  title: string;
  description: string | null;
  status: ClassExamStatus;
};

export type VaoBaiKiemTraPayload = {
  examCode: string;
};

export type TaoCauHoiChoExamPayload = {
  examCode: string;
  questionOrder: number;
  questionType: ClassExamQuestionType;
  promptText: string;
  points: number;
  metadataJson: Record<string, unknown>;
  answerKey: AnswerKeyPayload;
};

export type CapNhatCauHoiChoExamPayload = {
  questionOrder: number;
  questionType: ClassExamQuestionType;
  promptText: string;
  points: number;
  metadataJson: Record<string, unknown>;
  answerKey: AnswerKeyPayload;
};

export type LuuCauTraLoiTheoAttemptPayload = {
  attemptId: string;
  questionId: string;
  answerText: string | null;
  answerJson: Record<string, unknown>;
};

export type NopBaiKiemTraPayload = {
  attemptId: string;
};

export type ChamTayCauEssayPayload = {
  manualAwardedPoints: number;
  gradingNote: string | null;
};

export type TaoGoiYChamAIChoEssayPayload = {
  examCode: string;
  answerId: string;
};

export type XuLyGoiYChamAIPayload = {
  action: "accept" | "reject";
};

function docObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Du lieu dau vao khong hop le.",
      statusCode: 400,
    });
  }

  return payload as Record<string, unknown>;
}

function docObjectTuyChon(payload: unknown, fieldName: string): Record<string, unknown> {
  if (payload === undefined || payload === null) {
    return {};
  }

  if (typeof payload !== "object" || Array.isArray(payload)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la object neu duoc cung cap.`,
      statusCode: 400,
    });
  }

  return payload as Record<string, unknown>;
}

function docChuoi(
  rawValue: unknown,
  fieldName: string,
  minLength: number,
  maxLength: number,
): string {
  if (typeof rawValue !== "string") {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la chuoi.`,
      statusCode: 400,
    });
  }

  const normalized = rawValue.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai co do dai tu ${minLength} den ${maxLength} ky tu.`,
      statusCode: 400,
    });
  }

  return normalized;
}

function docChuoiTuyChon(rawValue: unknown, fieldName: string, maxLength: number): string | null {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }

  if (typeof rawValue !== "string") {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la chuoi neu duoc cung cap.`,
      statusCode: 400,
    });
  }

  const normalized = rawValue.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} khong duoc vuot qua ${maxLength} ky tu.`,
      statusCode: 400,
    });
  }

  return normalized;
}

function docChuoiTraLoi(rawValue: unknown, fieldName: string, maxLength: number): string | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue !== "string") {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la chuoi neu duoc cung cap.`,
      statusCode: 400,
    });
  }

  const normalized = rawValue.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} khong duoc vuot qua ${maxLength} ky tu.`,
      statusCode: 400,
    });
  }

  return normalized;
}

function docSoDuong(
  rawValue: unknown,
  fieldName: string,
  minValue: number,
  maxValue: number,
): number {
  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la so hop le.`,
      statusCode: 400,
    });
  }

  if (rawValue < minValue || rawValue > maxValue) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai nam trong khoang ${minValue} den ${maxValue}.`,
      statusCode: 400,
    });
  }

  const rounded = Math.round(rawValue * 100) / 100;
  return rounded;
}

function docSoNguyenDuong(
  rawValue: unknown,
  fieldName: string,
  minValue: number,
  maxValue: number,
): number {
  if (typeof rawValue !== "number" || !Number.isInteger(rawValue)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la so nguyen hop le.`,
      statusCode: 400,
    });
  }

  if (rawValue < minValue || rawValue > maxValue) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai nam trong khoang ${minValue} den ${maxValue}.`,
      statusCode: 400,
    });
  }

  return rawValue;
}

function docStatus(rawValue: unknown): ClassExamStatus {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return "published";
  }

  if (rawValue === "draft" || rawValue === "published" || rawValue === "archived") {
    return rawValue;
  }

  throw new AuthError({
    code: "INVALID_INPUT",
    message: "Truong status chi chap nhan draft, published hoac archived.",
    statusCode: 400,
  });
}

function docQuestionType(rawValue: unknown): ClassExamQuestionType {
  if (
    rawValue === "multiple_choice_single" ||
    rawValue === "true_false" ||
    rawValue === "short_answer" ||
    rawValue === "essay_placeholder"
  ) {
    return rawValue;
  }

  throw new AuthError({
    code: "INVALID_INPUT",
    message:
      "Truong questionType chi chap nhan multiple_choice_single, true_false, short_answer, essay_placeholder.",
    statusCode: 400,
  });
}

function docUuid(rawValue: unknown, fieldName: string): string {
  const normalized = docChuoi(rawValue, fieldName, 36, 36);
  if (!UUID_PATTERN.test(normalized)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la UUID hop le.`,
      statusCode: 400,
    });
  }

  return normalized.toLowerCase();
}

function taoMaNgauNhien(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * MA_KY_TU.length);
    value += MA_KY_TU[randomIndex] ?? "X";
  }

  return value;
}

function taoMaBaiKiemTra(): string {
  return `EX${taoMaNgauNhien(8)}`;
}

function docMetadataTheoLoaiCauHoi(
  questionType: ClassExamQuestionType,
  rawValue: unknown,
): Record<string, unknown> {
  const base = rawValue === undefined || rawValue === null ? {} : docObject(rawValue);
  if (questionType === "multiple_choice_single") {
    const rawOptions = base.options;
    if (!Array.isArray(rawOptions)) {
      throw new AuthError({
        code: "INVALID_ANSWER_KEY",
        message: "Cau hoi multiple_choice_single bat buoc co metadata.options.",
        statusCode: 400,
      });
    }

    const options = rawOptions
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const uniqueOptions = [...new Set(options)];
    if (uniqueOptions.length < 2 || uniqueOptions.length > 8) {
      throw new AuthError({
        code: "INVALID_ANSWER_KEY",
        message: "metadata.options cua multiple_choice_single can tu 2 den 8 lua chon.",
        statusCode: 400,
      });
    }

    return {
      options: uniqueOptions,
    };
  }

  if (questionType === "short_answer") {
    const rawCaseSensitive = base.caseSensitive;
    if (rawCaseSensitive !== undefined && typeof rawCaseSensitive !== "boolean") {
      throw new AuthError({
        code: "INVALID_ANSWER_KEY",
        message: "metadata.caseSensitive chi chap nhan kieu boolean.",
        statusCode: 400,
      });
    }
    return {
      caseSensitive: rawCaseSensitive === true,
    };
  }

  if (questionType === "essay_placeholder") {
    const rawExpectedMinWords = base.expectedMinWords;
    if (rawExpectedMinWords !== undefined) {
      if (
        typeof rawExpectedMinWords !== "number" ||
        !Number.isInteger(rawExpectedMinWords) ||
        rawExpectedMinWords < 0 ||
        rawExpectedMinWords > 20000
      ) {
        throw new AuthError({
          code: "INVALID_ANSWER_KEY",
          message: "metadata.expectedMinWords khong hop le.",
          statusCode: 400,
        });
      }
    }
    return {
      expectedMinWords: typeof rawExpectedMinWords === "number" ? rawExpectedMinWords : 0,
    };
  }

  return {};
}

function taoLoiDapAnKhongHopLe(message: string): never {
  throw new AuthError({
    code: "INVALID_ANSWER_KEY",
    message,
    statusCode: 400,
  });
}

function chuanHoaAnswerKeyTheoLoaiCauHoi(
  questionType: ClassExamQuestionType,
  metadataJson: Record<string, unknown>,
  rawAnswerKey: unknown,
): AnswerKeyPayload {
  const answerData = docObject(rawAnswerKey);
  const explanationText = docChuoiTuyChon(answerData.explanationText, "explanationText", 2000);

  if (questionType === "multiple_choice_single") {
    const answerText = docChuoi(
      answerData.correctAnswerText,
      "correctAnswerText",
      1,
      200,
    );
    const options = Array.isArray(metadataJson.options)
      ? metadataJson.options.filter((item): item is string => typeof item === "string")
      : [];
    if (!options.includes(answerText)) {
      taoLoiDapAnKhongHopLe(
        "correctAnswerText phai khop mot trong cac lua chon metadata.options.",
      );
    }

    return {
      keyType: questionType,
      correctAnswerText: answerText,
      correctAnswerJson: {
        acceptedOptions: [answerText],
      },
      explanationText,
    };
  }

  if (questionType === "true_false") {
    const rawValue = answerData.correctAnswerText;
    let normalized: "true" | "false";
    if (rawValue === true) {
      normalized = "true";
    } else if (rawValue === false) {
      normalized = "false";
    } else if (typeof rawValue === "string") {
      const lowered = rawValue.trim().toLowerCase();
      if (lowered === "true" || lowered === "false") {
        normalized = lowered;
      } else {
        taoLoiDapAnKhongHopLe("correctAnswerText cua true_false chi chap nhan true hoac false.");
      }
    } else {
      taoLoiDapAnKhongHopLe("correctAnswerText cua true_false khong hop le.");
    }

    return {
      keyType: questionType,
      correctAnswerText: normalized,
      correctAnswerJson: {
        expectedBoolean: normalized === "true",
      },
      explanationText,
    };
  }

  if (questionType === "short_answer") {
    const answerText = docChuoi(
      answerData.correctAnswerText,
      "correctAnswerText",
      1,
      500,
    );
    const caseSensitive = metadataJson.caseSensitive === true;

    return {
      keyType: questionType,
      correctAnswerText: answerText,
      correctAnswerJson: {
        acceptedAnswers: [answerText],
        caseSensitive,
      },
      explanationText,
    };
  }

  return {
    keyType: questionType,
    correctAnswerText: null,
    correctAnswerJson: {
      gradingMode: "manual",
    },
    explanationText,
  };
}

export function chuanHoaTaoBaiKiemTraTheoLopPayload(payload: unknown): TaoBaiKiemTraTheoLopPayload {
  const data = docObject(payload);
  const classCode = docChuoi(data.classCode, "classCode", 4, 16).toUpperCase();
  if (!MA_LOP_PATTERN.test(classCode)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong classCode khong dung dinh dang.",
      statusCode: 400,
    });
  }

  return {
    classCode,
    title: docChuoi(data.title, "title", 3, 180),
    description: docChuoiTuyChon(data.description, "description", 1200),
    status: docStatus(data.status),
  };
}

export function chuanHoaVaoBaiKiemTraPayload(payload: unknown): VaoBaiKiemTraPayload {
  const data = docObject(payload);
  const examCode = docChuoi(data.examCode, "examCode", 6, 16).toUpperCase();
  if (!MA_BAI_KIEM_TRA_PATTERN.test(examCode)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong examCode khong dung dinh dang.",
      statusCode: 400,
    });
  }

  return {
    examCode,
  };
}

export function chuanHoaTaoCauHoiChoExamPayload(payload: unknown): TaoCauHoiChoExamPayload {
  const data = docObject(payload);
  const examCode = docChuoi(data.examCode, "examCode", 6, 16).toUpperCase();
  if (!MA_BAI_KIEM_TRA_PATTERN.test(examCode)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong examCode khong dung dinh dang.",
      statusCode: 400,
    });
  }

  const questionType = docQuestionType(data.questionType);
  const metadataJson = docMetadataTheoLoaiCauHoi(questionType, data.metadataJson);
  const answerKey = chuanHoaAnswerKeyTheoLoaiCauHoi(questionType, metadataJson, data.answerKey);

  return {
    examCode,
    questionOrder: docSoNguyenDuong(data.questionOrder, "questionOrder", 1, 5000),
    questionType,
    promptText: docChuoi(data.promptText, "promptText", 3, 5000),
    points: docSoDuong(data.points, "points", 0.1, 1000),
    metadataJson,
    answerKey,
  };
}

export function chuanHoaCapNhatCauHoiChoExamPayload(payload: unknown): CapNhatCauHoiChoExamPayload {
  const data = docObject(payload);
  const questionType = docQuestionType(data.questionType);
  const metadataJson = docMetadataTheoLoaiCauHoi(questionType, data.metadataJson);
  const answerKey = chuanHoaAnswerKeyTheoLoaiCauHoi(questionType, metadataJson, data.answerKey);

  return {
    questionOrder: docSoNguyenDuong(data.questionOrder, "questionOrder", 1, 5000),
    questionType,
    promptText: docChuoi(data.promptText, "promptText", 3, 5000),
    points: docSoDuong(data.points, "points", 0.1, 1000),
    metadataJson,
    answerKey,
  };
}

export function chuanHoaQuestionId(rawQuestionId: unknown): string {
  return docUuid(rawQuestionId, "questionId");
}

export function chuanHoaAnswerId(rawAnswerId: unknown): string {
  return docUuid(rawAnswerId, "answerId");
}

export function chuanHoaSuggestionId(rawSuggestionId: unknown): string {
  return docUuid(rawSuggestionId, "suggestionId");
}

export function chuanHoaAttemptId(rawAttemptId: unknown): string {
  return docUuid(rawAttemptId, "attemptId");
}

export function chuanHoaLuuCauTraLoiTheoAttemptPayload(
  payload: unknown,
): LuuCauTraLoiTheoAttemptPayload {
  const data = docObject(payload);
  return {
    attemptId: chuanHoaAttemptId(data.attemptId),
    questionId: chuanHoaQuestionId(data.questionId),
    answerText: docChuoiTraLoi(data.answerText, "answerText", 20000),
    answerJson: docObjectTuyChon(data.answerJson, "answerJson"),
  };
}

export function chuanHoaNopBaiKiemTraPayload(payload: unknown): NopBaiKiemTraPayload {
  const data = docObject(payload);
  return {
    attemptId: chuanHoaAttemptId(data.attemptId),
  };
}

export function chuanHoaChamTayCauEssayPayload(payload: unknown): ChamTayCauEssayPayload {
  const data = docObject(payload);
  return {
    manualAwardedPoints: docSoDuong(data.manualAwardedPoints, "manualAwardedPoints", 0, 1000),
    gradingNote: docChuoiTuyChon(data.gradingNote, "gradingNote", 4000),
  };
}

export function chuanHoaTaoGoiYChamAIChoEssayPayload(payload: unknown): TaoGoiYChamAIChoEssayPayload {
  const data = docObject(payload);
  const examCode = docChuoi(data.examCode, "examCode", 6, 16).toUpperCase();
  if (!MA_BAI_KIEM_TRA_PATTERN.test(examCode)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong examCode khong dung dinh dang.",
      statusCode: 400,
    });
  }

  return {
    examCode,
    answerId: chuanHoaAnswerId(data.answerId),
  };
}

export function chuanHoaXuLyGoiYChamAIPayload(payload: unknown): XuLyGoiYChamAIPayload {
  const data = docObject(payload);
  const action = data.action;
  if (action !== "accept" && action !== "reject") {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong action chi chap nhan accept hoac reject.",
      statusCode: 400,
    });
  }

  return {
    action,
  };
}

export async function taoBaiKiemTraTheoLop(
  token: string,
  payload: TaoBaiKiemTraTheoLopPayload,
) {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();
  const nowIso = new Date().toISOString();

  const soLanThuToiDa = 6;
  for (let soLanThu = 1; soLanThu <= soLanThuToiDa; soLanThu += 1) {
    try {
      const input: CreateClassExamInput = {
        examCode: taoMaBaiKiemTra(),
        classCode: payload.classCode,
        title: payload.title,
        description: payload.description,
        createdByUserId: verifiedSession.user.id,
        status: payload.status,
        createdAt: nowIso,
      };
      return await repository.createClassExamByTeacher(input);
    } catch (error) {
      if (error instanceof AuthError && error.code === "EXAM_CODE_ALREADY_EXISTS") {
        continue;
      }
      throw error;
    }
  }

  throw new AuthError({
    code: "EXAM_CODE_GENERATION_FAILED",
    message: "Khong tao duoc ma bai kiem tra hop le sau nhieu lan thu.",
    statusCode: 500,
  });
}

export async function lietKeBaiKiemTraDaTao(token: string): Promise<MyCreatedClassExamItem[]> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();

  return repository.listMyCreatedClassExams(verifiedSession.user.id);
}

export async function vaoBaiKiemTraTheoMa(
  token: string,
  payload: VaoBaiKiemTraPayload,
): Promise<StartClassExamResult> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layExamRepository();

  return repository.startClassExam({
    examCode: payload.examCode,
    userId: verifiedSession.user.id,
    startedAt: new Date().toISOString(),
  });
}

export async function lietKeLuotVaoBaiCuaToi(token: string): Promise<ClassExamAttemptRecord[]> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layExamRepository();

  return repository.listMyExamAttempts(verifiedSession.user.id);
}

export async function taoCauHoiChoExam(
  token: string,
  payload: TaoCauHoiChoExamPayload,
): Promise<ClassExamQuestionItemRecord> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();
  const nowIso = new Date().toISOString();
  const normalized = chuanHoaTaoCauHoiChoExamPayload(payload);

  const input: CreateExamQuestionInput = {
    examCode: normalized.examCode,
    actorUserId: verifiedSession.user.id,
    questionOrder: normalized.questionOrder,
    questionType: normalized.questionType,
    promptText: normalized.promptText,
    points: normalized.points,
    metadataJson: normalized.metadataJson,
    answerKey: normalized.answerKey,
    createdAt: nowIso,
  };

  return repository.createExamQuestion(input);
}

export async function lietKeCauHoiTheoExam(
  token: string,
  examCode: string,
): Promise<ClassExamQuestionItemRecord[]> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();

  return repository.listExamQuestionsByExamCode(examCode, verifiedSession.user.id);
}

export async function capNhatCauHoiChoExam(
  token: string,
  questionId: string,
  payload: CapNhatCauHoiChoExamPayload,
): Promise<ClassExamQuestionItemRecord> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();
  const nowIso = new Date().toISOString();
  const normalized = chuanHoaCapNhatCauHoiChoExamPayload(payload);

  const input: UpdateExamQuestionInput = {
    questionId,
    actorUserId: verifiedSession.user.id,
    questionOrder: normalized.questionOrder,
    promptText: normalized.promptText,
    points: normalized.points,
    metadataJson: normalized.metadataJson,
    answerKey: normalized.answerKey,
    updatedAt: nowIso,
  };

  return repository.updateExamQuestion(input);
}

export async function xoaCauHoiChoExam(
  token: string,
  questionId: string,
): Promise<{ deleted: true; questionId: string }> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();

  await repository.deleteExamQuestion({
    questionId,
    actorUserId: verifiedSession.user.id,
  });

  return {
    deleted: true,
    questionId,
  };
}

export async function luuCauTraLoiTheoAttempt(
  token: string,
  payload: LuuCauTraLoiTheoAttemptPayload,
): Promise<ClassExamAttemptAnswerItemRecord> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layExamRepository();
  const normalized = chuanHoaLuuCauTraLoiTheoAttemptPayload(payload);

  const input: UpsertAttemptAnswerInput = {
    attemptId: normalized.attemptId,
    questionId: normalized.questionId,
    actorUserId: verifiedSession.user.id,
    answerText: normalized.answerText,
    answerJson: normalized.answerJson,
    updatedAt: new Date().toISOString(),
  };

  return repository.upsertAttemptAnswer(input);
}

export async function lietKeCauTraLoiTheoAttempt(
  token: string,
  attemptId: string,
): Promise<ClassExamAttemptAnswerItemRecord[]> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layExamRepository();

  return repository.listAttemptAnswers({
    attemptId: chuanHoaAttemptId(attemptId),
    actorUserId: verifiedSession.user.id,
  });
}

export async function chamDiemNenChoAttempt(
  token: string,
  payload: NopBaiKiemTraPayload,
): Promise<SubmitClassExamAttemptResult> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layExamRepository();
  const normalized = chuanHoaNopBaiKiemTraPayload(payload);

  const input: SubmitClassExamAttemptInput = {
    attemptId: normalized.attemptId,
    actorUserId: verifiedSession.user.id,
    submittedAt: new Date().toISOString(),
  };

  return repository.submitClassExamAttempt(input);
}

export async function nopBaiKiemTra(
  token: string,
  payload: NopBaiKiemTraPayload,
): Promise<SubmitClassExamAttemptResult> {
  return chamDiemNenChoAttempt(token, payload);
}

export async function taiDuLieuLamBaiTheoExamCode(
  token: string,
  payload: VaoBaiKiemTraPayload,
): Promise<StudentExamPlayerRecord> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layExamRepository();

  const input: GetStudentExamPlayerInput = {
    examCode: payload.examCode,
    actorUserId: verifiedSession.user.id,
  };

  return repository.getStudentExamPlayer(input);
}

export async function taiKetQuaBaiLamTheoExamCode(
  token: string,
  payload: VaoBaiKiemTraPayload,
): Promise<StudentExamResultRecord> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layExamRepository();

  const playerData = await repository.getStudentExamPlayer({
    examCode: payload.examCode,
    actorUserId: verifiedSession.user.id,
  });

  if (!playerData.attempt) {
    return {
      exam: playerData.exam,
      attempt: null,
      summary: {
        totalQuestionCount: 0,
        answeredQuestionCount: 0,
        submitted: false,
        submittedAt: null,
        autoGradedScore: null,
        maxAutoGradableScore: null,
        finalScore: null,
        pendingManualGradingCount: 0,
      },
      reviewItems: [],
    };
  }

  const answerItems = await repository.listAttemptAnswers({
    attemptId: playerData.attempt.id,
    actorUserId: verifiedSession.user.id,
  });
  const answerByQuestionId = new Map(answerItems.map((item) => [item.question.id, item.answer]));
  const reviewItems = playerData.questions.map((question) => ({
    question,
    answer: answerByQuestionId.get(question.id) ?? null,
  }));
  const answeredQuestionCount = reviewItems.filter((item) => {
    if (!item.answer) {
      return false;
    }

    const answerText = item.answer.answerText?.trim() ?? "";
    return answerText.length > 0 || Object.keys(item.answer.answerJson).length > 0;
  }).length;

  return {
    exam: playerData.exam,
    attempt: playerData.attempt,
    summary: {
      totalQuestionCount: reviewItems.length,
      answeredQuestionCount,
      submitted: playerData.attempt.status === "submitted",
      submittedAt: playerData.attempt.submittedAt,
      autoGradedScore: playerData.attempt.autoGradedScore,
      maxAutoGradableScore: playerData.attempt.maxAutoGradedScore,
      finalScore: playerData.attempt.finalScore,
      pendingManualGradingCount: playerData.attempt.pendingManualGradingCount,
    },
    reviewItems,
  };
}

export async function lietKeCacCauEssayCanChamTheoExam(
  token: string,
  payload: VaoBaiKiemTraPayload,
): Promise<EssayManualGradingQueueItemRecord[]> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();

  const input: ListEssayAnswersForManualGradingInput = {
    examCode: payload.examCode,
    actorUserId: verifiedSession.user.id,
  };

  return repository.listEssayAnswersForManualGrading(input);
}

export async function chamTayCauEssayChoAttempt(
  token: string,
  answerId: string,
  payload: ChamTayCauEssayPayload,
): Promise<GradeEssayAttemptAnswerResult> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();
  const normalizedAnswerId = chuanHoaAnswerId(answerId);
  const normalizedPayload = chuanHoaChamTayCauEssayPayload(payload);

  const input: GradeEssayAttemptAnswerInput = {
    answerId: normalizedAnswerId,
    actorUserId: verifiedSession.user.id,
    manualAwardedPoints: normalizedPayload.manualAwardedPoints,
    gradingNote: normalizedPayload.gradingNote,
    gradedAt: new Date().toISOString(),
  };

  return repository.gradeEssayAttemptAnswer(input);
}

export async function taoGoiYChamAIChoEssay(
  token: string,
  payload: TaoGoiYChamAIChoEssayPayload,
): Promise<AiEssayGradingSuggestionItemRecord> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();
  const normalized = chuanHoaTaoGoiYChamAIChoEssayPayload(payload);

  const queue = await repository.listEssayAnswersForManualGrading({
    examCode: normalized.examCode,
    actorUserId: verifiedSession.user.id,
  });
  const target = queue.find((item) => item.answer.id === normalized.answerId);
  if (!target) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_ANSWER_NOT_FOUND",
      message: "Khong tim thay cau tra loi essay can tao goi y AI trong queue hien tai.",
      statusCode: 404,
    });
  }

  const provider = layAiEssayGradingProvider();
  const suggestion = await provider.generateEssaySuggestion({
    answer: target.answer,
    question: target.question,
    attempt: target.attempt,
  });

  return repository.createAiEssaySuggestion({
    answerId: target.answer.id,
    actorUserId: verifiedSession.user.id,
    suggestedPoints: suggestion.suggestedPoints,
    suggestedFeedback: suggestion.suggestedFeedback,
    confidenceScore: suggestion.confidenceScore,
    providerKind: suggestion.providerKind,
    modelName: suggestion.modelName,
    promptVersion: suggestion.promptVersion,
    responseJson: suggestion.responseJson,
    generatedAt: new Date().toISOString(),
  });
}

export async function lietKeGoiYChamAIChoTeacher(
  token: string,
  examCode: string,
  answerId?: string | null,
): Promise<AiEssayGradingSuggestionItemRecord[]> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();
  const normalizedPayload = chuanHoaVaoBaiKiemTraPayload({ examCode });

  return repository.listAiEssaySuggestions({
    examCode: normalizedPayload.examCode,
    actorUserId: verifiedSession.user.id,
    answerId: answerId ? chuanHoaAnswerId(answerId) : null,
  });
}

export async function chapNhanGoiYChamAI(
  token: string,
  suggestionId: string,
): Promise<ReviewAiEssaySuggestionResult> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();

  return repository.reviewAiEssaySuggestion({
    suggestionId: chuanHoaSuggestionId(suggestionId),
    actorUserId: verifiedSession.user.id,
    action: "accept",
    reviewedAt: new Date().toISOString(),
  });
}

export async function boQuaGoiYChamAI(
  token: string,
  suggestionId: string,
): Promise<ReviewAiEssaySuggestionResult> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();

  return repository.reviewAiEssaySuggestion({
    suggestionId: chuanHoaSuggestionId(suggestionId),
    actorUserId: verifiedSession.user.id,
    action: "reject",
    reviewedAt: new Date().toISOString(),
  });
}
