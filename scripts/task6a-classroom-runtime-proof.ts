import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

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

type LopHocDbHang = {
  id: string;
  class_code: string;
  join_code: string;
  teacher_user_id: string;
  status: string;
  teacher_member_user_id: string;
  teacher_member_role: string;
};

type ThanhVienDbHang = {
  user_id: string;
  member_role: string;
};

type RuntimeProofSummary = {
  adapterMode: string;
  prefix: string;
  proofScope: {
    service: boolean;
    repository: boolean;
    database: boolean;
    route: boolean;
  };
  cases: {
    teacherApprovedCreateClass: {
      pass: boolean;
      classId: string | null;
      classCode: string | null;
      teacherMembershipOk: boolean;
      classStatus: string | null;
    };
    teacherPendingBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    normalUserBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    joinByCodeSuccess: {
      pass: boolean;
      memberRole: string | null;
    };
    duplicateJoinBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    wrongJoinCodeBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    listMineAfterJoin: {
      pass: boolean;
      totalClasses: number;
      hasTargetClass: boolean;
    };
  };
  cleanup: {
    deletedClasses: number;
    deletedUsers: number;
  };
  notes: string[];
};

function napEnvTuFile(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Khong tim thay file env: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/u);
  for (const line of lines) {
    if (!line || /^\s*#/.test(line)) {
      continue;
    }

    const matched = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
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

  const duongDanAuthErrors = "@/server/auth/" + "errors.ts";
  const duongDanAuthRepository = "@/server/auth/repository/" + "index.ts";
  const duongDanAuthService = "@/server/auth/" + "service.ts";
  const duongDanClassService = "@/server/classes/" + "service.ts";

  const { AuthError }: typeof import("@/server/auth/errors") = await import(duongDanAuthErrors);
  const { layAuthRepository }: typeof import("@/server/auth/repository") = await import(
    duongDanAuthRepository
  );
  const {
    chuanHoaDangKyPayload,
    dangKyTaiKhoan,
    dangNhapTaiKhoan,
  }: typeof import("@/server/auth/service") = await import(duongDanAuthService);
  const {
    lietKeLopHocCuaToi,
    taoLopHocBoiGiaoVien,
    thamGiaLopHocBangMa,
  }: typeof import("@/server/classes/service") = await import(duongDanClassService);

  const repository = layAuthRepository();
  const prefix = `task6a-${Date.now()}`;
  const password = "Task6A!SafePass123";

  let deletedClasses = 0;
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

  async function dangNhapLayToken(taiKhoan: TaiKhoanTest): Promise<string> {
    const session = await dangNhapTaiKhoan({
      email: taiKhoan.email,
      password: taiKhoan.password,
    });

    return session.token;
  }

  async function docLopHocVaThanhVienGiaoVien(classId: string, teacherUserId: string) {
    const result = await pool.query<LopHocDbHang>(
      `select
         c.id,
         c.class_code,
         c.join_code,
         c.teacher_user_id,
         c.status,
         cm.user_id as teacher_member_user_id,
         cm.member_role as teacher_member_role
       from public.classes c
       inner join public.class_members cm
         on cm.class_id = c.id
        and cm.user_id = $2
       where c.id = $1
       limit 1`,
      [classId, teacherUserId],
    );

    if (result.rowCount !== 1) {
      throw new Error(`Khong tim thay lop hoc ${classId} hoac membership giao vien trong DB.`);
    }

    return result.rows[0] as LopHocDbHang;
  }

  async function docThanhVienLop(classId: string, userId: string) {
    const result = await pool.query<ThanhVienDbHang>(
      `select user_id, member_role
       from public.class_members
       where class_id = $1
         and user_id = $2
       limit 1`,
      [classId, userId],
    );

    return result.rows[0] ?? null;
  }

  const summary: RuntimeProofSummary = {
    adapterMode: process.env.AUTH_ADAPTER_MODE ?? "unknown",
    prefix,
    proofScope: {
      service: true,
      repository: true,
      database: true,
      route: false,
    },
    cases: {
      teacherApprovedCreateClass: {
        pass: false,
        classId: null,
        classCode: null,
        teacherMembershipOk: false,
        classStatus: null,
      },
      teacherPendingBlocked: {
        pass: false,
        errorCode: null,
      },
      normalUserBlocked: {
        pass: false,
        errorCode: null,
      },
      joinByCodeSuccess: {
        pass: false,
        memberRole: null,
      },
      duplicateJoinBlocked: {
        pass: false,
        errorCode: null,
      },
      wrongJoinCodeBlocked: {
        pass: false,
        errorCode: null,
      },
      listMineAfterJoin: {
        pass: false,
        totalClasses: 0,
        hasTargetClass: false,
      },
    },
    cleanup: {
      deletedClasses: 0,
      deletedUsers: 0,
    },
    notes: [],
  };

  try {
    const teacherApproved = await taoTaiKhoan({
      email: `${prefix}-teacher-approved@test.local`,
      password,
      displayName: `${prefix}-teacher-approved`,
    });
    const teacherPending = await taoTaiKhoan({
      email: `${prefix}-teacher-pending@test.local`,
      password,
      displayName: `${prefix}-teacher-pending`,
    });
    const userThuong = await taoTaiKhoan({
      email: `${prefix}-user-thuong@test.local`,
      password,
      displayName: `${prefix}-user-thuong`,
    });
    const studentJoin = await taoTaiKhoan({
      email: `${prefix}-student-join@test.local`,
      password,
      displayName: `${prefix}-student-join`,
    });
    const studentSaiMa = await taoTaiKhoan({
      email: `${prefix}-student-sai-ma@test.local`,
      password,
      displayName: `${prefix}-student-sai-ma`,
    });

    await repository.updateUser(teacherApproved.id, {
      roles: ["user", "teacher"],
      teacherVerificationStatus: "approved",
    });
    await repository.updateUser(teacherPending.id, {
      roles: ["user", "teacher"],
      teacherVerificationStatus: "pending_review",
    });

    const teacherApprovedToken = await dangNhapLayToken(teacherApproved);
    const teacherPendingToken = await dangNhapLayToken(teacherPending);
    const userThuongToken = await dangNhapLayToken(userThuong);
    const studentJoinToken = await dangNhapLayToken(studentJoin);
    const studentSaiMaToken = await dangNhapLayToken(studentSaiMa);

    const taoLopResult = await taoLopHocBoiGiaoVien(teacherApprovedToken, {
      educationLevel: "THPT",
      subjectName: `Toan ${prefix}`,
      schoolName: "THPT Runtime Proof",
      gradeLabel: "Khoi 11A",
      fullClassName: `${prefix}-lop-thu-nghiem`,
    });
    assert.equal(taoLopResult.classRecord.teacherUserId, teacherApproved.id);
    assert.equal(taoLopResult.teacherMembership.memberRole, "teacher");
    assert.equal(taoLopResult.teacherMembership.userId, teacherApproved.id);

    const lopHocDb = await docLopHocVaThanhVienGiaoVien(
      taoLopResult.classRecord.id,
      teacherApproved.id,
    );
    assert.equal(lopHocDb.status, "active");
    assert.equal(lopHocDb.teacher_member_role, "teacher");
    assert.equal(lopHocDb.teacher_member_user_id, teacherApproved.id);

    summary.cases.teacherApprovedCreateClass = {
      pass: true,
      classId: taoLopResult.classRecord.id,
      classCode: taoLopResult.classRecord.classCode,
      teacherMembershipOk:
        lopHocDb.teacher_member_role === "teacher" &&
        lopHocDb.teacher_member_user_id === teacherApproved.id,
      classStatus: lopHocDb.status,
    };

    let teacherPendingError: string | null = null;
    try {
      await taoLopHocBoiGiaoVien(teacherPendingToken, {
        educationLevel: "THPT",
        subjectName: "Toan pending",
        schoolName: "THPT Runtime Proof",
        gradeLabel: "Khoi 10A",
        fullClassName: `${prefix}-pending-bi-chan`,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        teacherPendingError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(teacherPendingError, "CLASS_PERMISSION_REQUIRED");
    summary.cases.teacherPendingBlocked = {
      pass: teacherPendingError === "CLASS_PERMISSION_REQUIRED",
      errorCode: teacherPendingError,
    };

    let normalUserError: string | null = null;
    try {
      await taoLopHocBoiGiaoVien(userThuongToken, {
        educationLevel: "THPT",
        subjectName: "Toan user thuong",
        schoolName: "THPT Runtime Proof",
        gradeLabel: "Khoi 12A",
        fullClassName: `${prefix}-user-thuong-bi-chan`,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        normalUserError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(normalUserError, "CLASS_PERMISSION_REQUIRED");
    summary.cases.normalUserBlocked = {
      pass: normalUserError === "CLASS_PERMISSION_REQUIRED",
      errorCode: normalUserError,
    };

    const joinResult = await thamGiaLopHocBangMa(studentJoinToken, {
      classCode: taoLopResult.classRecord.classCode,
      joinCode: taoLopResult.classRecord.joinCode,
    });
    assert.equal(joinResult.membership.memberRole, "student");
    assert.equal(joinResult.membership.userId, studentJoin.id);

    const joinMembershipDb = await docThanhVienLop(taoLopResult.classRecord.id, studentJoin.id);
    assert.ok(joinMembershipDb);
    assert.equal(joinMembershipDb?.member_role, "student");
    summary.cases.joinByCodeSuccess = {
      pass: Boolean(joinMembershipDb && joinMembershipDb.member_role === "student"),
      memberRole: joinMembershipDb?.member_role ?? null,
    };

    let duplicateJoinError: string | null = null;
    try {
      await thamGiaLopHocBangMa(studentJoinToken, {
        classCode: taoLopResult.classRecord.classCode,
        joinCode: taoLopResult.classRecord.joinCode,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        duplicateJoinError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(duplicateJoinError, "CLASS_MEMBER_ALREADY_EXISTS");
    summary.cases.duplicateJoinBlocked = {
      pass: duplicateJoinError === "CLASS_MEMBER_ALREADY_EXISTS",
      errorCode: duplicateJoinError,
    };

    let wrongJoinCodeError: string | null = null;
    try {
      await thamGiaLopHocBangMa(studentSaiMaToken, {
        classCode: taoLopResult.classRecord.classCode,
        joinCode: "SAIMA123",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        wrongJoinCodeError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(wrongJoinCodeError, "CLASS_JOIN_CODE_INVALID");
    summary.cases.wrongJoinCodeBlocked = {
      pass: wrongJoinCodeError === "CLASS_JOIN_CODE_INVALID",
      errorCode: wrongJoinCodeError,
    };

    const listMine = await lietKeLopHocCuaToi(studentJoinToken);
    const hasTargetClass = listMine.some(
      (item) =>
        item.classRecord.id === taoLopResult.classRecord.id &&
        item.membership.userId === studentJoin.id &&
        item.membership.memberRole === "student",
    );
    assert.equal(hasTargetClass, true);
    summary.cases.listMineAfterJoin = {
      pass: hasTargetClass,
      totalClasses: listMine.length,
      hasTargetClass,
    };

    summary.notes.push("Proof da chay tren DB dev/test that.");
    summary.notes.push("Case create/join/permission duoc xac minh bang service + DB truy van truc tiep.");
    summary.notes.push("Route-level chua proof trong script nay, scope hien tai la service/repository/DB.");
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    const classRows = await pool.query<{ id: string }>(
      `select id
       from public.classes
       where full_class_name like $1`,
      [`${prefix}%`],
    );
    const classIds = classRows.rows.map((row) => row.id);

    if (classIds.length > 0) {
      await pool.query(
        `delete from public.class_members
         where class_id = any($1::uuid[])`,
        [classIds],
      );
      const deletedClassRows = await pool.query<{ id: string }>(
        `delete from public.classes
         where id = any($1::uuid[])
         returning id`,
        [classIds],
      );
      deletedClasses = deletedClassRows.rowCount ?? 0;
    }

    const userRows = await pool.query<{ id: string }>(
      `select id
       from public.user_accounts
       where email like $1`,
      [`${prefix}%`],
    );
    const userIds = userRows.rows.map((row) => row.id);

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
      const deletedUserRows = await pool.query<{ id: string }>(
        `delete from public.user_accounts
         where id = any($1::uuid[])
         returning id`,
        [userIds],
      );
      deletedUsers = deletedUserRows.rowCount ?? 0;
    }

    await pool.end();

    process.stdout.write(
      `${JSON.stringify(
        {
          cleanup: {
            prefix,
            deletedClasses,
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
