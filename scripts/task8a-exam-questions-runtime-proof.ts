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

type ExamQuestionDbRow = {
  id: string;
  class_exam_id: string;
  question_order: number;
  question_type: string;
  prompt_text: string;
  points: string | number;
  metadata_json: Record<string, unknown> | null;
};

type ExamAnswerKeyDbRow = {
  id: string;
  question_id: string;
  key_type: string;
  correct_answer_text: string | null;
  correct_answer_json: Record<string, unknown> | null;
  explanation_text: string | null;
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
    ownerCreateQuestion: {
      pass: boolean;
      questionId: string | null;
      answerKeyId: string | null;
      questionOrder: number | null;
    };
    nonOwnerCreateBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    normalUserCreateBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    ownerUpdateQuestion: {
      pass: boolean;
      questionId: string | null;
      updatedOrder: number | null;
      updatedPrompt: string | null;
    };
    nonOwnerUpdateBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    ownerDeleteQuestion: {
      pass: boolean;
      questionId: string | null;
      deletedFromQuestionTable: boolean;
      deletedFromAnswerKeyTable: boolean;
    };
    nonOwnerDeleteBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    invalidAnswerKeyBlocked: {
      pass: boolean;
      errorCode: string | null;
    };
    questionOrderConflictBlocked: {
      pass: boolean;
      errorCode: string | null;
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

function chuyenPointsVeSo(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

async function main(): Promise<void> {
  napEnvTuFile(resolve(process.cwd(), ".env.local"));

  const adapterMode = (process.env.AUTH_ADAPTER_MODE ?? "unknown").trim().toLowerCase();
  if (adapterMode === "mock") {
    throw new Error("Task8A runtime proof yeu cau DB that, khong chap nhan AUTH_ADAPTER_MODE=mock.");
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
  const duongDanExamRepository = "@/server/exams/repository/" + "index.ts";

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
  }: typeof import("@/server/classes/service") = await import(duongDanClassService);
  const {
    taoBaiKiemTraTheoLop,
    taoCauHoiChoExam,
    capNhatCauHoiChoExam,
    xoaCauHoiChoExam,
    lietKeCauHoiTheoExam,
  }: typeof import("@/server/exams/service") = await import(duongDanExamService);
  const { layExamRepository }: typeof import("@/server/exams/repository") = await import(
    duongDanExamRepository
  );

  const authRepository = layAuthRepository();
  const examRepository = layExamRepository();

  const prefix = `task8a-${Date.now()}`;
  const password = "Task8A!SafePass123";
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

  async function docQuestion(questionId: string): Promise<ExamQuestionDbRow | null> {
    const result = await pool.query<ExamQuestionDbRow>(
      `select
         id,
         class_exam_id,
         question_order,
         question_type,
         prompt_text,
         points,
         metadata_json
       from public.exam_questions
       where id = $1
       limit 1`,
      [questionId],
    );

    return result.rows[0] ?? null;
  }

  async function docAnswerKeyTheoQuestionId(questionId: string): Promise<ExamAnswerKeyDbRow | null> {
    const result = await pool.query<ExamAnswerKeyDbRow>(
      `select
         id,
         question_id,
         key_type,
         correct_answer_text,
         correct_answer_json,
         explanation_text
       from public.exam_answer_keys
       where question_id = $1
       limit 1`,
      [questionId],
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
      ownerCreateQuestion: {
        pass: false,
        questionId: null,
        answerKeyId: null,
        questionOrder: null,
      },
      nonOwnerCreateBlocked: {
        pass: false,
        errorCode: null,
      },
      normalUserCreateBlocked: {
        pass: false,
        errorCode: null,
      },
      ownerUpdateQuestion: {
        pass: false,
        questionId: null,
        updatedOrder: null,
        updatedPrompt: null,
      },
      nonOwnerUpdateBlocked: {
        pass: false,
        errorCode: null,
      },
      ownerDeleteQuestion: {
        pass: false,
        questionId: null,
        deletedFromQuestionTable: false,
        deletedFromAnswerKeyTable: false,
      },
      nonOwnerDeleteBlocked: {
        pass: false,
        errorCode: null,
      },
      invalidAnswerKeyBlocked: {
        pass: false,
        errorCode: null,
      },
      questionOrderConflictBlocked: {
        pass: false,
        errorCode: null,
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
    const teacherNonOwner = await taoTaiKhoan({
      email: `${prefix}-teacher-non-owner@test.local`,
      password,
      displayName: `${prefix}-teacher-non-owner`,
    });
    const normalUser = await taoTaiKhoan({
      email: `${prefix}-user-thuong@test.local`,
      password,
      displayName: `${prefix}-user-thuong`,
    });

    await authRepository.updateUser(teacherOwner.id, {
      roles: ["user", "teacher"],
      teacherVerificationStatus: "approved",
    });
    await authRepository.updateUser(teacherNonOwner.id, {
      roles: ["user", "teacher"],
      teacherVerificationStatus: "approved",
    });

    const ownerToken = await dangNhapLayToken(teacherOwner);
    const nonOwnerToken = await dangNhapLayToken(teacherNonOwner);
    const normalUserToken = await dangNhapLayToken(normalUser);

    const lop = await taoLopHocBoiGiaoVien(ownerToken, {
      educationLevel: "THPT",
      subjectName: `Toan ${prefix}`,
      schoolName: "THPT Runtime Proof",
      gradeLabel: "Khoi 11A",
      fullClassName: `${prefix}-class-for-question-proof`,
    });
    const exam = await taoBaiKiemTraTheoLop(ownerToken, {
      classCode: lop.classRecord.classCode,
      title: `De thi ${prefix}`,
      description: "Proof exam question runtime",
      status: "published",
    });

    const createdQ1 = await taoCauHoiChoExam(ownerToken, {
      examCode: exam.examCode,
      questionOrder: 1,
      questionType: "multiple_choice_single",
      promptText: "1 + 1 bang bao nhieu?",
      points: 1,
      metadataJson: {
        options: ["1", "2", "3"],
      },
      answerKey: {
        keyType: "multiple_choice_single",
        correctAnswerText: "2",
        correctAnswerJson: {},
        explanationText: "Dap an la 2.",
      },
    });
    const q1Db = await docQuestion(createdQ1.question.id);
    const q1KeyDb = await docAnswerKeyTheoQuestionId(createdQ1.question.id);
    assert.ok(q1Db);
    assert.ok(q1KeyDb);
    assert.equal(q1Db?.question_order, 1);
    assert.equal(q1KeyDb?.key_type, "multiple_choice_single");
    assert.equal(q1KeyDb?.correct_answer_text, "2");
    summary.cases.ownerCreateQuestion = {
      pass: true,
      questionId: createdQ1.question.id,
      answerKeyId: q1KeyDb?.id ?? null,
      questionOrder: q1Db?.question_order ?? null,
    };

    let nonOwnerCreateError: string | null = null;
    try {
      await taoCauHoiChoExam(nonOwnerToken, {
        examCode: exam.examCode,
        questionOrder: 2,
        questionType: "true_false",
        promptText: "Trai dat la hanh tinh thu 3?",
        points: 1,
        metadataJson: {},
        answerKey: {
          keyType: "true_false",
          correctAnswerText: "true",
          correctAnswerJson: {},
          explanationText: null,
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        nonOwnerCreateError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(nonOwnerCreateError, "EXAM_CONTENT_PERMISSION_REQUIRED");
    summary.cases.nonOwnerCreateBlocked = {
      pass: nonOwnerCreateError === "EXAM_CONTENT_PERMISSION_REQUIRED",
      errorCode: nonOwnerCreateError,
    };

    let normalUserCreateError: string | null = null;
    try {
      await taoCauHoiChoExam(normalUserToken, {
        examCode: exam.examCode,
        questionOrder: 2,
        questionType: "true_false",
        promptText: "Cau hoi bi chan",
        points: 1,
        metadataJson: {},
        answerKey: {
          keyType: "true_false",
          correctAnswerText: "false",
          correctAnswerJson: {},
          explanationText: null,
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        normalUserCreateError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(normalUserCreateError, "CLASS_PERMISSION_REQUIRED");
    summary.cases.normalUserCreateBlocked = {
      pass: normalUserCreateError === "CLASS_PERMISSION_REQUIRED",
      errorCode: normalUserCreateError,
    };

    const createdQ2 = await taoCauHoiChoExam(ownerToken, {
      examCode: exam.examCode,
      questionOrder: 2,
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

    let conflictError: string | null = null;
    try {
      await taoCauHoiChoExam(ownerToken, {
        examCode: exam.examCode,
        questionOrder: 2,
        questionType: "essay_placeholder",
        promptText: "Cau hoi conflict",
        points: 1,
        metadataJson: {},
        answerKey: {
          keyType: "essay_placeholder",
          correctAnswerText: null,
          correctAnswerJson: {},
          explanationText: null,
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        conflictError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(conflictError, "EXAM_QUESTION_ORDER_CONFLICT");
    summary.cases.questionOrderConflictBlocked = {
      pass: conflictError === "EXAM_QUESTION_ORDER_CONFLICT",
      errorCode: conflictError,
    };

    let invalidAnswerKeyError: string | null = null;
    try {
      await examRepository.createExamQuestion({
        examCode: exam.examCode,
        actorUserId: teacherOwner.id,
        questionOrder: 3,
        questionType: "true_false",
        promptText: "DB guard key type",
        points: 1,
        metadataJson: {},
        answerKey: {
          keyType: "short_answer",
          correctAnswerText: "true",
          correctAnswerJson: {},
          explanationText: null,
        },
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof AuthError) {
        invalidAnswerKeyError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(invalidAnswerKeyError, "INVALID_ANSWER_KEY");
    summary.cases.invalidAnswerKeyBlocked = {
      pass: invalidAnswerKeyError === "INVALID_ANSWER_KEY",
      errorCode: invalidAnswerKeyError,
    };

    const updatedQ1 = await capNhatCauHoiChoExam(ownerToken, createdQ1.question.id, {
      questionOrder: 3,
      questionType: "multiple_choice_single",
      promptText: "1 + 2 bang bao nhieu?",
      points: 1.5,
      metadataJson: {
        options: ["2", "3", "4"],
      },
      answerKey: {
        keyType: "multiple_choice_single",
        correctAnswerText: "3",
        correctAnswerJson: {},
        explanationText: "Dap an la 3.",
      },
    });
    const updatedQ1Db = await docQuestion(createdQ1.question.id);
    const updatedQ1KeyDb = await docAnswerKeyTheoQuestionId(createdQ1.question.id);
    assert.ok(updatedQ1Db);
    assert.ok(updatedQ1KeyDb);
    assert.equal(updatedQ1Db?.question_order, 3);
    assert.equal(updatedQ1Db?.prompt_text, "1 + 2 bang bao nhieu?");
    assert.equal(chuyenPointsVeSo(updatedQ1Db?.points ?? 0), 1.5);
    assert.equal(updatedQ1KeyDb?.correct_answer_text, "3");
    summary.cases.ownerUpdateQuestion = {
      pass: true,
      questionId: updatedQ1.question.id,
      updatedOrder: updatedQ1Db?.question_order ?? null,
      updatedPrompt: updatedQ1Db?.prompt_text ?? null,
    };

    let nonOwnerUpdateError: string | null = null;
    try {
      await capNhatCauHoiChoExam(nonOwnerToken, createdQ1.question.id, {
        questionOrder: 3,
        questionType: "multiple_choice_single",
        promptText: "Cap nhat trai phep",
        points: 2,
        metadataJson: {
          options: ["1", "2"],
        },
        answerKey: {
          keyType: "multiple_choice_single",
          correctAnswerText: "1",
          correctAnswerJson: {},
          explanationText: null,
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        nonOwnerUpdateError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(nonOwnerUpdateError, "EXAM_CONTENT_PERMISSION_REQUIRED");
    summary.cases.nonOwnerUpdateBlocked = {
      pass: nonOwnerUpdateError === "EXAM_CONTENT_PERMISSION_REQUIRED",
      errorCode: nonOwnerUpdateError,
    };

    let nonOwnerDeleteError: string | null = null;
    try {
      await xoaCauHoiChoExam(nonOwnerToken, createdQ2.question.id);
    } catch (error) {
      if (error instanceof AuthError) {
        nonOwnerDeleteError = error.code;
      } else {
        throw error;
      }
    }
    assert.equal(nonOwnerDeleteError, "EXAM_CONTENT_PERMISSION_REQUIRED");
    summary.cases.nonOwnerDeleteBlocked = {
      pass: nonOwnerDeleteError === "EXAM_CONTENT_PERMISSION_REQUIRED",
      errorCode: nonOwnerDeleteError,
    };

    await xoaCauHoiChoExam(ownerToken, createdQ2.question.id);
    const deletedQ2Db = await docQuestion(createdQ2.question.id);
    const deletedQ2KeyDb = await docAnswerKeyTheoQuestionId(createdQ2.question.id);
    assert.equal(deletedQ2Db, null);
    assert.equal(deletedQ2KeyDb, null);
    summary.cases.ownerDeleteQuestion = {
      pass: true,
      questionId: createdQ2.question.id,
      deletedFromQuestionTable: deletedQ2Db === null,
      deletedFromAnswerKeyTable: deletedQ2KeyDb === null,
    };

    const listed = await lietKeCauHoiTheoExam(ownerToken, exam.examCode);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.question.id, createdQ1.question.id);

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
