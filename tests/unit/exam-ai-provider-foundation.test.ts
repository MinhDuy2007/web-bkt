import assert from "node:assert/strict";
import test from "node:test";
import { AuthError } from "@/server/auth/errors";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { chuanHoaDangKyPayload, dangKyTaiKhoan, dangNhapTaiKhoan } from "@/server/auth/service";
import {
  AiGradingProviderCallError,
  datAiEssayGradingProviderChoTest,
  type AiEssayGradingProvider,
} from "@/server/exams/ai-grading-provider";
import { datLaiKhoLopHocGiaLap } from "@/server/classes/repository/mock-classroom-repository";
import {
  taoLopHocBoiGiaoVien,
  thamGiaLopHocBangMa,
  type TaoLopHocPayload,
} from "@/server/classes/service";
import {
  datLaiKhoBaiKiemTraGiaLap,
  docAiGradingUsageLogsGiaLap,
} from "@/server/exams/repository/mock-exam-repository";
import {
  chapNhanGoiYChamAI,
  lietKeCauTraLoiTheoAttempt,
  lietKeCauHoiTheoExam,
  lietKeGoiYChamAIChoTeacher,
  luuCauTraLoiTheoAttempt,
  nopBaiKiemTra,
  taiKetQuaBaiLamTheoExamCode,
  taoBaiKiemTraTheoLop,
  taoCauHoiChoExam,
  taoGoiYChamAIChoEssay,
  vaoBaiKiemTraTheoMa,
} from "@/server/exams/service";

process.env.AUTH_ADAPTER_MODE = "mock";
process.env.AI_GRADING_PROVIDER_MODE = "mock";

type TaiKhoanTest = {
  id: string;
  email: string;
  password: string;
};

const payloadTaoLopMau: TaoLopHocPayload = {
  educationLevel: "THPT",
  subjectName: "Ngu van",
  schoolName: "THPT AI Provider",
  gradeLabel: "Khoi 12A6",
  fullClassName: "Lop AI provider foundation",
};

async function taoTaiKhoanTest(
  email: string,
  password: string,
  displayName: string,
): Promise<TaiKhoanTest> {
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

async function dangNhapLayToken(taiKhoan: TaiKhoanTest): Promise<string> {
  const session = await dangNhapTaiKhoan({
    email: taiKhoan.email,
    password: taiKhoan.password,
  });

  return session.token;
}

async function nangTrangThaiGiaoVien(taiKhoan: TaiKhoanTest): Promise<void> {
  const repository = layAuthRepository();
  await repository.updateUser(taiKhoan.id, {
    roles: ["user", "teacher"],
    teacherVerificationStatus: "approved",
  });
}

async function taoFixtureAiProvider() {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest(
    "ai-provider-teacher@test.local",
    "SafePass123!",
    "ai-provider-teacher",
  );
  await nangTrangThaiGiaoVien(teacher);
  const teacherToken = await dangNhapLayToken(teacher);

  const student = await taoTaiKhoanTest(
    "ai-provider-student@test.local",
    "SafePass123!",
    "ai-provider-student",
  );
  const studentToken = await dangNhapLayToken(student);

  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De AI provider foundation",
    description: "Proof provider success/fail va usage log.",
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
    promptText: "Viet doan ngan ve trach nhiem cong dan trong hoc duong.",
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

  await thamGiaLopHocBangMa(studentToken, {
    classCode: lop.classRecord.classCode,
    joinCode: lop.classRecord.joinCode,
  });

  const started = await vaoBaiKiemTraTheoMa(studentToken, {
    examCode: exam.examCode,
  });
  const ownerQuestions = await lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id).catch(
    () => [],
  );
  assert.equal(ownerQuestions.length, 0);

  const questions = await lietKeCauHoiTheoExam(teacherToken, exam.examCode);
  const shortQuestion = questions.find((item) => item.question.questionType === "short_answer");
  const essayQuestion = questions.find((item) => item.question.questionType === "essay_placeholder");
  assert.ok(shortQuestion);
  assert.ok(essayQuestion);

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
      "Bai lam trinh bay y thuc ky luat, ton trong noi quy, hop tac voi tap the va chu dong nhan trach nhiem trong moi truong hoc duong.",
    answerJson: {},
  });
  await nopBaiKiemTra(studentToken, {
    attemptId: started.attempt.id,
  });

  const answers = await lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id);
  const essayAnswer = answers.find((item) => item.question.id === essayQuestion.question.id);
  assert.ok(essayAnswer);

  return {
    teacherToken,
    studentToken,
    examCode: exam.examCode,
    essayAnswerId: essayAnswer.answer.id,
  };
}

function taoProviderThanhCong(): AiEssayGradingProvider {
  return {
    async generateEssaySuggestion() {
      return {
        suggestedPoints: 3.25,
        suggestedFeedback: "AI goi y diem kha tot, nhung van can teacher duyet cuoi.",
        confidenceScore: 0.81,
        providerKind: "openai",
        modelName: "gpt-4o-mini",
        promptVersion: "essay-openai-v1",
        latencyMs: 123,
        responseId: "resp_success_001",
        responseJson: {
          responseId: "resp_success_001",
          outputText:
            '{"suggestedPoints":3.25,"suggestedFeedback":"AI goi y diem kha tot, nhung van can teacher duyet cuoi.","confidenceScore":0.81}',
        },
        usageJson: {
          input_tokens: 111,
          output_tokens: 44,
          total_tokens: 155,
        },
      };
    },
  };
}

test.afterEach(() => {
  datAiEssayGradingProviderChoTest(null);
});

test("provider success ghi usage log va final score chi doi sau khi teacher accept", async () => {
  const setup = await taoFixtureAiProvider();
  datAiEssayGradingProviderChoTest(taoProviderThanhCong());

  const created = await taoGoiYChamAIChoEssay(setup.teacherToken, {
    examCode: setup.examCode,
    answerId: setup.essayAnswerId,
  });

  const logsSauKhiTao = docAiGradingUsageLogsGiaLap();
  assert.equal(logsSauKhiTao.length, 1);
  assert.equal(logsSauKhiTao[0]?.requestStatus, "succeeded");
  assert.equal(logsSauKhiTao[0]?.providerKind, "openai");
  assert.equal(logsSauKhiTao[0]?.suggestionId, created.suggestion.id);
  assert.equal(logsSauKhiTao[0]?.latencyMs, 123);

  const truocKhiAccept = await taiKetQuaBaiLamTheoExamCode(setup.studentToken, {
    examCode: setup.examCode,
  });
  assert.equal(truocKhiAccept.summary.finalScore, null);
  assert.equal(truocKhiAccept.summary.pendingManualGradingCount, 1);

  const accepted = await chapNhanGoiYChamAI(setup.teacherToken, created.suggestion.id);
  assert.equal(accepted.attempt.finalScore, 5.25);
  assert.equal(accepted.attempt.pendingManualGradingCount, 0);
});

test("provider timeout ghi usage log that bai va khong tao suggestion moi", async () => {
  const setup = await taoFixtureAiProvider();
  datAiEssayGradingProviderChoTest({
    async generateEssaySuggestion() {
      throw new AiGradingProviderCallError({
        code: "AI_PROVIDER_TIMEOUT",
        message: "Provider AI vuot timeout.",
        statusCode: 504,
        providerKind: "openai",
        modelName: "gpt-4o-mini",
        promptVersion: "essay-openai-v1",
        requestStatus: "timeout",
        latencyMs: 1500,
        metadataJson: {
          httpStatus: 504,
        },
      });
    },
  });

  await assert.rejects(
    () =>
      taoGoiYChamAIChoEssay(setup.teacherToken, {
        examCode: setup.examCode,
        answerId: setup.essayAnswerId,
      }),
    (error) => error instanceof AuthError && error.code === "AI_PROVIDER_TIMEOUT",
  );

  const logsSauTimeout = docAiGradingUsageLogsGiaLap();
  assert.equal(logsSauTimeout.length, 1);
  assert.equal(logsSauTimeout[0]?.requestStatus, "timeout");
  assert.equal(logsSauTimeout[0]?.errorCode, "AI_PROVIDER_TIMEOUT");
  assert.equal(logsSauTimeout[0]?.suggestionId, null);

  const suggestions = await lietKeGoiYChamAIChoTeacher(setup.teacherToken, setup.examCode);
  assert.equal(suggestions.length, 0);
});
