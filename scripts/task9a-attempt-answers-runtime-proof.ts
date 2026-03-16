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

type AttemptDbRow = {
  id: string;
  status: string;
  submitted_at: string | null;
  auto_graded_score: string | number | null;
  max_auto_graded_score: string | number | null;
  pending_manual_grading_count: number | null;
};

type AttemptAnswerDbRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_text: string | null;
  answer_json: Record<string, unknown> | null;
  awarded_points: string | number | null;
  scored_at: string | null;
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
  attemptId: string | null;
  cases: {
    ownerSaveAnswer: { pass: boolean; answerId: string | null };
    outsiderSaveBlocked: { pass: boolean; errorCode: string | null };
    listAnswerData: { pass: boolean; totalAnswers: number };
    overwriteAnswer: { pass: boolean; answerIdKept: boolean; latestAnswerText: string | null };
    submitAttempt: {
      pass: boolean;
      awardedScore: number | null;
      maxAutoGradableScore: number | null;
      pendingManualGradingCount: number | null;
      attemptStatus: string | null;
    };
    submittedLock: { pass: boolean; errorCode: string | null };
    scoringMcq: { pass: boolean; awardedPoints: number | null };
    scoringTrueFalse: { pass: boolean; awardedPoints: number | null };
    scoringShortAnswer: { pass: boolean; awardedPoints: number | null };
    essayPendingManual: { pass: boolean; awardedPoints: number | null; pendingCount: number | null };
    scorePersistenceDb: {
      pass: boolean;
      autoScore: number | null;
      maxAutoScore: number | null;
      pendingManualCount: number | null;
      submittedAtExists: boolean;
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

function docSo(value: string | number | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "number" ? value : Number(value);
}

async function main(): Promise<void> {
  napEnvTuFile(resolve(process.cwd(), ".env.local"));

  const adapterMode = (process.env.AUTH_ADAPTER_MODE ?? "unknown").trim().toLowerCase();
  if (adapterMode === "mock") {
    throw new Error("Task9A runtime proof yeu cau DB that, khong chap nhan AUTH_ADAPTER_MODE=mock.");
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
    taoCauHoiChoExam,
    vaoBaiKiemTraTheoMa,
    luuCauTraLoiTheoAttempt,
    lietKeCauTraLoiTheoAttempt,
    nopBaiKiemTra,
  }: typeof import("@/server/exams/service") = await import(duongDanExamService);

  const authRepository = layAuthRepository();
  const prefix = `task9a-${Date.now()}`;
  const password = "Task9A!SafePass123";
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

  async function docAttempt(attemptId: string): Promise<AttemptDbRow | null> {
    const result = await pool.query<AttemptDbRow>(
      `select
         id,
         status,
         submitted_at,
         auto_graded_score,
         max_auto_graded_score,
         pending_manual_grading_count
       from public.class_exam_attempts
       where id = $1
       limit 1`,
      [attemptId],
    );

    return result.rows[0] ?? null;
  }

  async function docAttemptAnswers(attemptId: string): Promise<AttemptAnswerDbRow[]> {
    const result = await pool.query<AttemptAnswerDbRow>(
      `select
         id,
         attempt_id,
         question_id,
         answer_text,
         answer_json,
         awarded_points,
         scored_at
       from public.class_exam_attempt_answers
       where attempt_id = $1
       order by created_at asc`,
      [attemptId],
    );

    return result.rows;
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
    attemptId: null,
    cases: {
      ownerSaveAnswer: { pass: false, answerId: null },
      outsiderSaveBlocked: { pass: false, errorCode: null },
      listAnswerData: { pass: false, totalAnswers: 0 },
      overwriteAnswer: { pass: false, answerIdKept: false, latestAnswerText: null },
      submitAttempt: {
        pass: false,
        awardedScore: null,
        maxAutoGradableScore: null,
        pendingManualGradingCount: null,
        attemptStatus: null,
      },
      submittedLock: { pass: false, errorCode: null },
      scoringMcq: { pass: false, awardedPoints: null },
      scoringTrueFalse: { pass: false, awardedPoints: null },
      scoringShortAnswer: { pass: false, awardedPoints: null },
      essayPendingManual: { pass: false, awardedPoints: null, pendingCount: null },
      scorePersistenceDb: {
        pass: false,
        autoScore: null,
        maxAutoScore: null,
        pendingManualCount: null,
        submittedAtExists: false,
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
    const studentMember = await taoTaiKhoan({
      email: `${prefix}-student-member@test.local`,
      password,
      displayName: `${prefix}-student-member`,
    });
    const outsiderUser = await taoTaiKhoan({
      email: `${prefix}-outsider@test.local`,
      password,
      displayName: `${prefix}-outsider`,
    });

    await authRepository.updateUser(teacherOwner.id, {
      roles: ["user", "teacher"],
      teacherVerificationStatus: "approved",
    });

    const teacherToken = await dangNhapLayToken(teacherOwner);
    const studentToken = await dangNhapLayToken(studentMember);
    const outsiderToken = await dangNhapLayToken(outsiderUser);

    const lop = await taoLopHocBoiGiaoVien(teacherToken, {
      educationLevel: "THPT",
      subjectName: `Toan ${prefix}`,
      schoolName: "THPT Runtime Proof",
      gradeLabel: "Khoi 11A",
      fullClassName: `${prefix}-class-attempt-proof`,
    });
    await thamGiaLopHocBangMa(studentToken, {
      classCode: lop.classRecord.classCode,
      joinCode: lop.classRecord.joinCode,
    });

    const exam = await taoBaiKiemTraTheoLop(teacherToken, {
      classCode: lop.classRecord.classCode,
      title: `De thi ${prefix}`,
      description: "Proof attempt answers runtime",
      status: "published",
    });

    const q1 = await taoCauHoiChoExam(teacherToken, {
      examCode: exam.examCode,
      questionOrder: 1,
      questionType: "multiple_choice_single",
      promptText: "2 + 3 bang bao nhieu?",
      points: 2,
      metadataJson: {
        options: ["4", "5", "6"],
      },
      answerKey: {
        keyType: "multiple_choice_single",
        correctAnswerText: "5",
        correctAnswerJson: {},
        explanationText: null,
      },
    });
    const q2 = await taoCauHoiChoExam(teacherToken, {
      examCode: exam.examCode,
      questionOrder: 2,
      questionType: "true_false",
      promptText: "Nuoc soi o 100 do C?",
      points: 1,
      metadataJson: {},
      answerKey: {
        keyType: "true_false",
        correctAnswerText: "true",
        correctAnswerJson: {},
        explanationText: null,
      },
    });
    const q3 = await taoCauHoiChoExam(teacherToken, {
      examCode: exam.examCode,
      questionOrder: 3,
      questionType: "short_answer",
      promptText: "Thu do cua Viet Nam la gi?",
      points: 3,
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
    const q4 = await taoCauHoiChoExam(teacherToken, {
      examCode: exam.examCode,
      questionOrder: 4,
      questionType: "essay_placeholder",
      promptText: "Phan tich ngan gon.",
      points: 4,
      metadataJson: {},
      answerKey: {
        keyType: "essay_placeholder",
        correctAnswerText: null,
        correctAnswerJson: {},
        explanationText: null,
      },
    });

    const started = await vaoBaiKiemTraTheoMa(studentToken, {
      examCode: exam.examCode,
    });
    summary.attemptId = started.attempt.id;

    const savedQ1Lan1 = await luuCauTraLoiTheoAttempt(studentToken, {
      attemptId: started.attempt.id,
      questionId: q1.question.id,
      answerText: "A",
      answerJson: {},
    });
    summary.cases.ownerSaveAnswer = {
      pass: savedQ1Lan1.answer.attemptId === started.attempt.id,
      answerId: savedQ1Lan1.answer.id,
    };

    let outsiderSaveError: string | null = null;
    try {
      await luuCauTraLoiTheoAttempt(outsiderToken, {
        attemptId: started.attempt.id,
        questionId: q1.question.id,
        answerText: "B",
        answerJson: {},
      });
    } catch (error) {
      if (error instanceof AuthError) {
        outsiderSaveError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(outsiderSaveError, "EXAM_ATTEMPT_PERMISSION_REQUIRED");
    summary.cases.outsiderSaveBlocked = {
      pass: outsiderSaveError === "EXAM_ATTEMPT_PERMISSION_REQUIRED",
      errorCode: outsiderSaveError,
    };

    const listLan1 = await lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id);
    assert.equal(listLan1.length, 1);
    assert.equal(listLan1[0]?.question.id, q1.question.id);
    summary.cases.listAnswerData = {
      pass: listLan1.length === 1 && listLan1[0]?.question.id === q1.question.id,
      totalAnswers: listLan1.length,
    };

    const savedQ1Lan2 = await luuCauTraLoiTheoAttempt(studentToken, {
      attemptId: started.attempt.id,
      questionId: q1.question.id,
      answerText: "5",
      answerJson: {},
    });
    assert.equal(savedQ1Lan2.answer.id, savedQ1Lan1.answer.id);
    assert.equal(savedQ1Lan2.answer.answerText, "5");
    summary.cases.overwriteAnswer = {
      pass: savedQ1Lan2.answer.id === savedQ1Lan1.answer.id && savedQ1Lan2.answer.answerText === "5",
      answerIdKept: savedQ1Lan2.answer.id === savedQ1Lan1.answer.id,
      latestAnswerText: savedQ1Lan2.answer.answerText,
    };

    await luuCauTraLoiTheoAttempt(studentToken, {
      attemptId: started.attempt.id,
      questionId: q2.question.id,
      answerText: "false",
      answerJson: {},
    });
    await luuCauTraLoiTheoAttempt(studentToken, {
      attemptId: started.attempt.id,
      questionId: q3.question.id,
      answerText: "  ha   noi ",
      answerJson: {},
    });
    await luuCauTraLoiTheoAttempt(studentToken, {
      attemptId: started.attempt.id,
      questionId: q4.question.id,
      answerText: "Bai essay can cham tay.",
      answerJson: {},
    });

    const submit = await nopBaiKiemTra(studentToken, {
      attemptId: started.attempt.id,
    });
    assert.equal(submit.attempt.status, "submitted");
    assert.equal(submit.scoreSummary.awardedScore, 5);
    assert.equal(submit.scoreSummary.maxAutoGradableScore, 6);
    assert.equal(submit.scoreSummary.pendingManualGradingCount, 1);
    summary.cases.submitAttempt = {
      pass:
        submit.attempt.status === "submitted" &&
        submit.scoreSummary.awardedScore === 5 &&
        submit.scoreSummary.maxAutoGradableScore === 6 &&
        submit.scoreSummary.pendingManualGradingCount === 1,
      awardedScore: submit.scoreSummary.awardedScore,
      maxAutoGradableScore: submit.scoreSummary.maxAutoGradableScore,
      pendingManualGradingCount: submit.scoreSummary.pendingManualGradingCount,
      attemptStatus: submit.attempt.status,
    };

    let submittedLockError: string | null = null;
    try {
      await luuCauTraLoiTheoAttempt(studentToken, {
        attemptId: started.attempt.id,
        questionId: q1.question.id,
        answerText: "4",
        answerJson: {},
      });
    } catch (error) {
      if (error instanceof AuthError) {
        submittedLockError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(submittedLockError, "EXAM_ATTEMPT_ALREADY_SUBMITTED");
    summary.cases.submittedLock = {
      pass: submittedLockError === "EXAM_ATTEMPT_ALREADY_SUBMITTED",
      errorCode: submittedLockError,
    };

    const listedSauSubmit = await lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id);
    assert.equal(listedSauSubmit.length, 4);
    const answerByQuestionId = new Map(listedSauSubmit.map((item) => [item.question.id, item.answer]));
    const q1Awarded = answerByQuestionId.get(q1.question.id)?.awardedPoints ?? null;
    const q2Awarded = answerByQuestionId.get(q2.question.id)?.awardedPoints ?? null;
    const q3Awarded = answerByQuestionId.get(q3.question.id)?.awardedPoints ?? null;
    const q4Awarded = answerByQuestionId.get(q4.question.id)?.awardedPoints ?? null;
    summary.cases.scoringMcq = {
      pass: q1Awarded === 2,
      awardedPoints: q1Awarded,
    };
    summary.cases.scoringTrueFalse = {
      pass: q2Awarded === 0,
      awardedPoints: q2Awarded,
    };
    summary.cases.scoringShortAnswer = {
      pass: q3Awarded === 3,
      awardedPoints: q3Awarded,
    };
    summary.cases.essayPendingManual = {
      pass: q4Awarded === 0 && submit.scoreSummary.pendingManualGradingCount === 1,
      awardedPoints: q4Awarded,
      pendingCount: submit.scoreSummary.pendingManualGradingCount,
    };

    const attemptDb = await docAttempt(started.attempt.id);
    assert.ok(attemptDb);
    const autoScore = docSo(attemptDb?.auto_graded_score ?? null);
    const maxAutoScore = docSo(attemptDb?.max_auto_graded_score ?? null);
    const pendingManual = attemptDb?.pending_manual_grading_count ?? null;
    assert.equal(attemptDb?.status, "submitted");
    assert.ok(Boolean(attemptDb?.submitted_at));
    assert.equal(autoScore, 5);
    assert.equal(maxAutoScore, 6);
    assert.equal(pendingManual, 1);
    summary.cases.scorePersistenceDb = {
      pass:
        attemptDb?.status === "submitted" &&
        Boolean(attemptDb?.submitted_at) &&
        autoScore === 5 &&
        maxAutoScore === 6 &&
        pendingManual === 1,
      autoScore,
      maxAutoScore,
      pendingManualCount: pendingManual,
      submittedAtExists: Boolean(attemptDb?.submitted_at),
    };

    const answerRows = await docAttemptAnswers(started.attempt.id);
    assert.equal(answerRows.length, 4);
    const answerRowByQuestionId = new Map(answerRows.map((row) => [row.question_id, row]));
    assert.equal(docSo(answerRowByQuestionId.get(q1.question.id)?.awarded_points ?? null), 2);
    assert.equal(docSo(answerRowByQuestionId.get(q2.question.id)?.awarded_points ?? null), 0);
    assert.equal(docSo(answerRowByQuestionId.get(q3.question.id)?.awarded_points ?? null), 3);
    assert.equal(docSo(answerRowByQuestionId.get(q4.question.id)?.awarded_points ?? null), 0);
    assert.ok(Boolean(answerRowByQuestionId.get(q1.question.id)?.scored_at));

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
