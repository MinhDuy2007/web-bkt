import test from "node:test";
import assert from "node:assert/strict";
import type { AuthSession } from "@/types/auth";
import {
  coPhaiGiaoVienDaDuyet,
  coQuyenTaoLop,
  coQuyenThamGiaNganHangDe,
} from "@/server/auth/permissions";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { chuanHoaDangKyPayload, dangKyTaiKhoan } from "@/server/auth/service";

function taoSessionMau(input: Partial<AuthSession["user"]>): AuthSession {
  return {
    token: "token-test",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    user: {
      id: "user-test",
      email: "user@test.local",
      roles: ["user", "student"],
      accountStatus: "active",
      identityStatus: "unverified",
      teacherVerificationStatus: "none",
      ...input,
    },
    profile: null,
  };
}

test("user thuong khong duoc tao lop", () => {
  const session = taoSessionMau({});
  assert.equal(coQuyenTaoLop(session.user), false);
});

test("user thuong khong duoc tham gia ngan hang de", () => {
  const session = taoSessionMau({});
  assert.equal(coQuyenThamGiaNganHangDe(session.user), false);
});

test("teacher pending_review chua duoc quyen giao vien day du", () => {
  const session = taoSessionMau({
    roles: ["user", "teacher"],
    teacherVerificationStatus: "pending_review",
  });

  assert.equal(coPhaiGiaoVienDaDuyet(session.user), false);
  assert.equal(coQuyenTaoLop(session.user), false);
  assert.equal(coQuyenThamGiaNganHangDe(session.user), false);
});

test("teacher approved duoc pass guard tao lop va ngan hang de", () => {
  const session = taoSessionMau({
    roles: ["user", "teacher"],
    teacherVerificationStatus: "approved",
  });

  assert.equal(coPhaiGiaoVienDaDuyet(session.user), true);
  assert.equal(coQuyenTaoLop(session.user), true);
  assert.equal(coQuyenThamGiaNganHangDe(session.user), true);
});

test("du lieu role tu client khong du de nang quyen khi backend khong chap nhan", async () => {
  datLaiKhoAuthGiaLap();

  const payloadClient = chuanHoaDangKyPayload({
    email: "normal-user@test.local",
    password: "SafePass123!",
    displayName: "normal-user",
    fullName: "Normal User",
    roles: ["admin", "teacher"],
    teacherVerificationStatus: "approved",
  });

  const result = await dangKyTaiKhoan(payloadClient);
  assert.deepEqual(result.user.roles, ["user", "student"]);
  assert.equal(result.user.teacherVerificationStatus, "none");
});

