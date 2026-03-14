import type { QueryResult, QueryResultRow } from "pg";
import { AuthError } from "@/server/auth/errors";
import type {
  AuthRepository,
  CreateSessionInput,
  CreateUserInput,
  ListTeacherVerificationRequestsInput,
  ListTeacherVerificationRequestsResult,
  ReviewTeacherVerificationInput,
  ReviewTeacherVerificationResult,
  UpdateUserInput,
  UpsertProfileInput,
} from "@/server/auth/repository/auth-repository";
import { layPostgresPool } from "@/server/db/postgres-pool";
import {
  ACCOUNT_STATUSES,
  APP_ROLES,
  IDENTITY_STATUSES,
  TEACHER_VERIFICATION_STATUSES,
  type AccountRecord,
  type AccountStatus,
  type AppRole,
  type IdentityStatus,
  type SessionRecord,
  type TeacherVerificationRequestRecord,
  type TeacherVerificationStatus,
  type UserProfileRecord,
} from "@/types/auth";

type UserAccountRow = {
  id: string;
  email: string;
  password_hash: string;
  roles: string[];
  account_status: string;
  identity_status: string;
  teacher_verification_status: string;
  created_by_user_id: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type UserProfileRow = {
  user_id: string;
  display_name: string;
  full_name: string;
  birth_year: number | null;
  school_name: string | null;
  created_at: string;
  updated_at: string;
};

type AppSessionRow = {
  token_hash: string;
  user_id: string;
  issued_at: string;
  expires_at: string;
  created_at: string;
};

type TeacherVerificationRequestRow = {
  id: string;
  user_id: string;
  full_name: string;
  school_name: string;
  teaching_subjects: string[];
  evidence_note: string;
  evidence_urls: string[];
  status: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewTeacherVerificationRow = {
  request_row: TeacherVerificationRequestRow | null;
  account_row: UserAccountRow | null;
};

type TeacherVerificationListJoinRow = {
  request_id: string;
  request_user_id: string;
  request_full_name: string;
  request_school_name: string;
  request_teaching_subjects: string[];
  request_evidence_note: string;
  request_evidence_urls: string[];
  request_status: string;
  request_submitted_at: string;
  request_reviewed_by: string | null;
  request_reviewed_at: string | null;
  request_admin_note: string | null;
  request_created_at: string;
  request_updated_at: string;
  account_id: string;
  account_email: string;
  account_password_hash: string;
  account_roles: string[];
  account_account_status: string;
  account_identity_status: string;
  account_teacher_verification_status: string;
  account_created_by_user_id: string | null;
  account_last_login_at: string | null;
  account_created_at: string;
  account_updated_at: string;
  profile_user_id: string | null;
  profile_display_name: string | null;
  profile_full_name: string | null;
  profile_birth_year: number | null;
  profile_school_name: string | null;
  profile_created_at: string | null;
  profile_updated_at: string | null;
};

function taoLoiPostgres(action: string, error: unknown): never {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message =
    typeof error === "object" && error && "message" in error ? String(error.message) : "Loi khong xac dinh";

  if (code === "23505") {
    throw new AuthError({
      code: "UNIQUE_CONSTRAINT_VIOLATION",
      message: `[postgres-auth] Vi pham rang buoc duy nhat khi ${action}.`,
      statusCode: 409,
    });
  }

  throw new AuthError({
    code: "POSTGRES_QUERY_FAILED",
    message: `[postgres-auth] Loi khi ${action}: ${message}`,
    statusCode: 500,
  });
}

function docThongDiepLoi(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return "";
}

function docGiaTriEnum<T extends readonly string[]>(
  value: string,
  validValues: T,
  fieldName: string,
): T[number] {
  if (!validValues.includes(value as T[number])) {
    throw new AuthError({
      code: "POSTGRES_DATA_INVALID",
      message: `[postgres-auth] Truong ${fieldName} khong hop le: ${value}.`,
      statusCode: 500,
    });
  }

  return value as T[number];
}

function docDanhSachRole(rawRoles: string[]): AppRole[] {
  const normalized = rawRoles.map((item) => item.trim()).filter((item) => item.length > 0);
  if (normalized.length === 0) {
    throw new AuthError({
      code: "POSTGRES_DATA_INVALID",
      message: "[postgres-auth] Danh sach role rong.",
      statusCode: 500,
    });
  }

  return normalized.map((role) => docGiaTriEnum(role, APP_ROLES, "roles"));
}

function layHangDuyNhat<T extends QueryResultRow>(result: QueryResult<T>, action: string): T {
  if (result.rowCount !== 1 || result.rows.length !== 1) {
    throw new AuthError({
      code: "POSTGRES_DATA_INVALID",
      message: `[postgres-auth] Ket qua ${action} khong hop le.`,
      statusCode: 500,
    });
  }

  return result.rows[0] as T;
}

function mapUserAccountRow(row: UserAccountRow): AccountRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    roles: docDanhSachRole(row.roles),
    accountStatus: docGiaTriEnum(
      row.account_status,
      ACCOUNT_STATUSES,
      "account_status",
    ) as AccountStatus,
    identityStatus: docGiaTriEnum(
      row.identity_status,
      IDENTITY_STATUSES,
      "identity_status",
    ) as IdentityStatus,
    teacherVerificationStatus: docGiaTriEnum(
      row.teacher_verification_status,
      TEACHER_VERIFICATION_STATUSES,
      "teacher_verification_status",
    ) as TeacherVerificationStatus,
    createdByUserId: row.created_by_user_id,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUserProfileRow(row: UserProfileRow): UserProfileRecord {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    fullName: row.full_name,
    birthYear: row.birth_year,
    schoolName: row.school_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSessionRow(row: AppSessionRow): SessionRecord {
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function mapTeacherVerificationRequestRow(
  row: TeacherVerificationRequestRow,
): TeacherVerificationRequestRecord {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    schoolName: row.school_name,
    teachingSubjects: [...row.teaching_subjects],
    evidenceNote: row.evidence_note,
    evidenceUrls: [...row.evidence_urls],
    status: docGiaTriEnum(
      row.status,
      ["pending_review", "approved", "rejected"] as const,
      "status",
    ),
    submittedAt: row.submitted_at,
    reviewedByUserId: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTeacherVerificationListJoinRow(row: TeacherVerificationListJoinRow) {
  const request = mapTeacherVerificationRequestRow({
    id: row.request_id,
    user_id: row.request_user_id,
    full_name: row.request_full_name,
    school_name: row.request_school_name,
    teaching_subjects: row.request_teaching_subjects,
    evidence_note: row.request_evidence_note,
    evidence_urls: row.request_evidence_urls,
    status: row.request_status,
    submitted_at: row.request_submitted_at,
    reviewed_by: row.request_reviewed_by,
    reviewed_at: row.request_reviewed_at,
    admin_note: row.request_admin_note,
    created_at: row.request_created_at,
    updated_at: row.request_updated_at,
  });

  const account = mapUserAccountRow({
    id: row.account_id,
    email: row.account_email,
    password_hash: row.account_password_hash,
    roles: row.account_roles,
    account_status: row.account_account_status,
    identity_status: row.account_identity_status,
    teacher_verification_status: row.account_teacher_verification_status,
    created_by_user_id: row.account_created_by_user_id,
    last_login_at: row.account_last_login_at,
    created_at: row.account_created_at,
    updated_at: row.account_updated_at,
  });

  const profile =
    row.profile_user_id &&
    row.profile_display_name &&
    row.profile_full_name &&
    row.profile_created_at &&
    row.profile_updated_at
      ? mapUserProfileRow({
          user_id: row.profile_user_id,
          display_name: row.profile_display_name,
          full_name: row.profile_full_name,
          birth_year: row.profile_birth_year,
          school_name: row.profile_school_name,
          created_at: row.profile_created_at,
          updated_at: row.profile_updated_at,
        })
      : null;

  return {
    request,
    account,
    profile,
  };
}

function mapLoiReviewTeacherVerification(error: unknown): AuthError | null {
  const message = docThongDiepLoi(error);

  if (message.includes("ADMIN_ACTOR_NOT_FOUND")) {
    return new AuthError({
      code: "ADMIN_ACTOR_NOT_FOUND",
      message: "Khong tim thay tai khoan admin thuc hien review.",
      statusCode: 404,
    });
  }

  if (message.includes("ADMIN_PERMISSION_REQUIRED")) {
    return new AuthError({
      code: "ADMIN_PERMISSION_REQUIRED",
      message: "Tai khoan hien tai khong co quyen review xac minh giao vien.",
      statusCode: 403,
    });
  }

  if (message.includes("REQUEST_NOT_FOUND")) {
    return new AuthError({
      code: "REQUEST_NOT_FOUND",
      message: "Khong tim thay yeu cau xac minh giao vien.",
      statusCode: 404,
    });
  }

  if (message.includes("REQUEST_ALREADY_REVIEWED")) {
    return new AuthError({
      code: "REQUEST_ALREADY_REVIEWED",
      message: "Yeu cau da duoc review truoc do, khong the review lai.",
      statusCode: 409,
    });
  }

  if (message.includes("TARGET_ACCOUNT_NOT_FOUND")) {
    return new AuthError({
      code: "TARGET_ACCOUNT_NOT_FOUND",
      message: "Khong tim thay tai khoan can cap nhat trang thai giao vien.",
      statusCode: 404,
    });
  }

  if (message.includes("INVALID_REVIEW_ACTION")) {
    return new AuthError({
      code: "INVALID_REVIEW_ACTION",
      message: "Hanh dong review khong hop le.",
      statusCode: 400,
    });
  }

  return null;
}

export function taoPostgresAuthRepository(): AuthRepository {
  const pool = layPostgresPool();

  return {
    async createUser(input: CreateUserInput): Promise<AccountRecord> {
      try {
        const result = await pool.query<UserAccountRow>(
          `insert into public.user_accounts (
             email,
             password_hash,
             roles,
             account_status,
             identity_status,
             teacher_verification_status,
             created_at,
             updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $7)
           returning *`,
          [
            input.email.toLowerCase(),
            input.passwordHash,
            input.roles,
            input.accountStatus,
            input.identityStatus,
            input.teacherVerificationStatus,
            input.createdAt,
          ],
        );

        return mapUserAccountRow(layHangDuyNhat(result, "tao tai khoan"));
      } catch (error) {
        taoLoiPostgres("tao tai khoan", error);
      }
    },

    async findUserByEmail(email: string): Promise<AccountRecord | null> {
      try {
        const result = await pool.query<UserAccountRow>(
          `select *
           from public.user_accounts
           where email = $1
           limit 1`,
          [email.toLowerCase()],
        );

        if (result.rowCount === 0) {
          return null;
        }

        return mapUserAccountRow(layHangDuyNhat(result, "tim tai khoan theo email"));
      } catch (error) {
        taoLoiPostgres("tim tai khoan theo email", error);
      }
    },

    async findUserById(userId: string): Promise<AccountRecord | null> {
      try {
        const result = await pool.query<UserAccountRow>(
          `select *
           from public.user_accounts
           where id = $1
           limit 1`,
          [userId],
        );

        if (result.rowCount === 0) {
          return null;
        }

        return mapUserAccountRow(layHangDuyNhat(result, "tim tai khoan theo id"));
      } catch (error) {
        taoLoiPostgres("tim tai khoan theo id", error);
      }
    },

    async updateUser(userId: string, input: UpdateUserInput): Promise<AccountRecord> {
      const patchColumns: string[] = [];
      const values: unknown[] = [];

      if (input.roles) {
        values.push(input.roles);
        patchColumns.push(`roles = $${values.length}`);
      }

      if (input.accountStatus) {
        values.push(input.accountStatus);
        patchColumns.push(`account_status = $${values.length}`);
      }

      if (input.identityStatus) {
        values.push(input.identityStatus);
        patchColumns.push(`identity_status = $${values.length}`);
      }

      if (input.teacherVerificationStatus) {
        values.push(input.teacherVerificationStatus);
        patchColumns.push(`teacher_verification_status = $${values.length}`);
      }

      if (input.lastLoginAt !== undefined) {
        values.push(input.lastLoginAt);
        patchColumns.push(`last_login_at = $${values.length}`);
      }

      if (patchColumns.length === 0) {
        const current = await this.findUserById(userId);
        if (!current) {
          throw new AuthError({
            code: "USER_NOT_FOUND",
            message: "Khong tim thay user de cap nhat.",
            statusCode: 404,
          });
        }
        return current;
      }

      values.push(new Date().toISOString());
      patchColumns.push(`updated_at = $${values.length}`);
      values.push(userId);

      try {
        const result = await pool.query<UserAccountRow>(
          `update public.user_accounts
           set ${patchColumns.join(", ")}
           where id = $${values.length}
           returning *`,
          values,
        );

        if (result.rowCount === 0) {
          throw new AuthError({
            code: "USER_NOT_FOUND",
            message: "Khong tim thay user de cap nhat.",
            statusCode: 404,
          });
        }

        return mapUserAccountRow(layHangDuyNhat(result, "cap nhat tai khoan"));
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }
        taoLoiPostgres("cap nhat tai khoan", error);
      }
    },

    async upsertProfile(input: UpsertProfileInput): Promise<UserProfileRecord> {
      try {
        const result = await pool.query<UserProfileRow>(
          `insert into public.user_profiles (
             user_id,
             display_name,
             full_name,
             birth_year,
             school_name,
             created_at,
             updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (user_id) do update
           set
             display_name = excluded.display_name,
             full_name = excluded.full_name,
             birth_year = excluded.birth_year,
             school_name = excluded.school_name,
             updated_at = excluded.updated_at
           returning *`,
          [
            input.userId,
            input.displayName,
            input.fullName,
            input.birthYear ?? null,
            input.schoolName ?? null,
            input.createdAt,
            input.updatedAt,
          ],
        );

        return mapUserProfileRow(layHangDuyNhat(result, "upsert ho so"));
      } catch (error) {
        taoLoiPostgres("upsert ho so", error);
      }
    },

    async findProfileByUserId(userId: string): Promise<UserProfileRecord | null> {
      try {
        const result = await pool.query<UserProfileRow>(
          `select *
           from public.user_profiles
           where user_id = $1
           limit 1`,
          [userId],
        );

        if (result.rowCount === 0) {
          return null;
        }

        return mapUserProfileRow(layHangDuyNhat(result, "tim ho so theo user id"));
      } catch (error) {
        taoLoiPostgres("tim ho so theo user id", error);
      }
    },

    async createSession(input: CreateSessionInput): Promise<SessionRecord> {
      try {
        const result = await pool.query<AppSessionRow>(
          `insert into public.app_sessions (
             token_hash,
             user_id,
             issued_at,
             expires_at,
             created_at
           )
           values ($1, $2, $3, $4, $5)
           returning *`,
          [input.tokenHash, input.userId, input.issuedAt, input.expiresAt, input.createdAt],
        );

        return mapSessionRow(layHangDuyNhat(result, "tao session"));
      } catch (error) {
        taoLoiPostgres("tao session", error);
      }
    },

    async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
      try {
        const result = await pool.query<AppSessionRow>(
          `select *
           from public.app_sessions
           where token_hash = $1
           limit 1`,
          [tokenHash],
        );

        if (result.rowCount === 0) {
          return null;
        }

        return mapSessionRow(layHangDuyNhat(result, "tim session theo token hash"));
      } catch (error) {
        taoLoiPostgres("tim session theo token hash", error);
      }
    },

    async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
      try {
        await pool.query(
          `delete from public.app_sessions
           where token_hash = $1`,
          [tokenHash],
        );
      } catch (error) {
        taoLoiPostgres("xoa session", error);
      }
    },

    async upsertTeacherVerificationRequest(
      input: TeacherVerificationRequestRecord,
    ): Promise<TeacherVerificationRequestRecord> {
      try {
        const result = await pool.query<TeacherVerificationRequestRow>(
          `insert into public.teacher_verification_requests (
             id,
             user_id,
             full_name,
             school_name,
             teaching_subjects,
             evidence_note,
             evidence_urls,
             status,
             submitted_at,
             reviewed_by,
             reviewed_at,
             admin_note,
             created_at,
             updated_at
           )
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           on conflict (user_id) do update
           set
             full_name = excluded.full_name,
             school_name = excluded.school_name,
             teaching_subjects = excluded.teaching_subjects,
             evidence_note = excluded.evidence_note,
             evidence_urls = excluded.evidence_urls,
             status = excluded.status,
             submitted_at = excluded.submitted_at,
             reviewed_by = excluded.reviewed_by,
             reviewed_at = excluded.reviewed_at,
             admin_note = excluded.admin_note,
             updated_at = excluded.updated_at
           returning *`,
          [
            input.id,
            input.userId,
            input.fullName,
            input.schoolName,
            input.teachingSubjects,
            input.evidenceNote,
            input.evidenceUrls,
            input.status,
            input.submittedAt,
            input.reviewedByUserId ?? null,
            input.reviewedAt ?? null,
            input.adminNote ?? null,
            input.createdAt,
            input.updatedAt,
          ],
        );

        return mapTeacherVerificationRequestRow(
          layHangDuyNhat(result, "upsert yeu cau xac minh giao vien"),
        );
      } catch (error) {
        taoLoiPostgres("upsert yeu cau xac minh giao vien", error);
      }
    },

    async findTeacherVerificationByUserId(
      userId: string,
    ): Promise<TeacherVerificationRequestRecord | null> {
      try {
        const result = await pool.query<TeacherVerificationRequestRow>(
          `select *
           from public.teacher_verification_requests
           where user_id = $1
           limit 1`,
          [userId],
        );

        if (result.rowCount === 0) {
          return null;
        }

        return mapTeacherVerificationRequestRow(
          layHangDuyNhat(result, "tim yeu cau xac minh giao vien"),
        );
      } catch (error) {
        taoLoiPostgres("tim yeu cau xac minh giao vien", error);
      }
    },

    async listTeacherVerificationRequests(
      input: ListTeacherVerificationRequestsInput,
    ): Promise<ListTeacherVerificationRequestsResult> {
      try {
        const totalResult = await pool.query<{ total: string }>(
          `select count(*)::text as total
           from public.teacher_verification_requests
           where ($1::text is null or status = $1::text)`,
          [input.status ?? null],
        );
        const total = Number(totalResult.rows[0]?.total ?? "0");

        if (total === 0) {
          return {
            items: [],
            total: 0,
          };
        }

        const result = await pool.query<TeacherVerificationListJoinRow>(
          `select
             tvr.id as request_id,
             tvr.user_id as request_user_id,
             tvr.full_name as request_full_name,
             tvr.school_name as request_school_name,
             tvr.teaching_subjects as request_teaching_subjects,
             tvr.evidence_note as request_evidence_note,
             tvr.evidence_urls as request_evidence_urls,
             tvr.status as request_status,
             tvr.submitted_at as request_submitted_at,
             tvr.reviewed_by as request_reviewed_by,
             tvr.reviewed_at as request_reviewed_at,
             tvr.admin_note as request_admin_note,
             tvr.created_at as request_created_at,
             tvr.updated_at as request_updated_at,
             ua.id as account_id,
             ua.email as account_email,
             ua.password_hash as account_password_hash,
             ua.roles as account_roles,
             ua.account_status as account_account_status,
             ua.identity_status as account_identity_status,
             ua.teacher_verification_status as account_teacher_verification_status,
             ua.created_by_user_id as account_created_by_user_id,
             ua.last_login_at as account_last_login_at,
             ua.created_at as account_created_at,
             ua.updated_at as account_updated_at,
             up.user_id as profile_user_id,
             up.display_name as profile_display_name,
             up.full_name as profile_full_name,
             up.birth_year as profile_birth_year,
             up.school_name as profile_school_name,
             up.created_at as profile_created_at,
             up.updated_at as profile_updated_at
           from public.teacher_verification_requests tvr
           inner join public.user_accounts ua on ua.id = tvr.user_id
           left join public.user_profiles up on up.user_id = tvr.user_id
           where ($1::text is null or tvr.status = $1::text)
           order by tvr.submitted_at desc
           limit $2
           offset $3`,
          [input.status ?? null, input.limit, input.offset],
        );

        return {
          items: result.rows.map((row) => mapTeacherVerificationListJoinRow(row)),
          total,
        };
      } catch (error) {
        taoLoiPostgres("liet ke yeu cau xac minh giao vien", error);
      }
    },

    async reviewTeacherVerification(
      input: ReviewTeacherVerificationInput,
    ): Promise<ReviewTeacherVerificationResult> {
      try {
        const result = await pool.query<ReviewTeacherVerificationRow>(
          `select request_row, account_row
           from public.app_admin_review_teacher_verification($1, $2, $3, $4)`,
          [input.requestId, input.actorUserId, input.action, input.adminNote ?? null],
        );

        if (result.rowCount === 0) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-auth] Ham review giao vien khong tra du lieu.",
            statusCode: 500,
          });
        }

        const row = layHangDuyNhat(result, "review yeu cau xac minh giao vien");
        if (!row.request_row || !row.account_row) {
          throw new AuthError({
            code: "POSTGRES_DATA_INVALID",
            message: "[postgres-auth] Du lieu tra ve tu ham review khong hop le.",
            statusCode: 500,
          });
        }

        return {
          request: mapTeacherVerificationRequestRow(row.request_row),
          account: mapUserAccountRow(row.account_row),
        };
      } catch (error) {
        if (error instanceof AuthError) {
          throw error;
        }

        const mappedError = mapLoiReviewTeacherVerification(error);
        if (mappedError) {
          throw mappedError;
        }

        taoLoiPostgres("review yeu cau xac minh giao vien", error);
      }
    },
  };
}
