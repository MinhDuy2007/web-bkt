import { AuthError } from "@/server/auth/errors";
import { layPostgresPool } from "@/server/db/postgres-pool";
import type {
  CreateAiEssaySuggestionInput,
  CreateClassExamInput,
  CreateExamQuestionInput,
  DeleteExamQuestionInput,
  ExamRepository,
  GradeEssayAttemptAnswerInput,
  GetStudentExamPlayerInput,
  ListAiEssaySuggestionsInput,
  ListEssayAnswersForManualGradingInput,
  ListAttemptAnswersInput,
  ReviewAiEssaySuggestionInput,
  SubmitClassExamAttemptInput,
  StartClassExamInput,
  UpsertAttemptAnswerInput,
  UpdateExamQuestionInput,
} from "@/server/exams/repository/exam-repository";
import { chamDiemNenChoCauHoi, lamTronDiemNen } from "@/server/exams/scoring";
import {
  AI_GRADING_SUGGESTION_STATUSES,
  type AiEssayGradingSuggestionItemRecord,
  type AiEssayGradingSuggestionRecord,
  CLASS_EXAM_ANSWER_KEY_TYPES,
  CLASS_EXAM_ATTEMPT_STATUSES,
  CLASS_EXAM_QUESTION_TYPES,
  CLASS_EXAM_STATUSES,
  type ClassExamAttemptAnswerItemRecord,
  type ClassExamAttemptAnswerRecord,
  type ClassExamAnswerKeyRecord,
  type ClassExamAttemptRecord,
  type ClassExamAttemptStatus,
  type ClassExamQuestionItemRecord,
  type ClassExamQuestionRecord,
  type ClassExamQuestionType,
  type ClassExamRecord,
  type ClassExamStatus,
  type EssayManualGradingQueueItemRecord,
  type GradeEssayAttemptAnswerResult,
  type MyCreatedClassExamItem,
  type ReviewAiEssaySuggestionResult,
  type StartClassExamResult,
  type StudentExamPlayerRecord,
  type SubmitClassExamAttemptResult,
} from "@/types/exam";

type ClassExamRow = {
  id: string;
  exam_code: string;
  class_id: string;
  title: string;
  description: string | null;
  created_by_user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ClassExamAttemptRow = {
  id: string;
  class_exam_id: string;
  user_id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  auto_graded_score: string | number | null;
  max_auto_graded_score: string | number | null;
  final_score: string | number | null;
  pending_manual_grading_count: number | null;
  created_at: string;
  updated_at: string;
};

type ClassLookupRow = {
  id: string;
  class_code: string;
  full_class_name: string;
  teacher_user_id: string;
};

type MyCreatedExamJoinRow = ClassExamRow & {
  class_code: string;
  class_name: string;
};

type ExamQuestionRow = {
  id: string;
  class_exam_id: string;
  question_order: number;
  question_type: string;
  prompt_text: string;
  points: string | number;
  metadata_json: Record<string, unknown> | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

type ExamAnswerKeyRow = {
  id: string;
  question_id: string;
  key_type: string;
  correct_answer_text: string | null;
  correct_answer_json: Record<string, unknown> | null;
  explanation_text: string | null;
  created_at: string;
  updated_at: string;
};

type ExamOwnerRow = {
  id: string;
  exam_code: string;
  created_by_user_id: string;
};

type ExamQuestionOwnerRow = {
  id: string;
  class_exam_id: string;
  question_order: number;
  created_by_user_id: string;
};

type AttemptOwnerRow = {
  id: string;
  class_exam_id: string;
  user_id: string;
  status: string;
  submitted_at: string | null;
  started_at: string;
  auto_graded_score: string | number | null;
  max_auto_graded_score: string | number | null;
  final_score: string | number | null;
  pending_manual_grading_count: number | null;
  created_at: string;
  updated_at: string;
};

type AttemptAnswerRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_text: string | null;
  answer_json: Record<string, unknown> | null;
  awarded_points: string | number | null;
  manual_awarded_points: string | number | null;
  grading_note: string | null;
  graded_by: string | null;
  graded_at: string | null;
  scored_at: string | null;
  created_at: string;
  updated_at: string;
};

type EssayManualGradingRow = AttemptAnswerRow & {
  question_class_exam_id: string;
  question_order: number;
  question_type: string;
  prompt_text: string;
  points: string | number;
  metadata_json: Record<string, unknown> | null;
  created_by_user_id: string;
  question_created_at: string;
  question_updated_at: string;
  attempt_user_id: string;
  attempt_status: string;
  attempt_started_at: string;
  attempt_submitted_at: string | null;
  attempt_auto_graded_score: string | number | null;
  attempt_max_auto_graded_score: string | number | null;
  attempt_final_score: string | number | null;
  attempt_pending_manual_grading_count: number | null;
  attempt_created_at: string;
  attempt_updated_at: string;
  student_email: string | null;
  student_display_name: string | null;
};

type AiGradingSuggestionRow = {
  id: string;
  answer_id: string;
  suggested_points: string | number;
  suggested_feedback: string | null;
  confidence_score: string | number | null;
  provider_kind: string;
  model_name: string;
  prompt_version: string | null;
  status: string;
  response_json: Record<string, unknown> | null;
  generated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function docGiaTriEnum<T extends readonly string[]>(
  value: string,
  validValues: T,
  fieldName: string,
): T[number] {
  if (!validValues.includes(value as T[number])) {
    throw new AuthError({
      code: "POSTGRES_DATA_INVALID",
      message: `[postgres-exam] Truong ${fieldName} khong hop le: ${value}.`,
      statusCode: 500,
    });
  }

  return value as T[number];
}

function docJsonObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (value === null || value === undefined) {
      return {};
    }
    throw new AuthError({
      code: "POSTGRES_DATA_INVALID",
      message: `[postgres-exam] Truong ${fieldName} khong phai object hop le.`,
      statusCode: 500,
    });
  }

  return value as Record<string, unknown>;
}

function docPoints(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AuthError({
      code: "POSTGRES_DATA_INVALID",
      message: `[postgres-exam] Truong points khong hop le: ${String(value)}.`,
      statusCode: 500,
    });
  }

  return parsed;
}

function docDiemKhongAm(value: string | number | null, fieldName: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AuthError({
      code: "POSTGRES_DATA_INVALID",
      message: `[postgres-exam] Truong ${fieldName} khong hop le: ${String(value)}.`,
      statusCode: 500,
    });
  }

  return parsed;
}

function mapClassExamRow(row: ClassExamRow): ClassExamRecord {
  return {
    id: row.id,
    examCode: row.exam_code,
    classId: row.class_id,
    title: row.title,
    description: row.description,
    createdByUserId: row.created_by_user_id,
    status: docGiaTriEnum(row.status, CLASS_EXAM_STATUSES, "status") as ClassExamStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClassExamAttemptRow(row: ClassExamAttemptRow): ClassExamAttemptRecord {
  return {
    id: row.id,
    classExamId: row.class_exam_id,
    userId: row.user_id,
    status: docGiaTriEnum(
      row.status,
      CLASS_EXAM_ATTEMPT_STATUSES,
      "status",
    ) as ClassExamAttemptStatus,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    autoGradedScore: docDiemKhongAm(row.auto_graded_score, "auto_graded_score"),
    maxAutoGradedScore: docDiemKhongAm(row.max_auto_graded_score, "max_auto_graded_score"),
    finalScore: docDiemKhongAm(row.final_score, "final_score"),
    pendingManualGradingCount: row.pending_manual_grading_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExamQuestionRow(row: ExamQuestionRow): ClassExamQuestionRecord {
  return {
    id: row.id,
    classExamId: row.class_exam_id,
    questionOrder: row.question_order,
    questionType: docGiaTriEnum(
      row.question_type,
      CLASS_EXAM_QUESTION_TYPES,
      "question_type",
    ) as ClassExamQuestionType,
    promptText: row.prompt_text,
    points: docPoints(row.points),
    metadataJson: docJsonObject(row.metadata_json, "metadata_json"),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExamAnswerKeyRow(row: ExamAnswerKeyRow): ClassExamAnswerKeyRecord {
  return {
    id: row.id,
    questionId: row.question_id,
    keyType: docGiaTriEnum(
      row.key_type,
      CLASS_EXAM_ANSWER_KEY_TYPES,
      "key_type",
    ),
    correctAnswerText: row.correct_answer_text,
    correctAnswerJson: docJsonObject(row.correct_answer_json, "correct_answer_json"),
    explanationText: row.explanation_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAttemptAnswerRow(row: AttemptAnswerRow): ClassExamAttemptAnswerRecord {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    answerText: row.answer_text,
    answerJson: docJsonObject(row.answer_json, "answer_json"),
    awardedPoints: docDiemKhongAm(row.awarded_points, "awarded_points"),
    manualAwardedPoints: docDiemKhongAm(row.manual_awarded_points, "manual_awarded_points"),
    gradingNote: row.grading_note,
    gradedBy: row.graded_by,
    gradedAt: row.graded_at,
    scoredAt: row.scored_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAiGradingSuggestionRow(row: AiGradingSuggestionRow): AiEssayGradingSuggestionRecord {
  return {
    id: row.id,
    answerId: row.answer_id,
    suggestedPoints: docDiemKhongAm(row.suggested_points, "ai_grading_suggestions.suggested_points") ?? 0,
    suggestedFeedback: row.suggested_feedback,
    confidenceScore: docDiemKhongAm(row.confidence_score, "confidence_score"),
    providerKind: row.provider_kind,
    modelName: row.model_name,
    promptVersion: row.prompt_version,
    status: docGiaTriEnum(
      row.status,
      AI_GRADING_SUGGESTION_STATUSES,
      "ai_grading_suggestions.status",
    ),
    responseJson: docJsonObject(row.response_json, "ai_grading_suggestions.response_json"),
    generatedAt: row.generated_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function coTraLoiTextCoNoiDung(answer: ClassExamAttemptAnswerRecord | null): boolean {
  return typeof answer?.answerText === "string" && answer.answerText.trim().length > 0;
}

function taoLoiPostgresExam(action: string, error: unknown): never {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "Loi khong xac dinh";

  if (code === "23505" && message.includes("uq_class_exams_exam_code")) {
    throw new AuthError({
      code: "EXAM_CODE_ALREADY_EXISTS",
      message: "Ma bai kiem tra da ton tai, vui long thu lai.",
      statusCode: 409,
    });
  }

  if (code === "23505" && message.includes("uq_class_exam_attempts_exam_user")) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_ALREADY_EXISTS",
      message: "Tai khoan da co luot lam bai cho bai kiem tra nay.",
      statusCode: 409,
    });
  }

  if (code === "23505" && message.includes("uq_exam_questions_exam_order")) {
    throw new AuthError({
      code: "EXAM_QUESTION_ORDER_CONFLICT",
      message: "questionOrder da ton tai trong bai kiem tra nay.",
      statusCode: 409,
    });
  }

  if (code === "23505" && message.includes("uq_ai_grading_suggestions_one_pending_per_answer")) {
    throw new AuthError({
      code: "AI_GRADING_SUGGESTION_PENDING_EXISTS",
      message: "Dang ton tai mot goi y AI pending cho cau tra loi nay.",
      statusCode: 409,
    });
  }

  if (message.includes("ANSWER_KEY_TYPE_MISMATCH")) {
    throw new AuthError({
      code: "INVALID_ANSWER_KEY",
      message: "Loai dap an khong khop voi loai cau hoi.",
      statusCode: 400,
    });
  }

  if (message.includes("ATTEMPT_QUESTION_MISMATCH")) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_QUESTION_MISMATCH",
      message: "questionId khong thuoc bai kiem tra cua attempt.",
      statusCode: 400,
    });
  }

  if (message.includes("ATTEMPT_ALREADY_SUBMITTED")) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_ALREADY_SUBMITTED",
      message: "Attempt da nop bai, khong duoc cap nhat du lieu.",
      statusCode: 409,
    });
  }

  if (message.includes("ESSAY_MANUAL_GRADING_ONLY")) {
    throw new AuthError({
      code: "ESSAY_MANUAL_GRADING_ONLY",
      message: "Chi cau essay_placeholder moi duoc cham tay trong task nay.",
      statusCode: 400,
    });
  }

  if (message.includes("AI_SUGGESTED_POINTS_OUT_OF_RANGE")) {
    throw new AuthError({
      code: "AI_SUGGESTED_POINTS_OUT_OF_RANGE",
      message: "Diem goi y AI nam ngoai khoang diem hop le cua cau hoi.",
      statusCode: 400,
    });
  }

  throw new AuthError({
    code: "POSTGRES_EXAM_QUERY_FAILED",
    message: `[postgres-exam] Loi khi ${action}: ${message}`,
    statusCode: 500,
  });
}

async function rollbackAnToan(client: { query: (queryText: string) => Promise<unknown> }): Promise<void> {
  try {
    await client.query("rollback");
  } catch {
  }
}

async function batBuocExamTonTaiVaCoQuyenSua(
  client: { query: (queryText: string, values?: unknown[]) => Promise<{ rows: ExamOwnerRow[] }> },
  examCode: string,
  actorUserId: string,
  lock: boolean,
): Promise<ExamOwnerRow> {
  const examResult = await client.query(
    `select id, exam_code, created_by_user_id
     from public.class_exams
     where exam_code = $1
     limit 1${lock ? " for update" : ""}`,
    [examCode.trim().toUpperCase()],
  );
  const examRow = examResult.rows[0];
  if (!examRow) {
    throw new AuthError({
      code: "EXAM_NOT_FOUND",
      message: "Khong tim thay bai kiem tra theo ma da nhap.",
      statusCode: 404,
    });
  }

  if (examRow.created_by_user_id !== actorUserId) {
    throw new AuthError({
      code: "EXAM_CONTENT_PERMISSION_REQUIRED",
      message: "Tai khoan hien tai khong co quyen sua noi dung bai kiem tra.",
      statusCode: 403,
    });
  }

  return examRow;
}

async function batBuocAttemptTonTaiVaCoQuyenTruyCap(
  client: {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: AttemptOwnerRow[] }>;
  },
  attemptId: string,
  actorUserId: string,
  lock: boolean,
): Promise<AttemptOwnerRow> {
  const attemptResult = await client.query(
    `select
       id,
       class_exam_id,
       user_id,
       status,
       submitted_at,
       started_at,
       auto_graded_score,
       max_auto_graded_score,
       final_score,
       pending_manual_grading_count,
       created_at,
       updated_at
     from public.class_exam_attempts
     where id = $1
     limit 1${lock ? " for update" : ""}`,
    [attemptId],
  );
  const attemptRow = attemptResult.rows[0];
  if (!attemptRow) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_NOT_FOUND",
      message: "Khong tim thay luot lam bai theo attemptId.",
      statusCode: 404,
    });
  }

  if (attemptRow.user_id !== actorUserId) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_PERMISSION_REQUIRED",
      message: "Tai khoan hien tai khong duoc thao tac tren attempt nay.",
      statusCode: 403,
    });
  }

  return attemptRow;
}

async function batBuocCauEssayTonTaiVaCoQuyenCham(
  client: {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: EssayManualGradingRow[] }>;
  },
  answerId: string,
  actorUserId: string,
  lock: boolean,
): Promise<EssayManualGradingRow> {
  const result = await client.query(
    `select
       aa.*,
       q.class_exam_id as question_class_exam_id,
       q.question_order,
       q.question_type,
       q.prompt_text,
       q.points,
       q.metadata_json,
       q.created_by_user_id,
       q.created_at as question_created_at,
       q.updated_at as question_updated_at,
       cea.user_id as attempt_user_id,
       cea.status as attempt_status,
       cea.started_at as attempt_started_at,
       cea.submitted_at as attempt_submitted_at,
       cea.auto_graded_score as attempt_auto_graded_score,
       cea.max_auto_graded_score as attempt_max_auto_graded_score,
       cea.final_score as attempt_final_score,
       cea.pending_manual_grading_count as attempt_pending_manual_grading_count,
       cea.created_at as attempt_created_at,
       cea.updated_at as attempt_updated_at,
       ua.email as student_email,
       up.display_name as student_display_name
     from public.class_exam_attempt_answers aa
     inner join public.exam_questions q on q.id = aa.question_id
     inner join public.class_exam_attempts cea on cea.id = aa.attempt_id
     inner join public.class_exams ce on ce.id = cea.class_exam_id
     left join public.user_accounts ua on ua.id = cea.user_id
     left join public.user_profiles up on up.user_id = cea.user_id
     where aa.id = $1
     limit 1${lock ? " for update of aa, cea" : ""}`,
    [answerId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_ANSWER_NOT_FOUND",
      message: "Khong tim thay cau tra loi can cham tay.",
      statusCode: 404,
    });
  }

  if (row.created_by_user_id !== actorUserId) {
    throw new AuthError({
      code: "EXAM_CONTENT_PERMISSION_REQUIRED",
      message: "Tai khoan hien tai khong co quyen cham tay bai nay.",
      statusCode: 403,
    });
  }

  if (row.question_type !== "essay_placeholder") {
    throw new AuthError({
      code: "ESSAY_MANUAL_GRADING_ONLY",
      message: "Chi cau essay_placeholder moi duoc cham tay trong task nay.",
      statusCode: 400,
    });
  }

  return row;
}

function mapEssayManualGradingRowToAttempt(row: EssayManualGradingRow): ClassExamAttemptRecord {
  return mapClassExamAttemptRow({
    id: row.attempt_id,
    class_exam_id: row.question_class_exam_id,
    user_id: row.attempt_user_id,
    status: row.attempt_status,
    started_at: row.attempt_started_at,
    submitted_at: row.attempt_submitted_at,
    auto_graded_score: row.attempt_auto_graded_score,
    max_auto_graded_score: row.attempt_max_auto_graded_score,
    final_score: row.attempt_final_score,
    pending_manual_grading_count: row.attempt_pending_manual_grading_count,
    created_at: row.attempt_created_at,
    updated_at: row.attempt_updated_at,
  });
}

function mapEssayManualGradingRowToQuestion(row: EssayManualGradingRow): ClassExamQuestionRecord {
  return mapExamQuestionRow({
    id: row.question_id,
    class_exam_id: row.question_class_exam_id,
    question_order: row.question_order,
    question_type: row.question_type,
    prompt_text: row.prompt_text,
    points: row.points,
    metadata_json: row.metadata_json,
    created_by_user_id: row.created_by_user_id,
    created_at: row.question_created_at,
    updated_at: row.question_updated_at,
  });
}

async function tinhTongKetAttemptSauCham(
  client: {
    query: <TRow>(
      queryText: string,
      values?: unknown[],
    ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
  },
  attemptId: string,
): Promise<{
  finalScore: number | null;
  pendingManualGradingCount: number;
}> {
  const answerRowsResult = await client.query<
    AttemptAnswerRow & {
      question_type: string;
    }
  >(
    `select aa.*, q.question_type
     from public.class_exam_attempt_answers aa
     inner join public.exam_questions q on q.id = aa.question_id
     where aa.attempt_id = $1`,
    [attemptId],
  );

  let finalScore = 0;
  let pendingManualGradingCount = 0;
  for (const row of answerRowsResult.rows) {
    const answer = mapAttemptAnswerRow(row);
    finalScore += answer.awardedPoints ?? 0;
    if (
      row.question_type === "essay_placeholder" &&
      coTraLoiTextCoNoiDung(answer) &&
      answer.manualAwardedPoints === null
    ) {
      pendingManualGradingCount += 1;
    }
  }

  return {
    finalScore: pendingManualGradingCount === 0 ? lamTronDiemNen(finalScore) : null,
    pendingManualGradingCount,
  };
}

async function capNhatTongKetAttemptSauCham(
  client: {
    query: <TRow>(
      queryText: string,
      values?: unknown[],
    ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
  },
  attemptId: string,
  updatedAt: string,
): Promise<ClassExamAttemptRecord> {
  const tongKet = await tinhTongKetAttemptSauCham(client, attemptId);
  const attemptResult = await client.query<ClassExamAttemptRow>(
    `update public.class_exam_attempts
     set
       final_score = $2,
       pending_manual_grading_count = $3,
       updated_at = $4
     where id = $1
     returning *`,
    [attemptId, tongKet.finalScore, tongKet.pendingManualGradingCount, updatedAt],
  );
  const updatedAttemptRow = attemptResult.rows[0];
  if (!updatedAttemptRow) {
    throw new AuthError({
      code: "EXAM_ATTEMPT_NOT_FOUND",
      message: "Khong tim thay luot lam bai de cap nhat tong ket.",
      statusCode: 404,
    });
  }

  return mapClassExamAttemptRow(updatedAttemptRow);
}

async function supersedePendingAiSuggestionsNoCheck(
  client: {
    query: <TRow>(
      queryText: string,
      values?: unknown[],
    ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
  },
  answerId: string,
  updatedAt: string,
  excludeSuggestionId?: string,
): Promise<AiEssayGradingSuggestionRecord[]> {
  const values: unknown[] = [answerId, updatedAt];
  let filterSql = "";
  if (excludeSuggestionId) {
    values.push(excludeSuggestionId);
    filterSql = " and id <> $3";
  }

  const result = await client.query<AiGradingSuggestionRow>(
    `update public.ai_grading_suggestions
     set status = 'superseded',
         updated_at = $2
     where answer_id = $1
       and status = 'pending'${filterSql}
     returning *`,
    values,
  );

  return result.rows.map((row) => mapAiGradingSuggestionRow(row));
}

async function batBuocGoiYChamAITonTaiVaCoQuyen(
  client: {
    query: <TRow>(
      queryText: string,
      values?: unknown[],
    ) => Promise<{ rows: TRow[]; rowCount: number | null }>;
  },
  suggestionId: string,
  actorUserId: string,
  lock: boolean,
): Promise<{
  suggestionRow: AiGradingSuggestionRow;
  essayRow: EssayManualGradingRow;
}> {
  const suggestionResult = await client.query<AiGradingSuggestionRow>(
    `select *
     from public.ai_grading_suggestions
     where id = $1
     limit 1${lock ? " for update" : ""}`,
    [suggestionId],
  );
  const suggestionRow = suggestionResult.rows[0];
  if (!suggestionRow) {
    throw new AuthError({
      code: "AI_GRADING_SUGGESTION_NOT_FOUND",
      message: "Khong tim thay goi y cham AI theo suggestionId.",
      statusCode: 404,
    });
  }

  const essayRow = await batBuocCauEssayTonTaiVaCoQuyenCham(
    client,
    suggestionRow.answer_id,
    actorUserId,
    lock,
  );

  return {
    suggestionRow,
    essayRow,
  };
}

function taoBanGhiGoiYChamAITuDuLieu(
  suggestionRow: AiGradingSuggestionRow,
  essayRow: EssayManualGradingRow,
): AiEssayGradingSuggestionItemRecord {
  return {
    suggestion: mapAiGradingSuggestionRow(suggestionRow),
    answer: mapAttemptAnswerRow(essayRow),
    question: mapEssayManualGradingRowToQuestion(essayRow),
    attempt: mapEssayManualGradingRowToAttempt(essayRow),
    student: {
      userId: essayRow.attempt_user_id,
      email: essayRow.student_email,
      displayName: essayRow.student_display_name,
    },
  };
}

export function taoPostgresExamRepository(): ExamRepository {
  const pool = layPostgresPool();

  return {
    async createClassExamByTeacher(input: CreateClassExamInput): Promise<ClassExamRecord> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const classResult = await client.query<ClassLookupRow>(
          `select id, class_code, full_class_name, teacher_user_id
           from public.classes
           where class_code = $1
           limit 1
           for update`,
          [input.classCode.trim().toUpperCase()],
        );

        const classRow = classResult.rows[0];
        if (!classRow) {
          throw new AuthError({
            code: "CLASS_NOT_FOUND",
            message: "Khong tim thay lop hoc de tao bai kiem tra.",
            statusCode: 404,
          });
        }

        if (classRow.teacher_user_id !== input.createdByUserId) {
          throw new AuthError({
            code: "CLASS_OWNERSHIP_REQUIRED",
            message: "Chi giao vien so huu lop moi duoc tao bai kiem tra.",
            statusCode: 403,
          });
        }

        const examResult = await client.query<ClassExamRow>(
          `insert into public.class_exams (
             exam_code,
             class_id,
             title,
             description,
             created_by_user_id,
             status,
             created_at,
             updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $7)
           returning *`,
          [
            input.examCode.trim().toUpperCase(),
            classRow.id,
            input.title,
            input.description,
            input.createdByUserId,
            input.status,
            input.createdAt,
          ],
        );

        const examRow = examResult.rows[0];
        if (!examRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-exam] Khong tao duoc bai kiem tra.",
            statusCode: 500,
          });
        }

        await client.query("commit");
        return mapClassExamRow(examRow);
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("tao bai kiem tra theo lop", error);
      } finally {
        client.release();
      }
    },

    async listMyCreatedClassExams(userId: string): Promise<MyCreatedClassExamItem[]> {
      try {
        const result = await pool.query<MyCreatedExamJoinRow>(
          `select
             ce.*,
             c.class_code as class_code,
             c.full_class_name as class_name
           from public.class_exams ce
           inner join public.classes c on c.id = ce.class_id
           where ce.created_by_user_id = $1
           order by ce.created_at desc`,
          [userId],
        );

        return result.rows.map((row) => ({
          exam: mapClassExamRow(row),
          classCode: row.class_code,
          className: row.class_name,
        }));
      } catch (error) {
        taoLoiPostgresExam("liet ke bai kiem tra da tao", error);
      }
    },

    async startClassExam(input: StartClassExamInput): Promise<StartClassExamResult> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const examResult = await client.query<ClassExamRow>(
          `select *
           from public.class_exams
           where exam_code = $1
           limit 1
           for update`,
          [input.examCode.trim().toUpperCase()],
        );

        const examRow = examResult.rows[0];
        if (!examRow) {
          throw new AuthError({
            code: "EXAM_NOT_FOUND",
            message: "Khong tim thay bai kiem tra theo ma da nhap.",
            statusCode: 404,
          });
        }

        if (examRow.status !== "published") {
          throw new AuthError({
            code: "EXAM_NOT_AVAILABLE",
            message: "Bai kiem tra hien khong mo de vao lam.",
            statusCode: 409,
          });
        }

        const membershipResult = await client.query<{ class_id: string }>(
          `select class_id
           from public.class_members
           where class_id = $1
             and user_id = $2
           limit 1`,
          [examRow.class_id, input.userId],
        );

        if (membershipResult.rowCount !== 1) {
          throw new AuthError({
            code: "CLASS_MEMBERSHIP_REQUIRED",
            message: "Chi thanh vien lop moi duoc vao bai kiem tra.",
            statusCode: 403,
          });
        }

        const attemptResult = await client.query<ClassExamAttemptRow>(
          `insert into public.class_exam_attempts (
             class_exam_id,
             user_id,
             status,
             started_at,
             submitted_at,
             auto_graded_score,
             max_auto_graded_score,
             final_score,
             pending_manual_grading_count,
             created_at,
             updated_at
           )
           values ($1, $2, 'started', $3, null, null, null, null, 0, $3, $3)
           returning *`,
          [examRow.id, input.userId, input.startedAt],
        );

        const attemptRow = attemptResult.rows[0];
        if (!attemptRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-exam] Khong tao duoc luot vao bai.",
            statusCode: 500,
          });
        }

        await client.query("commit");
        return {
          exam: mapClassExamRow(examRow),
          attempt: mapClassExamAttemptRow(attemptRow),
        };
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("vao bai kiem tra", error);
      } finally {
        client.release();
      }
    },

    async findExamByCode(examCode: string): Promise<ClassExamRecord | null> {
      try {
        const result = await pool.query<ClassExamRow>(
          `select *
           from public.class_exams
           where exam_code = $1
           limit 1`,
          [examCode.trim().toUpperCase()],
        );
        const row = result.rows[0];
        return row ? mapClassExamRow(row) : null;
      } catch (error) {
        taoLoiPostgresExam("tim bai kiem tra theo ma", error);
      }
    },

    async listMyExamAttempts(userId: string): Promise<ClassExamAttemptRecord[]> {
      try {
        const result = await pool.query<ClassExamAttemptRow>(
          `select *
           from public.class_exam_attempts
           where user_id = $1
           order by started_at desc`,
          [userId],
        );

        return result.rows.map((row) => mapClassExamAttemptRow(row));
      } catch (error) {
        taoLoiPostgresExam("liet ke luot vao bai cua toi", error);
      }
    },

    async getStudentExamPlayer(input: GetStudentExamPlayerInput): Promise<StudentExamPlayerRecord> {
      try {
        const examResult = await pool.query<ClassExamRow>(
          `select *
           from public.class_exams
           where exam_code = $1
           limit 1`,
          [input.examCode.trim().toUpperCase()],
        );
        const examRow = examResult.rows[0];
        if (!examRow) {
          throw new AuthError({
            code: "EXAM_NOT_FOUND",
            message: "Khong tim thay bai kiem tra theo ma da nhap.",
            statusCode: 404,
          });
        }

        const membershipResult = await pool.query<{ class_id: string }>(
          `select class_id
           from public.class_members
           where class_id = $1
             and user_id = $2
           limit 1`,
          [examRow.class_id, input.actorUserId],
        );
        if (membershipResult.rowCount !== 1) {
          throw new AuthError({
            code: "CLASS_MEMBERSHIP_REQUIRED",
            message: "Chi thanh vien lop moi duoc truy cap bai kiem tra nay.",
            statusCode: 403,
          });
        }

        const attemptResult = await pool.query<ClassExamAttemptRow>(
          `select *
           from public.class_exam_attempts
           where class_exam_id = $1
             and user_id = $2
           limit 1`,
          [examRow.id, input.actorUserId],
        );
        const attemptRow = attemptResult.rows[0];
        if (!attemptRow) {
          if (examRow.status !== "published") {
            throw new AuthError({
              code: "EXAM_NOT_AVAILABLE",
              message: "Bai kiem tra hien khong mo de vao lam.",
              statusCode: 409,
            });
          }

          return {
            exam: {
              id: examRow.id,
              examCode: examRow.exam_code,
              title: examRow.title,
              description: examRow.description,
              status: docGiaTriEnum(examRow.status, CLASS_EXAM_STATUSES, "status"),
            },
            attempt: null,
            questions: [],
            answers: [],
            canStart: true,
            isLocked: false,
          };
        }

        const questionsResult = await pool.query<ExamQuestionRow>(
          `select *
           from public.exam_questions
           where class_exam_id = $1
           order by question_order asc, created_at asc`,
          [examRow.id],
        );
        const answersResult = await pool.query<AttemptAnswerRow>(
          `select *
           from public.class_exam_attempt_answers
           where attempt_id = $1
           order by created_at asc`,
          [attemptRow.id],
        );

        return {
          exam: {
            id: examRow.id,
            examCode: examRow.exam_code,
            title: examRow.title,
            description: examRow.description,
            status: docGiaTriEnum(examRow.status, CLASS_EXAM_STATUSES, "status"),
          },
          attempt: mapClassExamAttemptRow(attemptRow),
          questions: questionsResult.rows.map((row) => mapExamQuestionRow(row)),
          answers: answersResult.rows.map((row) => mapAttemptAnswerRow(row)),
          canStart: false,
          isLocked: attemptRow.status === "submitted",
        };
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("tai du lieu exam player cho hoc sinh", error);
      }
    },

    async listEssayAnswersForManualGrading(
      input: ListEssayAnswersForManualGradingInput,
    ): Promise<EssayManualGradingQueueItemRecord[]> {
      const client = await pool.connect();
      try {
        const examRow = await batBuocExamTonTaiVaCoQuyenSua(
          client,
          input.examCode,
          input.actorUserId,
          false,
        );

        const result = await client.query<EssayManualGradingRow>(
          `select
             aa.*,
             q.class_exam_id as question_class_exam_id,
             q.question_order,
             q.question_type,
             q.prompt_text,
             q.points,
             q.metadata_json,
             q.created_by_user_id,
             q.created_at as question_created_at,
             q.updated_at as question_updated_at,
             cea.user_id as attempt_user_id,
             cea.status as attempt_status,
             cea.started_at as attempt_started_at,
             cea.submitted_at as attempt_submitted_at,
             cea.auto_graded_score as attempt_auto_graded_score,
             cea.max_auto_graded_score as attempt_max_auto_graded_score,
             cea.final_score as attempt_final_score,
             cea.pending_manual_grading_count as attempt_pending_manual_grading_count,
             cea.created_at as attempt_created_at,
             cea.updated_at as attempt_updated_at,
             ua.email as student_email,
             up.display_name as student_display_name
           from public.class_exam_attempt_answers aa
           inner join public.exam_questions q on q.id = aa.question_id
           inner join public.class_exam_attempts cea on cea.id = aa.attempt_id
           left join public.user_accounts ua on ua.id = cea.user_id
           left join public.user_profiles up on up.user_id = cea.user_id
           where q.class_exam_id = $1
             and q.question_type = 'essay_placeholder'
             and cea.status = 'submitted'
             and nullif(btrim(coalesce(aa.answer_text, '')), '') is not null
             and aa.manual_awarded_points is null
           order by cea.submitted_at asc nulls last, q.question_order asc, aa.created_at asc`,
          [examRow.id],
        );

        return result.rows.map((row) => ({
          answer: mapAttemptAnswerRow(row),
          question: mapExamQuestionRow({
            id: row.question_id,
            class_exam_id: examRow.id,
            question_order: row.question_order,
            question_type: row.question_type,
            prompt_text: row.prompt_text,
            points: row.points,
            metadata_json: row.metadata_json,
            created_by_user_id: row.created_by_user_id,
            created_at: row.question_created_at,
            updated_at: row.question_updated_at,
          }),
          attempt: mapClassExamAttemptRow({
            id: row.attempt_id,
            class_exam_id: examRow.id,
            user_id: row.attempt_user_id,
            status: row.attempt_status,
            started_at: row.attempt_started_at,
            submitted_at: row.attempt_submitted_at,
            auto_graded_score: row.attempt_auto_graded_score,
            max_auto_graded_score: row.attempt_max_auto_graded_score,
            final_score: row.attempt_final_score,
            pending_manual_grading_count: row.attempt_pending_manual_grading_count,
            created_at: row.attempt_created_at,
            updated_at: row.attempt_updated_at,
          }),
          student: {
            userId: row.attempt_user_id,
            email: row.student_email,
            displayName: row.student_display_name,
          },
        }));
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("liet ke cac cau essay can cham", error);
      } finally {
        client.release();
      }
    },

    async gradeEssayAttemptAnswer(
      input: GradeEssayAttemptAnswerInput,
    ): Promise<GradeEssayAttemptAnswerResult> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const currentRow = await batBuocCauEssayTonTaiVaCoQuyenCham(
          client,
          input.answerId,
          input.actorUserId,
          true,
        );
        if (currentRow.attempt_status !== "submitted") {
          throw new AuthError({
            code: "EXAM_ATTEMPT_NOT_SUBMITTED",
            message: "Chi duoc cham tay sau khi hoc sinh da nop bai.",
            statusCode: 409,
          });
        }

        const question = mapExamQuestionRow({
          id: currentRow.question_id,
          class_exam_id: currentRow.question_class_exam_id,
          question_order: currentRow.question_order,
          question_type: currentRow.question_type,
          prompt_text: currentRow.prompt_text,
          points: currentRow.points,
          metadata_json: currentRow.metadata_json,
          created_by_user_id: currentRow.created_by_user_id,
          created_at: currentRow.question_created_at,
          updated_at: currentRow.question_updated_at,
        });
        if (!coTraLoiTextCoNoiDung(mapAttemptAnswerRow(currentRow))) {
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

        const answerResult = await client.query<AttemptAnswerRow>(
          `update public.class_exam_attempt_answers
           set
             awarded_points = $2,
             manual_awarded_points = $2,
             grading_note = $3,
             graded_by = $4,
             graded_at = $5,
             scored_at = $5,
             updated_at = $5
           where id = $1
           returning *`,
          [
            input.answerId,
            lamTronDiemNen(input.manualAwardedPoints),
            input.gradingNote,
            input.actorUserId,
            input.gradedAt,
          ],
        );
        const updatedAnswerRow = answerResult.rows[0];
        if (!updatedAnswerRow) {
          throw new AuthError({
            code: "EXAM_ATTEMPT_ANSWER_NOT_FOUND",
            message: "Khong tim thay cau tra loi can cham tay.",
            statusCode: 404,
          });
        }
        await supersedePendingAiSuggestionsNoCheck(client, input.answerId, input.gradedAt);
        const updatedAttempt = await capNhatTongKetAttemptSauCham(
          client,
          currentRow.attempt_id,
          input.gradedAt,
        );

        await client.query("commit");
        return {
          answer: mapAttemptAnswerRow(updatedAnswerRow),
          question,
          attempt: updatedAttempt,
        };
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("cham tay cau essay", error);
      } finally {
        client.release();
      }
    },

    async createAiEssaySuggestion(
      input: CreateAiEssaySuggestionInput,
    ): Promise<AiEssayGradingSuggestionItemRecord> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const essayRow = await batBuocCauEssayTonTaiVaCoQuyenCham(
          client,
          input.answerId,
          input.actorUserId,
          true,
        );
        if (essayRow.attempt_status !== "submitted") {
          throw new AuthError({
            code: "EXAM_ATTEMPT_NOT_SUBMITTED",
            message: "Chi duoc tao goi y AI sau khi hoc sinh da nop bai.",
            statusCode: 409,
          });
        }
        const question = mapEssayManualGradingRowToQuestion(essayRow);
        if (!coTraLoiTextCoNoiDung(mapAttemptAnswerRow(essayRow))) {
          throw new AuthError({
            code: "ESSAY_ANSWER_EMPTY",
            message: "Khong the tao goi y AI khi cau tu luan chua co noi dung tra loi.",
            statusCode: 400,
          });
        }
        if (input.suggestedPoints < 0 || input.suggestedPoints > question.points) {
          throw new AuthError({
            code: "AI_SUGGESTED_POINTS_OUT_OF_RANGE",
            message: "Diem goi y AI nam ngoai khoang diem hop le cua cau hoi.",
            statusCode: 400,
          });
        }

        await supersedePendingAiSuggestionsNoCheck(client, input.answerId, input.generatedAt);

        const suggestionResult = await client.query<AiGradingSuggestionRow>(
          `insert into public.ai_grading_suggestions (
             answer_id,
             suggested_points,
             suggested_feedback,
             confidence_score,
             provider_kind,
             model_name,
             prompt_version,
             status,
             response_json,
             generated_at,
             reviewed_by,
             reviewed_at,
             created_at,
             updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, 'pending', $8::jsonb, $9, null, null, $9, $9)
           returning *`,
          [
            input.answerId,
            lamTronDiemNen(input.suggestedPoints),
            input.suggestedFeedback,
            input.confidenceScore,
            input.providerKind,
            input.modelName,
            input.promptVersion,
            JSON.stringify(input.responseJson),
            input.generatedAt,
          ],
        );
        const suggestionRow = suggestionResult.rows[0];
        if (!suggestionRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-exam] Khong tao duoc goi y cham AI.",
            statusCode: 500,
          });
        }

        await client.query("commit");
        return taoBanGhiGoiYChamAITuDuLieu(suggestionRow, essayRow);
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("tao goi y cham AI cho essay", error);
      } finally {
        client.release();
      }
    },

    async listAiEssaySuggestions(
      input: ListAiEssaySuggestionsInput,
    ): Promise<AiEssayGradingSuggestionItemRecord[]> {
      const client = await pool.connect();
      try {
        const examRow = await batBuocExamTonTaiVaCoQuyenSua(
          client,
          input.examCode,
          input.actorUserId,
          false,
        );

        const values: unknown[] = [examRow.id];
        let answerFilterSql = "";
        if (input.answerId) {
          values.push(input.answerId);
          answerFilterSql = " and ags.answer_id = $2";
        }

        const suggestionIdsResult = await client.query<{ id: string }>(
          `select ags.id
           from public.ai_grading_suggestions ags
           inner join public.class_exam_attempt_answers aa on aa.id = ags.answer_id
           inner join public.exam_questions q on q.id = aa.question_id
           where q.class_exam_id = $1${answerFilterSql}
           order by ags.generated_at desc, ags.created_at desc`,
          values,
        );

        const items: AiEssayGradingSuggestionItemRecord[] = [];
        for (const row of suggestionIdsResult.rows) {
          const record = await batBuocGoiYChamAITonTaiVaCoQuyen(
            client,
            row.id,
            input.actorUserId,
            false,
          );
          items.push(taoBanGhiGoiYChamAITuDuLieu(record.suggestionRow, record.essayRow));
        }

        return items;
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("liet ke goi y cham AI", error);
      } finally {
        client.release();
      }
    },

    async reviewAiEssaySuggestion(
      input: ReviewAiEssaySuggestionInput,
    ): Promise<ReviewAiEssaySuggestionResult> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const record = await batBuocGoiYChamAITonTaiVaCoQuyen(
          client,
          input.suggestionId,
          input.actorUserId,
          true,
        );
        const currentSuggestion = mapAiGradingSuggestionRow(record.suggestionRow);
        if (currentSuggestion.status !== "pending") {
          throw new AuthError({
            code: "AI_GRADING_SUGGESTION_ALREADY_REVIEWED",
            message: "Goi y cham AI nay da duoc xu ly truoc do.",
            statusCode: 409,
          });
        }

        const question = mapEssayManualGradingRowToQuestion(record.essayRow);
        const currentAttempt = mapEssayManualGradingRowToAttempt(record.essayRow);

        const suggestionResult = await client.query<AiGradingSuggestionRow>(
          `update public.ai_grading_suggestions
           set
             status = $2,
             reviewed_by = $3,
             reviewed_at = $4,
             updated_at = $4
           where id = $1
           returning *`,
          [
            input.suggestionId,
            input.action === "accept" ? "accepted" : "rejected",
            input.actorUserId,
            input.reviewedAt,
          ],
        );
        const updatedSuggestionRow = suggestionResult.rows[0];
        if (!updatedSuggestionRow) {
          throw new AuthError({
            code: "AI_GRADING_SUGGESTION_NOT_FOUND",
            message: "Khong tim thay goi y cham AI theo suggestionId.",
            statusCode: 404,
          });
        }

        if (input.action === "reject") {
          await client.query("commit");
          return {
            suggestion: mapAiGradingSuggestionRow(updatedSuggestionRow),
            answer: mapAttemptAnswerRow(record.essayRow),
            question,
            attempt: currentAttempt,
          };
        }

        await supersedePendingAiSuggestionsNoCheck(
          client,
          record.essayRow.id,
          input.reviewedAt,
          input.suggestionId,
        );

        const answerResult = await client.query<AttemptAnswerRow>(
          `update public.class_exam_attempt_answers
           set
             awarded_points = $2,
             manual_awarded_points = $2,
             grading_note = $3,
             graded_by = $4,
             graded_at = $5,
             scored_at = $5,
             updated_at = $5
           where id = $1
           returning *`,
          [
            record.essayRow.id,
            mapAiGradingSuggestionRow(updatedSuggestionRow).suggestedPoints,
            updatedSuggestionRow.suggested_feedback,
            input.actorUserId,
            input.reviewedAt,
          ],
        );
        const updatedAnswerRow = answerResult.rows[0];
        if (!updatedAnswerRow) {
          throw new AuthError({
            code: "EXAM_ATTEMPT_ANSWER_NOT_FOUND",
            message: "Khong tim thay cau tra loi can ap goi y AI.",
            statusCode: 404,
          });
        }

        const updatedAttempt = await capNhatTongKetAttemptSauCham(
          client,
          record.essayRow.attempt_id,
          input.reviewedAt,
        );

        await client.query("commit");
        return {
          suggestion: mapAiGradingSuggestionRow(updatedSuggestionRow),
          answer: mapAttemptAnswerRow(updatedAnswerRow),
          question,
          attempt: updatedAttempt,
        };
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("review goi y cham AI", error);
      } finally {
        client.release();
      }
    },

    async supersedePendingAiSuggestionsForAnswer(
      answerId: string,
      actorUserId: string,
      updatedAt: string,
    ): Promise<AiEssayGradingSuggestionRecord[]> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        await batBuocCauEssayTonTaiVaCoQuyenCham(client, answerId, actorUserId, true);
        const updated = await supersedePendingAiSuggestionsNoCheck(client, answerId, updatedAt);

        await client.query("commit");
        return updated;
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("dong cac goi y AI pending theo answer", error);
      } finally {
        client.release();
      }
    },

    async createExamQuestion(input: CreateExamQuestionInput): Promise<ClassExamQuestionItemRecord> {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const examRow = await batBuocExamTonTaiVaCoQuyenSua(
          client,
          input.examCode,
          input.actorUserId,
          true,
        );

        const questionResult = await client.query<ExamQuestionRow>(
          `insert into public.exam_questions (
             class_exam_id,
             question_order,
             question_type,
             prompt_text,
             points,
             metadata_json,
             created_by_user_id,
             created_at,
             updated_at
           )
           values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8)
           returning *`,
          [
            examRow.id,
            input.questionOrder,
            input.questionType,
            input.promptText,
            input.points,
            JSON.stringify(input.metadataJson),
            input.actorUserId,
            input.createdAt,
          ],
        );
        const questionRow = questionResult.rows[0];
        if (!questionRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-exam] Khong tao duoc cau hoi.",
            statusCode: 500,
          });
        }

        const answerKeyResult = await client.query<ExamAnswerKeyRow>(
          `insert into public.exam_answer_keys (
             question_id,
             key_type,
             correct_answer_text,
             correct_answer_json,
             explanation_text,
             created_at,
             updated_at
           )
           values ($1, $2, $3, $4::jsonb, $5, $6, $6)
           returning *`,
          [
            questionRow.id,
            input.answerKey.keyType,
            input.answerKey.correctAnswerText,
            JSON.stringify(input.answerKey.correctAnswerJson),
            input.answerKey.explanationText,
            input.createdAt,
          ],
        );
        const answerKeyRow = answerKeyResult.rows[0];
        if (!answerKeyRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-exam] Khong tao duoc dap an cau hoi.",
            statusCode: 500,
          });
        }

        await client.query("commit");
        return {
          question: mapExamQuestionRow(questionRow),
          answerKey: mapExamAnswerKeyRow(answerKeyRow),
        };
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("tao cau hoi cho exam", error);
      } finally {
        client.release();
      }
    },

    async listExamQuestionsByExamCode(
      examCode: string,
      actorUserId: string,
    ): Promise<ClassExamQuestionItemRecord[]> {
      try {
        const examResult = await pool.query<ExamOwnerRow>(
          `select id, exam_code, created_by_user_id
           from public.class_exams
           where exam_code = $1
           limit 1`,
          [examCode.trim().toUpperCase()],
        );
        const examRow = examResult.rows[0];
        if (!examRow) {
          throw new AuthError({
            code: "EXAM_NOT_FOUND",
            message: "Khong tim thay bai kiem tra theo ma da nhap.",
            statusCode: 404,
          });
        }
        if (examRow.created_by_user_id !== actorUserId) {
          throw new AuthError({
            code: "EXAM_CONTENT_PERMISSION_REQUIRED",
            message: "Tai khoan hien tai khong co quyen sua noi dung bai kiem tra.",
            statusCode: 403,
          });
        }

        const result = await pool.query<
          ExamQuestionRow & {
            answer_key_id: string | null;
            answer_key_type: string | null;
            answer_key_correct_answer_text: string | null;
            answer_key_correct_answer_json: Record<string, unknown> | null;
            answer_key_explanation_text: string | null;
            answer_key_created_at: string | null;
            answer_key_updated_at: string | null;
          }
        >(
          `select
             q.*,
             ak.id as answer_key_id,
             ak.key_type as answer_key_type,
             ak.correct_answer_text as answer_key_correct_answer_text,
             ak.correct_answer_json as answer_key_correct_answer_json,
             ak.explanation_text as answer_key_explanation_text,
             ak.created_at as answer_key_created_at,
             ak.updated_at as answer_key_updated_at
           from public.exam_questions q
           left join public.exam_answer_keys ak on ak.question_id = q.id
           where q.class_exam_id = $1
           order by q.question_order asc, q.created_at asc`,
          [examRow.id],
        );

        return result.rows.map((row) => {
          if (
            !row.answer_key_id ||
            !row.answer_key_type ||
            !row.answer_key_created_at ||
            !row.answer_key_updated_at
          ) {
            throw new AuthError({
              code: "POSTGRES_DATA_INVALID",
              message: "[postgres-exam] Cau hoi khong co dap an di kem.",
              statusCode: 500,
            });
          }

          return {
            question: mapExamQuestionRow(row),
            answerKey: mapExamAnswerKeyRow({
              id: row.answer_key_id,
              question_id: row.id,
              key_type: row.answer_key_type,
              correct_answer_text: row.answer_key_correct_answer_text,
              correct_answer_json: row.answer_key_correct_answer_json,
              explanation_text: row.answer_key_explanation_text,
              created_at: row.answer_key_created_at,
              updated_at: row.answer_key_updated_at,
            }),
          };
        });
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("liet ke cau hoi theo exam", error);
      }
    },

    async updateExamQuestion(input: UpdateExamQuestionInput): Promise<ClassExamQuestionItemRecord> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const questionOwnerResult = await client.query<ExamQuestionOwnerRow>(
          `select q.id, q.class_exam_id, q.question_order, ce.created_by_user_id
           from public.exam_questions q
           inner join public.class_exams ce on ce.id = q.class_exam_id
           where q.id = $1
           limit 1
           for update`,
          [input.questionId],
        );
        const questionOwnerRow = questionOwnerResult.rows[0];
        if (!questionOwnerRow) {
          throw new AuthError({
            code: "EXAM_QUESTION_NOT_FOUND",
            message: "Khong tim thay cau hoi theo questionId.",
            statusCode: 404,
          });
        }
        if (questionOwnerRow.created_by_user_id !== input.actorUserId) {
          throw new AuthError({
            code: "EXAM_CONTENT_PERMISSION_REQUIRED",
            message: "Tai khoan hien tai khong co quyen sua noi dung bai kiem tra.",
            statusCode: 403,
          });
        }

        const questionResult = await client.query<ExamQuestionRow>(
          `update public.exam_questions
           set
             question_order = $2,
             prompt_text = $3,
             points = $4,
             metadata_json = $5::jsonb,
             updated_at = $6
           where id = $1
           returning *`,
          [
            input.questionId,
            input.questionOrder,
            input.promptText,
            input.points,
            JSON.stringify(input.metadataJson),
            input.updatedAt,
          ],
        );
        const questionRow = questionResult.rows[0];
        if (!questionRow) {
          throw new AuthError({
            code: "EXAM_QUESTION_NOT_FOUND",
            message: "Khong tim thay cau hoi theo questionId.",
            statusCode: 404,
          });
        }

        const answerKeyResult = await client.query<ExamAnswerKeyRow>(
          `update public.exam_answer_keys
           set
             key_type = $2,
             correct_answer_text = $3,
             correct_answer_json = $4::jsonb,
             explanation_text = $5,
             updated_at = $6
           where question_id = $1
           returning *`,
          [
            input.questionId,
            input.answerKey.keyType,
            input.answerKey.correctAnswerText,
            JSON.stringify(input.answerKey.correctAnswerJson),
            input.answerKey.explanationText,
            input.updatedAt,
          ],
        );
        const answerKeyRow = answerKeyResult.rows[0];
        if (!answerKeyRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-exam] Khong tim thay dap an cua cau hoi.",
            statusCode: 500,
          });
        }

        await client.query("commit");
        return {
          question: mapExamQuestionRow(questionRow),
          answerKey: mapExamAnswerKeyRow(answerKeyRow),
        };
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("cap nhat cau hoi exam", error);
      } finally {
        client.release();
      }
    },

    async deleteExamQuestion(input: DeleteExamQuestionInput): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const questionOwnerResult = await client.query<ExamQuestionOwnerRow>(
          `select q.id, q.class_exam_id, q.question_order, ce.created_by_user_id
           from public.exam_questions q
           inner join public.class_exams ce on ce.id = q.class_exam_id
           where q.id = $1
           limit 1
           for update`,
          [input.questionId],
        );
        const questionOwnerRow = questionOwnerResult.rows[0];
        if (!questionOwnerRow) {
          throw new AuthError({
            code: "EXAM_QUESTION_NOT_FOUND",
            message: "Khong tim thay cau hoi theo questionId.",
            statusCode: 404,
          });
        }
        if (questionOwnerRow.created_by_user_id !== input.actorUserId) {
          throw new AuthError({
            code: "EXAM_CONTENT_PERMISSION_REQUIRED",
            message: "Tai khoan hien tai khong co quyen sua noi dung bai kiem tra.",
            statusCode: 403,
          });
        }

        await client.query(`delete from public.exam_questions where id = $1`, [input.questionId]);

        await client.query("commit");
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("xoa cau hoi exam", error);
      } finally {
        client.release();
      }
    },

    async upsertAttemptAnswer(
      input: UpsertAttemptAnswerInput,
    ): Promise<ClassExamAttemptAnswerItemRecord> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const attemptRow = await batBuocAttemptTonTaiVaCoQuyenTruyCap(
          client,
          input.attemptId,
          input.actorUserId,
          true,
        );
        if (attemptRow.status !== "started") {
          throw new AuthError({
            code: "EXAM_ATTEMPT_ALREADY_SUBMITTED",
            message: "Attempt da nop bai, khong duoc sua cau tra loi.",
            statusCode: 409,
          });
        }

        const questionResult = await client.query<ExamQuestionRow>(
          `select *
           from public.exam_questions
           where id = $1
             and class_exam_id = $2
           limit 1`,
          [input.questionId, attemptRow.class_exam_id],
        );
        const questionRow = questionResult.rows[0];
        if (!questionRow) {
          throw new AuthError({
            code: "EXAM_ATTEMPT_QUESTION_MISMATCH",
            message: "questionId khong thuoc bai kiem tra cua attempt.",
            statusCode: 400,
          });
        }

        const answerResult = await client.query<AttemptAnswerRow>(
          `insert into public.class_exam_attempt_answers (
             attempt_id,
             question_id,
             answer_text,
             answer_json,
             awarded_points,
             scored_at,
             created_at,
             updated_at
           )
           values ($1, $2, $3, $4::jsonb, null, null, $5, $5)
           on conflict (attempt_id, question_id)
           do update
             set answer_text = excluded.answer_text,
                 answer_json = excluded.answer_json,
                 awarded_points = null,
                 manual_awarded_points = null,
                 grading_note = null,
                 graded_by = null,
                 graded_at = null,
                 scored_at = null,
                 updated_at = excluded.updated_at
           returning *`,
          [
            input.attemptId,
            input.questionId,
            input.answerText,
            JSON.stringify(input.answerJson),
            input.updatedAt,
          ],
        );
        const answerRow = answerResult.rows[0];
        if (!answerRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-exam] Khong luu duoc cau tra loi theo attempt.",
            statusCode: 500,
          });
        }

        await client.query("commit");
        return {
          answer: mapAttemptAnswerRow(answerRow),
          question: mapExamQuestionRow(questionRow),
        };
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("luu cau tra loi theo attempt", error);
      } finally {
        client.release();
      }
    },

    async listAttemptAnswers(
      input: ListAttemptAnswersInput,
    ): Promise<ClassExamAttemptAnswerItemRecord[]> {
      const client = await pool.connect();
      try {
        const attemptRow = await batBuocAttemptTonTaiVaCoQuyenTruyCap(
          client,
          input.attemptId,
          input.actorUserId,
          false,
        );

        const result = await client.query<
          AttemptAnswerRow & {
            question_order: number;
            question_type: string;
            prompt_text: string;
            points: string | number;
            metadata_json: Record<string, unknown> | null;
            created_by_user_id: string;
            question_created_at: string;
            question_updated_at: string;
          }
        >(
          `select
             aa.*,
             q.question_order,
             q.question_type,
             q.prompt_text,
             q.points,
             q.metadata_json,
             q.created_by_user_id,
             q.created_at as question_created_at,
             q.updated_at as question_updated_at
           from public.class_exam_attempt_answers aa
           inner join public.exam_questions q on q.id = aa.question_id
           where aa.attempt_id = $1
             and q.class_exam_id = $2
           order by q.question_order asc, aa.created_at asc`,
          [attemptRow.id, attemptRow.class_exam_id],
        );

        return result.rows.map((row) => ({
          answer: mapAttemptAnswerRow(row),
          question: mapExamQuestionRow({
            id: row.question_id,
            class_exam_id: attemptRow.class_exam_id,
            question_order: row.question_order,
            question_type: row.question_type,
            prompt_text: row.prompt_text,
            points: row.points,
            metadata_json: row.metadata_json,
            created_by_user_id: row.created_by_user_id,
            created_at: row.question_created_at,
            updated_at: row.question_updated_at,
          }),
        }));
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("liet ke cau tra loi theo attempt", error);
      } finally {
        client.release();
      }
    },

    async submitClassExamAttempt(
      input: SubmitClassExamAttemptInput,
    ): Promise<SubmitClassExamAttemptResult> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const attemptRow = await batBuocAttemptTonTaiVaCoQuyenTruyCap(
          client,
          input.attemptId,
          input.actorUserId,
          true,
        );
        if (attemptRow.status !== "started") {
          throw new AuthError({
            code: "EXAM_ATTEMPT_ALREADY_SUBMITTED",
            message: "Attempt da nop bai, khong the nop lai.",
            statusCode: 409,
          });
        }

        const questionRowsResult = await client.query<
          ExamQuestionRow & {
            answer_key_id: string;
            answer_key_type: string;
            answer_key_correct_answer_text: string | null;
            answer_key_correct_answer_json: Record<string, unknown> | null;
            answer_key_explanation_text: string | null;
            answer_key_created_at: string;
            answer_key_updated_at: string;
          }
        >(
          `select
             q.*,
             ak.id as answer_key_id,
             ak.key_type as answer_key_type,
             ak.correct_answer_text as answer_key_correct_answer_text,
             ak.correct_answer_json as answer_key_correct_answer_json,
             ak.explanation_text as answer_key_explanation_text,
             ak.created_at as answer_key_created_at,
             ak.updated_at as answer_key_updated_at
           from public.exam_questions q
           inner join public.exam_answer_keys ak on ak.question_id = q.id
           where q.class_exam_id = $1
           order by q.question_order asc, q.created_at asc`,
          [attemptRow.class_exam_id],
        );

        const answerRowsResult = await client.query<AttemptAnswerRow>(
          `select *
           from public.class_exam_attempt_answers
           where attempt_id = $1`,
          [attemptRow.id],
        );
        const answerByQuestionId = new Map<string, AttemptAnswerRow>();
        for (const answerRow of answerRowsResult.rows) {
          answerByQuestionId.set(answerRow.question_id, answerRow);
        }

        let awardedScore = 0;
        let maxAutoGradableScore = 0;
        let pendingManualGradingCount = 0;
        let autoGradedQuestionCount = 0;
        let answeredQuestionCount = 0;

        for (const row of questionRowsResult.rows) {
          const question = mapExamQuestionRow(row);
          const answerKey = mapExamAnswerKeyRow({
            id: row.answer_key_id,
            question_id: row.id,
            key_type: row.answer_key_type,
            correct_answer_text: row.answer_key_correct_answer_text,
            correct_answer_json: row.answer_key_correct_answer_json,
            explanation_text: row.answer_key_explanation_text,
            created_at: row.answer_key_created_at,
            updated_at: row.answer_key_updated_at,
          });
          const answerRow = answerByQuestionId.get(question.id);
          const answer = answerRow ? mapAttemptAnswerRow(answerRow) : null;
          if (answer) {
            answeredQuestionCount += 1;
          }

          const ketQuaCham = chamDiemNenChoCauHoi(question, answerKey, answer);
          awardedScore += ketQuaCham.awardedPoints;
          maxAutoGradableScore += ketQuaCham.maxAutoPoints;
          if (ketQuaCham.laCauChamTuDong) {
            autoGradedQuestionCount += 1;
          }
          if (ketQuaCham.laCauTuLuanChoChamTay && coTraLoiTextCoNoiDung(answer)) {
            pendingManualGradingCount += 1;
          }

          if (answerRow) {
            await client.query(
              `update public.class_exam_attempt_answers
               set awarded_points = $2,
                   scored_at = $3,
                   updated_at = $3
               where id = $1`,
              [answerRow.id, lamTronDiemNen(ketQuaCham.awardedPoints), input.submittedAt],
            );
          }
        }

        const attemptResult = await client.query<ClassExamAttemptRow>(
          `update public.class_exam_attempts
           set
             status = 'submitted',
             submitted_at = $2,
             auto_graded_score = $3,
             max_auto_graded_score = $4,
             final_score = $5,
             pending_manual_grading_count = $6,
             updated_at = $2
           where id = $1
           returning *`,
          [
            attemptRow.id,
            input.submittedAt,
            lamTronDiemNen(awardedScore),
            lamTronDiemNen(maxAutoGradableScore),
            pendingManualGradingCount === 0 ? lamTronDiemNen(awardedScore) : null,
            pendingManualGradingCount,
          ],
        );
        const updatedAttemptRow = attemptResult.rows[0];
        if (!updatedAttemptRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-exam] Khong cap nhat duoc trang thai submit cho attempt.",
            statusCode: 500,
          });
        }

        await client.query("commit");
        return {
          attempt: mapClassExamAttemptRow(updatedAttemptRow),
          scoreSummary: {
            awardedScore: lamTronDiemNen(awardedScore),
            maxAutoGradableScore: lamTronDiemNen(maxAutoGradableScore),
            pendingManualGradingCount,
            autoGradedQuestionCount,
            answeredQuestionCount,
            totalQuestionCount: questionRowsResult.rows.length,
          },
        };
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresExam("nop bai va cham diem nen cho attempt", error);
      } finally {
        client.release();
      }
    },
  };
}
