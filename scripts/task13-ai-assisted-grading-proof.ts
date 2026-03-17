import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

type Lenh = "setup" | "verify" | "cleanup";

type TrangThaiProof = {
  prefix: string;
  examCode: string | null;
  teacherToken: string | null;
  teacherId: string | null;
  studentToken: string | null;
  studentId: string | null;
  attemptId: string | null;
  essayAnswerId: string | null;
  initialSuggestionId: string | null;
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

  if (rawLenh !== "setup" && rawLenh !== "verify" && rawLenh !== "cleanup") {
    throw new Error("Lenh khong hop le. Chi chap nhan setup, verify hoac cleanup.");
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

async function cleanupTheoPrefix(
  pool: pg.Pool,
  prefix: string,
): Promise<{ deletedClasses: number; deletedUsers: number }> {
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
  const prefix = `task13-${Date.now()}`;
  const password = "Task13!SafePass123";
  const state: TrangThaiProof = {
    prefix,
    examCode: null,
    teacherToken: null,
    teacherId: null,
    studentToken: null,
    studentId: null,
    attemptId: null,
    essayAnswerId: null,
    initialSuggestionId: null,
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
    lietKeCauHoiTheoExam,
    lietKeCauTraLoiTheoAttempt,
    luuCauTraLoiTheoAttempt,
    nopBaiKiemTra,
    taoBaiKiemTraTheoLop,
    taoCauHoiChoExam,
    taoGoiYChamAIChoEssay,
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
      gradeLabel: "Khoi 12A5",
      fullClassName: `${prefix}-lop-ai-grading`,
    });

    await thamGiaLopHocBangMa(studentToken, {
      classCode: lop.classRecord.classCode,
      joinCode: lop.classRecord.joinCode,
    });

    const exam = await taoBaiKiemTraTheoLop(teacherToken, {
      classCode: lop.classRecord.classCode,
      title: `AI assisted grading runtime ${prefix}`,
      description: "Proof runtime cho teacher AI-assisted grading task 13.",
      status: "published",
    });

    await taoCauHoiChoExam(teacherToken, {
      examCode: exam.examCode,
      questionOrder: 1,
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
      questionOrder: 2,
      questionType: "essay_placeholder",
      promptText: "Viet doan ngan ve trach nhiem cong dan trong moi truong hoc duong.",
      points: 4,
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

    const questionItems = await lietKeCauHoiTheoExam(teacherToken, exam.examCode);
    const shortQuestion = questionItems.find((item) => item.question.questionType === "short_answer");
    const essayQuestion = questionItems.find((item) => item.question.questionType === "essay_placeholder");
    assert.ok(shortQuestion, "Phai co short answer question de proof.");
    assert.ok(essayQuestion, "Phai co essay question de proof.");

    const started = await vaoBaiKiemTraTheoMa(studentToken, {
      examCode: exam.examCode,
    });
    await luuCauTraLoiTheoAttempt(studentToken, {
      attemptId: started.attempt.id,
      questionId: shortQuestion.question.id,
      answerText: "Ha Noi",
      answerJson: {},
    });
    await luuCauTraLoiTheoAttempt(studentToken, {
      attemptId: started.attempt.id,
      questionId: essayQuestion.question.id,
      answerText:
        "Bai lam neu ro y thuc ton trong noi quy, chu dong hop tac va trach nhiem voi tap the. Lap luan du dai de AI mock goi y diem phu hop.",
      answerJson: {},
    });
    await nopBaiKiemTra(studentToken, {
      attemptId: started.attempt.id,
    });

    const answerItems = await lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id);
    const essayAnswer = answerItems.find((item) => item.question.id === essayQuestion.question.id);
    assert.ok(essayAnswer, "Phai co essay answer sau submit.");

    const initialSuggestion = await taoGoiYChamAIChoEssay(teacherToken, {
      examCode: exam.examCode,
      answerId: essayAnswer.answer.id,
    });

    state.examCode = exam.examCode;
    state.teacherToken = teacherToken;
    state.teacherId = teacher.id;
    state.studentToken = studentToken;
    state.studentId = student.id;
    state.attemptId = started.attempt.id;
    state.essayAnswerId = essayAnswer.answer.id;
    state.initialSuggestionId = initialSuggestion.suggestion.id;
    ghiState(statePath, state);

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          prefix,
          examCode: exam.examCode,
          initialSuggestionId: initialSuggestion.suggestion.id,
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

async function verifyProof(statePath: string, pool: pg.Pool): Promise<void> {
  if (!existsSync(statePath)) {
    throw new Error("Khong tim thay state file de verify.");
  }

  const raw = readFileSync(statePath, "utf8");
  const state = JSON.parse(raw) as TrangThaiProof;
  if (
    !state.examCode ||
    !state.teacherToken ||
    !state.teacherId ||
    !state.studentToken ||
    !state.studentId ||
    !state.attemptId ||
    !state.essayAnswerId ||
    !state.initialSuggestionId
  ) {
    throw new Error("State verify khong day du.");
  }

  const duongDanExamService = "@/server/exams/" + "service.ts";
  const {
    boQuaGoiYChamAI,
    chapNhanGoiYChamAI,
    lietKeGoiYChamAIChoTeacher,
    taiKetQuaBaiLamTheoExamCode,
    taoGoiYChamAIChoEssay,
  }: typeof import("@/server/exams/service") = await import(duongDanExamService);

  const listedBeforeReject = await lietKeGoiYChamAIChoTeacher(state.teacherToken, state.examCode);
  const initialSuggestion = listedBeforeReject.find(
    (item) => item.suggestion.id === state.initialSuggestionId,
  );
  assert.ok(initialSuggestion, "Phai tim thay pending suggestion ban dau.");
  assert.equal(initialSuggestion.suggestion.status, "pending");

  const rejected = await boQuaGoiYChamAI(state.teacherToken, state.initialSuggestionId);
  assert.equal(rejected.suggestion.status, "rejected");
  assert.equal(rejected.attempt.finalScore, null);
  assert.equal(rejected.attempt.pendingManualGradingCount, 1);

  const dbRejected = await pool.query<{
    status: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
  }>(
    `select status, reviewed_by, reviewed_at
     from public.ai_grading_suggestions
     where id = $1
     limit 1`,
    [state.initialSuggestionId],
  );
  assert.equal(dbRejected.rows[0]?.status, "rejected");
  assert.equal(dbRejected.rows[0]?.reviewed_by, state.teacherId);
  assert.ok(dbRejected.rows[0]?.reviewed_at, "reviewed_at cua suggestion reject phai co gia tri.");

  const replacementSuggestion = await taoGoiYChamAIChoEssay(state.teacherToken, {
    examCode: state.examCode,
    answerId: state.essayAnswerId,
  });
  assert.equal(replacementSuggestion.suggestion.status, "pending");

  const accepted = await chapNhanGoiYChamAI(
    state.teacherToken,
    replacementSuggestion.suggestion.id,
  );
  assert.equal(accepted.suggestion.status, "accepted");
  assert.equal(accepted.attempt.pendingManualGradingCount, 0);
  assert.equal(
    accepted.attempt.finalScore,
    2 + replacementSuggestion.suggestion.suggestedPoints,
  );

  const dbAccepted = await pool.query<{
    status: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    model_name: string;
  }>(
    `select status, reviewed_by, reviewed_at, model_name
     from public.ai_grading_suggestions
     where id = $1
     limit 1`,
    [replacementSuggestion.suggestion.id],
  );
  assert.equal(dbAccepted.rows[0]?.status, "accepted");
  assert.equal(dbAccepted.rows[0]?.reviewed_by, state.teacherId);
  assert.ok(dbAccepted.rows[0]?.reviewed_at, "reviewed_at cua suggestion accept phai co gia tri.");
  assert.ok((dbAccepted.rows[0]?.model_name ?? "").length > 0);

  const dbAnswer = await pool.query<{
    manual_awarded_points: string | number | null;
    grading_note: string | null;
    graded_by: string | null;
    graded_at: string | null;
    awarded_points: string | number | null;
  }>(
    `select manual_awarded_points, grading_note, graded_by, graded_at, awarded_points
     from public.class_exam_attempt_answers
     where id = $1
     limit 1`,
    [state.essayAnswerId],
  );
  assert.equal(
    Number(dbAnswer.rows[0]?.manual_awarded_points ?? NaN),
    replacementSuggestion.suggestion.suggestedPoints,
  );
  assert.equal(
    Number(dbAnswer.rows[0]?.awarded_points ?? NaN),
    replacementSuggestion.suggestion.suggestedPoints,
  );
  assert.equal(dbAnswer.rows[0]?.grading_note, replacementSuggestion.suggestion.suggestedFeedback);
  assert.equal(dbAnswer.rows[0]?.graded_by, state.teacherId);
  assert.ok(dbAnswer.rows[0]?.graded_at, "graded_at phai duoc cap nhat.");

  const dbAttempt = await pool.query<{
    final_score: string | number | null;
    pending_manual_grading_count: number;
  }>(
    `select final_score, pending_manual_grading_count
     from public.class_exam_attempts
     where id = $1
     limit 1`,
    [state.attemptId],
  );
  assert.equal(
    Number(dbAttempt.rows[0]?.final_score ?? NaN),
    2 + replacementSuggestion.suggestion.suggestedPoints,
  );
  assert.equal(dbAttempt.rows[0]?.pending_manual_grading_count, 0);

  const studentResult = await taiKetQuaBaiLamTheoExamCode(state.studentToken, {
    examCode: state.examCode,
  });
  assert.equal(studentResult.summary.autoGradedScore, 2);
  assert.equal(
    studentResult.summary.finalScore,
    2 + replacementSuggestion.suggestion.suggestedPoints,
  );
  assert.equal(studentResult.summary.pendingManualGradingCount, 0);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        verify: {
          examCode: state.examCode,
          rejectedSuggestionId: state.initialSuggestionId,
          acceptedSuggestionId: replacementSuggestion.suggestion.id,
          finalScore: studentResult.summary.finalScore,
          pendingManualGradingCount: studentResult.summary.pendingManualGradingCount,
          providerMode: process.env.AI_GRADING_PROVIDER_MODE ?? "mock",
        },
      },
      null,
      2,
    )}\n`,
  );
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
  process.env.AI_GRADING_PROVIDER_MODE ??= "mock";
  process.env.AI_GRADING_MODEL_NAME ??= "mock-essay-grader-v1";

  const { lenh, statePath } = docThamSo(process.argv);
  const adapterMode = (process.env.AUTH_ADAPTER_MODE ?? "").trim().toLowerCase();
  if (adapterMode === "mock") {
    throw new Error("Task13 runtime proof yeu cau adapter that, khong chap nhan AUTH_ADAPTER_MODE=mock.");
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

    if (lenh === "verify") {
      await verifyProof(statePath, pool);
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
