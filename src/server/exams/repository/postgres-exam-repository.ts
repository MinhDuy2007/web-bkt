import { AuthError } from "@/server/auth/errors";
import { layPostgresPool } from "@/server/db/postgres-pool";
import type {
  CreateClassExamInput,
  ExamRepository,
  StartClassExamInput,
} from "@/server/exams/repository/exam-repository";
import {
  CLASS_EXAM_ATTEMPT_STATUSES,
  CLASS_EXAM_STATUSES,
  type ClassExamAttemptRecord,
  type ClassExamAttemptStatus,
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

  throw new AuthError({
    code: "POSTGRES_EXAM_QUERY_FAILED",
    message: `[postgres-exam] Loi khi ${action}: ${message}`,
    statusCode: 500,
  });
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
        try {
          await client.query("rollback");
        } catch {
        }
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
        try {
          await client.query("rollback");
        } catch {
        }
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
  };
}
