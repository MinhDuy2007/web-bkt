import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
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

function napEnvTuFile(filePath: string): void {
  if (!existsSync(filePath)) {
    throw new Error(`Khong tim thay file env: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/u);
  for (const line of lines) {
    if (!line || /^\s*#/u.test(line)) {
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

async function docBodyJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Body khong phai object hop le.");
  }

  return parsed as Record<string, unknown>;
}

async function taoMockOpenAiServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  let requestCount = 0;

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST" || request.url !== "/v1/responses") {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    requestCount += 1;
    let body: Record<string, unknown> = {};
    try {
      body = await docBodyJson(request);
    } catch {
      response.statusCode = 400;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ error: { message: "invalid json" } }));
      return;
    }

    const model = typeof body.model === "string" ? body.model : "gpt-4o-mini";

    if (requestCount === 1) {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          id: "resp_task14_success_001",
          model,
          output_text: JSON.stringify({
            suggestedPoints: 3.75,
            suggestedFeedback:
              "AI de xuat bai lam co y chinh ro, can mo rong them dan chung neu giao vien thay can.",
            confidenceScore: 0.84,
          }),
          usage: {
            input_tokens: 118,
            output_tokens: 47,
            total_tokens: 165,
          },
        }),
      );
      return;
    }

    if (requestCount === 2) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 800));
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          id: "resp_task14_timeout_002",
          model,
          output_text: JSON.stringify({
            suggestedPoints: 2.5,
            suggestedFeedback: "Late response",
            confidenceScore: 0.5,
          }),
        }),
      );
      return;
    }

    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        error: {
          message: "mock provider internal error",
          type: "server_error",
        },
      }),
    );
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Khong xac dinh duoc port cho mock OpenAI server.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: async () => {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }
          resolveClose();
        });
      });
    },
  };
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

async function main(): Promise<void> {
  napEnvTuFile(resolve(process.cwd(), ".env.local"));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Thieu DATABASE_URL trong moi truong runtime.");
  }

  if ((process.env.AUTH_ADAPTER_MODE ?? "").trim().toLowerCase() === "mock") {
    throw new Error("Task14 runtime proof yeu cau adapter that, khong chap nhan AUTH_ADAPTER_MODE=mock.");
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
  });

  const prefix = `task14-${Date.now()}`;
  const mockServer = await taoMockOpenAiServer();

  process.env.AI_GRADING_PROVIDER_MODE = "openai";
  process.env.OPENAI_API_KEY = "task14-local-openai-key";
  process.env.OPENAI_API_BASE_URL = mockServer.baseUrl;
  process.env.AI_GRADING_MODEL_NAME = "gpt-4o-mini";
  process.env.AI_GRADING_TIMEOUT_MS = "150";
  process.env.AI_GRADING_PROMPT_VERSION = "essay-openai-v1";

  const { datLaiBienMoiTruongServerChoTest }: typeof import("@/server/config/env") = await import(
    "@/server/config/env"
  );
  datLaiBienMoiTruongServerChoTest();

  const { datAiEssayGradingProviderChoTest }: typeof import("@/server/exams/ai-grading-provider") =
    await import("@/server/exams/ai-grading-provider");
  datAiEssayGradingProviderChoTest(null);

  const { layAuthRepository }: typeof import("@/server/auth/repository") = await import(
    "@/server/auth/repository"
  );
  const authService: typeof import("@/server/auth/service") = await import("@/server/auth/service");
  const classService: typeof import("@/server/classes/service") = await import("@/server/classes/service");
  const examService: typeof import("@/server/exams/service") = await import("@/server/exams/service");

  const authRepository = layAuthRepository();
  const password = "Task14!SafePass123";

  async function taoTaiKhoan(input: TaoTaiKhoanInput): Promise<TaiKhoanTest> {
    const created = await authService.dangKyTaiKhoan(
      authService.chuanHoaDangKyPayload({
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
    const session = await authService.dangNhapTaiKhoan({
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

    const lop = await classService.taoLopHocBoiGiaoVien(teacherToken, {
      educationLevel: "THPT",
      subjectName: `Ngu van ${prefix}`,
      schoolName: "THPT Dev Test",
      gradeLabel: "Khoi 12A7",
      fullClassName: `${prefix}-lop-openai`,
    });

    await classService.thamGiaLopHocBangMa(studentToken, {
      classCode: lop.classRecord.classCode,
      joinCode: lop.classRecord.joinCode,
    });

    const exam = await examService.taoBaiKiemTraTheoLop(teacherToken, {
      classCode: lop.classRecord.classCode,
      title: `AI provider runtime ${prefix}`,
      description: "Proof OpenAI adapter, timeout, failure va usage log.",
      status: "published",
    });

    await examService.taoCauHoiChoExam(teacherToken, {
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
    await examService.taoCauHoiChoExam(teacherToken, {
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

    const questionItems = await examService.lietKeCauHoiTheoExam(teacherToken, exam.examCode);
    const shortQuestion = questionItems.find((item) => item.question.questionType === "short_answer");
    const essayQuestion = questionItems.find((item) => item.question.questionType === "essay_placeholder");
    assert.ok(shortQuestion);
    assert.ok(essayQuestion);

    const started = await examService.vaoBaiKiemTraTheoMa(studentToken, {
      examCode: exam.examCode,
    });
    await examService.luuCauTraLoiTheoAttempt(studentToken, {
      attemptId: started.attempt.id,
      questionId: shortQuestion.question.id,
      answerText: "Ha Noi",
      answerJson: {},
    });
    await examService.luuCauTraLoiTheoAttempt(studentToken, {
      attemptId: started.attempt.id,
      questionId: essayQuestion.question.id,
      answerText:
        "Bai lam trinh bay y thuc ky luat, ton trong noi quy, chu dong hop tac va co trach nhiem voi tap the trong moi truong hoc duong.",
      answerJson: {},
    });
    await examService.nopBaiKiemTra(studentToken, {
      attemptId: started.attempt.id,
    });

    const answers = await examService.lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id);
    const essayAnswer = answers.find((item) => item.question.id === essayQuestion.question.id);
    assert.ok(essayAnswer);

    const firstSuggestion = await examService.taoGoiYChamAIChoEssay(teacherToken, {
      examCode: exam.examCode,
      answerId: essayAnswer.answer.id,
    });
    assert.equal(firstSuggestion.suggestion.providerKind, "openai");
    assert.equal(firstSuggestion.suggestion.modelName, "gpt-4o-mini");

    const resultBeforeAccept = await examService.taiKetQuaBaiLamTheoExamCode(studentToken, {
      examCode: exam.examCode,
    });
    assert.equal(resultBeforeAccept.summary.finalScore, null);
    assert.equal(resultBeforeAccept.summary.pendingManualGradingCount, 1);

    await assert.rejects(
      () =>
        examService.taoGoiYChamAIChoEssay(teacherToken, {
          examCode: exam.examCode,
          answerId: essayAnswer.answer.id,
        }),
      (error) => error instanceof Error && "code" in error && (error as { code: string }).code === "AI_PROVIDER_TIMEOUT",
    );

    await assert.rejects(
      () =>
        examService.taoGoiYChamAIChoEssay(teacherToken, {
          examCode: exam.examCode,
          answerId: essayAnswer.answer.id,
        }),
      (error) => error instanceof Error && "code" in error && (error as { code: string }).code === "AI_PROVIDER_HTTP_ERROR",
    );

    const accepted = await examService.chapNhanGoiYChamAI(teacherToken, firstSuggestion.suggestion.id);
    assert.equal(accepted.attempt.finalScore, 5.75);
    assert.equal(accepted.attempt.pendingManualGradingCount, 0);

    const usageLogs = await pool.query<{
      request_status: string;
      provider_kind: string;
      model_name: string;
      error_code: string | null;
      latency_ms: number | null;
      suggestion_id: string | null;
    }>(
      `select request_status, provider_kind, model_name, error_code, latency_ms, suggestion_id
       from public.ai_grading_usage_logs
       where answer_id = $1
       order by created_at asc`,
      [essayAnswer.answer.id],
    );
    assert.equal(usageLogs.rows.length, 3);
    assert.deepEqual(
      usageLogs.rows.map((row) => row.request_status),
      ["succeeded", "timeout", "failed"],
    );
    assert.equal(usageLogs.rows[0]?.provider_kind, "openai");
    assert.equal(usageLogs.rows[0]?.model_name, "gpt-4o-mini");
    assert.equal(usageLogs.rows[0]?.suggestion_id, firstSuggestion.suggestion.id);
    assert.equal(usageLogs.rows[1]?.error_code, "AI_PROVIDER_TIMEOUT");
    assert.equal(usageLogs.rows[2]?.error_code, "AI_PROVIDER_HTTP_ERROR");
    assert.ok((usageLogs.rows[0]?.latency_ms ?? 0) >= 0);

    const suggestions = await pool.query<{
      id: string;
      status: string;
      provider_kind: string;
      model_name: string;
      prompt_version: string | null;
    }>(
      `select id, status, provider_kind, model_name, prompt_version
       from public.ai_grading_suggestions
       where answer_id = $1
       order by created_at asc`,
      [essayAnswer.answer.id],
    );
    assert.equal(suggestions.rows.length, 1);
    assert.equal(suggestions.rows[0]?.status, "accepted");
    assert.equal(suggestions.rows[0]?.provider_kind, "openai");
    assert.equal(suggestions.rows[0]?.model_name, "gpt-4o-mini");
    assert.equal(suggestions.rows[0]?.prompt_version, "essay-openai-v1");

    const attemptRow = await pool.query<{
      final_score: string | number | null;
      pending_manual_grading_count: number;
    }>(
      `select final_score, pending_manual_grading_count
       from public.class_exam_attempts
       where id = $1
       limit 1`,
      [started.attempt.id],
    );
    assert.equal(Number(attemptRow.rows[0]?.final_score ?? NaN), 5.75);
    assert.equal(attemptRow.rows[0]?.pending_manual_grading_count, 0);

    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          verify: {
            examCode: exam.examCode,
            providerMode: process.env.AI_GRADING_PROVIDER_MODE,
            providerBaseUrl: mockServer.baseUrl,
            successSuggestionId: firstSuggestion.suggestion.id,
            usageLogCount: usageLogs.rows.length,
            finalScore: 5.75,
            pendingManualGradingCount: 0,
          },
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    try {
      const cleanup = await cleanupTheoPrefix(pool, prefix);
      process.stdout.write(
        `${JSON.stringify(
          {
            ok: true,
            cleanup: {
              prefix,
              deletedClasses: cleanup.deletedClasses,
              deletedUsers: cleanup.deletedUsers,
            },
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      await mockServer.close();
      await pool.end();
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
