import { AuthError } from "@/server/auth/errors";
import { layPostgresPool } from "@/server/db/postgres-pool";
import type {
  CreateClassExamInput,
  CreateExamQuestionInput,
  DeleteExamQuestionInput,
  ExamRepository,
  StartClassExamInput,
  UpdateExamQuestionInput,
} from "@/server/exams/repository/exam-repository";
import {
  CLASS_EXAM_ANSWER_KEY_TYPES,
  CLASS_EXAM_ATTEMPT_STATUSES,
  CLASS_EXAM_QUESTION_TYPES,
  CLASS_EXAM_STATUSES,
  type ClassExamAnswerKeyRecord,
  type ClassExamAttemptRecord,
  type ClassExamAttemptStatus,
  type ClassExamQuestionItemRecord,
  type ClassExamQuestionRecord,
  type ClassExamQuestionType,
  type ClassExamRecord,
  type ClassExamStatus,
  type MyCreatedClassExamItem,
  type StartClassExamResult,
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

  if (message.includes("ANSWER_KEY_TYPE_MISMATCH")) {
    throw new AuthError({
      code: "INVALID_ANSWER_KEY",
      message: "Loai dap an khong khop voi loai cau hoi.",
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
             created_at,
             updated_at
           )
           values ($1, $2, 'started', $3, null, $3, $3)
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
  };
}
