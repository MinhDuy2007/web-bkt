import type {
  AccountRecord,
  AccountStatus,
  AppRole,
  IdentityStatus,
  SessionRecord,
  TeacherVerificationRequestRecord,
  TeacherVerificationStatus,
  UserProfileRecord,
} from "@/types/auth";

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  roles: AppRole[];
  accountStatus: AccountStatus;
  identityStatus: IdentityStatus;
  teacherVerificationStatus: TeacherVerificationStatus;
  createdAt: string;
};

export type UpdateUserInput = Partial<
  Pick<
    AccountRecord,
    "roles" | "accountStatus" | "identityStatus" | "teacherVerificationStatus" | "lastLoginAt"
  >
>;

export type UpsertProfileInput = Omit<UserProfileRecord, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type CreateSessionInput = {
  tokenHash: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  createdAt: string;
};

export interface AuthRepository {
  createUser(input: CreateUserInput): Promise<AccountRecord>;
  findUserByEmail(email: string): Promise<AccountRecord | null>;
  findUserById(userId: string): Promise<AccountRecord | null>;
  updateUser(userId: string, input: UpdateUserInput): Promise<AccountRecord>;

  upsertProfile(input: UpsertProfileInput): Promise<UserProfileRecord>;
  findProfileByUserId(userId: string): Promise<UserProfileRecord | null>;

  createSession(input: CreateSessionInput): Promise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;

  upsertTeacherVerificationRequest(
    input: TeacherVerificationRequestRecord,
  ): Promise<TeacherVerificationRequestRecord>;
  findTeacherVerificationByUserId(userId: string): Promise<TeacherVerificationRequestRecord | null>;
}
