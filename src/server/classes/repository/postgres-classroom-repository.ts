import type { PoolClient } from "pg";
import { AuthError } from "@/server/auth/errors";
import type {
  ClassroomRepository,
  CreateClassInput,
  CreateClassResult,
  JoinClassByCodeInput,
} from "@/server/classes/repository/classroom-repository";
import { layPostgresPool } from "@/server/db/postgres-pool";
import {
  CLASS_MEMBER_ROLES,
  CLASS_STATUSES,
  type ClassMemberRecord,
  type ClassMemberRole,
  type ClassRecord,
  type ClassStatus,
  type MyClassItemRecord,
} from "@/types/classroom";

type ClassRow = {
  id: string;
  class_code: string;
  education_level: string;
  subject_name: string;
  school_name: string | null;
  grade_label: string;
  full_class_name: string;
  teacher_user_id: string;
  join_code: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ClassMemberRow = {
  id: string;
  class_id: string;
  user_id: string;
  member_role: string;
  joined_at: string;
  created_at: string;
};

type MyClassJoinRow = ClassRow & {
  member_id: string;
  member_user_id: string;
  member_role: string;
  member_joined_at: string;
  member_created_at: string;
};

function docGiaTriEnum<T extends readonly string[]>(
  value: string,
  validValues: T,
  fieldName: string,
): T[number] {
  if (!validValues.includes(value as T[number])) {
    throw new AuthError({
      code: "POSTGRES_DATA_INVALID",
      message: `[postgres-classroom] Truong ${fieldName} khong hop le: ${value}.`,
      statusCode: 500,
    });
  }

  return value as T[number];
}

function mapClassRow(row: ClassRow): ClassRecord {
  return {
    id: row.id,
    classCode: row.class_code,
    educationLevel: row.education_level,
    subjectName: row.subject_name,
    schoolName: row.school_name,
    gradeLabel: row.grade_label,
    fullClassName: row.full_class_name,
    teacherUserId: row.teacher_user_id,
    joinCode: row.join_code,
    status: docGiaTriEnum(row.status, CLASS_STATUSES, "status") as ClassStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClassMemberRow(row: ClassMemberRow): ClassMemberRecord {
  return {
    id: row.id,
    classId: row.class_id,
    userId: row.user_id,
    memberRole: docGiaTriEnum(
      row.member_role,
      CLASS_MEMBER_ROLES,
      "member_role",
    ) as ClassMemberRole,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
  };
}

function taoLoiPostgresClassroom(action: string, error: unknown): never {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message =
    typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "Loi khong xac dinh";

  if (code === "23505" && message.includes("uq_classes_class_code")) {
    throw new AuthError({
      code: "CLASS_CODE_ALREADY_EXISTS",
      message: "Ma lop hoc da ton tai, vui long thu lai.",
      statusCode: 409,
    });
  }

  if (code === "23505" && message.includes("uq_class_members_class_id_user_id")) {
    throw new AuthError({
      code: "CLASS_MEMBER_ALREADY_EXISTS",
      message: "Tai khoan da la thanh vien cua lop hoc nay.",
      statusCode: 409,
    });
  }

  throw new AuthError({
    code: "POSTGRES_CLASSROOM_QUERY_FAILED",
    message: `[postgres-classroom] Loi khi ${action}: ${message}`,
    statusCode: 500,
  });
}

async function rollbackAnToan(client: PoolClient): Promise<void> {
  try {
    await client.query("rollback");
  } catch {
  }
}

function mapMyClassJoinRow(row: MyClassJoinRow): MyClassItemRecord {
  return {
    classRecord: mapClassRow(row),
    membership: {
      id: row.member_id,
      classId: row.id,
      userId: row.member_user_id,
      memberRole: docGiaTriEnum(
        row.member_role,
        CLASS_MEMBER_ROLES,
        "member_role",
      ) as ClassMemberRole,
      joinedAt: row.member_joined_at,
      createdAt: row.member_created_at,
    },
  };
}

export function taoPostgresClassroomRepository(): ClassroomRepository {
  const pool = layPostgresPool();

  return {
    async createClassByTeacher(input: CreateClassInput): Promise<CreateClassResult> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const classResult = await client.query<ClassRow>(
          `insert into public.classes (
             class_code,
             education_level,
             subject_name,
             school_name,
             grade_label,
             full_class_name,
             teacher_user_id,
             join_code,
             status,
             created_at,
             updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
           returning *`,
          [
            input.classCode.trim().toUpperCase(),
            input.educationLevel,
            input.subjectName,
            input.schoolName,
            input.gradeLabel,
            input.fullClassName,
            input.teacherUserId,
            input.joinCode.trim().toUpperCase(),
            input.status,
            input.createdAt,
          ],
        );

        const classRow = classResult.rows[0];
        if (!classRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-classroom] Khong tao duoc ban ghi lop hoc.",
            statusCode: 500,
          });
        }

        const memberResult = await client.query<ClassMemberRow>(
          `insert into public.class_members (
             class_id,
             user_id,
             member_role,
             joined_at,
             created_at
           )
           values ($1, $2, $3, $4, $4)
           returning *`,
          [classRow.id, input.teacherUserId, "teacher", input.createdAt],
        );

        const memberRow = memberResult.rows[0];
        if (!memberRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-classroom] Khong tao duoc membership cho giao vien.",
            statusCode: 500,
          });
        }

        await client.query("commit");
        return {
          classRecord: mapClassRow(classRow),
          teacherMembership: mapClassMemberRow(memberRow),
        };
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresClassroom("tao lop hoc", error);
      } finally {
        client.release();
      }
    },

    async listMyClasses(userId: string): Promise<MyClassItemRecord[]> {
      try {
        const result = await pool.query<MyClassJoinRow>(
          `select
             c.*,
             cm.id as member_id,
             cm.user_id as member_user_id,
             cm.member_role as member_role,
             cm.joined_at as member_joined_at,
             cm.created_at as member_created_at
           from public.class_members cm
           inner join public.classes c on c.id = cm.class_id
           where cm.user_id = $1
           order by cm.joined_at desc`,
          [userId],
        );

        return result.rows.map((row) => mapMyClassJoinRow(row));
      } catch (error) {
        taoLoiPostgresClassroom("liet ke lop hoc cua toi", error);
      }
    },

    async joinClassByCode(input: JoinClassByCodeInput): Promise<MyClassItemRecord> {
      const client = await pool.connect();
      try {
        await client.query("begin");

        const classResult = await client.query<ClassRow>(
          `select *
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
            message: "Khong tim thay lop hoc theo ma da nhap.",
            statusCode: 404,
          });
        }

        if (classRow.status !== "active") {
          throw new AuthError({
            code: "CLASS_NOT_AVAILABLE",
            message: "Lop hoc hien khong con mo de tham gia.",
            statusCode: 409,
          });
        }

        const joinCode = input.joinCode.trim().toUpperCase();
        if (classRow.join_code !== joinCode) {
          throw new AuthError({
            code: "CLASS_JOIN_CODE_INVALID",
            message: "Ma tham gia lop hoc khong dung.",
            statusCode: 400,
          });
        }

        const nowIso = new Date().toISOString();
        const memberResult = await client.query<ClassMemberRow>(
          `insert into public.class_members (
             class_id,
             user_id,
             member_role,
             joined_at,
             created_at
           )
           values ($1, $2, $3, $4, $4)
           returning *`,
          [classRow.id, input.userId, input.memberRole, nowIso],
        );

        const memberRow = memberResult.rows[0];
        if (!memberRow) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-classroom] Khong tao duoc membership moi.",
            statusCode: 500,
          });
        }

        await client.query("commit");
        return {
          classRecord: mapClassRow(classRow),
          membership: mapClassMemberRow(memberRow),
        };
      } catch (error) {
        await rollbackAnToan(client);
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgresClassroom("tham gia lop hoc bang ma", error);
      } finally {
        client.release();
      }
    },
  };
}
