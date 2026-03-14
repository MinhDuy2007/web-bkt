import type { PostgrestError } from "@supabase/supabase-js";
import { AuthError } from "@/server/auth/errors";
import type {
  AuthRepository,
  CreateSessionInput,
  CreateUserInput,
  UpdateUserInput,
  UpsertProfileInput,
} from "@/server/auth/repository/auth-repository";
import { taoSupabaseAdminServerClient } from "@/server/supabase/server-client";
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

// Module nay chi danh cho admin/internal path can service role.
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

function taoLoiSupabase(action: string, error: PostgrestError): never {
  if (error.code === "23505") {
    throw new AuthError({
      code: "UNIQUE_CONSTRAINT_VIOLATION",
      message: `[supabase-auth] Vi pham rang buoc duy nhat khi ${action}.`,
      statusCode: 409,
    });
  }

  throw new AuthError({
    code: "SUPABASE_QUERY_FAILED",
    message: `[supabase-auth] Loi khi ${action}: ${error.message}`,
    statusCode: 500,
  });
}

function docGiaTriEnum<T extends readonly string[]>(
  value: string,
  validValues: T,
  fieldName: string,
): T[number] {
  if (!validValues.includes(value as T[number])) {
    throw new AuthError({
      code: "SUPABASE_DATA_INVALID",
      message: `[supabase-auth] Truong ${fieldName} khong hop le: ${value}.`,
      statusCode: 500,
    });
  }

  return value as T[number];
}

function docDanhSachRole(rawRoles: string[]): AppRole[] {
  const normalized = rawRoles.map((item) => item.trim()).filter((item) => item.length > 0);
  if (normalized.length === 0) {
    throw new AuthError({
      code: "SUPABASE_DATA_INVALID",
      message: "[supabase-auth] Danh sach role rong.",
      statusCode: 500,
    });
  }

  return normalized.map((role) => docGiaTriEnum(role, APP_ROLES, "roles"));
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

export function taoSupabaseAdminAuthRepository(): AuthRepository {
  const client = taoSupabaseAdminServerClient();

  return {
    async createUser(input: CreateUserInput): Promise<AccountRecord> {
      const { data, error } = await client
        .from("user_accounts")
        .insert({
          email: input.email.toLowerCase(),
          password_hash: input.passwordHash,
          roles: input.roles,
          account_status: input.accountStatus,
          identity_status: input.identityStatus,
          teacher_verification_status: input.teacherVerificationStatus,
          created_at: input.createdAt,
          updated_at: input.createdAt,
        })
        .select("*")
        .single<UserAccountRow>();

      if (error) {
        taoLoiSupabase("tao tai khoan", error);
      }

      return mapUserAccountRow(data);
    },

    async findUserByEmail(email: string): Promise<AccountRecord | null> {
      const { data, error } = await client
        .from("user_accounts")
        .select("*")
        .eq("email", email.toLowerCase())
        .maybeSingle<UserAccountRow>();

      if (error) {
        taoLoiSupabase("tim tai khoan theo email", error);
      }

      return data ? mapUserAccountRow(data) : null;
    },

    async findUserById(userId: string): Promise<AccountRecord | null> {
      const { data, error } = await client
        .from("user_accounts")
        .select("*")
        .eq("id", userId)
        .maybeSingle<UserAccountRow>();

      if (error) {
        taoLoiSupabase("tim tai khoan theo id", error);
      }

      return data ? mapUserAccountRow(data) : null;
    },

    async updateUser(userId: string, input: UpdateUserInput): Promise<AccountRecord> {
      const patch: Record<string, unknown> = {};
      if (input.roles) {
        patch.roles = input.roles;
      }
      if (input.accountStatus) {
        patch.account_status = input.accountStatus;
      }
      if (input.identityStatus) {
        patch.identity_status = input.identityStatus;
      }
      if (input.teacherVerificationStatus) {
        patch.teacher_verification_status = input.teacherVerificationStatus;
      }
      if (input.lastLoginAt !== undefined) {
        patch.last_login_at = input.lastLoginAt;
      }

      if (Object.keys(patch).length === 0) {
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

      patch.updated_at = new Date().toISOString();

      const { data, error } = await client
        .from("user_accounts")
        .update(patch)
        .eq("id", userId)
        .select("*")
        .single<UserAccountRow>();

      if (error) {
        taoLoiSupabase("cap nhat tai khoan", error);
      }

      return mapUserAccountRow(data);
    },

    async upsertProfile(input: UpsertProfileInput): Promise<UserProfileRecord> {
      const { data, error } = await client
        .from("user_profiles")
        .upsert(
          {
            user_id: input.userId,
            display_name: input.displayName,
            full_name: input.fullName,
            birth_year: input.birthYear ?? null,
            school_name: input.schoolName ?? null,
            created_at: input.createdAt,
            updated_at: input.updatedAt,
          },
          { onConflict: "user_id" },
        )
        .select("*")
        .single<UserProfileRow>();

      if (error) {
        taoLoiSupabase("upsert ho so", error);
      }

      return mapUserProfileRow(data);
    },

    async findProfileByUserId(userId: string): Promise<UserProfileRecord | null> {
      const { data, error } = await client
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle<UserProfileRow>();

      if (error) {
        taoLoiSupabase("tim ho so theo user id", error);
      }

      return data ? mapUserProfileRow(data) : null;
    },

    async createSession(input: CreateSessionInput): Promise<SessionRecord> {
      const { data, error } = await client
        .from("app_sessions")
        .insert({
          token_hash: input.tokenHash,
          user_id: input.userId,
          issued_at: input.issuedAt,
          expires_at: input.expiresAt,
          created_at: input.createdAt,
        })
        .select("*")
        .single<AppSessionRow>();

      if (error) {
        taoLoiSupabase("tao session", error);
      }

      return mapSessionRow(data);
    },

    async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
      const { data, error } = await client
        .from("app_sessions")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle<AppSessionRow>();

      if (error) {
        taoLoiSupabase("tim session theo token", error);
      }

      return data ? mapSessionRow(data) : null;
    },

    async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
      const { error } = await client.from("app_sessions").delete().eq("token_hash", tokenHash);
      if (error) {
        taoLoiSupabase("xoa session", error);
      }
    },

    async upsertTeacherVerificationRequest(
      input: TeacherVerificationRequestRecord,
    ): Promise<TeacherVerificationRequestRecord> {
      const { data, error } = await client
        .from("teacher_verification_requests")
        .upsert(
          {
            id: input.id,
            user_id: input.userId,
            full_name: input.fullName,
            school_name: input.schoolName,
            teaching_subjects: input.teachingSubjects,
            evidence_note: input.evidenceNote,
            evidence_urls: input.evidenceUrls,
            status: input.status,
            submitted_at: input.submittedAt,
            reviewed_by: input.reviewedByUserId ?? null,
            reviewed_at: input.reviewedAt ?? null,
            admin_note: input.adminNote ?? null,
            created_at: input.createdAt,
            updated_at: input.updatedAt,
          },
          { onConflict: "user_id" },
        )
        .select("*")
        .single<TeacherVerificationRequestRow>();

      if (error) {
        taoLoiSupabase("upsert yeu cau xac minh giao vien", error);
      }

      return mapTeacherVerificationRequestRow(data);
    },

    async findTeacherVerificationByUserId(
      userId: string,
    ): Promise<TeacherVerificationRequestRecord | null> {
      const { data, error } = await client
        .from("teacher_verification_requests")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle<TeacherVerificationRequestRow>();

      if (error) {
        taoLoiSupabase("tim yeu cau xac minh giao vien", error);
      }

      return data ? mapTeacherVerificationRequestRow(data) : null;
    },
  };
}

export function taoSupabaseAuthRepository(): AuthRepository {
  return taoSupabaseAdminAuthRepository();
}
