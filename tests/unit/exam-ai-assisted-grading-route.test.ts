import assert from "node:assert/strict";
import test from "node:test";
import { GET as getAiSuggestions, POST as postAiSuggestion } from "@/app/api/exams/ai-grading/suggestions/route";
import { PATCH as patchAiSuggestion } from "@/app/api/exams/ai-grading/suggestions/[suggestionId]/route";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { chuanHoaDangKyPayload, dangKyTaiKhoan, dangNhapTaiKhoan } from "@/server/auth/service";
import { datLaiKhoLopHocGiaLap } from "@/server/classes/repository/mock-classroom-repository";
import { taoLopHocBoiGiaoVien, thamGiaLopHocBangMa, type TaoLopHocPayload } from "@/server/classes/service";
import { datLaiKhoBaiKiemTraGiaLap } from "@/server/exams/repository/mock-exam-repository";
import {
  lietKeCauHoiTheoExam,
  lietKeCauTraLoiTheoAttempt,
  luuCauTraLoiTheoAttempt,
  nopBaiKiemTra,
  taoBaiKiemTraTheoLop,
  taoCauHoiChoExam,
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
  schoolName: "THPT Route AI Assist",
  gradeLabel: "Khoi 12A4",
  fullClassName: "Lop route AI assist",
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

async function dangNhapLayCookie(taiKhoan: TaiKhoanTest): Promise<string> {
  const session = await dangNhapTaiKhoan({
    email: taiKhoan.email,
    password: taiKhoan.password,
  });

  return `session_token=${encodeURIComponent(session.token)}`;
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

async function taoFixtureRoute() {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest("ai-route-teacher@test.local", "SafePass123!", "ai-route-teacher");
  await nangTrangThaiGiaoVien(teacher);
  const teacherToken = await dangNhapLayToken(teacher);
  const teacherCookie = await dangNhapLayCookie(teacher);

  const student = await taoTaiKhoanTest("ai-route-student@test.local", "SafePass123!", "ai-route-student");
  const studentToken = await dangNhapLayToken(student);

  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De route AI assist",
    description: null,
    status: "published",
  });
  await taoCauHoiChoExam(teacherToken, {
    examCode: exam.examCode,
    questionOrder: 1,
    questionType: "essay_placeholder",
    promptText: "Viet doan van ngan de route AI assist.",
    points: 4,
    metadataJson: {
      expectedMinWords: 30,
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
  const ownerQuestions = await lietKeCauHoiTheoExam(teacherToken, exam.examCode);
  const essayQuestion = ownerQuestions[0];
  assert.ok(essayQuestion, "Phai co cau essay de test route AI");

  await luuCauTraLoiTheoAttempt(studentToken, {
    attemptId: started.attempt.id,
    questionId: essayQuestion.question.id,
    answerText: "Bai lam route de AI mock tao goi y cham.",
    answerJson: {},
  });
  await nopBaiKiemTra(studentToken, {
    attemptId: started.attempt.id,
  });

  const answers = await lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id);
  const essayAnswer = answers.find((item) => item.question.id === essayQuestion.question.id);
  assert.ok(essayAnswer, "Phai co essay answer de test route AI");

  return {
    teacherCookie,
    exam,
    essayAnswer: essayAnswer!,
  };
}

test("route POST va GET AI suggestions hoat dong cho teacher owner", async () => {
  const setup = await taoFixtureRoute();

  const createdResponse = await postAiSuggestion(
    new Request("http://localhost:3000/api/exams/ai-grading/suggestions", {
      method: "POST",
      headers: {
        cookie: setup.teacherCookie,
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        examCode: setup.exam.examCode,
        answerId: setup.essayAnswer.answer.id,
      }),
    }),
  );
  const createdBody = (await createdResponse.json()) as {
    ok: boolean;
    data: {
      suggestion: {
        id: string;
        status: string;
      };
    };
  };

  assert.equal(createdResponse.status, 200);
  assert.equal(createdBody.ok, true);
  assert.equal(createdBody.data.suggestion.status, "pending");

  const listedResponse = await getAiSuggestions(
    new Request(
      `http://localhost:3000/api/exams/ai-grading/suggestions?examCode=${setup.exam.examCode}`,
      {
        method: "GET",
        headers: {
          cookie: setup.teacherCookie,
        },
      },
    ),
  );
  const listedBody = (await listedResponse.json()) as {
    ok: boolean;
    data: Array<{
      suggestion: {
        id: string;
      };
    }>;
  };

  assert.equal(listedResponse.status, 200);
  assert.equal(listedBody.ok, true);
  assert.equal(listedBody.data.length, 1);
  assert.equal(listedBody.data[0]?.suggestion.id, createdBody.data.suggestion.id);
});

test("route PATCH accept AI suggestion cap nhat attempt summary", async () => {
  const setup = await taoFixtureRoute();

  const createdResponse = await postAiSuggestion(
    new Request("http://localhost:3000/api/exams/ai-grading/suggestions", {
      method: "POST",
      headers: {
        cookie: setup.teacherCookie,
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        examCode: setup.exam.examCode,
        answerId: setup.essayAnswer.answer.id,
      }),
    }),
  );
  const createdBody = (await createdResponse.json()) as {
    ok: boolean;
    data: {
      suggestion: {
        id: string;
      };
    };
  };

  const acceptResponse = await patchAiSuggestion(
    new Request(
      `http://localhost:3000/api/exams/ai-grading/suggestions/${createdBody.data.suggestion.id}`,
      {
        method: "PATCH",
        headers: {
          cookie: setup.teacherCookie,
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "accept",
        }),
      },
    ),
    {
      params: Promise.resolve({
        suggestionId: createdBody.data.suggestion.id,
      }),
    },
  );
  const acceptBody = (await acceptResponse.json()) as {
    ok: boolean;
    data: {
      suggestion: {
        status: string;
      };
      attempt: {
        pendingManualGradingCount: number;
        finalScore: number | null;
      };
    };
  };

  assert.equal(acceptResponse.status, 200);
  assert.equal(acceptBody.ok, true);
  assert.equal(acceptBody.data.suggestion.status, "accepted");
  assert.equal(acceptBody.data.attempt.pendingManualGradingCount, 0);
  assert.equal(typeof acceptBody.data.attempt.finalScore, "number");
});
