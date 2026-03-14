import test from "node:test";
import assert from "node:assert/strict";
import { POST as reviewTeacherVerificationPost } from "@/app/api/admin/teacher-verification/[requestId]/review/route";
import { layAuthRepository } from "@/server/auth/repository";
import {
  datLaiKhoAuthGiaLap,
  layNhatKyXacMinhGiaoVienGiaLap,
} from "@/server/auth/repository/mock-auth-repository";
import {
  chuanHoaDangKyPayload,
  dangKyTaiKhoan,
  dangNhapTaiKhoan,
  guiYeuCauXacMinhGiaoVien,
} from "@/server/auth/service";

process.env.AUTH_ADAPTER_MODE = "mock";

type ThongTinTaiKhoanTest = {
  id: string;
  email: string;
  password: string;
};

async function taoTaiKhoanTest(
  email: string,
  password: string,
  displayName: string,
): Promise<ThongTinTaiKhoanTest> {
  const result = await dangKyTaiKhoan(
    chuanHoaDangKyPayload({
      email,
      password,
      displayName,
      fullName: displayName,
    }),
  );

  return {
    id: result.user.id,
    email,
    password,
  };
}

async function taoCookieSession(email: string, password: string): Promise<string> {
  const session = await dangNhapTaiKhoan({ email, password });
  return `session_token=${encodeURIComponent(session.token)}`;
}

async function taoYeuCauXacMinhGiaoVien(user: ThongTinTaiKhoanTest) {
  const session = await dangNhapTaiKhoan({
    email: user.email,
    password: user.password,
  });

  return guiYeuCauXacMinhGiaoVien(session.token, {
    fullName: "Giao vien test",
    schoolName: "THPT Test",
    teachingSubjects: ["Toan"],
    evidenceNote: "Toi da co kinh nghiem giang day va can duoc duyet.",
    evidenceUrls: [],
  });
}

async function taoRequestReview(
  requestId: string,
  cookieHeader: string,
  action: "approve" | "reject",
  adminNote = "Da xu ly ho so theo quy trinh.",
) {
  return reviewTeacherVerificationPost(
    new Request(`http://localhost:3000/api/admin/teacher-verification/${requestId}/review`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader,
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        action,
        adminNote,
      }),
    }),
    {
      params: { requestId },
    },
  );
}

test("non-admin khong duoc review yeu cau xac minh giao vien", async () => {
  datLaiKhoAuthGiaLap();

  const reviewer = await taoTaiKhoanTest("reviewer@test.local", "SafePass123!", "reviewer");
  const targetUser = await taoTaiKhoanTest("target-user@test.local", "SafePass123!", "target-user");
  const request = await taoYeuCauXacMinhGiaoVien(targetUser);
  const reviewerCookie = await taoCookieSession(reviewer.email, reviewer.password);

  const response = await taoRequestReview(request.id, reviewerCookie, "approve");
  const body = (await response.json()) as { ok: boolean; error: { code: string } };

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "ADMIN_PERMISSION_REQUIRED");
});

test("admin approve cap nhat request, account va ghi audit log", async () => {
  datLaiKhoAuthGiaLap();

  const repository = layAuthRepository();
  const admin = await taoTaiKhoanTest("admin-user@test.local", "SafePass123!", "admin-user");
  await repository.updateUser(admin.id, {
    roles: ["admin", "user"],
  });

  const targetUser = await taoTaiKhoanTest("target-approve@test.local", "SafePass123!", "target-approve");
  const request = await taoYeuCauXacMinhGiaoVien(targetUser);
  const adminCookie = await taoCookieSession(admin.email, admin.password);

  const response = await taoRequestReview(request.id, adminCookie, "approve", "Da duyet ho so giao vien.");
  const body = (await response.json()) as {
    ok: boolean;
    data: {
      request: { status: string; reviewedByUserId: string | null; reviewedAt: string | null };
      account: { teacherVerificationStatus: string; roles: string[]; passwordHash?: string };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.request.status, "approved");
  assert.equal(body.data.request.reviewedByUserId, admin.id);
  assert.equal(typeof body.data.request.reviewedAt, "string");
  assert.equal(body.data.account.teacherVerificationStatus, "approved");
  assert.equal(body.data.account.roles.includes("teacher"), true);
  assert.equal("passwordHash" in body.data.account, false);

  const updatedAccount = await repository.findUserById(targetUser.id);
  assert.equal(updatedAccount?.teacherVerificationStatus, "approved");
  assert.equal(updatedAccount?.roles.includes("teacher"), true);

  const auditLogs = layNhatKyXacMinhGiaoVienGiaLap(request.id);
  const reviewLog = auditLogs.find((log) => log.action === "approved");
  assert.ok(reviewLog);
  assert.equal(reviewLog?.actorUserId, admin.id);
  assert.equal(reviewLog?.oldStatus, "pending_review");
  assert.equal(reviewLog?.newStatus, "approved");
});

test("admin reject cap nhat dung trang thai va chan review lai", async () => {
  datLaiKhoAuthGiaLap();

  const repository = layAuthRepository();
  const admin = await taoTaiKhoanTest("admin-reject@test.local", "SafePass123!", "admin-reject");
  await repository.updateUser(admin.id, {
    roles: ["admin", "user"],
  });

  const targetUser = await taoTaiKhoanTest("target-reject@test.local", "SafePass123!", "target-reject");
  const request = await taoYeuCauXacMinhGiaoVien(targetUser);
  const adminCookie = await taoCookieSession(admin.email, admin.password);

  const rejectResponse = await taoRequestReview(
    request.id,
    adminCookie,
    "reject",
    "Ho so chua du thong tin de duyet.",
  );
  const rejectBody = (await rejectResponse.json()) as {
    ok: boolean;
    data: {
      request: { status: string };
      account: { teacherVerificationStatus: string; roles: string[] };
    };
  };

  assert.equal(rejectResponse.status, 200);
  assert.equal(rejectBody.ok, true);
  assert.equal(rejectBody.data.request.status, "rejected");
  assert.equal(rejectBody.data.account.teacherVerificationStatus, "rejected");
  assert.equal(rejectBody.data.account.roles.includes("teacher"), false);

  const reviewAgainResponse = await taoRequestReview(request.id, adminCookie, "approve");
  const reviewAgainBody = (await reviewAgainResponse.json()) as {
    ok: boolean;
    error: { code: string };
  };

  assert.equal(reviewAgainResponse.status, 409);
  assert.equal(reviewAgainBody.ok, false);
  assert.equal(reviewAgainBody.error.code, "REQUEST_ALREADY_REVIEWED");

  const auditLogs = layNhatKyXacMinhGiaoVienGiaLap(request.id);
  const rejectLog = auditLogs.find((log) => log.action === "rejected");
  assert.ok(rejectLog);
  assert.equal(rejectLog?.actorUserId, admin.id);
});
