import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

type RuntimeProofSummary = {
  adapterMode: string;
  proofScope: {
    service: boolean;
    repository: boolean;
    database: boolean;
  };
  cases: {
    nonAdminBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    approve: {
      pass: boolean;
      requestId: string;
      targetUserId: string;
      reviewedByMatchesAdmin: boolean;
      teacherRoleAdded: boolean;
      accountStatusSynced: boolean;
      auditApprovedLogged: boolean;
    };
    reject: {
      pass: boolean;
      requestId: string;
      targetUserId: string;
      reviewedByMatchesAdmin: boolean;
      teacherRoleRemoved: boolean;
      accountStatusSynced: boolean;
      auditRejectedLogged: boolean;
    };
  };
  cleanup: {
    deletedUsers: number;
  };
  notes: string[];
};

function napEnvTuFile(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Khong tim thay file env: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line || /^\s*#/.test(line)) {
      continue;
    }

    const matched = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!matched) {
      continue;
    }

    const key = matched[1];
    let value = matched[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

type TaoTaiKhoanInput = {
  email: string;
  password: string;
  displayName: string;
};

type TaiKhoanTest = {
  id: string;
  email: string;
  password: string;
};

type RequestHang = {
  id: string;
  user_id: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type AccountHang = {
  id: string;
  teacher_verification_status: string;
  roles: string[];
};

type AuditHang = {
  request_id: string;
  actor_user_id: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
};

async function main(): Promise<void> {
  napEnvTuFile(resolve(process.cwd(), ".env.local"));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Thieu DATABASE_URL trong moi truong runtime.");
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
  });

  const {
    AuthError,
  }: typeof import("@/server/auth/errors") = await import("@/server/auth/errors");
  const {
    layAuthRepository,
  }: typeof import("@/server/auth/repository") = await import("@/server/auth/repository");
  const {
    chuanHoaDangKyPayload,
    dangKyTaiKhoan,
    dangNhapTaiKhoan,
    guiYeuCauXacMinhGiaoVien,
    duyetYeuCauXacMinhGiaoVienBoiAdmin,
  }: typeof import("@/server/auth/service") = await import("@/server/auth/service");

  const repository = layAuthRepository();
  const prefix = `task4a-${Date.now()}`;
  const password = "Task4A!SafePass123";
  let deletedUsers = 0;

  async function taoTaiKhoan(input: TaoTaiKhoanInput): Promise<TaiKhoanTest> {
    const created = await dangKyTaiKhoan(
      chuanHoaDangKyPayload({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
        fullName: input.displayName,
      }),
    );

    return {
      id: created.user.id,
      email: input.email,
      password: input.password,
    };
  }

  async function taoYeuCauXacMinh(user: TaiKhoanTest, suffix: string) {
    const session = await dangNhapTaiKhoan({
      email: user.email,
      password: user.password,
    });

    return guiYeuCauXacMinhGiaoVien(session.token, {
      fullName: `Giao vien ${suffix}`,
      schoolName: "THPT Runtime Proof",
      teachingSubjects: ["Toan", "Vat ly"],
      evidenceNote: "Toi can duoc duyet de tham gia he thong giao vien.",
      evidenceUrls: [],
    });
  }

  async function docTrangThaiRequest(requestId: string): Promise<RequestHang> {
    const result = await pool.query<RequestHang>(
      `select id, user_id, status, reviewed_by, reviewed_at
       from public.teacher_verification_requests
       where id = $1`,
      [requestId],
    );

    if (result.rowCount !== 1) {
      throw new Error(`Khong tim thay request ${requestId} trong DB runtime.`);
    }
    return result.rows[0] as RequestHang;
  }

  async function docTrangThaiAccount(userId: string): Promise<AccountHang> {
    const result = await pool.query<AccountHang>(
      `select id, teacher_verification_status, roles
       from public.user_accounts
       where id = $1`,
      [userId],
    );

    if (result.rowCount !== 1) {
      throw new Error(`Khong tim thay account ${userId} trong DB runtime.`);
    }
    return result.rows[0] as AccountHang;
  }

  async function docAuditTheoAction(requestId: string, action: "approved" | "rejected") {
    const result = await pool.query<AuditHang>(
      `select request_id, actor_user_id, action, old_status, new_status
       from public.teacher_verification_audit_logs
       where request_id = $1
         and action = $2
       order by id desc
       limit 1`,
      [requestId, action],
    );
    return result.rows[0] ?? null;
  }

  try {
    const admin = await taoTaiKhoan({
      email: `${prefix}-admin@test.local`,
      password,
      displayName: `${prefix}-admin`,
    });
    const reviewer = await taoTaiKhoan({
      email: `${prefix}-reviewer@test.local`,
      password,
      displayName: `${prefix}-reviewer`,
    });
    const approveTarget = await taoTaiKhoan({
      email: `${prefix}-approve@test.local`,
      password,
      displayName: `${prefix}-approve`,
    });
    const rejectTarget = await taoTaiKhoan({
      email: `${prefix}-reject@test.local`,
      password,
      displayName: `${prefix}-reject`,
    });

    await repository.updateUser(admin.id, {
      roles: ["admin", "user"],
    });

    await repository.updateUser(rejectTarget.id, {
      roles: ["user", "student", "teacher"],
      teacherVerificationStatus: "pending_review",
    });

    const approveRequest = await taoYeuCauXacMinh(approveTarget, "approve");
    const rejectRequest = await taoYeuCauXacMinh(rejectTarget, "reject");

    const reviewerSession = await dangNhapTaiKhoan({
      email: reviewer.email,
      password: reviewer.password,
    });

    let nonAdminErrorCode: string | null = null;
    try {
      await duyetYeuCauXacMinhGiaoVienBoiAdmin(reviewerSession.token, approveRequest.id, {
        action: "approve",
        adminNote: "Khong du quyen admin",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        nonAdminErrorCode = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(nonAdminErrorCode, "ADMIN_PERMISSION_REQUIRED");

    const adminSession = await dangNhapTaiKhoan({
      email: admin.email,
      password: admin.password,
    });

    const approveResult = await duyetYeuCauXacMinhGiaoVienBoiAdmin(adminSession.token, approveRequest.id, {
      action: "approve",
      adminNote: "Runtime proof approve",
    });
    assert.equal(approveResult.request.status, "approved");
    assert.equal(approveResult.account.teacherVerificationStatus, "approved");
    assert.equal(approveResult.account.roles.includes("teacher"), true);

    const rejectResult = await duyetYeuCauXacMinhGiaoVienBoiAdmin(adminSession.token, rejectRequest.id, {
      action: "reject",
      adminNote: "Runtime proof reject",
    });
    assert.equal(rejectResult.request.status, "rejected");
    assert.equal(rejectResult.account.teacherVerificationStatus, "rejected");
    assert.equal(rejectResult.account.roles.includes("teacher"), false);

    const approveRequestDb = await docTrangThaiRequest(approveRequest.id);
    const approveAccountDb = await docTrangThaiAccount(approveTarget.id);
    const approveAuditDb = await docAuditTheoAction(approveRequest.id, "approved");

    const rejectRequestDb = await docTrangThaiRequest(rejectRequest.id);
    const rejectAccountDb = await docTrangThaiAccount(rejectTarget.id);
    const rejectAuditDb = await docAuditTheoAction(rejectRequest.id, "rejected");

    assert.equal(approveRequestDb.status, "approved");
    assert.equal(approveRequestDb.reviewed_by, admin.id);
    assert.ok(approveRequestDb.reviewed_at);
    assert.equal(approveAccountDb.teacher_verification_status, "approved");
    assert.equal(approveAccountDb.roles.includes("teacher"), true);
    assert.equal(approveRequestDb.status, approveAccountDb.teacher_verification_status);
    assert.ok(approveAuditDb);
    assert.equal(approveAuditDb?.actor_user_id, admin.id);
    assert.equal(approveAuditDb?.old_status, "pending_review");
    assert.equal(approveAuditDb?.new_status, "approved");

    assert.equal(rejectRequestDb.status, "rejected");
    assert.equal(rejectRequestDb.reviewed_by, admin.id);
    assert.ok(rejectRequestDb.reviewed_at);
    assert.equal(rejectAccountDb.teacher_verification_status, "rejected");
    assert.equal(rejectAccountDb.roles.includes("teacher"), false);
    assert.equal(rejectRequestDb.status, rejectAccountDb.teacher_verification_status);
    assert.ok(rejectAuditDb);
    assert.equal(rejectAuditDb?.actor_user_id, admin.id);
    assert.equal(rejectAuditDb?.old_status, "pending_review");
    assert.equal(rejectAuditDb?.new_status, "rejected");

    const summary: RuntimeProofSummary = {
      adapterMode: process.env.AUTH_ADAPTER_MODE ?? "unknown",
      proofScope: {
        service: true,
        repository: true,
        database: true,
      },
      cases: {
        nonAdminBlocked: {
          pass: nonAdminErrorCode === "ADMIN_PERMISSION_REQUIRED",
          errorCode: nonAdminErrorCode,
        },
        approve: {
          pass: true,
          requestId: approveRequest.id,
          targetUserId: approveTarget.id,
          reviewedByMatchesAdmin: approveRequestDb.reviewed_by === admin.id,
          teacherRoleAdded: approveAccountDb.roles.includes("teacher"),
          accountStatusSynced: approveRequestDb.status === approveAccountDb.teacher_verification_status,
          auditApprovedLogged: Boolean(approveAuditDb),
        },
        reject: {
          pass: true,
          requestId: rejectRequest.id,
          targetUserId: rejectTarget.id,
          reviewedByMatchesAdmin: rejectRequestDb.reviewed_by === admin.id,
          teacherRoleRemoved: !rejectAccountDb.roles.includes("teacher"),
          accountStatusSynced: rejectRequestDb.status === rejectAccountDb.teacher_verification_status,
          auditRejectedLogged: Boolean(rejectAuditDb),
        },
      },
      cleanup: {
        deletedUsers: 0,
      },
      notes: [
        "Proof da chay tren DB dev/test that.",
        "Non-admin bi chan o service layer truoc khi vao admin review path.",
        "Approve/reject duoc doi chieu lai bang truy van DB runtime.",
      ],
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    const usersByPrefix = await pool.query<{ id: string }>(
      `select id
       from public.user_accounts
       where email like $1`,
      [`${prefix}%`],
    );
    const userIds = usersByPrefix.rows.map((row) => row.id);

    if (userIds.length > 0) {
      await pool.query(
        `delete from public.teacher_verification_requests
         where user_id = any($1::uuid[])`,
        [userIds],
      );
      await pool.query(
        `delete from public.app_sessions
         where user_id = any($1::uuid[])`,
        [userIds],
      );
      await pool.query(
        `delete from public.user_profiles
         where user_id = any($1::uuid[])`,
        [userIds],
      );
      const deleted = await pool.query<{ id: string }>(
        `delete from public.user_accounts
         where id = any($1::uuid[])
         returning id`,
        [userIds],
      );
      deletedUsers = deleted.rowCount ?? 0;
    }
    await pool.end();

    process.stdout.write(
      `${JSON.stringify(
        {
          cleanup: {
            prefix,
            deletedUsers,
          },
        },
        null,
        2,
      )}\n`,
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
