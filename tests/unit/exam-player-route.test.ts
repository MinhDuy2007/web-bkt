import assert from "node:assert/strict";
import test from "node:test";
import { GET as examPlayerGet } from "@/app/api/exams/player/route";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { chuanHoaDangKyPayload, dangKyTaiKhoan, dangNhapTaiKhoan } from "@/server/auth/service";
import { datLaiKhoLopHocGiaLap } from "@/server/classes/repository/mock-classroom-repository";
import { taoLopHocBoiGiaoVien, thamGiaLopHocBangMa, type TaoLopHocPayload } from "@/server/classes/service";
import { datLaiKhoBaiKiemTraGiaLap } from "@/server/exams/repository/mock-exam-repository";
import { taoBaiKiemTraTheoLop, taoCauHoiChoExam, vaoBaiKiemTraTheoMa } from "@/server/exams/service";

process.env.AUTH_ADAPTER_MODE = "mock";

type TaiKhoanTest = {
  id: string;
  email: string;
  password: string;
};

const payloadTaoLopMau: TaoLopHocPayload = {
  educationLevel: "THPT",
  subjectName: "Toan",
  schoolName: "THPT Runtime",
  gradeLabel: "Khoi 11A",
  fullClassName: "Lop on thi Toan 11A",
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

async function nangTrangThaiGiaoVien(taiKhoan: TaiKhoanTest): Promise<void> {
  const repository = layAuthRepository();
  await repository.updateUser(taiKhoan.id, {
    roles: ["user", "teacher"],
    teacherVerificationStatus: "approved",
  });
}

async function taoRequestPlayer(cookieHeader: string, examCode: string) {
  return examPlayerGet(
    new Request(`http://localhost:3000/api/exams/player?examCode=${examCode}`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
    }),
  );
}

test("member chua start chi nhin thay exam summary va co the bat dau", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest("player-teacher@test.local", "SafePass123!", "player-teacher");
  await nangTrangThaiGiaoVien(teacher);
  const teacherSession = await dangNhapTaiKhoan({
    email: teacher.email,
    password: teacher.password,
  });
  const lop = await taoLopHocBoiGiaoVien(teacherSession.token, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherSession.token, {
    classCode: lop.classRecord.classCode,
    title: "De player route",
    description: "Mo ta player route",
    status: "published",
  });

  const student = await taoTaiKhoanTest("player-student@test.local", "SafePass123!", "player-student");
  const studentSession = await dangNhapTaiKhoan({
    email: student.email,
    password: student.password,
  });
  await thamGiaLopHocBangMa(studentSession.token, {
    classCode: lop.classRecord.classCode,
    joinCode: lop.classRecord.joinCode,
  });

  const response = await taoRequestPlayer(await dangNhapLayCookie(student), exam.examCode);
  const body = (await response.json()) as {
    ok: boolean;
    data: {
      exam: { examCode: string; title: string };
      attempt: null;
      questions: unknown[];
      answers: unknown[];
      canStart: boolean;
      isLocked: boolean;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.exam.examCode, exam.examCode);
  assert.equal(body.data.attempt, null);
  assert.equal(body.data.questions.length, 0);
  assert.equal(body.data.answers.length, 0);
  assert.equal(body.data.canStart, true);
  assert.equal(body.data.isLocked, false);
});

test("attempt da ton tai thi route tra question va answer cho owner", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest("player-owner-teacher@test.local", "SafePass123!", "player-owner-teacher");
  await nangTrangThaiGiaoVien(teacher);
  const teacherSession = await dangNhapTaiKhoan({
    email: teacher.email,
    password: teacher.password,
  });
  const lop = await taoLopHocBoiGiaoVien(teacherSession.token, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherSession.token, {
    classCode: lop.classRecord.classCode,
    title: "De player owner",
    description: null,
    status: "published",
  });
  await taoCauHoiChoExam(teacherSession.token, {
    examCode: exam.examCode,
    questionOrder: 1,
    questionType: "short_answer",
    promptText: "Thu do cua Viet Nam?",
    points: 1,
    metadataJson: {},
    answerKey: {
      keyType: "short_answer",
      correctAnswerText: "Ha Noi",
      correctAnswerJson: {},
      explanationText: null,
    },
  });

  const student = await taoTaiKhoanTest("player-owner-student@test.local", "SafePass123!", "player-owner-student");
  const studentSession = await dangNhapTaiKhoan({
    email: student.email,
    password: student.password,
  });
  await thamGiaLopHocBangMa(studentSession.token, {
    classCode: lop.classRecord.classCode,
    joinCode: lop.classRecord.joinCode,
  });
  await vaoBaiKiemTraTheoMa(studentSession.token, {
    examCode: exam.examCode,
  });

  const response = await taoRequestPlayer(await dangNhapLayCookie(student), exam.examCode);
  const body = (await response.json()) as {
    ok: boolean;
    data: {
      attempt: { status: string };
      questions: Array<{ questionType: string }>;
      answers: unknown[];
      canStart: boolean;
      isLocked: boolean;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.attempt.status, "started");
  assert.equal(body.data.questions.length, 1);
  assert.equal(body.data.questions[0]?.questionType, "short_answer");
  assert.equal(body.data.answers.length, 0);
  assert.equal(body.data.canStart, false);
  assert.equal(body.data.isLocked, false);
});

test("outsider bi chan khi tai player data", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest("player-outsider-teacher@test.local", "SafePass123!", "player-outsider-teacher");
  await nangTrangThaiGiaoVien(teacher);
  const teacherSession = await dangNhapTaiKhoan({
    email: teacher.email,
    password: teacher.password,
  });
  const lop = await taoLopHocBoiGiaoVien(teacherSession.token, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherSession.token, {
    classCode: lop.classRecord.classCode,
    title: "De outsider",
    description: null,
    status: "published",
  });

  const outsider = await taoTaiKhoanTest("player-outsider@test.local", "SafePass123!", "player-outsider");
  const response = await taoRequestPlayer(await dangNhapLayCookie(outsider), exam.examCode);
  const body = (await response.json()) as {
    ok: boolean;
    error: { code: string };
  };

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "CLASS_MEMBERSHIP_REQUIRED");
});
