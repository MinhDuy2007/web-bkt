import type { AuthSession, SessionUserSnapshot } from "@/types/auth";
import { AuthError } from "@/server/auth/errors";

function coRole(user: SessionUserSnapshot, role: SessionUserSnapshot["roles"][number]): boolean {
  return user.roles.includes(role);
}

export function coTaiKhoanHopLe(user: SessionUserSnapshot | null): boolean {
  return Boolean(user && user.accountStatus === "active");
}

export function coQuyenNguoiDungCoBan(user: SessionUserSnapshot | null): boolean {
  if (!coTaiKhoanHopLe(user)) {
    return false;
  }

  return Boolean(
    user &&
      (coRole(user, "user") || coRole(user, "student") || coRole(user, "teacher") || coRole(user, "admin")),
  );
}

export function coPhaiAdmin(user: SessionUserSnapshot | null): boolean {
  return Boolean(user && user.accountStatus === "active" && coRole(user, "admin"));
}

export function coPhaiGiaoVienDaDuyet(user: SessionUserSnapshot | null): boolean {
  if (!user || user.accountStatus !== "active") {
    return false;
  }

  if (coPhaiAdmin(user)) {
    return true;
  }

  return coRole(user, "teacher") && user.teacherVerificationStatus === "approved";
}

export function coQuyenTaoLop(user: SessionUserSnapshot | null): boolean {
  return coPhaiGiaoVienDaDuyet(user);
}

export function coQuyenThamGiaNganHangDe(user: SessionUserSnapshot | null): boolean {
  return coPhaiGiaoVienDaDuyet(user);
}

export function batBuocDangNhap(session: AuthSession | null): AuthSession {
  if (!session) {
    throw new AuthError({
      code: "AUTH_REQUIRED",
      message: "Can dang nhap de thuc hien thao tac nay.",
      statusCode: 401,
    });
  }

  return session;
}

export function batBuocQuyenNguoiDungCoBan(session: AuthSession | null): AuthSession {
  const verifiedSession = batBuocDangNhap(session);
  if (!coQuyenNguoiDungCoBan(verifiedSession.user)) {
    throw new AuthError({
      code: "BASIC_PERMISSION_REQUIRED",
      message: "Tai khoan chua du dieu kien su dung tinh nang co ban.",
      statusCode: 403,
    });
  }

  return verifiedSession;
}

export function batBuocQuyenTaoLop(session: AuthSession | null): AuthSession {
  const verifiedSession = batBuocDangNhap(session);
  if (!coQuyenTaoLop(verifiedSession.user)) {
    throw new AuthError({
      code: "CLASS_PERMISSION_REQUIRED",
      message: "Tai khoan hien tai khong co quyen tao lop.",
      statusCode: 403,
    });
  }

  return verifiedSession;
}

export function batBuocQuyenThamGiaNganHangDe(session: AuthSession | null): AuthSession {
  const verifiedSession = batBuocDangNhap(session);
  if (!coQuyenThamGiaNganHangDe(verifiedSession.user)) {
    throw new AuthError({
      code: "QUESTION_BANK_PERMISSION_REQUIRED",
      message: "Tai khoan hien tai khong co quyen tham gia ngan hang de.",
      statusCode: 403,
    });
  }

  return verifiedSession;
}
