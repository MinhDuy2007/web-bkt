import type {
  ClassExamAnswerKeyType,
  ClassExamAttemptRecord,
  ClassExamQuestionItemRecord,
  ClassExamQuestionType,
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

export type AnswerKeyPayload = {
  keyType: ClassExamAnswerKeyType;
  correctAnswerText: string | null;
  correctAnswerJson: Record<string, unknown>;
  explanationText: string | null;
};

export type CreateExamQuestionInput = {
  examCode: string;
  actorUserId: string;
  questionOrder: number;
  questionType: ClassExamQuestionType;
  promptText: string;
  points: number;
  metadataJson: Record<string, unknown>;
  answerKey: AnswerKeyPayload;
  createdAt: string;
};

export type UpdateExamQuestionInput = {
  questionId: string;
  actorUserId: string;
  questionOrder: number;
  promptText: string;
  points: number;
  metadataJson: Record<string, unknown>;
  answerKey: AnswerKeyPayload;
  updatedAt: string;
};

export type DeleteExamQuestionInput = {
  questionId: string;
  actorUserId: string;
};

export interface ExamRepository {
  createClassExamByTeacher(input: CreateClassExamInput): Promise<ClassExamRecord>;
  listMyCreatedClassExams(userId: string): Promise<MyCreatedClassExamItem[]>;
  startClassExam(input: StartClassExamInput): Promise<StartClassExamResult>;
  findExamByCode(examCode: string): Promise<ClassExamRecord | null>;
  listMyExamAttempts(userId: string): Promise<ClassExamAttemptRecord[]>;
  createExamQuestion(input: CreateExamQuestionInput): Promise<ClassExamQuestionItemRecord>;
  listExamQuestionsByExamCode(
    examCode: string,
    actorUserId: string,
  ): Promise<ClassExamQuestionItemRecord[]>;
  updateExamQuestion(input: UpdateExamQuestionInput): Promise<ClassExamQuestionItemRecord>;
  deleteExamQuestion(input: DeleteExamQuestionInput): Promise<void>;
}
