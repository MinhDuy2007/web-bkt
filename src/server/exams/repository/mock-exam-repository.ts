import { randomUUID } from "node:crypto";
import { AuthError } from "@/server/auth/errors";
import {
  laThanhVienLopHocGiaLap,
  layLopHocGiaLapTheoMaLop,
} from "@/server/classes/repository/mock-classroom-repository";
import type {
  CreateClassExamInput,
  ExamRepository,
  StartClassExamInput,
} from "@/server/exams/repository/exam-repository";
import type {
  ClassExamAttemptRecord,
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
};

const mockExamStore: ExamStore = {
  examsById: new Map<string, ClassExamRecord>(),
  examIdByExamCode: new Map<string, string>(),
  classCodeByExamId: new Map<string, string>(),
  attemptsById: new Map<string, ClassExamAttemptRecord>(),
  attemptIdByExamAndUser: new Map<string, string>(),
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
  };
}

let cachedMockExamRepository: ExamRepository | null = null;

export function datLaiKhoBaiKiemTraGiaLap(): void {
  mockExamStore.examsById.clear();
  mockExamStore.examIdByExamCode.clear();
  mockExamStore.classCodeByExamId.clear();
  mockExamStore.attemptsById.clear();
  mockExamStore.attemptIdByExamAndUser.clear();
}

export function layMockExamRepository(): ExamRepository {
  if (!cachedMockExamRepository) {
    cachedMockExamRepository = taoMockExamRepository();
  }

  return cachedMockExamRepository;
}
