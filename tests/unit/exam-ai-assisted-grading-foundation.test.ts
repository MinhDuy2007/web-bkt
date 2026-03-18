import assert from "node:assert/strict";
import test from "node:test";
import { AuthError } from "@/server/auth/errors";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { chuanHoaDangKyPayload, dangKyTaiKhoan, dangNhapTaiKhoan } from "@/server/auth/service";
import { datAiEssayGradingProviderChoTest } from "@/server/exams/ai-grading-provider";
import { datLaiKhoLopHocGiaLap } from "@/server/classes/repository/mock-classroom-repository";
import { taoLopHocBoiGiaoVien, thamGiaLopHocBangMa, type TaoLopHocPayload } from "@/server/classes/service";
import { datLaiKhoBaiKiemTraGiaLap } from "@/server/exams/repository/mock-exam-repository";
import {
  boQuaGoiYChamAI,
  chamTayCauEssayChoAttempt,
  chapNhanGoiYChamAI,
  lietKeCacCauEssayCanChamTheoExam,
  lietKeGoiYChamAIChoTeacher,
  lietKeCauTraLoiTheoAttempt,
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

test.afterEach(() => {
  datAiEssayGradingProviderChoTest(null);
});

type TaiKhoanTest = {
  id: string;
  email: string;
  password: string;
};

const payloadTaoLopMau: TaoLopHocPayload = {
  educationLevel: "THPT",
  subjectName: "Ngu van",
  schoolName: "THPT AI Assist",
  gradeLabel: "Khoi 12A3",
  fullClassName: "Lop AI assisted grading",
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

async function taoFixtureAiGrading() {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const ownerTeacher = await taoTaiKhoanTest(
    "ai-owner-teacher@test.local",
    "SafePass123!",
    "ai-owner-teacher",
  );
  await nangTrangThaiGiaoVien(ownerTeacher);
  const ownerTeacherToken = await dangNhapLayToken(ownerTeacher);

  const nonOwnerTeacher = await taoTaiKhoanTest(
    "ai-non-owner-teacher@test.local",
    "SafePass123!",
    "ai-non-owner-teacher",
  );
  await nangTrangThaiGiaoVien(nonOwnerTeacher);
  const nonOwnerTeacherToken = await dangNhapLayToken(nonOwnerTeacher);

  const student = await taoTaiKhoanTest("ai-student@test.local", "SafePass123!", "ai-student");
  const studentToken = await dangNhapLayToken(student);

  const lop = await taoLopHocBoiGiaoVien(ownerTeacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(ownerTeacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De AI assisted grading",
    description: "Proof backend AI-assisted grading",
    status: "published",
  });

  const shortAnswer = await taoCauHoiChoExam(ownerTeacherToken, {
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
  const essay = await taoCauHoiChoExam(ownerTeacherToken, {
    examCode: exam.examCode,
    questionOrder: 2,
    questionType: "essay_placeholder",
    promptText: "Phan tich vai tro cua trach nhiem cong dan trong doi song hoc duong.",
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

  await luuCauTraLoiTheoAttempt(studentToken, {
    attemptId: started.attempt.id,
    questionId: shortAnswer.question.id,
    answerText: "Ha Noi",
    answerJson: {},
  });
  await luuCauTraLoiTheoAttempt(studentToken, {
    attemptId: started.attempt.id,
    questionId: essay.question.id,
    answerText:
      "Bai lam trinh bay vai tro cua y thuc ky luat, ton trong noi quy va trach nhiem voi tap the. Lap luan du ro de AI mock tao goi y on dinh.",
    answerJson: {},
  });
  await nopBaiKiemTra(studentToken, {
    attemptId: started.attempt.id,
  });

  const answerItems = await lietKeCauTraLoiTheoAttempt(studentToken, started.attempt.id);
  const essayAnswer = answerItems.find((item) => item.question.id === essay.question.id);
  assert.ok(essayAnswer, "Phai co essay answer sau submit.");

  return {
    ownerTeacher,
    ownerTeacherToken,
    nonOwnerTeacher,
    nonOwnerTeacherToken,
    student,
    studentToken,
    exam,
    attempt: started.attempt,
    essayAnswer: essayAnswer!,
  };
}

test("teacher owner tao goi y AI nhung final score chua doi truoc khi accept", async () => {
  const setup = await taoFixtureAiGrading();

  const created = await taoGoiYChamAIChoEssay(setup.ownerTeacherToken, {
    examCode: setup.exam.examCode,
    answerId: setup.essayAnswer.answer.id,
  });

  assert.equal(created.suggestion.status, "pending");
  assert.equal(created.answer.id, setup.essayAnswer.answer.id);
  assert.ok(created.suggestion.modelName.length > 0);

  const listed = await lietKeGoiYChamAIChoTeacher(setup.ownerTeacherToken, setup.exam.examCode);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.suggestion.id, created.suggestion.id);

  const result = await taiKetQuaBaiLamTheoExamCode(setup.studentToken, {
    examCode: setup.exam.examCode,
  });
  assert.equal(result.summary.autoGradedScore, 2);
  assert.equal(result.summary.finalScore, null);
  assert.equal(result.summary.pendingManualGradingCount, 1);
});

test("teacher owner accept goi y AI moi cap nhat final score va giam pending", async () => {
  const setup = await taoFixtureAiGrading();

  const created = await taoGoiYChamAIChoEssay(setup.ownerTeacherToken, {
    examCode: setup.exam.examCode,
    answerId: setup.essayAnswer.answer.id,
  });
  const accepted = await chapNhanGoiYChamAI(setup.ownerTeacherToken, created.suggestion.id);

  assert.equal(accepted.suggestion.status, "accepted");
  assert.equal(accepted.answer.manualAwardedPoints, created.suggestion.suggestedPoints);
  assert.equal(accepted.answer.gradingNote, created.suggestion.suggestedFeedback);
  assert.equal(accepted.attempt.pendingManualGradingCount, 0);
  assert.equal(accepted.attempt.finalScore, 2 + created.suggestion.suggestedPoints);

  const queue = await lietKeCacCauEssayCanChamTheoExam(setup.ownerTeacherToken, {
    examCode: setup.exam.examCode,
  });
  assert.equal(queue.length, 0);
});

test("reject goi y AI khong duoc doi final score va teacher van co the cham tay rieng", async () => {
  const setup = await taoFixtureAiGrading();

  const created = await taoGoiYChamAIChoEssay(setup.ownerTeacherToken, {
    examCode: setup.exam.examCode,
    answerId: setup.essayAnswer.answer.id,
  });
  const rejected = await boQuaGoiYChamAI(setup.ownerTeacherToken, created.suggestion.id);
  assert.equal(rejected.suggestion.status, "rejected");
  assert.equal(rejected.attempt.finalScore, null);
  assert.equal(rejected.attempt.pendingManualGradingCount, 1);

  const manuallyGraded = await chamTayCauEssayChoAttempt(
    setup.ownerTeacherToken,
    setup.essayAnswer.answer.id,
    {
      manualAwardedPoints: 3.5,
      gradingNote: "Teacher cham tay rieng sau khi bo qua goi y AI.",
    },
  );
  assert.equal(manuallyGraded.attempt.finalScore, 5.5);
  assert.equal(manuallyGraded.attempt.pendingManualGradingCount, 0);
});

test("teacher non-owner va student bi chan khoi AI-assisted grading", async () => {
  const setup = await taoFixtureAiGrading();

  await assert.rejects(
    () =>
      taoGoiYChamAIChoEssay(setup.nonOwnerTeacherToken, {
        examCode: setup.exam.examCode,
        answerId: setup.essayAnswer.answer.id,
      }),
    (error) => assertAuthError(error, "EXAM_CONTENT_PERMISSION_REQUIRED"),
  );

  await assert.rejects(
    () =>
      taoGoiYChamAIChoEssay(setup.studentToken, {
        examCode: setup.exam.examCode,
        answerId: setup.essayAnswer.answer.id,
      }),
    (error) => assertAuthError(error, "CLASS_PERMISSION_REQUIRED"),
  );
});

test("manual grading truc tiep phai supersede pending AI suggestion", async () => {
  const setup = await taoFixtureAiGrading();

  const created = await taoGoiYChamAIChoEssay(setup.ownerTeacherToken, {
    examCode: setup.exam.examCode,
    answerId: setup.essayAnswer.answer.id,
  });
  const manuallyGraded = await chamTayCauEssayChoAttempt(
    setup.ownerTeacherToken,
    setup.essayAnswer.answer.id,
    {
      manualAwardedPoints: 3,
      gradingNote: "Teacher chon cham tay thay vi chap nhan AI.",
    },
  );

  assert.equal(manuallyGraded.attempt.finalScore, 5);

  const suggestions = await lietKeGoiYChamAIChoTeacher(setup.ownerTeacherToken, setup.exam.examCode);
  const found = suggestions.find((item) => item.suggestion.id === created.suggestion.id);
  assert.equal(found?.suggestion.status, "superseded");
});
