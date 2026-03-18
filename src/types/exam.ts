export const CLASS_EXAM_STATUSES = ["draft", "published", "archived"] as const;
export type ClassExamStatus = (typeof CLASS_EXAM_STATUSES)[number];

export const CLASS_EXAM_ATTEMPT_STATUSES = ["started", "submitted"] as const;
export type ClassExamAttemptStatus = (typeof CLASS_EXAM_ATTEMPT_STATUSES)[number];

export const CLASS_EXAM_QUESTION_TYPES = [
  "multiple_choice_single",
  "true_false",
  "short_answer",
  "essay_placeholder",
] as const;
export type ClassExamQuestionType = (typeof CLASS_EXAM_QUESTION_TYPES)[number];

export const CLASS_EXAM_ANSWER_KEY_TYPES = CLASS_EXAM_QUESTION_TYPES;
export type ClassExamAnswerKeyType = ClassExamQuestionType;

export const AI_GRADING_SUGGESTION_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "superseded",
] as const;
export type AiGradingSuggestionStatus = (typeof AI_GRADING_SUGGESTION_STATUSES)[number];

export const AI_GRADING_USAGE_LOG_STATUSES = ["succeeded", "failed", "timeout"] as const;
export type AiGradingUsageLogStatus = (typeof AI_GRADING_USAGE_LOG_STATUSES)[number];

export type ClassExamRecord = {
  id: string;
  examCode: string;
  classId: string;
  title: string;
  description: string | null;
  createdByUserId: string;
  status: ClassExamStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClassExamAttemptRecord = {
  id: string;
  classExamId: string;
  userId: string;
  status: ClassExamAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  autoGradedScore: number | null;
  maxAutoGradedScore: number | null;
  finalScore: number | null;
  pendingManualGradingCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MyCreatedClassExamItem = {
  exam: ClassExamRecord;
  classCode: string;
  className: string;
};

export type StartClassExamResult = {
  exam: ClassExamRecord;
  attempt: ClassExamAttemptRecord;
};

export type ClassExamAttemptAnswerRecord = {
  id: string;
  attemptId: string;
  questionId: string;
  answerText: string | null;
  answerJson: Record<string, unknown>;
  awardedPoints: number | null;
  manualAwardedPoints: number | null;
  gradingNote: string | null;
  gradedBy: string | null;
  gradedAt: string | null;
  scoredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClassExamQuestionRecord = {
  id: string;
  classExamId: string;
  questionOrder: number;
  questionType: ClassExamQuestionType;
  promptText: string;
  points: number;
  metadataJson: Record<string, unknown>;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassExamAnswerKeyRecord = {
  id: string;
  questionId: string;
  keyType: ClassExamAnswerKeyType;
  correctAnswerText: string | null;
  correctAnswerJson: Record<string, unknown>;
  explanationText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClassExamQuestionItemRecord = {
  question: ClassExamQuestionRecord;
  answerKey: ClassExamAnswerKeyRecord;
};

export type ClassExamAttemptAnswerItemRecord = {
  answer: ClassExamAttemptAnswerRecord;
  question: ClassExamQuestionRecord;
};

export type ClassExamPlayerExamRecord = {
  id: string;
  examCode: string;
  title: string;
  description: string | null;
  status: ClassExamStatus;
};

export type StudentExamPlayerRecord = {
  exam: ClassExamPlayerExamRecord;
  attempt: ClassExamAttemptRecord | null;
  questions: ClassExamQuestionRecord[];
  answers: ClassExamAttemptAnswerRecord[];
  canStart: boolean;
  isLocked: boolean;
};

export type StudentExamReviewItemRecord = {
  question: ClassExamQuestionRecord;
  answer: ClassExamAttemptAnswerRecord | null;
};

export type StudentExamResultRecord = {
  exam: ClassExamPlayerExamRecord;
  attempt: ClassExamAttemptRecord | null;
  summary: {
    totalQuestionCount: number;
    answeredQuestionCount: number;
    submitted: boolean;
    submittedAt: string | null;
    autoGradedScore: number | null;
    maxAutoGradableScore: number | null;
    finalScore: number | null;
    pendingManualGradingCount: number;
  };
  reviewItems: StudentExamReviewItemRecord[];
};

export type EssayManualGradingQueueItemRecord = {
  answer: ClassExamAttemptAnswerRecord;
  question: ClassExamQuestionRecord;
  attempt: ClassExamAttemptRecord;
  student: {
    userId: string;
    email: string | null;
    displayName: string | null;
  };
};

export type GradeEssayAttemptAnswerResult = {
  answer: ClassExamAttemptAnswerRecord;
  question: ClassExamQuestionRecord;
  attempt: ClassExamAttemptRecord;
};

export type AiEssayGradingSuggestionRecord = {
  id: string;
  answerId: string;
  suggestedPoints: number;
  suggestedFeedback: string | null;
  confidenceScore: number | null;
  providerKind: string;
  modelName: string;
  promptVersion: string | null;
  status: AiGradingSuggestionStatus;
  responseJson: Record<string, unknown>;
  generatedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiEssayGradingSuggestionItemRecord = {
  suggestion: AiEssayGradingSuggestionRecord;
  answer: ClassExamAttemptAnswerRecord;
  question: ClassExamQuestionRecord;
  attempt: ClassExamAttemptRecord;
  student: {
    userId: string;
    email: string | null;
    displayName: string | null;
  };
};

export type ReviewAiEssaySuggestionResult = {
  suggestion: AiEssayGradingSuggestionRecord;
  answer: ClassExamAttemptAnswerRecord;
  question: ClassExamQuestionRecord;
  attempt: ClassExamAttemptRecord;
};

export type AiGradingUsageLogRecord = {
  id: string;
  answerId: string;
  suggestionId: string | null;
  actorUserId: string | null;
  providerKind: string;
  modelName: string;
  promptVersion: string | null;
  requestStatus: AiGradingUsageLogStatus;
  errorCode: string | null;
  latencyMs: number | null;
  metadataJson: Record<string, unknown>;
  createdAt: string;
};

export type SubmitClassExamAttemptResult = {
  attempt: ClassExamAttemptRecord;
  scoreSummary: {
    awardedScore: number;
    maxAutoGradableScore: number;
    pendingManualGradingCount: number;
    autoGradedQuestionCount: number;
    answeredQuestionCount: number;
    totalQuestionCount: number;
  };
};
