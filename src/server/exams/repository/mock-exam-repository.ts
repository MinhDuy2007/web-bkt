import { randomUUID } from "node:crypto";
import { AuthError } from "@/server/auth/errors";
import { layAuthRepository } from "@/server/auth/repository";
import {
  laThanhVienLopHocGiaLap,
  layLopHocGiaLapTheoMaLop,
} from "@/server/classes/repository/mock-classroom-repository";
import { chamDiemNenChoCauHoi, lamTronDiemNen } from "@/server/exams/scoring";
import type {
  CreateClassExamInput,
  CreateExamQuestionInput,
  DeleteExamQuestionInput,
  ExamRepository,
  GradeEssayAttemptAnswerInput,
  GetStudentExamPlayerInput,
  ListEssayAnswersForManualGradingInput,
  ListAttemptAnswersInput,
  SubmitClassExamAttemptInput,
  StartClassExamInput,
  UpsertAttemptAnswerInput,
  UpdateExamQuestionInput,
} from "@/server/exams/repository/exam-repository";
import type {
  ClassExamAttemptAnswerItemRecord,
  ClassExamAttemptAnswerRecord,
  ClassExamAnswerKeyRecord,
  ClassExamAttemptRecord,
  ClassExamQuestionItemRecord,
  ClassExamQuestionRecord,
  ClassExamRecord,
  EssayManualGradingQueueItemRecord,
  GradeEssayAttemptAnswerResult,
  MyCreatedClassExamItem,
  StartClassExamResult,
  StudentExamPlayerRecord,
  SubmitClassExamAttemptResult,
} from "@/types/exam";

type ExamStore = {
  examsById: Map<string, ClassExamRecord>;
  examIdByExamCode: Map<string, string>;
  classCodeByExamId: Map<string, string>;
  attemptsById: Map<string, ClassExamAttemptRecord>;
  attemptIdByExamAndUser: Map<string, string>;
  questionsById: Map<string, ClassExamQuestionRecord>;
  answerKeysByQuestionId: Map<string, ClassExamAnswerKeyRecord>;
  attemptAnswersById: Map<string, ClassExamAttemptAnswerRecord>;
  attemptAnswerIdByAttemptAndQuestion: Map<string, string>;
  attemptAnswerIdsByAttemptId: Map<string, Set<string>>;
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
  attemptAnswersById: new Map<string, ClassExamAttemptAnswerRecord>(),
  attemptAnswerIdByAttemptAndQuestion: new Map<string, string>(),
  attemptAnswerIdsByAttemptId: new Map<string, Set<string>>(),
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

function keyAttemptQuestion(attemptId: string, questionId: string): string {
  return `${attemptId}:${questionId}`;
}

function keyQuestionOrder(classExamId: string, questionOrder: number): string {
  return `${classExamId}:${questionOrder}`;
}

function layDanhSachAnswerIdTheoAttempt(attemptId: string): Set<string> {
  let answerIds = mockExamStore.attemptAnswerIdsByAttemptId.get(attemptId);
  if (!answerIds) {
    answerIds = new Set<string>();
    mockExamStore.attemptAnswerIdsByAttemptId.set(attemptId, answerIds);
  }

  return answerIds;
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

function batBuocAttemptTonTai(attemptId: string): ClassExamAttemptRecord {
  const attempt = mockExamStore.attemptsById.get(attemptId);
  if (!attempt) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_NOT_FOUND",
      message: "Khong tim thay luot lam bai theo attemptId.",
      statusCode: 404,
    });
  }

  return attempt;
}

function batBuocQuyenTruyCapAttempt(attemptId: string, actorUserId: string): ClassExamAttemptRecord {
  const attempt = batBuocAttemptTonTai(attemptId);
  if (attempt.userId !== actorUserId) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_PERMISSION_REQUIRED",
      message: "Tai khoan hien tai khong duoc thao tac tren attempt nay.",
      statusCode: 403,
    });
  }

  return attempt;
}

function coCauTraLoiTextHopLe(answer: ClassExamAttemptAnswerRecord | null): boolean {
  return typeof answer?.answerText === "string" && answer.answerText.trim().length > 0;
}

function batBuocQuestionEssay(questionId: string): ClassExamQuestionRecord {
  const question = batBuocQuestionTonTai(questionId);
  if (question.questionType !== "essay_placeholder") {
    throw new AuthError({
      code: "ESSAY_MANUAL_GRADING_ONLY",
      message: "Chi cau essay_placeholder moi duoc cham tay trong task nay.",
      statusCode: 400,
    });
  }

  return question;
}

function batBuocQuyenChamTayEssay(question: ClassExamQuestionRecord, actorUserId: string): void {
  batBuocQuyenSuaNoiDungExam(question.classExamId, actorUserId);
}

function tinhTongKetAttemptSauChamTay(attemptId: string): {
  finalScore: number | null;
  pendingManualGradingCount: number;
} {
  const attempt = batBuocAttemptTonTai(attemptId);
  const questionIds = layDanhSachQuestionIdTheoExam(attempt.classExamId);
  let finalScore = 0;
  let pendingManualGradingCount = 0;

  for (const questionId of questionIds) {
    const question = mockExamStore.questionsById.get(questionId);
    if (!question) {
      continue;
    }

    const answerId = mockExamStore.attemptAnswerIdByAttemptAndQuestion.get(
      keyAttemptQuestion(attempt.id, question.id),
    );
    const answer = answerId ? (mockExamStore.attemptAnswersById.get(answerId) ?? null) : null;
    finalScore += answer?.awardedPoints ?? 0;

    if (
      question.questionType === "essay_placeholder" &&
      coCauTraLoiTextHopLe(answer) &&
      answer?.manualAwardedPoints === null
    ) {
      pendingManualGradingCount += 1;
    }
  }

  return {
    finalScore: pendingManualGradingCount === 0 ? lamTronDiemNen(finalScore) : null,
    pendingManualGradingCount,
  };
}

function batBuocAttemptChuaNop(attempt: ClassExamAttemptRecord): void {
  if (attempt.status !== "started") {
    throw new AuthError({
      code: "EXAM_ATTEMPT_ALREADY_SUBMITTED",
      message: "Attempt da nop bai, khong duoc sua cau tra loi.",
      statusCode: 409,
    });
  }
}

function layDanhSachQuestionIdTheoExam(classExamId: string): Set<string> {
  let questionIds = mockExamStore.questionIdsByExamId.get(classExamId);
  if (!questionIds) {
    questionIds = new Set<string>();
    mockExamStore.questionIdsByExamId.set(classExamId, questionIds);
  }

  return questionIds;
}

async function taoThongTinHocSinh(userId: string): Promise<{
  userId: string;
  email: string | null;
  displayName: string | null;
}> {
  const authRepository = layAuthRepository();
  const [account, profile] = await Promise.all([
    authRepository.findUserById(userId),
    authRepository.findProfileByUserId(userId),
  ]);

  return {
    userId,
    email: account?.email ?? null,
    displayName: profile?.displayName ?? null,
  };
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
        autoGradedScore: null,
        maxAutoGradedScore: null,
        finalScore: null,
        pendingManualGradingCount: 0,
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

    async getStudentExamPlayer(input: GetStudentExamPlayerInput): Promise<StudentExamPlayerRecord> {
      const examId = mockExamStore.examIdByExamCode.get(keyExamCode(input.examCode));
      if (!examId) {
        throw new AuthError({
          code: "EXAM_NOT_FOUND",
          message: "Khong tim thay bai kiem tra theo ma da nhap.",
          statusCode: 404,
        });
      }

      const exam = batBuocExamTonTai(examId);
      if (!laThanhVienLopHocGiaLap(exam.classId, input.actorUserId)) {
        throw new AuthError({
          code: "CLASS_MEMBERSHIP_REQUIRED",
          message: "Chi thanh vien lop moi duoc truy cap bai kiem tra nay.",
          statusCode: 403,
        });
      }

      const attemptId = mockExamStore.attemptIdByExamAndUser.get(keyAttempt(exam.id, input.actorUserId));
      const attempt = attemptId ? (mockExamStore.attemptsById.get(attemptId) ?? null) : null;
      if (!attempt) {
        if (exam.status !== "published") {
          throw new AuthError({
            code: "EXAM_NOT_AVAILABLE",
            message: "Bai kiem tra hien khong mo de vao lam.",
            statusCode: 409,
          });
        }

        return {
          exam: {
            id: exam.id,
            examCode: exam.examCode,
            title: exam.title,
            description: exam.description,
            status: exam.status,
          },
          attempt: null,
          questions: [],
          answers: [],
          canStart: true,
          isLocked: false,
        };
      }

      const questionIds = layDanhSachQuestionIdTheoExam(exam.id);
      const questions = Array.from(questionIds)
        .map((questionId) => mockExamStore.questionsById.get(questionId))
        .filter((item): item is ClassExamQuestionRecord => Boolean(item))
        .sort((a, b) => a.questionOrder - b.questionOrder)
        .map((item) => saoChep(item));
      const answerIds = layDanhSachAnswerIdTheoAttempt(attempt.id);
      const answers = Array.from(answerIds)
        .map((answerId) => mockExamStore.attemptAnswersById.get(answerId))
        .filter((item): item is ClassExamAttemptAnswerRecord => Boolean(item))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((item) => saoChep(item));

      return {
        exam: {
          id: exam.id,
          examCode: exam.examCode,
          title: exam.title,
          description: exam.description,
          status: exam.status,
        },
        attempt: saoChep(attempt),
        questions,
        answers,
        canStart: false,
        isLocked: attempt.status === "submitted",
      };
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
      for (const attemptId of mockExamStore.attemptsById.keys()) {
        const answerKey = keyAttemptQuestion(attemptId, question.id);
        const answerId = mockExamStore.attemptAnswerIdByAttemptAndQuestion.get(answerKey);
        if (!answerId) {
          continue;
        }
        mockExamStore.attemptAnswerIdByAttemptAndQuestion.delete(answerKey);
        mockExamStore.attemptAnswersById.delete(answerId);
        layDanhSachAnswerIdTheoAttempt(attemptId).delete(answerId);
      }
      mockExamStore.questionIdByExamAndOrder.delete(
        keyQuestionOrder(question.classExamId, question.questionOrder),
      );
      layDanhSachQuestionIdTheoExam(question.classExamId).delete(question.id);
    },

    async upsertAttemptAnswer(
      input: UpsertAttemptAnswerInput,
    ): Promise<ClassExamAttemptAnswerItemRecord> {
      const attempt = batBuocQuyenTruyCapAttempt(input.attemptId, input.actorUserId);
      batBuocAttemptChuaNop(attempt);

      const question = batBuocQuestionTonTai(input.questionId);
      if (question.classExamId !== attempt.classExamId) {
        throw new AuthError({
          code: "EXAM_ATTEMPT_QUESTION_MISMATCH",
          message: "questionId khong thuoc bai kiem tra cua attempt.",
          statusCode: 400,
        });
      }

      const lookupKey = keyAttemptQuestion(input.attemptId, input.questionId);
      const existingAnswerId = mockExamStore.attemptAnswerIdByAttemptAndQuestion.get(lookupKey);
      const nowIso = input.updatedAt;

      if (existingAnswerId) {
        const existing = mockExamStore.attemptAnswersById.get(existingAnswerId);
        if (!existing) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "Kho gia lap bi sai lien ket answer.",
            statusCode: 500,
          });
        }

        const updated: ClassExamAttemptAnswerRecord = {
          ...existing,
          answerText: input.answerText,
          answerJson: saoChep(input.answerJson),
          awardedPoints: null,
          manualAwardedPoints: null,
          gradingNote: null,
          gradedBy: null,
          gradedAt: null,
          scoredAt: null,
          updatedAt: nowIso,
        };
        mockExamStore.attemptAnswersById.set(updated.id, updated);
        return {
          answer: saoChep(updated),
          question: saoChep(question),
        };
      }

      const created: ClassExamAttemptAnswerRecord = {
        id: randomUUID(),
        attemptId: input.attemptId,
        questionId: input.questionId,
        answerText: input.answerText,
        answerJson: saoChep(input.answerJson),
        awardedPoints: null,
        manualAwardedPoints: null,
        gradingNote: null,
        gradedBy: null,
        gradedAt: null,
        scoredAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      mockExamStore.attemptAnswersById.set(created.id, created);
      mockExamStore.attemptAnswerIdByAttemptAndQuestion.set(lookupKey, created.id);
      layDanhSachAnswerIdTheoAttempt(input.attemptId).add(created.id);

      return {
        answer: saoChep(created),
        question: saoChep(question),
      };
    },

    async listAttemptAnswers(
      input: ListAttemptAnswersInput,
    ): Promise<ClassExamAttemptAnswerItemRecord[]> {
      const attempt = batBuocQuyenTruyCapAttempt(input.attemptId, input.actorUserId);
      const answerIds = layDanhSachAnswerIdTheoAttempt(attempt.id);
      const items: ClassExamAttemptAnswerItemRecord[] = [];
      for (const answerId of answerIds) {
        const answer = mockExamStore.attemptAnswersById.get(answerId);
        if (!answer) {
          continue;
        }
        const question = mockExamStore.questionsById.get(answer.questionId);
        if (!question || question.classExamId !== attempt.classExamId) {
          continue;
        }
        items.push({
          answer: saoChep(answer),
          question: saoChep(question),
        });
      }

      return items.sort((a, b) => a.question.questionOrder - b.question.questionOrder);
    },

    async submitClassExamAttempt(
      input: SubmitClassExamAttemptInput,
    ): Promise<SubmitClassExamAttemptResult> {
      const attempt = batBuocQuyenTruyCapAttempt(input.attemptId, input.actorUserId);
      batBuocAttemptChuaNop(attempt);

      const questionIds = layDanhSachQuestionIdTheoExam(attempt.classExamId);
      let awardedScore = 0;
      let maxAutoGradableScore = 0;
      let pendingManualGradingCount = 0;
      let autoGradedQuestionCount = 0;
      let answeredQuestionCount = 0;

      for (const questionId of questionIds) {
        const question = mockExamStore.questionsById.get(questionId);
        const answerKey = mockExamStore.answerKeysByQuestionId.get(questionId);
        if (!question || !answerKey) {
          continue;
        }

        const attemptQuestionKey = keyAttemptQuestion(attempt.id, question.id);
        const answerId = mockExamStore.attemptAnswerIdByAttemptAndQuestion.get(attemptQuestionKey);
        const answer = answerId ? (mockExamStore.attemptAnswersById.get(answerId) ?? null) : null;
        if (answer) {
          answeredQuestionCount += 1;
        }

        const ketQuaCham = chamDiemNenChoCauHoi(question, answerKey, answer);
        awardedScore += ketQuaCham.awardedPoints;
        maxAutoGradableScore += ketQuaCham.maxAutoPoints;
        if (ketQuaCham.laCauChamTuDong) {
          autoGradedQuestionCount += 1;
        }
        if (ketQuaCham.laCauTuLuanChoChamTay && coCauTraLoiTextHopLe(answer)) {
          pendingManualGradingCount += 1;
        }

        if (answer) {
          const updatedAnswer: ClassExamAttemptAnswerRecord = {
            ...answer,
            awardedPoints: lamTronDiemNen(ketQuaCham.awardedPoints),
            scoredAt: input.submittedAt,
            updatedAt: input.submittedAt,
          };
          mockExamStore.attemptAnswersById.set(updatedAnswer.id, updatedAnswer);
        }
      }

      const updatedAttempt: ClassExamAttemptRecord = {
        ...attempt,
        status: "submitted",
        submittedAt: input.submittedAt,
        autoGradedScore: lamTronDiemNen(awardedScore),
        maxAutoGradedScore: lamTronDiemNen(maxAutoGradableScore),
        finalScore:
          pendingManualGradingCount === 0 ? lamTronDiemNen(awardedScore) : null,
        pendingManualGradingCount,
        updatedAt: input.submittedAt,
      };
      mockExamStore.attemptsById.set(updatedAttempt.id, updatedAttempt);

      return {
        attempt: saoChep(updatedAttempt),
        scoreSummary: {
          awardedScore: lamTronDiemNen(awardedScore),
          maxAutoGradableScore: lamTronDiemNen(maxAutoGradableScore),
          pendingManualGradingCount,
          autoGradedQuestionCount,
          answeredQuestionCount,
          totalQuestionCount: questionIds.size,
        },
      };
    },

    async listEssayAnswersForManualGrading(
      input: ListEssayAnswersForManualGradingInput,
    ): Promise<EssayManualGradingQueueItemRecord[]> {
      const examId = mockExamStore.examIdByExamCode.get(keyExamCode(input.examCode));
      if (!examId) {
        throw new AuthError({
          code: "EXAM_NOT_FOUND",
          message: "Khong tim thay bai kiem tra theo ma da nhap.",
          statusCode: 404,
        });
      }

      batBuocQuyenSuaNoiDungExam(examId, input.actorUserId);

      const items: EssayManualGradingQueueItemRecord[] = [];
      const questionIds = Array.from(layDanhSachQuestionIdTheoExam(examId))
        .map((questionId) => mockExamStore.questionsById.get(questionId))
        .filter(
          (question): question is ClassExamQuestionRecord =>
            question !== undefined && question.questionType === "essay_placeholder",
        )
        .sort((a, b) => a.questionOrder - b.questionOrder);

      for (const question of questionIds) {
        for (const attempt of mockExamStore.attemptsById.values()) {
          if (attempt.classExamId !== examId || attempt.status !== "submitted") {
            continue;
          }

          const answerId = mockExamStore.attemptAnswerIdByAttemptAndQuestion.get(
            keyAttemptQuestion(attempt.id, question.id),
          );
          if (!answerId) {
            continue;
          }

          const answer = mockExamStore.attemptAnswersById.get(answerId);
          if (!answer || !coCauTraLoiTextHopLe(answer) || answer.manualAwardedPoints !== null) {
            continue;
          }

          items.push({
            answer: saoChep(answer),
            question: saoChep(question),
            attempt: saoChep(attempt),
            student: await taoThongTinHocSinh(attempt.userId),
          });
        }
      }

      return items.sort((a, b) => {
        const submittedDiff =
          new Date(a.attempt.submittedAt ?? a.attempt.updatedAt).getTime() -
          new Date(b.attempt.submittedAt ?? b.attempt.updatedAt).getTime();
        if (submittedDiff !== 0) {
          return submittedDiff;
        }

        return a.question.questionOrder - b.question.questionOrder;
      });
    },

    async gradeEssayAttemptAnswer(
      input: GradeEssayAttemptAnswerInput,
    ): Promise<GradeEssayAttemptAnswerResult> {
      const answer = mockExamStore.attemptAnswersById.get(input.answerId);
      if (!answer) {
        throw new AuthError({
          code: "EXAM_ATTEMPT_ANSWER_NOT_FOUND",
          message: "Khong tim thay cau tra loi can cham tay.",
          statusCode: 404,
        });
      }

      const question = batBuocQuestionEssay(answer.questionId);
      batBuocQuyenChamTayEssay(question, input.actorUserId);

      const attempt = batBuocAttemptTonTai(answer.attemptId);
      if (attempt.status !== "submitted") {
        throw new AuthError({
          code: "EXAM_ATTEMPT_NOT_SUBMITTED",
          message: "Chi duoc cham tay sau khi hoc sinh da nop bai.",
          statusCode: 409,
        });
      }

      if (!coCauTraLoiTextHopLe(answer)) {
        throw new AuthError({
          code: "ESSAY_ANSWER_EMPTY",
          message: "Khong the cham tay khi cau tu luan chua co noi dung tra loi.",
          statusCode: 400,
        });
      }

      if (input.manualAwardedPoints < 0 || input.manualAwardedPoints > question.points) {
        throw new AuthError({
          code: "INVALID_INPUT",
          message: "Diem cham tay phai nam trong khoang 0 den diem toi da cua cau hoi.",
          statusCode: 400,
        });
      }

      const updatedAnswer: ClassExamAttemptAnswerRecord = {
        ...answer,
        awardedPoints: lamTronDiemNen(input.manualAwardedPoints),
        manualAwardedPoints: lamTronDiemNen(input.manualAwardedPoints),
        gradingNote: input.gradingNote,
        gradedBy: input.actorUserId,
        gradedAt: input.gradedAt,
        scoredAt: input.gradedAt,
        updatedAt: input.gradedAt,
      };
      mockExamStore.attemptAnswersById.set(updatedAnswer.id, updatedAnswer);

      const tongKet = tinhTongKetAttemptSauChamTay(attempt.id);
      const updatedAttempt: ClassExamAttemptRecord = {
        ...attempt,
        finalScore: tongKet.finalScore,
        pendingManualGradingCount: tongKet.pendingManualGradingCount,
        updatedAt: input.gradedAt,
      };
      mockExamStore.attemptsById.set(updatedAttempt.id, updatedAttempt);

      return {
        answer: saoChep(updatedAnswer),
        question: saoChep(question),
        attempt: saoChep(updatedAttempt),
      };
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
  mockExamStore.attemptAnswersById.clear();
  mockExamStore.attemptAnswerIdByAttemptAndQuestion.clear();
  mockExamStore.attemptAnswerIdsByAttemptId.clear();
  mockExamStore.questionIdsByExamId.clear();
  mockExamStore.questionIdByExamAndOrder.clear();
}

export function layMockExamRepository(): ExamRepository {
  if (!cachedMockExamRepository) {
    cachedMockExamRepository = taoMockExamRepository();
  }

  return cachedMockExamRepository;
}
