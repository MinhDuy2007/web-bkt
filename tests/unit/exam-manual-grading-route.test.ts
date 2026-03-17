import assert from "node:assert/strict";
import test from "node:test";
import { GET as getManualGradingQueue } from "@/app/api/exams/manual-grading/route";
import { PATCH as patchManualGrade } from "@/app/api/exams/manual-grading/[answerId]/route";
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

type TaiKhoanTest = {
  id: string;
  email: string;
  password: string;
};

const payloadTaoLopMau: TaoLopHocPayload = {
  educationLevel: "THPT",
  subjectName: "Ngu van",
  schoolName: "THPT Route Manual Grading",
  gradeLabel: "Khoi 12A2",
  fullClassName: "Lop route manual grading",
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

  const teacher = await taoTaiKhoanTest("manual-route-teacher@test.local", "SafePass123!", "manual-route-teacher");
  await nangTrangThaiGiaoVien(teacher);
  const teacherToken = await dangNhapLayToken(teacher);
  const teacherCookie = await dangNhapLayCookie(teacher);

  const student = await taoTaiKhoanTest("manual-route-student@test.local", "SafePass123!", "manual-route-student");
  const studentToken = await dangNhapLayToken(student);

  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De route manual grading",
    description: null,
    status: "published",
  });
  await taoCauHoiChoExam(teacherToken, {
    examCode: exam.examCode,
    questionOrder: 1,
    questionType: "essay_placeholder",
    promptText: "Viet doan cam nhan ngan.",
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
  assert.ok(essayQuestion, "Phai co cau essay de test route");

  await luuCauTraLoiTheoAttempt(studentToken, {
    attemptId: started.attempt.id,
    questionId: essayQuestion.question.id,
    answerText: "Bai lam route de giao vien cham tay.",
    answerJson: {},
  });
  await nopBaiKiemTra(studentToken, {
    attemptId: started.attempt.id,
  });

  const answers = await lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id);
  const essayAnswer = answers.find((item) => item.question.id === essayQuestion.question.id);
  assert.ok(essayAnswer, "Phai co essay answer de test route");

  return {
    teacher,
    teacherCookie,
    student,
    exam,
    essayAnswer: essayAnswer!,
  };
}

test("route GET manual grading tra queue cho teacher owner", async () => {
  const setup = await taoFixtureRoute();
  const response = await getManualGradingQueue(
    new Request(`http://localhost:3000/api/exams/manual-grading?examCode=${setup.exam.examCode}`, {
      method: "GET",
      headers: {
        cookie: setup.teacherCookie,
      },
    }),
  );
  const body = (await response.json()) as {
    ok: boolean;
    data: Array<{
      answer: { id: string };
      student: { userId: string };
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0]?.answer.id, setup.essayAnswer.answer.id);
  assert.equal(body.data[0]?.student.userId, setup.student.id);
});

test("route PATCH manual grading cap nhat diem tay va pending count", async () => {
  const setup = await taoFixtureRoute();
  const response = await patchManualGrade(
    new Request(`http://localhost:3000/api/exams/manual-grading/${setup.essayAnswer.answer.id}`, {
      method: "PATCH",
      headers: {
        cookie: setup.teacherCookie,
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        manualAwardedPoints: 3,
        gradingNote: "Can them dan chung cu the hon.",
      }),
    }),
    {
      params: Promise.resolve({
        answerId: setup.essayAnswer.answer.id,
      }),
    },
  );
  const body = (await response.json()) as {
    ok: boolean;
    data: {
      answer: {
        manualAwardedPoints: number | null;
        gradingNote: string | null;
      };
      attempt: {
        pendingManualGradingCount: number;
        finalScore: number | null;
      };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.answer.manualAwardedPoints, 3);
  assert.equal(body.data.answer.gradingNote, "Can them dan chung cu the hon.");
  assert.equal(body.data.attempt.pendingManualGradingCount, 0);
  assert.equal(body.data.attempt.finalScore, 3);
});
