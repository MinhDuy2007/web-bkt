import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

type Lenh = "setup" | "cleanup";

type TrangThaiProof = {
  prefix: string;
  examCode: string | null;
  sessionToken: string | null;
};

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

function docThamSo(argv: string[]): { lenh: Lenh; statePath: string } {
  const rawLenh = argv[2];
  const statePath = argv[3];

  if (rawLenh !== "setup" && rawLenh !== "cleanup") {
    throw new Error("Lenh khong hop le. Chi chap nhan setup hoac cleanup.");
  }

  if (!statePath) {
    throw new Error("Thieu duong dan state file.");
  }

  return {
    lenh: rawLenh,
    statePath: resolve(process.cwd(), statePath),
  };
}

function ghiState(statePath: string, state: TrangThaiProof): void {
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function cleanupTheoPrefix(pool: pg.Pool, prefix: string): Promise<{ deletedClasses: number; deletedUsers: number }> {
  let deletedClasses = 0;
  let deletedUsers = 0;

  const classRows = await pool.query<{ id: string }>(
    `select id
     from public.classes
     where full_class_name like $1`,
    [`${prefix}%`],
  );
  const classIds = classRows.rows.map((row) => row.id);

  if (classIds.length > 0) {
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
      `delete from public.teacher_verification_audit_logs
       where actor_user_id = any($1::uuid[])`,
      [userIds],
    );
    await pool.query(
      `delete from public.teacher_verification_requests
       where user_id = any($1::uuid[])
          or reviewed_by = any($1::uuid[])`,
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

  return {
    deletedClasses,
    deletedUsers,
  };
}

async function setupProof(statePath: string, pool: pg.Pool): Promise<void> {
  const prefix = `task10-${Date.now()}`;
  const password = "Task10!SafePass123";
  const state: TrangThaiProof = {
    prefix,
    examCode: null,
    sessionToken: null,
  };
  ghiState(statePath, state);

  const duongDanAuthRepository = "@/server/auth/repository/" + "index.ts";
  const duongDanAuthService = "@/server/auth/" + "service.ts";
  const duongDanClassService = "@/server/classes/" + "service.ts";
  const duongDanExamService = "@/server/exams/" + "service.ts";

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
    taoCauHoiChoExam,
    vaoBaiKiemTraTheoMa,
  }: typeof import("@/server/exams/service") = await import(duongDanExamService);

  const authRepository = layAuthRepository();

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

  try {
    const teacher = await taoTaiKhoan({
      email: `${prefix}-teacher@test.local`,
      password,
      displayName: `${prefix}-teacher`,
    });
    const student = await taoTaiKhoan({
      email: `${prefix}-student@test.local`,
      password,
      displayName: `${prefix}-student`,
    });

    await authRepository.updateUser(teacher.id, {
      roles: ["user", "teacher"],
      teacherVerificationStatus: "approved",
    });

    const teacherToken = await dangNhapLayToken(teacher);
    const studentToken = await dangNhapLayToken(student);

    const lop = await taoLopHocBoiGiaoVien(teacherToken, {
      educationLevel: "THPT",
      subjectName: `Ngu van ${prefix}`,
      schoolName: "THPT Dev Test",
      gradeLabel: "Khoi 10A1",
      fullClassName: `${prefix}-lop-hoc-ui-player`,
    });

    await thamGiaLopHocBangMa(studentToken, {
      classCode: lop.classRecord.classCode,
      joinCode: lop.classRecord.joinCode,
    });

    const exam = await taoBaiKiemTraTheoLop(teacherToken, {
      classCode: lop.classRecord.classCode,
      title: `Bai thi runtime ${prefix}`,
      description: "Exam player toi thieu cho hoc sinh tren dev/test.",
      status: "published",
    });

    await taoCauHoiChoExam(teacherToken, {
      examCode: exam.examCode,
      questionOrder: 1,
      questionType: "multiple_choice_single",
      promptText: "2 + 2 bang bao nhieu?",
      points: 1,
      metadataJson: {
        options: ["3", "4", "5"],
      },
      answerKey: {
        keyType: "multiple_choice_single",
        correctAnswerText: "4",
        correctAnswerJson: {},
        explanationText: null,
      },
    });
    await taoCauHoiChoExam(teacherToken, {
      examCode: exam.examCode,
      questionOrder: 2,
      questionType: "true_false",
      promptText: "Trai Dat quay quanh Mat Troi.",
      points: 1,
      metadataJson: {},
      answerKey: {
        keyType: "true_false",
        correctAnswerText: "true",
        correctAnswerJson: {},
        explanationText: null,
      },
    });
    await taoCauHoiChoExam(teacherToken, {
      examCode: exam.examCode,
      questionOrder: 3,
      questionType: "short_answer",
      promptText: "Thu do cua Viet Nam la gi?",
      points: 2,
      metadataJson: {
        caseSensitive: false,
      },
      answerKey: {
        keyType: "short_answer",
        correctAnswerText: "Ha Noi",
        correctAnswerJson: {},
        explanationText: null,
      },
    });
    await taoCauHoiChoExam(teacherToken, {
      examCode: exam.examCode,
      questionOrder: 4,
      questionType: "essay_placeholder",
      promptText: "Viet doan van ngan ve muc tieu hoc tap cua ban.",
      points: 3,
      metadataJson: {
        expectedMinWords: 40,
      },
      answerKey: {
        keyType: "essay_placeholder",
        correctAnswerText: null,
        correctAnswerJson: {},
        explanationText: null,
      },
    });

    await vaoBaiKiemTraTheoMa(studentToken, {
      examCode: exam.examCode,
    });

    state.examCode = exam.examCode;
    state.sessionToken = studentToken;
    ghiState(statePath, state);

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          prefix,
          examCode: exam.examCode,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    await cleanupTheoPrefix(pool, prefix);
    throw error;
  }
}

async function cleanupProof(statePath: string, pool: pg.Pool): Promise<void> {
  if (!existsSync(statePath)) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          cleanup: {
            skipped: true,
            reason: "state file khong ton tai",
          },
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const raw = readFileSync(statePath, "utf8");
  const state = JSON.parse(raw) as TrangThaiProof;
  const cleanup = await cleanupTheoPrefix(pool, state.prefix);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        cleanup: {
          prefix: state.prefix,
          deletedClasses: cleanup.deletedClasses,
          deletedUsers: cleanup.deletedUsers,
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function main(): Promise<void> {
  napEnvTuFile(resolve(process.cwd(), ".env.local"));

  const { lenh, statePath } = docThamSo(process.argv);
  const adapterMode = (process.env.AUTH_ADAPTER_MODE ?? "").trim().toLowerCase();
  if (adapterMode === "mock") {
    throw new Error("Task10 UI proof yeu cau adapter that, khong chap nhan AUTH_ADAPTER_MODE=mock.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Thieu DATABASE_URL trong moi truong runtime.");
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
  });

  try {
    if (lenh === "setup") {
      await setupProof(statePath, pool);
      return;
    }

    await cleanupProof(statePath, pool);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
