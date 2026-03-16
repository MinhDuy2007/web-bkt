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
