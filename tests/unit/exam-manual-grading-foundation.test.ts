import assert from "node:assert/strict";
import test from "node:test";
import { AuthError } from "@/server/auth/errors";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { chuanHoaDangKyPayload, dangKyTaiKhoan, dangNhapTaiKhoan } from "@/server/auth/service";
import { datLaiKhoLopHocGiaLap } from "@/server/classes/repository/mock-classroom-repository";
import { taoLopHocBoiGiaoVien, thamGiaLopHocBangMa, type TaoLopHocPayload } from "@/server/classes/service";
import { datLaiKhoBaiKiemTraGiaLap } from "@/server/exams/repository/mock-exam-repository";
import {
  chamTayCauEssayChoAttempt,
  lietKeCacCauEssayCanChamTheoExam,
  lietKeCauTraLoiTheoAttempt,
  luuCauTraLoiTheoAttempt,
  nopBaiKiemTra,
  taiKetQuaBaiLamTheoExamCode,
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
  schoolName: "THPT Manual Grading",
  gradeLabel: "Khoi 12A1",
  fullClassName: "Lop cham tay essay",
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

function assertAuthError(error: unknown, code: string): boolean {
  return error instanceof AuthError && error.code === code;
}

async function taoDuLieuChamTay() {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const ownerTeacher = await taoTaiKhoanTest(
    "manual-owner-teacher@test.local",
    "SafePass123!",
    "manual-owner-teacher",
  );
  await nangTrangThaiGiaoVien(ownerTeacher);
  const ownerTeacherToken = await dangNhapLayToken(ownerTeacher);

  const nonOwnerTeacher = await taoTaiKhoanTest(
    "manual-non-owner-teacher@test.local",
    "SafePass123!",
    "manual-non-owner-teacher",
  );
  await nangTrangThaiGiaoVien(nonOwnerTeacher);
  const nonOwnerTeacherToken = await dangNhapLayToken(nonOwnerTeacher);

  const student = await taoTaiKhoanTest(
    "manual-student@test.local",
    "SafePass123!",
    "manual-student",
  );
  const studentToken = await dangNhapLayToken(student);

  const lop = await taoLopHocBoiGiaoVien(ownerTeacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(ownerTeacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De cham tay essay",
    description: "De kiem tra manual grading",
    status: "published",
  });

  const shortAnswer = await taoCauHoiChoExam(ownerTeacherToken, {
    examCode: exam.examCode,
    questionOrder: 1,
    questionType: "short_answer",
    promptText: "Thu do Viet Nam la gi?",
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
  const essay = await taoCauHoiChoExam(ownerTeacherToken, {
    examCode: exam.examCode,
    questionOrder: 2,
    questionType: "essay_placeholder",
    promptText: "Phan tich hinh anh nguoi linh trong doan van ngan.",
    points: 4,
    metadataJson: {
      expectedMinWords: 60,
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

  await luuCauTraLoiTheoAttempt(studentToken, {
    attemptId: started.attempt.id,
    questionId: shortAnswer.question.id,
    answerText: "Ha Noi",
    answerJson: {},
  });
  await luuCauTraLoiTheoAttempt(studentToken, {
    attemptId: started.attempt.id,
    questionId: essay.question.id,
    answerText: "Bai lam essay co noi dung de giao vien cham tay.",
    answerJson: {},
  });

  await nopBaiKiemTra(studentToken, {
    attemptId: started.attempt.id,
  });

  const answerItems = await lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id);
  const essayAnswer = answerItems.find((item) => item.question.id === essay.question.id);
  assert.ok(essayAnswer, "Phai co essay answer sau khi submit");

  return {
    ownerTeacher,
    ownerTeacherToken,
    nonOwnerTeacher,
    nonOwnerTeacherToken,
    student,
    studentToken,
    exam,
    shortAnswer,
    essay,
    attempt: started.attempt,
    essayAnswer: essayAnswer!,
  };
}

test("teacher owner liet ke queue cham tay va cap nhat final score dung", async () => {
  const setup = await taoDuLieuChamTay();

  const queue = await lietKeCacCauEssayCanChamTheoExam(setup.ownerTeacherToken, {
    examCode: setup.exam.examCode,
  });

  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.student.userId, setup.student.id);
  assert.equal(queue[0]?.answer.id, setup.essayAnswer.answer.id);

  const graded = await chamTayCauEssayChoAttempt(
    setup.ownerTeacherToken,
    setup.essayAnswer.answer.id,
    {
      manualAwardedPoints: 3.5,
      gradingNote: "Lap luan tot, can dan xep y gon hon.",
    },
  );

  assert.equal(graded.answer.manualAwardedPoints, 3.5);
  assert.equal(graded.answer.awardedPoints, 3.5);
  assert.equal(graded.answer.gradingNote, "Lap luan tot, can dan xep y gon hon.");
  assert.equal(graded.attempt.pendingManualGradingCount, 0);
  assert.equal(graded.attempt.finalScore, 5.5);

  const result = await taiKetQuaBaiLamTheoExamCode(setup.studentToken, {
    examCode: setup.exam.examCode,
  });
  assert.equal(result.summary.autoGradedScore, 2);
  assert.equal(result.summary.finalScore, 5.5);
  assert.equal(result.summary.pendingManualGradingCount, 0);
  assert.equal(
    result.reviewItems.find((item) => item.question.id === setup.essay.question.id)?.answer?.manualAwardedPoints,
    3.5,
  );
});

test("teacher non-owner bi chan khi doc queue va cham tay", async () => {
  const setup = await taoDuLieuChamTay();

  await assert.rejects(
    () =>
      lietKeCacCauEssayCanChamTheoExam(setup.nonOwnerTeacherToken, {
        examCode: setup.exam.examCode,
      }),
    (error) => assertAuthError(error, "EXAM_CONTENT_PERMISSION_REQUIRED"),
  );

  await assert.rejects(
    () =>
      chamTayCauEssayChoAttempt(setup.nonOwnerTeacherToken, setup.essayAnswer.answer.id, {
        manualAwardedPoints: 2,
        gradingNote: null,
      }),
    (error) => assertAuthError(error, "EXAM_CONTENT_PERMISSION_REQUIRED"),
  );
});

test("student bi chan khoi luong manual grading", async () => {
  const setup = await taoDuLieuChamTay();

  await assert.rejects(
    () =>
      lietKeCacCauEssayCanChamTheoExam(setup.studentToken, {
        examCode: setup.exam.examCode,
      }),
    (error) => assertAuthError(error, "CLASS_PERMISSION_REQUIRED"),
  );

  await assert.rejects(
    () =>
      chamTayCauEssayChoAttempt(setup.studentToken, setup.essayAnswer.answer.id, {
        manualAwardedPoints: 1,
        gradingNote: null,
      }),
    (error) => assertAuthError(error, "CLASS_PERMISSION_REQUIRED"),
  );
});
