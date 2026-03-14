import assert from "node:assert/strict";
import test from "node:test";
import { GET as adminTeacherListGet } from "@/app/api/admin/teacher-verification/requests/route";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import {
  chuanHoaDangKyPayload,
  dangKyTaiKhoan,
  dangNhapTaiKhoan,
  duyetYeuCauXacMinhGiaoVienBoiAdmin,
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

async function taoYeuCauXacMinh(user: ThongTinTaiKhoanTest) {
  const session = await dangNhapTaiKhoan({
    email: user.email,
    password: user.password,
  });

  return guiYeuCauXacMinhGiaoVien(session.token, {
    fullName: `Ho so ${user.email}`,
    schoolName: "THPT Danh Sach",
    teachingSubjects: ["Toan"],
    evidenceNote: "Toi da day hoc va can duoc phe duyet tren he thong.",
    evidenceUrls: [],
  });
}

function taoRequestDanhSach(cookieHeader: string, query: string) {
  return adminTeacherListGet(
    new Request(`http://localhost:3000/api/admin/teacher-verification/requests${query}`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
    }),
  );
}

test("non-admin khong duoc lay danh sach yeu cau xac minh giao vien", async () => {
  datLaiKhoAuthGiaLap();

  const user = await taoTaiKhoanTest("list-non-admin@test.local", "SafePass123!", "list-non-admin");
  const target = await taoTaiKhoanTest("list-target@test.local", "SafePass123!", "list-target");
  await taoYeuCauXacMinh(target);
  const userCookie = await taoCookieSession(user.email, user.password);

  const response = await taoRequestDanhSach(userCookie, "?status=pending_review&page=1&limit=10");
  const body = (await response.json()) as {
    ok: boolean;
    error: { code: string };
  };

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "ADMIN_PERMISSION_REQUIRED");
});

test("admin lay duoc danh sach va loc theo trang thai", async () => {
  datLaiKhoAuthGiaLap();

  const repository = layAuthRepository();
  const admin = await taoTaiKhoanTest("list-admin@test.local", "SafePass123!", "list-admin");
  await repository.updateUser(admin.id, {
    roles: ["admin", "user"],
  });

  const targetPending = await taoTaiKhoanTest(
    "list-target-pending@test.local",
    "SafePass123!",
    "list-target-pending",
  );
  const targetApproved = await taoTaiKhoanTest(
    "list-target-approved@test.local",
    "SafePass123!",
    "list-target-approved",
  );

  const pendingRequest = await taoYeuCauXacMinh(targetPending);
  const approvedRequest = await taoYeuCauXacMinh(targetApproved);
  const adminSession = await dangNhapTaiKhoan({
    email: admin.email,
    password: admin.password,
  });
  await duyetYeuCauXacMinhGiaoVienBoiAdmin(adminSession.token, approvedRequest.id, {
    action: "approve",
    adminNote: "Da duyet de kiem thu route danh sach.",
  });

  const adminCookie = await taoCookieSession(admin.email, admin.password);

  const pendingResponse = await taoRequestDanhSach(
    adminCookie,
    "?status=pending_review&page=1&limit=10",
  );
  const pendingBody = (await pendingResponse.json()) as {
    ok: boolean;
    data: {
      items: Array<{ request: { id: string; status: string }; account: { email: string } }>;
      pagination: { total: number; page: number; limit: number };
    };
  };

  assert.equal(pendingResponse.status, 200);
  assert.equal(pendingBody.ok, true);
  assert.equal(pendingBody.data.items.length, 1);
  assert.equal(pendingBody.data.items[0]?.request.id, pendingRequest.id);
  assert.equal(pendingBody.data.items[0]?.request.status, "pending_review");
  assert.equal(pendingBody.data.pagination.page, 1);
  assert.equal(pendingBody.data.pagination.limit, 10);

  const approvedResponse = await taoRequestDanhSach(
    adminCookie,
    "?status=approved&page=1&limit=10",
  );
  const approvedBody = (await approvedResponse.json()) as {
    ok: boolean;
    data: {
      items: Array<{ request: { id: string; status: string }; account: { email: string } }>;
      pagination: { total: number };
    };
  };

  assert.equal(approvedResponse.status, 200);
  assert.equal(approvedBody.ok, true);
  assert.equal(approvedBody.data.items.length, 1);
  assert.equal(approvedBody.data.items[0]?.request.id, approvedRequest.id);
  assert.equal(approvedBody.data.items[0]?.request.status, "approved");
  assert.equal(approvedBody.data.pagination.total, 1);
});

test("route danh sach tra loi 400 neu query filter khong hop le", async () => {
  datLaiKhoAuthGiaLap();

  const repository = layAuthRepository();
  const admin = await taoTaiKhoanTest(
    "list-admin-invalid-filter@test.local",
    "SafePass123!",
    "list-admin-invalid-filter",
  );
  await repository.updateUser(admin.id, {
    roles: ["admin", "user"],
  });
  const adminCookie = await taoCookieSession(admin.email, admin.password);

  const response = await taoRequestDanhSach(adminCookie, "?status=sai-trang-thai");
  const body = (await response.json()) as {
    ok: boolean;
    error: { code: string };
  };

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "INVALID_QUERY");
});
