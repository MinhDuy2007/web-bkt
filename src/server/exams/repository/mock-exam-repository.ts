import { randomUUID } from "node:crypto";
import { AuthError } from "@/server/auth/errors";
import {
  laThanhVienLopHocGiaLap,
  layLopHocGiaLapTheoMaLop,
} from "@/server/classes/repository/mock-classroom-repository";
import type {
  CreateExamQuestionInput,
  CreateClassExamInput,
  DeleteExamQuestionInput,
  ExamRepository,
  StartClassExamInput,
  UpdateExamQuestionInput,
} from "@/server/exams/repository/exam-repository";
import type {
  ClassExamAnswerKeyRecord,
  ClassExamAttemptRecord,
  ClassExamQuestionItemRecord,
  ClassExamQuestionRecord,
  ClassExamRecord,
  MyCreatedClassExamItem,
  StartClassExamResult,
} from "@/types/exam";

type ExamStore = {
  examsById: Map<string, ClassExamRecord>;
  examIdByExamCode: Map<string, string>;
  classCodeByExamId: Map<string, string>;
  attemptsById: Map<string, ClassExamAttemptRecord>;
  attemptIdByExamAndUser: Map<string, string>;
  questionsById: Map<string, ClassExamQuestionRecord>;
  answerKeysByQuestionId: Map<string, ClassExamAnswerKeyRecord>;
  questionIdsByExamId: Map<string, Set<string>>;
  questionIdByExamAndOrder: Map<string, string>;
};

const mockExamStore: ExamStore = {
  examsById: new Map<string, ClassExamRecord>(),
  examIdByExamCode: new Map<string, string>(),
  classCodeByExamId: new Map<string, string>(),
  attemptsById: new Map<string, ClassExamAttemptRecord>(),
  attemptIdByExamAndUser: new Map<string, string>(),
  questionsById: new Map<string, ClassExamQuestionRecord>(),
  answerKeysByQuestionId: new Map<string, ClassExamAnswerKeyRecord>(),
  questionIdsByExamId: new Map<string, Set<string>>(),
  questionIdByExamAndOrder: new Map<string, string>(),
};

function saoChep<T>(value: T): T {
  return structuredClone(value);
}

function keyExamCode(examCode: string): string {
  return examCode.trim().toUpperCase();
}

function keyAttempt(classExamId: string, userId: string): string {
  return `${classExamId}:${userId}`;
}

function keyQuestionOrder(classExamId: string, questionOrder: number): string {
  return `${classExamId}:${questionOrder}`;
}

function batBuocExamTonTai(classExamId: string): ClassExamRecord {
  const exam = mockExamStore.examsById.get(classExamId);
  if (!exam) {
    throw new AuthError({
      code: "EXAM_NOT_FOUND",
      message: "Khong tim thay bai kiem tra.",
      statusCode: 404,
    });
  }

  return exam;
}

function batBuocQuyenSuaNoiDungExam(classExamId: string, actorUserId: string): ClassExamRecord {
  const exam = batBuocExamTonTai(classExamId);
  if (exam.createdByUserId !== actorUserId) {
    throw new AuthError({
      code: "EXAM_CONTENT_PERMISSION_REQUIRED",
      message: "Tai khoan hien tai khong co quyen sua noi dung bai kiem tra.",
      statusCode: 403,
    });
  }

  return exam;
}

function batBuocQuestionTonTai(questionId: string): ClassExamQuestionRecord {
  const question = mockExamStore.questionsById.get(questionId);
  if (!question) {
    throw new AuthError({
      code: "EXAM_QUESTION_NOT_FOUND",
      message: "Khong tim thay cau hoi theo questionId.",
      statusCode: 404,
    });
  }
  return question;
}

function layDanhSachQuestionIdTheoExam(classExamId: string): Set<string> {
  let questionIds = mockExamStore.questionIdsByExamId.get(classExamId);
  if (!questionIds) {
    questionIds = new Set<string>();
    mockExamStore.questionIdsByExamId.set(classExamId, questionIds);
  }

  return questionIds;
}

function taoMockExamRepository(): ExamRepository {
  return {
    async createClassExamByTeacher(input: CreateClassExamInput): Promise<ClassExamRecord> {
      const classCode = input.classCode.trim().toUpperCase();
      const classRecord = layLopHocGiaLapTheoMaLop(classCode);
      if (!classRecord) {
        throw new AuthError({
          code: "CLASS_NOT_FOUND",
          message: "Khong tim thay lop hoc de tao bai kiem tra.",
          statusCode: 404,
        });
      }

      if (classRecord.teacherUserId !== input.createdByUserId) {
        throw new AuthError({
          code: "CLASS_OWNERSHIP_REQUIRED",
          message: "Chi giao vien so huu lop moi duoc tao bai kiem tra.",
          statusCode: 403,
        });
      }

      const examCode = keyExamCode(input.examCode);
      if (mockExamStore.examIdByExamCode.has(examCode)) {
        throw new AuthError({
          code: "EXAM_CODE_ALREADY_EXISTS",
          message: "Ma bai kiem tra da ton tai.",
          statusCode: 409,
        });
      }

      const examRecord: ClassExamRecord = {
        id: randomUUID(),
        examCode,
        classId: classRecord.id,
        title: input.title,
        description: input.description,
        createdByUserId: input.createdByUserId,
        status: input.status,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };

      mockExamStore.examsById.set(examRecord.id, examRecord);
      mockExamStore.examIdByExamCode.set(examCode, examRecord.id);
      mockExamStore.classCodeByExamId.set(examRecord.id, classCode);

      return saoChep(examRecord);
    },

    async listMyCreatedClassExams(userId: string): Promise<MyCreatedClassExamItem[]> {
      const items: MyCreatedClassExamItem[] = [];

      for (const exam of mockExamStore.examsById.values()) {
        if (exam.createdByUserId !== userId) {
          continue;
        }

        const classCode = mockExamStore.classCodeByExamId.get(exam.id) ?? "";
        const classRecord = layLopHocGiaLapTheoMaLop(classCode);
        if (!classRecord) {
          continue;
        }

        items.push({
          exam: saoChep(exam),
          classCode: classRecord.classCode,
          className: classRecord.fullClassName,
        });
      }

      return items.sort(
        (a, b) => new Date(b.exam.createdAt).getTime() - new Date(a.exam.createdAt).getTime(),
      );
    },

    async startClassExam(input: StartClassExamInput): Promise<StartClassExamResult> {
      const examId = mockExamStore.examIdByExamCode.get(keyExamCode(input.examCode));
      if (!examId) {
        throw new AuthError({
          code: "EXAM_NOT_FOUND",
          message: "Khong tim thay bai kiem tra theo ma da nhap.",
          statusCode: 404,
        });
      }

      const exam = mockExamStore.examsById.get(examId);
      if (!exam || exam.status !== "published") {
        throw new AuthError({
          code: "EXAM_NOT_AVAILABLE",
          message: "Bai kiem tra hien khong mo de vao lam.",
          statusCode: 409,
        });
      }

      if (!laThanhVienLopHocGiaLap(exam.classId, input.userId)) {
        throw new AuthError({
          code: "CLASS_MEMBERSHIP_REQUIRED",
          message: "Chi thanh vien lop moi duoc vao bai kiem tra.",
          statusCode: 403,
        });
      }

      const attemptKey = keyAttempt(exam.id, input.userId);
      if (mockExamStore.attemptIdByExamAndUser.has(attemptKey)) {
        throw new AuthError({
          code: "EXAM_ATTEMPT_ALREADY_EXISTS",
          message: "Tai khoan da co luot lam bai cho bai kiem tra nay.",
          statusCode: 409,
        });
      }

      const attempt: ClassExamAttemptRecord = {
        id: randomUUID(),
        classExamId: exam.id,
        userId: input.userId,
        status: "started",
        startedAt: input.startedAt,
        submittedAt: null,
        createdAt: input.startedAt,
        updatedAt: input.startedAt,
      };

      mockExamStore.attemptsById.set(attempt.id, attempt);
      mockExamStore.attemptIdByExamAndUser.set(attemptKey, attempt.id);

      return {
        exam: saoChep(exam),
        attempt: saoChep(attempt),
      };
    },

    async findExamByCode(examCode: string): Promise<ClassExamRecord | null> {
      const examId = mockExamStore.examIdByExamCode.get(keyExamCode(examCode));
      if (!examId) {
        return null;
      }

      const exam = mockExamStore.examsById.get(examId);
      return exam ? saoChep(exam) : null;
    },

    async listMyExamAttempts(userId: string): Promise<ClassExamAttemptRecord[]> {
      return Array.from(mockExamStore.attemptsById.values())
        .filter((item) => item.userId === userId)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .map((item) => saoChep(item));
    },

    async createExamQuestion(input: CreateExamQuestionInput): Promise<ClassExamQuestionItemRecord> {
      const examId = mockExamStore.examIdByExamCode.get(keyExamCode(input.examCode));
      if (!examId) {
        throw new AuthError({
          code: "EXAM_NOT_FOUND",
          message: "Khong tim thay bai kiem tra theo ma da nhap.",
          statusCode: 404,
        });
      }

      const exam = batBuocQuyenSuaNoiDungExam(examId, input.actorUserId);
      const orderKey = keyQuestionOrder(exam.id, input.questionOrder);
      if (mockExamStore.questionIdByExamAndOrder.has(orderKey)) {
        throw new AuthError({
          code: "EXAM_QUESTION_ORDER_CONFLICT",
          message: "questionOrder da ton tai trong bai kiem tra nay.",
          statusCode: 409,
        });
      }

      const question: ClassExamQuestionRecord = {
        id: randomUUID(),
        classExamId: exam.id,
        questionOrder: input.questionOrder,
        questionType: input.questionType,
        promptText: input.promptText,
        points: input.points,
        metadataJson: saoChep(input.metadataJson),
        createdByUserId: input.actorUserId,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };
      const answerKey: ClassExamAnswerKeyRecord = {
        id: randomUUID(),
        questionId: question.id,
        keyType: input.answerKey.keyType,
        correctAnswerText: input.answerKey.correctAnswerText,
        correctAnswerJson: saoChep(input.answerKey.correctAnswerJson),
        explanationText: input.answerKey.explanationText,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };

      mockExamStore.questionsById.set(question.id, question);
      mockExamStore.answerKeysByQuestionId.set(question.id, answerKey);
      layDanhSachQuestionIdTheoExam(exam.id).add(question.id);
      mockExamStore.questionIdByExamAndOrder.set(orderKey, question.id);

      return {
        question: saoChep(question),
        answerKey: saoChep(answerKey),
      };
    },

    async listExamQuestionsByExamCode(
      examCode: string,
      actorUserId: string,
    ): Promise<ClassExamQuestionItemRecord[]> {
      const examId = mockExamStore.examIdByExamCode.get(keyExamCode(examCode));
      if (!examId) {
        throw new AuthError({
          code: "EXAM_NOT_FOUND",
          message: "Khong tim thay bai kiem tra theo ma da nhap.",
          statusCode: 404,
        });
      }

      const exam = batBuocQuyenSuaNoiDungExam(examId, actorUserId);
      const questionIds = layDanhSachQuestionIdTheoExam(exam.id);

      const items: ClassExamQuestionItemRecord[] = [];
      for (const questionId of questionIds) {
        const question = mockExamStore.questionsById.get(questionId);
        const answerKey = mockExamStore.answerKeysByQuestionId.get(questionId);
        if (!question || !answerKey) {
          continue;
        }

        items.push({
          question: saoChep(question),
          answerKey: saoChep(answerKey),
        });
      }

      return items.sort((a, b) => a.question.questionOrder - b.question.questionOrder);
    },

    async updateExamQuestion(input: UpdateExamQuestionInput): Promise<ClassExamQuestionItemRecord> {
      const currentQuestion = batBuocQuestionTonTai(input.questionId);
      const exam = batBuocQuyenSuaNoiDungExam(currentQuestion.classExamId, input.actorUserId);
      const currentOrderKey = keyQuestionOrder(exam.id, currentQuestion.questionOrder);
      const nextOrderKey = keyQuestionOrder(exam.id, input.questionOrder);
      const conflictingQuestionId = mockExamStore.questionIdByExamAndOrder.get(nextOrderKey);
      if (conflictingQuestionId && conflictingQuestionId !== currentQuestion.id) {
        throw new AuthError({
          code: "EXAM_QUESTION_ORDER_CONFLICT",
          message: "questionOrder da ton tai trong bai kiem tra nay.",
          statusCode: 409,
        });
      }

      const updatedQuestion: ClassExamQuestionRecord = {
        ...currentQuestion,
        questionOrder: input.questionOrder,
        promptText: input.promptText,
        points: input.points,
        metadataJson: saoChep(input.metadataJson),
        updatedAt: input.updatedAt,
      };
      const currentAnswerKey = mockExamStore.answerKeysByQuestionId.get(input.questionId);
      if (!currentAnswerKey) {
        throw new AuthError({
          code: "EXAM_QUESTION_NOT_FOUND",
          message: "Khong tim thay dap an cua cau hoi.",
          statusCode: 404,
        });
      }

      const updatedAnswerKey: ClassExamAnswerKeyRecord = {
        ...currentAnswerKey,
        keyType: input.answerKey.keyType,
        correctAnswerText: input.answerKey.correctAnswerText,
        correctAnswerJson: saoChep(input.answerKey.correctAnswerJson),
        explanationText: input.answerKey.explanationText,
        updatedAt: input.updatedAt,
      };

      mockExamStore.questionsById.set(updatedQuestion.id, updatedQuestion);
      mockExamStore.answerKeysByQuestionId.set(updatedQuestion.id, updatedAnswerKey);
      if (currentOrderKey !== nextOrderKey) {
        mockExamStore.questionIdByExamAndOrder.delete(currentOrderKey);
        mockExamStore.questionIdByExamAndOrder.set(nextOrderKey, updatedQuestion.id);
      }

      return {
        question: saoChep(updatedQuestion),
        answerKey: saoChep(updatedAnswerKey),
      };
    },

    async deleteExamQuestion(input: DeleteExamQuestionInput): Promise<void> {
      const question = batBuocQuestionTonTai(input.questionId);
      batBuocQuyenSuaNoiDungExam(question.classExamId, input.actorUserId);

      mockExamStore.questionsById.delete(question.id);
      mockExamStore.answerKeysByQuestionId.delete(question.id);
      mockExamStore.questionIdByExamAndOrder.delete(
        keyQuestionOrder(question.classExamId, question.questionOrder),
      );
      layDanhSachQuestionIdTheoExam(question.classExamId).delete(question.id);
    },
  };
}

let cachedMockExamRepository: ExamRepository | null = null;

export function datLaiKhoBaiKiemTraGiaLap(): void {
  mockExamStore.examsById.clear();
  mockExamStore.examIdByExamCode.clear();
  mockExamStore.classCodeByExamId.clear();
  mockExamStore.attemptsById.clear();
  mockExamStore.attemptIdByExamAndUser.clear();
  mockExamStore.questionsById.clear();
  mockExamStore.answerKeysByQuestionId.clear();
  mockExamStore.questionIdsByExamId.clear();
  mockExamStore.questionIdByExamAndOrder.clear();
}

export function layMockExamRepository(): ExamRepository {
  if (!cachedMockExamRepository) {
    cachedMockExamRepository = taoMockExamRepository();
  }

  return cachedMockExamRepository;
}
