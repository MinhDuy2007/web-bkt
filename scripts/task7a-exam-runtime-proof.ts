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

type ExamDbRow = {
  id: string;
  exam_code: string;
  class_id: string;
  created_by_user_id: string;
  status: string;
};

type AttemptDbRow = {
  id: string;
  class_exam_id: string;
  user_id: string;
  status: string;
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
    teacherApprovedCreateExam: {
      pass: boolean;
      examCode: string | null;
      classId: string | null;
      ownerUserId: string | null;
      status: string | null;
    };
    teacherPendingBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    normalUserBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    nonOwnerTeacherBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    memberStartSuccess: {
      pass: boolean;
      examCode: string | null;
      attemptStatus: string | null;
    };
    outsiderBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    duplicateAttemptBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    unpublishedExamBlocked: {
      pass: boolean;
      examCode: string | null;
      errorCode: string | null;
    };
    listMyCreatedExams: {
      pass: boolean;
      total: number;
      hasPublishedExam: boolean;
      hasDraftExam: boolean;
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

  const adapterMode = (process.env.AUTH_ADAPTER_MODE ?? "unknown").trim().toLowerCase();
  if (adapterMode === "mock") {
    throw new Error("Task7A runtime proof yeu cau DB that, khong chap nhan AUTH_ADAPTER_MODE=mock.");
  }

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
  const duongDanExamService = "@/server/exams/" + "service.ts";

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
    taoLopHocBoiGiaoVien,
    thamGiaLopHocBangMa,
  }: typeof import("@/server/classes/service") = await import(duongDanClassService);
  const {
    taoBaiKiemTraTheoLop,
    vaoBaiKiemTraTheoMa,
    lietKeBaiKiemTraDaTao,
  }: typeof import("@/server/exams/service") = await import(duongDanExamService);

  const repository = layAuthRepository();
  const prefix = `task7a-${Date.now()}`;
  const password = "Task7A!SafePass123";

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

  async function docExamTheoCode(examCode: string): Promise<ExamDbRow | null> {
    const result = await pool.query<ExamDbRow>(
      `select id, exam_code, class_id, created_by_user_id, status
       from public.class_exams
       where exam_code = $1
       limit 1`,
      [examCode],
    );
    return result.rows[0] ?? null;
  }

  async function docAttemptTheoExamVaUser(
    classExamId: string,
    userId: string,
  ): Promise<AttemptDbRow | null> {
    const result = await pool.query<AttemptDbRow>(
      `select id, class_exam_id, user_id, status
       from public.class_exam_attempts
       where class_exam_id = $1
         and user_id = $2
       limit 1`,
      [classExamId, userId],
    );
    return result.rows[0] ?? null;
  }

  const summary: RuntimeProofSummary = {
    adapterMode,
    prefix,
    proofScope: {
      service: true,
      repository: true,
      database: true,
      route: false,
    },
    cases: {
      teacherApprovedCreateExam: {
        pass: false,
        examCode: null,
        classId: null,
        ownerUserId: null,
        status: null,
      },
      teacherPendingBlocked: {
        pass: false,
        errorCode: null,
      },
      normalUserBlocked: {
        pass: false,
        errorCode: null,
      },
      nonOwnerTeacherBlocked: {
        pass: false,
        errorCode: null,
      },
      memberStartSuccess: {
        pass: false,
        examCode: null,
        attemptStatus: null,
      },
      outsiderBlocked: {
        pass: false,
        errorCode: null,
      },
      duplicateAttemptBlocked: {
        pass: false,
        errorCode: null,
      },
      unpublishedExamBlocked: {
        pass: false,
        examCode: null,
        errorCode: null,
      },
      listMyCreatedExams: {
        pass: false,
        total: 0,
        hasPublishedExam: false,
        hasDraftExam: false,
      },
    },
    cleanup: {
      deletedClasses: 0,
      deletedUsers: 0,
    },
    notes: [],
  };

  try {
    const teacherOwner = await taoTaiKhoan({
      email: `${prefix}-teacher-owner@test.local`,
      password,
      displayName: `${prefix}-teacher-owner`,
    });
    const teacherOther = await taoTaiKhoan({
      email: `${prefix}-teacher-other@test.local`,
      password,
      displayName: `${prefix}-teacher-other`,
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
    const studentMember = await taoTaiKhoan({
      email: `${prefix}-student-member@test.local`,
      password,
      displayName: `${prefix}-student-member`,
    });
    const outsider = await taoTaiKhoan({
      email: `${prefix}-outsider@test.local`,
      password,
      displayName: `${prefix}-outsider`,
    });

    await repository.updateUser(teacherOwner.id, {
      roles: ["user", "teacher"],
      teacherVerificationStatus: "approved",
    });
    await repository.updateUser(teacherOther.id, {
      roles: ["user", "teacher"],
      teacherVerificationStatus: "approved",
    });
    await repository.updateUser(teacherPending.id, {
      roles: ["user", "teacher"],
      teacherVerificationStatus: "pending_review",
    });

    const teacherOwnerToken = await dangNhapLayToken(teacherOwner);
    const teacherOtherToken = await dangNhapLayToken(teacherOther);
    const teacherPendingToken = await dangNhapLayToken(teacherPending);
    const userThuongToken = await dangNhapLayToken(userThuong);
    const studentMemberToken = await dangNhapLayToken(studentMember);
    const outsiderToken = await dangNhapLayToken(outsider);

    const lop = await taoLopHocBoiGiaoVien(teacherOwnerToken, {
      educationLevel: "THPT",
      subjectName: `Toan ${prefix}`,
      schoolName: "THPT Runtime Proof",
      gradeLabel: "Khoi 11A",
      fullClassName: `${prefix}-class-exam-proof`,
    });

    await thamGiaLopHocBangMa(studentMemberToken, {
      classCode: lop.classRecord.classCode,
      joinCode: lop.classRecord.joinCode,
    });

    const publishedExam = await taoBaiKiemTraTheoLop(teacherOwnerToken, {
      classCode: lop.classRecord.classCode,
      title: "De thi runtime published",
      description: "Proof exam published",
      status: "published",
    });

    const publishedExamRow = await docExamTheoCode(publishedExam.examCode);
    assert.ok(publishedExamRow);
    assert.equal(publishedExamRow?.class_id, lop.classRecord.id);
    assert.equal(publishedExamRow?.created_by_user_id, teacherOwner.id);
    assert.equal(publishedExamRow?.status, "published");
    summary.cases.teacherApprovedCreateExam = {
      pass: true,
      examCode: publishedExam.examCode,
      classId: publishedExamRow?.class_id ?? null,
      ownerUserId: publishedExamRow?.created_by_user_id ?? null,
      status: publishedExamRow?.status ?? null,
    };

    let pendingErrorCode: string | null = null;
    try {
      await taoBaiKiemTraTheoLop(teacherPendingToken, {
        classCode: lop.classRecord.classCode,
        title: "Pending tao de",
        description: null,
        status: "published",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        pendingErrorCode = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(pendingErrorCode, "CLASS_PERMISSION_REQUIRED");
    summary.cases.teacherPendingBlocked = {
      pass: pendingErrorCode === "CLASS_PERMISSION_REQUIRED",
      errorCode: pendingErrorCode,
    };

    let normalUserErrorCode: string | null = null;
    try {
      await taoBaiKiemTraTheoLop(userThuongToken, {
        classCode: lop.classRecord.classCode,
        title: "User thuong tao de",
        description: null,
        status: "published",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        normalUserErrorCode = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(normalUserErrorCode, "CLASS_PERMISSION_REQUIRED");
    summary.cases.normalUserBlocked = {
      pass: normalUserErrorCode === "CLASS_PERMISSION_REQUIRED",
      errorCode: normalUserErrorCode,
    };

    let nonOwnerErrorCode: string | null = null;
    try {
      await taoBaiKiemTraTheoLop(teacherOtherToken, {
        classCode: lop.classRecord.classCode,
        title: "Teacher khong so huu lop",
        description: null,
        status: "published",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        nonOwnerErrorCode = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(nonOwnerErrorCode, "CLASS_OWNERSHIP_REQUIRED");
    summary.cases.nonOwnerTeacherBlocked = {
      pass: nonOwnerErrorCode === "CLASS_OWNERSHIP_REQUIRED",
      errorCode: nonOwnerErrorCode,
    };

    const startResult = await vaoBaiKiemTraTheoMa(studentMemberToken, {
      examCode: publishedExam.examCode,
    });
    const attemptRow = await docAttemptTheoExamVaUser(publishedExam.id, studentMember.id);
    assert.ok(attemptRow);
    assert.equal(attemptRow?.status, "started");
    assert.equal(startResult.attempt.status, "started");
    summary.cases.memberStartSuccess = {
      pass: Boolean(attemptRow && attemptRow.status === "started"),
      examCode: publishedExam.examCode,
      attemptStatus: attemptRow?.status ?? null,
    };

    let outsiderErrorCode: string | null = null;
    try {
      await vaoBaiKiemTraTheoMa(outsiderToken, {
        examCode: publishedExam.examCode,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        outsiderErrorCode = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(outsiderErrorCode, "CLASS_MEMBERSHIP_REQUIRED");
    summary.cases.outsiderBlocked = {
      pass: outsiderErrorCode === "CLASS_MEMBERSHIP_REQUIRED",
      errorCode: outsiderErrorCode,
    };

    let duplicateAttemptErrorCode: string | null = null;
    try {
      await vaoBaiKiemTraTheoMa(studentMemberToken, {
        examCode: publishedExam.examCode,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        duplicateAttemptErrorCode = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(duplicateAttemptErrorCode, "EXAM_ATTEMPT_ALREADY_EXISTS");
    summary.cases.duplicateAttemptBlocked = {
      pass: duplicateAttemptErrorCode === "EXAM_ATTEMPT_ALREADY_EXISTS",
      errorCode: duplicateAttemptErrorCode,
    };

    const draftExam = await taoBaiKiemTraTheoLop(teacherOwnerToken, {
      classCode: lop.classRecord.classCode,
      title: "De thi runtime draft",
      description: "Exam chua mo",
      status: "draft",
    });
    const draftExamRow = await docExamTheoCode(draftExam.examCode);
    assert.equal(draftExamRow?.status, "draft");

    let draftErrorCode: string | null = null;
    try {
      await vaoBaiKiemTraTheoMa(studentMemberToken, {
        examCode: draftExam.examCode,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        draftErrorCode = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(draftErrorCode, "EXAM_NOT_AVAILABLE");
    summary.cases.unpublishedExamBlocked = {
      pass: draftErrorCode === "EXAM_NOT_AVAILABLE",
      examCode: draftExam.examCode,
      errorCode: draftErrorCode,
    };

    const createdExams = await lietKeBaiKiemTraDaTao(teacherOwnerToken);
    const hasPublishedExam = createdExams.some(
      (item) =>
        item.exam.examCode === publishedExam.examCode &&
        item.exam.classId === lop.classRecord.id &&
        item.classCode === lop.classRecord.classCode,
    );
    const hasDraftExam = createdExams.some(
      (item) =>
        item.exam.examCode === draftExam.examCode &&
        item.exam.classId === lop.classRecord.id &&
        item.classCode === lop.classRecord.classCode,
    );
    assert.equal(hasPublishedExam, true);
    assert.equal(hasDraftExam, true);
    summary.cases.listMyCreatedExams = {
      pass: hasPublishedExam && hasDraftExam,
      total: createdExams.length,
      hasPublishedExam,
      hasDraftExam,
    };

    summary.notes.push("Proof da chay tren DB dev/test that.");
    summary.notes.push("Scope proof: service + repository + DB.");
    summary.notes.push("Route-level chua duoc proof trong script nay.");
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
        `delete from public.class_exam_attempts
         where class_exam_id in (
           select ce.id
           from public.class_exams ce
           where ce.class_id = any($1::uuid[])
         )`,
        [classIds],
      );
      await pool.query(
        `delete from public.class_exams
         where class_id = any($1::uuid[])`,
        [classIds],
      );
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
