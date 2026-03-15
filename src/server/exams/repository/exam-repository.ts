import type {
  ClassExamAttemptRecord,
  ClassExamRecord,
  ClassExamStatus,
  MyCreatedClassExamItem,
  StartClassExamResult,
} from "@/types/exam";

export type CreateClassExamInput = {
  examCode: string;
  classCode: string;
  title: string;
  description: string | null;
  createdByUserId: string;
  status: ClassExamStatus;
  createdAt: string;
};

export type StartClassExamInput = {
  examCode: string;
  userId: string;
  startedAt: string;
};

export interface ExamRepository {
  createClassExamByTeacher(input: CreateClassExamInput): Promise<ClassExamRecord>;
  listMyCreatedClassExams(userId: string): Promise<MyCreatedClassExamItem[]>;
  startClassExam(input: StartClassExamInput): Promise<StartClassExamResult>;
  findExamByCode(examCode: string): Promise<ClassExamRecord | null>;
  listMyExamAttempts(userId: string): Promise<ClassExamAttemptRecord[]>;
}
