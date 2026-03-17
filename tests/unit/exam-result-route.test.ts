import assert from "node:assert/strict";
import test from "node:test";
import { GET as examResultGet } from "@/app/api/exams/result/route";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { chuanHoaDangKyPayload, dangKyTaiKhoan, dangNhapTaiKhoan } from "@/server/auth/service";
import { datLaiKhoLopHocGiaLap } from "@/server/classes/repository/mock-classroom-repository";
import { taoLopHocBoiGiaoVien, thamGiaLopHocBangMa, type TaoLopHocPayload } from "@/server/classes/service";
import { datLaiKhoBaiKiemTraGiaLap } from "@/server/exams/repository/mock-exam-repository";
import {
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
  schoolName: "THPT Ket Qua",
  gradeLabel: "Khoi 10A1",
  fullClassName: "Lop review ket qua",
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

async function taoRequestKetQua(cookieHeader: string, examCode: string) {
  return examResultGet(
    new Request(`http://localhost:3000/api/exams/result?examCode=${examCode}`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
    }),
  );
}

test("route ket qua tra summary va review items cho submitted attempt", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest("result-teacher@test.local", "SafePass123!", "result-teacher");
  await nangTrangThaiGiaoVien(teacher);
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De review submitted",
    description: "De co ket qua",
    status: "published",
  });
  const q1 = await taoCauHoiChoExam(teacherToken, {
    examCode: exam.examCode,
    questionOrder: 1,
    questionType: "multiple_choice_single",
    promptText: "2 + 2 = ?",
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
    questionType: "essay_placeholder",
    promptText: "Viet mot doan ngan.",
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

  const student = await taoTaiKhoanTest("result-student@test.local", "SafePass123!", "result-student");
  const studentToken = await dangNhapLayToken(student);
  await thamGiaLopHocBangMa(studentToken, {
    classCode: lop.classRecord.classCode,
    joinCode: lop.classRecord.joinCode,
  });
  const started = await vaoBaiKiemTraTheoMa(studentToken, {
    examCode: exam.examCode,
  });
  await luuCauTraLoiTheoAttempt(studentToken, {
    attemptId: started.attempt.id,
    questionId: q1.question.id,
    answerText: "4",
    answerJson: {},
  });
  await nopBaiKiemTra(studentToken, {
    attemptId: started.attempt.id,
  });

  const response = await taoRequestKetQua(await dangNhapLayCookie(student), exam.examCode);
  const body = (await response.json()) as {
    ok: boolean;
    data: {
      summary: {
        submitted: boolean;
        answeredQuestionCount: number;
        totalQuestionCount: number;
        pendingManualGradingCount: number;
      };
      reviewItems: Array<{
        question: { id: string };
        answer: { answerText: string | null } | null;
      }>;
      attempt: { status: string };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.attempt.status, "submitted");
  assert.equal(body.data.summary.submitted, true);
  assert.equal(body.data.summary.answeredQuestionCount, 1);
  assert.equal(body.data.summary.totalQuestionCount, 2);
  assert.equal(body.data.summary.pendingManualGradingCount, 0);
  assert.equal(body.data.reviewItems.length, 2);
  assert.equal(body.data.reviewItems[0]?.question.id, q1.question.id);
  assert.equal(body.data.reviewItems[0]?.answer?.answerText, "4");
  assert.equal(body.data.reviewItems[1]?.answer, null);
});

test("route ket qua khong gia vo la ket qua hoan chinh neu attempt chua submit", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest("result-progress-teacher@test.local", "SafePass123!", "result-progress-teacher");
  await nangTrangThaiGiaoVien(teacher);
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De review dang lam",
    description: null,
    status: "published",
  });
  const q1 = await taoCauHoiChoExam(teacherToken, {
    examCode: exam.examCode,
    questionOrder: 1,
    questionType: "short_answer",
    promptText: "Thu do Viet Nam?",
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

  const student = await taoTaiKhoanTest("result-progress-student@test.local", "SafePass123!", "result-progress-student");
  const studentToken = await dangNhapLayToken(student);
  await thamGiaLopHocBangMa(studentToken, {
    classCode: lop.classRecord.classCode,
    joinCode: lop.classRecord.joinCode,
  });
  const started = await vaoBaiKiemTraTheoMa(studentToken, {
    examCode: exam.examCode,
  });
  await luuCauTraLoiTheoAttempt(studentToken, {
    attemptId: started.attempt.id,
    questionId: q1.question.id,
    answerText: "Ha Noi",
    answerJson: {},
  });

  const response = await taoRequestKetQua(await dangNhapLayCookie(student), exam.examCode);
  const body = (await response.json()) as {
    ok: boolean;
    data: {
      summary: {
        submitted: boolean;
        autoGradedScore: number | null;
        submittedAt: string | null;
      };
      attempt: { status: string };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.attempt.status, "started");
  assert.equal(body.data.summary.submitted, false);
  assert.equal(body.data.summary.autoGradedScore, null);
  assert.equal(body.data.summary.submittedAt, null);
});

test("user ngoai attempt bi chan khi lay ket qua", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest("result-outsider-teacher@test.local", "SafePass123!", "result-outsider-teacher");
  await nangTrangThaiGiaoVien(teacher);
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De ket qua outsider",
    description: null,
    status: "published",
  });

  const member = await taoTaiKhoanTest("result-member@test.local", "SafePass123!", "result-member");
  const memberToken = await dangNhapLayToken(member);
  await thamGiaLopHocBangMa(memberToken, {
    classCode: lop.classRecord.classCode,
    joinCode: lop.classRecord.joinCode,
  });
  await vaoBaiKiemTraTheoMa(memberToken, {
    examCode: exam.examCode,
  });

  const outsider = await taoTaiKhoanTest("result-outsider@test.local", "SafePass123!", "result-outsider");
  const response = await taoRequestKetQua(await dangNhapLayCookie(outsider), exam.examCode);
  const body = (await response.json()) as {
    ok: boolean;
    error: { code: string };
  };

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "CLASS_MEMBERSHIP_REQUIRED");
});
