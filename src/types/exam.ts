export const CLASS_EXAM_STATUSES = ["draft", "published", "archived"] as const;
export type ClassExamStatus = (typeof CLASS_EXAM_STATUSES)[number];

export const CLASS_EXAM_ATTEMPT_STATUSES = ["started", "submitted"] as const;
export type ClassExamAttemptStatus = (typeof CLASS_EXAM_ATTEMPT_STATUSES)[number];

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
