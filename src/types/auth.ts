export const APP_ROLES = ["admin", "teacher", "student", "user"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "suspended", "pending"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const IDENTITY_STATUSES = ["unverified", "basic_verified"] as const;
export type IdentityStatus = (typeof IDENTITY_STATUSES)[number];

export const TEACHER_VERIFICATION_STATUSES = [
  "none",
  "pending_review",
  "approved",
  "rejected",
] as const;
export type TeacherVerificationStatus = (typeof TEACHER_VERIFICATION_STATUSES)[number];

export type TeacherVerificationRequestStatus = Exclude<TeacherVerificationStatus, "none">;
export type AuthAdapterMode = "mock" | "supabase";

export type AuditMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export type AccountRecord = {
  id: string;
  email: string;
  passwordHash: string;
  roles: AppRole[];
  accountStatus: AccountStatus;
  identityStatus: IdentityStatus;
  teacherVerificationStatus: TeacherVerificationStatus;
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string | null;
  lastLoginAt?: string | null;
};

export type UserProfileRecord = {
  userId: string;
  displayName: string;
  fullName: string;
  birthYear?: number | null;
  schoolName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherVerificationRequestRecord = {
  id: string;
  userId: string;
  fullName: string;
  schoolName: string;
  teachingSubjects: string[];
  evidenceNote: string;
  evidenceUrls: string[];
  status: TeacherVerificationRequestStatus;
  submittedAt: string;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  tokenHash: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  createdAt: string;
};

export type SessionUserSnapshot = {
  id: string;
  email: string;
  roles: AppRole[];
  accountStatus: AccountStatus;
  identityStatus: IdentityStatus;
  teacherVerificationStatus: TeacherVerificationStatus;
};

export type AuthSession = {
  token: string;
  issuedAt: string;
  expiresAt: string;
  user: SessionUserSnapshot;
  profile: UserProfileRecord | null;
};
