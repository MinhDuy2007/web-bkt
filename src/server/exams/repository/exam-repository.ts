import type {
  AiEssayGradingSuggestionItemRecord,
  AiEssayGradingSuggestionRecord,
  EssayManualGradingQueueItemRecord,
  GradeEssayAttemptAnswerResult,
  ClassExamAttemptAnswerItemRecord,
  ClassExamAnswerKeyType,
  ClassExamAttemptRecord,
  ClassExamQuestionItemRecord,
  ClassExamQuestionType,
  ClassExamRecord,
  ClassExamStatus,
  MyCreatedClassExamItem,
  ReviewAiEssaySuggestionResult,
  StartClassExamResult,
  StudentExamPlayerRecord,
  SubmitClassExamAttemptResult,
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

export type UpsertAttemptAnswerInput = {
  attemptId: string;
  questionId: string;
  actorUserId: string;
  answerText: string | null;
  answerJson: Record<string, unknown>;
  updatedAt: string;
};

export type ListAttemptAnswersInput = {
  attemptId: string;
  actorUserId: string;
};

export type SubmitClassExamAttemptInput = {
  attemptId: string;
  actorUserId: string;
  submittedAt: string;
};

export type GetStudentExamPlayerInput = {
  examCode: string;
  actorUserId: string;
};

export type ListEssayAnswersForManualGradingInput = {
  examCode: string;
  actorUserId: string;
};

export type GradeEssayAttemptAnswerInput = {
  answerId: string;
  actorUserId: string;
  manualAwardedPoints: number;
  gradingNote: string | null;
  gradedAt: string;
};

export type CreateAiEssaySuggestionInput = {
  answerId: string;
  actorUserId: string;
  suggestedPoints: number;
  suggestedFeedback: string | null;
  confidenceScore: number | null;
  providerKind: string;
  modelName: string;
  promptVersion: string | null;
  responseJson: Record<string, unknown>;
  generatedAt: string;
};

export type ListAiEssaySuggestionsInput = {
  examCode: string;
  actorUserId: string;
  answerId?: string | null;
};

export type ReviewAiEssaySuggestionInput = {
  suggestionId: string;
  actorUserId: string;
  action: "accept" | "reject";
  reviewedAt: string;
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
  upsertAttemptAnswer(input: UpsertAttemptAnswerInput): Promise<ClassExamAttemptAnswerItemRecord>;
  listAttemptAnswers(input: ListAttemptAnswersInput): Promise<ClassExamAttemptAnswerItemRecord[]>;
  submitClassExamAttempt(input: SubmitClassExamAttemptInput): Promise<SubmitClassExamAttemptResult>;
  getStudentExamPlayer(input: GetStudentExamPlayerInput): Promise<StudentExamPlayerRecord>;
  listEssayAnswersForManualGrading(
    input: ListEssayAnswersForManualGradingInput,
  ): Promise<EssayManualGradingQueueItemRecord[]>;
  gradeEssayAttemptAnswer(input: GradeEssayAttemptAnswerInput): Promise<GradeEssayAttemptAnswerResult>;
  createAiEssaySuggestion(input: CreateAiEssaySuggestionInput): Promise<AiEssayGradingSuggestionItemRecord>;
  listAiEssaySuggestions(input: ListAiEssaySuggestionsInput): Promise<AiEssayGradingSuggestionItemRecord[]>;
  reviewAiEssaySuggestion(input: ReviewAiEssaySuggestionInput): Promise<ReviewAiEssaySuggestionResult>;
  supersedePendingAiSuggestionsForAnswer(
    answerId: string,
    actorUserId: string,
    updatedAt: string,
  ): Promise<AiEssayGradingSuggestionRecord[]>;
}
