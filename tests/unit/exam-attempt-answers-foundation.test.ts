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

async function dangNhapLayToken(taiKhoan: TaiKhoanTest): Promise<string> {
  const session = await dangNhapTaiKhoan({
    email: taiKhoan.email,
    password: taiKhoan.password,
  });

  return session.token;
}

async function nangTrangThaiGiaoVien(
  taiKhoan: TaiKhoanTest,
  status: "pending_review" | "approved",
): Promise<void> {
  const repository = layAuthRepository();
  await repository.updateUser(taiKhoan.id, {
    roles: ["user", "teacher"],
    teacherVerificationStatus: status,
  });
}

function assertAuthError(error: unknown, code: string): boolean {
  return error instanceof AuthError && error.code === code;
}

async function taoExamCoAttemptChoHocSinh() {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest(
    "exam-answer-teacher@test.local",
    "SafePass123!",
    "exam-answer-teacher",
  );
  await nangTrangThaiGiaoVien(teacher, "approved");
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De cho attempt answer foundation",
    description: null,
    status: "published",
  });

  const student = await taoTaiKhoanTest(
    "exam-answer-student@test.local",
    "SafePass123!",
    "exam-answer-student",
  );
  const studentToken = await dangNhapLayToken(student);
  await thamGiaLopHocBangMa(studentToken, {
    classCode: lop.classRecord.classCode,
    joinCode: lop.classRecord.joinCode,
  });
  const started = await vaoBaiKiemTraTheoMa(studentToken, {
    examCode: exam.examCode,
  });

  return {
    teacher,
    teacherToken,
    student,
    studentToken,
    exam,
    attempt: started.attempt,
  };
}

test("owner luu cau tra loi theo attempt duoc va overwrite dung", async () => {
  const setup = await taoExamCoAttemptChoHocSinh();

  const q1 = await taoCauHoiChoExam(setup.teacherToken, {
    examCode: setup.exam.examCode,
    questionOrder: 1,
    questionType: "multiple_choice_single",
    promptText: "2 + 2 bang bao nhieu?",
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

  const created = await luuCauTraLoiTheoAttempt(setup.studentToken, {
    attemptId: setup.attempt.id,
    questionId: q1.question.id,
    answerText: "4",
    answerJson: {},
  });
  const updated = await luuCauTraLoiTheoAttempt(setup.studentToken, {
    attemptId: setup.attempt.id,
    questionId: q1.question.id,
    answerText: "3",
    answerJson: {},
  });

  assert.equal(created.answer.id, updated.answer.id);
  assert.equal(updated.answer.answerText, "3");

  const listed = await lietKeCauTraLoiTheoAttempt(setup.studentToken, setup.attempt.id);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.answer.answerText, "3");
});

test("outsider bi chan khi luu va list cau tra loi cua attempt khac", async () => {
  const setup = await taoExamCoAttemptChoHocSinh();
  const q1 = await taoCauHoiChoExam(setup.teacherToken, {
    examCode: setup.exam.examCode,
    questionOrder: 1,
    questionType: "true_false",
    promptText: "Trai dat quay quanh mat troi?",
    points: 1,
    metadataJson: {},
    answerKey: {
      keyType: "true_false",
      correctAnswerText: "true",
      correctAnswerJson: {},
      explanationText: null,
    },
  });

  const outsider = await taoTaiKhoanTest(
    "exam-answer-outsider@test.local",
    "SafePass123!",
    "exam-answer-outsider",
  );
  const outsiderToken = await dangNhapLayToken(outsider);

  await assert.rejects(
    () =>
      luuCauTraLoiTheoAttempt(outsiderToken, {
        attemptId: setup.attempt.id,
        questionId: q1.question.id,
        answerText: "true",
        answerJson: {},
      }),
    (error) => assertAuthError(error, "EXAM_ATTEMPT_PERMISSION_REQUIRED"),
  );

  await assert.rejects(
    () => lietKeCauTraLoiTheoAttempt(outsiderToken, setup.attempt.id),
    (error) => assertAuthError(error, "EXAM_ATTEMPT_PERMISSION_REQUIRED"),
  );
});

test("submit attempt cham diem nen dung cho mcq true_false short_answer va essay placeholder", async () => {
  const setup = await taoExamCoAttemptChoHocSinh();

  const q1 = await taoCauHoiChoExam(setup.teacherToken, {
    examCode: setup.exam.examCode,
    questionOrder: 1,
    questionType: "multiple_choice_single",
    promptText: "2 + 3 = ?",
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
  const q2 = await taoCauHoiChoExam(setup.teacherToken, {
    examCode: setup.exam.examCode,
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
  const q3 = await taoCauHoiChoExam(setup.teacherToken, {
    examCode: setup.exam.examCode,
    questionOrder: 3,
    questionType: "short_answer",
    promptText: "Thu do Viet Nam la gi?",
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
  const q4 = await taoCauHoiChoExam(setup.teacherToken, {
    examCode: setup.exam.examCode,
    questionOrder: 4,
    questionType: "essay_placeholder",
    promptText: "Phan tich bai toan bang loi van ngan gon.",
    points: 4,
    metadataJson: {},
    answerKey: {
      keyType: "essay_placeholder",
      correctAnswerText: null,
      correctAnswerJson: {},
      explanationText: null,
    },
  });

  await luuCauTraLoiTheoAttempt(setup.studentToken, {
    attemptId: setup.attempt.id,
    questionId: q1.question.id,
    answerText: "5",
    answerJson: {},
  });
  await luuCauTraLoiTheoAttempt(setup.studentToken, {
    attemptId: setup.attempt.id,
    questionId: q2.question.id,
    answerText: "false",
    answerJson: {},
  });
  await luuCauTraLoiTheoAttempt(setup.studentToken, {
    attemptId: setup.attempt.id,
    questionId: q3.question.id,
    answerText: "  ha   noi ",
    answerJson: {},
  });
  await luuCauTraLoiTheoAttempt(setup.studentToken, {
    attemptId: setup.attempt.id,
    questionId: q4.question.id,
    answerText: "Bai essay tam thoi.",
    answerJson: {},
  });

  const submitted = await nopBaiKiemTra(setup.studentToken, {
    attemptId: setup.attempt.id,
  });

  assert.equal(submitted.attempt.status, "submitted");
  assert.equal(submitted.scoreSummary.awardedScore, 5);
  assert.equal(submitted.scoreSummary.maxAutoGradableScore, 6);
  assert.equal(submitted.scoreSummary.pendingManualGradingCount, 1);
  assert.equal(submitted.scoreSummary.autoGradedQuestionCount, 3);
  assert.equal(submitted.scoreSummary.answeredQuestionCount, 4);
  assert.equal(submitted.scoreSummary.totalQuestionCount, 4);

  const listed = await lietKeCauTraLoiTheoAttempt(setup.studentToken, setup.attempt.id);
  const byQuestionId = new Map(listed.map((item) => [item.question.id, item]));
  assert.equal(byQuestionId.get(q1.question.id)?.answer.awardedPoints, 2);
  assert.equal(byQuestionId.get(q2.question.id)?.answer.awardedPoints, 0);
  assert.equal(byQuestionId.get(q3.question.id)?.answer.awardedPoints, 3);
  assert.equal(byQuestionId.get(q4.question.id)?.answer.awardedPoints, 0);
});

test("attempt da submit thi khong duoc cap nhat answer nua", async () => {
  const setup = await taoExamCoAttemptChoHocSinh();
  const q1 = await taoCauHoiChoExam(setup.teacherToken, {
    examCode: setup.exam.examCode,
    questionOrder: 1,
    questionType: "short_answer",
    promptText: "Viet mot dap an ngan",
    points: 1,
    metadataJson: {},
    answerKey: {
      keyType: "short_answer",
      correctAnswerText: "abc",
      correctAnswerJson: {},
      explanationText: null,
    },
  });

  await luuCauTraLoiTheoAttempt(setup.studentToken, {
    attemptId: setup.attempt.id,
    questionId: q1.question.id,
    answerText: "abc",
    answerJson: {},
  });
  await nopBaiKiemTra(setup.studentToken, {
    attemptId: setup.attempt.id,
  });

  await assert.rejects(
    () =>
      luuCauTraLoiTheoAttempt(setup.studentToken, {
        attemptId: setup.attempt.id,
        questionId: q1.question.id,
        answerText: "xyz",
        answerJson: {},
      }),
    (error) => assertAuthError(error, "EXAM_ATTEMPT_ALREADY_SUBMITTED"),
  );
});
