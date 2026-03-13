import { randomBytes, randomUUID } from "node:crypto";
import { AuthError } from "@/server/auth/errors";
import { bamMatKhau, xacThucMatKhau } from "@/server/auth/password";
import { batBuocQuyenNguoiDungCoBan } from "@/server/auth/permissions";
import { layAuthRepository } from "@/server/auth/repository";
import { layBienMoiTruongServer } from "@/server/config/env";
import type {
  AccountRecord,
  AuditMetadata,
  AuthSession,
  SessionRecord,
  TeacherVerificationRequestRecord,
  UserProfileRecord,
} from "@/types/auth";

export type DangKyPayload = {
  email: string;
  password: string;
  displayName: string;
  fullName?: string | null;
  birthYear?: number | null;
  schoolName?: string | null;
};

export type DangNhapPayload = {
  email: string;
  password: string;
};

export type QuenMatKhauPayload = {
  email: string;
};

export type YeuCauXacMinhGiaoVienPayload = {
  fullName: string;
  schoolName: string;
  teachingSubjects: string[];
  evidenceNote: string;
  evidenceUrls: string[];
};

type NguoiDungCongKhai = {
  user: Omit<AccountRecord, "passwordHash">;
  profile: UserProfileRecord | null;
};

function docObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Du lieu dau vao khong hop le.",
      statusCode: 400,
    });
  }

  return payload as Record<string, unknown>;
}

function docChuoi(rawValue: unknown, fieldName: string, minLength = 1): string {
  if (typeof rawValue !== "string") {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la chuoi.`,
      statusCode: 400,
    });
  }

  const normalized = rawValue.trim();
  if (normalized.length < minLength) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} khong hop le.`,
      statusCode: 400,
    });
  }

  return normalized;
}

function docChuoiTuyChon(rawValue: unknown): string | null {
  if (typeof rawValue !== "string") {
    return null;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : null;
}

function docNamSinhTuyChon(rawValue: unknown): number | null {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }

  const parsed = Number(rawValue);
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > currentYear) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong birthYear khong hop le.",
      statusCode: 400,
    });
  }

  return parsed;
}

function docEmail(rawValue: unknown): string {
  const normalized = docChuoi(rawValue, "email", 5).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AuthError({
      code: "INVALID_EMAIL",
      message: "Email khong dung dinh dang.",
      statusCode: 400,
    });
  }

  return normalized;
}

function docDanhSachChuoi(rawValue: unknown, fieldName: string): string[] {
  if (!Array.isArray(rawValue)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la danh sach.`,
      statusCode: 400,
    });
  }

  const normalized = rawValue
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (normalized.length === 0) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} can it nhat 1 gia tri.`,
      statusCode: 400,
    });
  }

  return [...new Set(normalized)];
}

function taoDisplayNameMacDinh(email: string): string {
  return email.split("@")[0] || "nguoi-dung-moi";
}

function taoSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function tinhExpiresAt(issuedAt: Date): string {
  const env = layBienMoiTruongServer();
  const expiresAtMs = issuedAt.getTime() + env.authSessionTtlMinutes * 60 * 1000;
  return new Date(expiresAtMs).toISOString();
}

function loaiBoPasswordHash(user: AccountRecord): Omit<AccountRecord, "passwordHash"> {
  const safeUser = { ...user };
  delete (safeUser as Partial<AccountRecord>).passwordHash;
  return safeUser;
}

function chuyenSession(
  session: SessionRecord,
  user: AccountRecord,
  profile: UserProfileRecord | null,
): AuthSession {
  return {
    token: session.token,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    user: {
      id: user.id,
      email: user.email,
      roles: [...user.roles],
      accountStatus: user.accountStatus,
      identityStatus: user.identityStatus,
      teacherVerificationStatus: user.teacherVerificationStatus,
    },
    profile,
  };
}

function taoAuditMetadataPlaceholder(audit?: AuditMetadata): void {
  void audit;
}

export function chuanHoaDangKyPayload(payload: unknown): DangKyPayload {
  const data = docObject(payload);
  const email = docEmail(data.email);
  const password = docChuoi(data.password, "password", 8);
  const displayName = docChuoiTuyChon(data.displayName) ?? taoDisplayNameMacDinh(email);

  return {
    email,
    password,
    displayName,
    fullName: docChuoiTuyChon(data.fullName),
    birthYear: docNamSinhTuyChon(data.birthYear),
    schoolName: docChuoiTuyChon(data.schoolName),
  };
}

export function chuanHoaDangNhapPayload(payload: unknown): DangNhapPayload {
  const data = docObject(payload);

  return {
    email: docEmail(data.email),
    password: docChuoi(data.password, "password", 8),
  };
}

export function chuanHoaQuenMatKhauPayload(payload: unknown): QuenMatKhauPayload {
  const data = docObject(payload);

  return {
    email: docEmail(data.email),
  };
}

export function chuanHoaYeuCauXacMinhGiaoVienPayload(
  payload: unknown,
): YeuCauXacMinhGiaoVienPayload {
  const data = docObject(payload);

  return {
    fullName: docChuoi(data.fullName, "fullName", 2),
    schoolName: docChuoi(data.schoolName, "schoolName", 2),
    teachingSubjects: docDanhSachChuoi(data.teachingSubjects, "teachingSubjects"),
    evidenceNote: docChuoi(data.evidenceNote, "evidenceNote", 8),
    evidenceUrls: Array.isArray(data.evidenceUrls)
      ? data.evidenceUrls.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function dangKyTaiKhoan(
  payload: DangKyPayload,
  audit?: AuditMetadata,
): Promise<NguoiDungCongKhai> {
  taoAuditMetadataPlaceholder(audit);
  const repository = layAuthRepository();

  const existing = await repository.findUserByEmail(payload.email);
  if (existing) {
    throw new AuthError({
      code: "EMAIL_ALREADY_EXISTS",
      message: "Email da ton tai.",
      statusCode: 409,
    });
  }

  const nowIso = new Date().toISOString();
  const user = await repository.createUser({
    email: payload.email,
    passwordHash: bamMatKhau(payload.password),
    roles: ["user", "student"],
    accountStatus: "active",
    identityStatus: "unverified",
    teacherVerificationStatus: "none",
    createdAt: nowIso,
  });

  const profile = await repository.upsertProfile({
    userId: user.id,
    displayName: payload.displayName,
    fullName: payload.fullName ?? payload.displayName,
    birthYear: payload.birthYear ?? null,
    schoolName: payload.schoolName ?? null,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return {
    user: loaiBoPasswordHash(user),
    profile,
  };
}

export async function dangNhapTaiKhoan(
  payload: DangNhapPayload,
  audit?: AuditMetadata,
): Promise<AuthSession> {
  taoAuditMetadataPlaceholder(audit);
  const repository = layAuthRepository();

  const user = await repository.findUserByEmail(payload.email);
  if (!user || !xacThucMatKhau(payload.password, user.passwordHash)) {
    throw new AuthError({
      code: "INVALID_CREDENTIALS",
      message: "Thong tin dang nhap khong dung.",
      statusCode: 401,
    });
  }

  if (user.accountStatus !== "active") {
    throw new AuthError({
      code: "ACCOUNT_NOT_ACTIVE",
      message: "Tai khoan chua du dieu kien dang nhap.",
      statusCode: 403,
    });
  }

  const issuedAt = new Date();
  const session = await repository.createSession({
    token: taoSessionToken(),
    userId: user.id,
    issuedAt: issuedAt.toISOString(),
    expiresAt: tinhExpiresAt(issuedAt),
    createdAt: issuedAt.toISOString(),
  });

  const updatedUser = await repository.updateUser(user.id, {
    lastLoginAt: issuedAt.toISOString(),
  });
  const profile = await repository.findProfileByUserId(user.id);

  return chuyenSession(session, updatedUser, profile);
}

export async function quenMatKhauPlaceholder(
  payload: QuenMatKhauPayload,
  audit?: AuditMetadata,
): Promise<{ accepted: true; message: string }> {
  taoAuditMetadataPlaceholder(audit);
  const repository = layAuthRepository();
  await repository.findUserByEmail(payload.email);

  return {
    accepted: true,
    message: "Yeu cau quen mat khau da duoc tiep nhan (placeholder).",
  };
}

export async function layPhienDangNhap(token: string): Promise<AuthSession | null> {
  if (!token) {
    return null;
  }

  const repository = layAuthRepository();
  const session = await repository.findSessionByToken(token);
  if (!session) {
    return null;
  }

  const expired = new Date(session.expiresAt).getTime() <= Date.now();
  if (expired) {
    await repository.deleteSession(token);
    return null;
  }

  const user = await repository.findUserById(session.userId);
  if (!user) {
    await repository.deleteSession(token);
    return null;
  }

  const profile = await repository.findProfileByUserId(user.id);
  return chuyenSession(session, user, profile);
}

export async function layHoSoHienTai(token: string): Promise<NguoiDungCongKhai> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);

  const repository = layAuthRepository();
  const user = await repository.findUserById(verifiedSession.user.id);
  if (!user) {
    throw new AuthError({
      code: "USER_NOT_FOUND",
      message: "Khong tim thay tai khoan.",
      statusCode: 404,
    });
  }

  const profile = await repository.findProfileByUserId(user.id);
  return {
    user: loaiBoPasswordHash(user),
    profile,
  };
}

export async function guiYeuCauXacMinhGiaoVien(
  token: string,
  payload: YeuCauXacMinhGiaoVienPayload,
  audit?: AuditMetadata,
): Promise<TeacherVerificationRequestRecord> {
  taoAuditMetadataPlaceholder(audit);
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);

  if (verifiedSession.user.teacherVerificationStatus === "approved") {
    throw new AuthError({
      code: "TEACHER_ALREADY_APPROVED",
      message: "Tai khoan da o trang thai giao vien duoc duyet.",
      statusCode: 409,
    });
  }

  const repository = layAuthRepository();
  const nowIso = new Date().toISOString();
  const existing = await repository.findTeacherVerificationByUserId(verifiedSession.user.id);
  const upsertedRequest: TeacherVerificationRequestRecord = {
    id: existing?.id ?? randomUUID(),
    userId: verifiedSession.user.id,
    fullName: payload.fullName,
    schoolName: payload.schoolName,
    teachingSubjects: [...payload.teachingSubjects],
    evidenceNote: payload.evidenceNote,
    evidenceUrls: [...payload.evidenceUrls],
    status: "pending_review",
    submittedAt: nowIso,
    reviewedByUserId: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  await repository.updateUser(verifiedSession.user.id, {
    teacherVerificationStatus: "pending_review",
  });

  return repository.upsertTeacherVerificationRequest(upsertedRequest);
}
