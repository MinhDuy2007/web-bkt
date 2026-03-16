import assert from "node:assert/strict";
import test from "node:test";
import { AuthError } from "@/server/auth/errors";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { datLaiKhoLopHocGiaLap } from "@/server/classes/repository/mock-classroom-repository";
import {
  taoLopHocBoiGiaoVien,
  type TaoLopHocPayload,
} from "@/server/classes/service";
import { datLaiKhoBaiKiemTraGiaLap } from "@/server/exams/repository/mock-exam-repository";
import {
  capNhatCauHoiChoExam,
  lietKeCauHoiTheoExam,
  taoBaiKiemTraTheoLop,
  taoCauHoiChoExam,
  xoaCauHoiChoExam,
} from "@/server/exams/service";
import { chuanHoaDangKyPayload, dangKyTaiKhoan, dangNhapTaiKhoan } from "@/server/auth/service";

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

test("owner tao va list cau hoi exam thanh cong", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest(
    "exam-question-owner@test.local",
    "SafePass123!",
    "exam-question-owner",
  );
  await nangTrangThaiGiaoVien(teacher, "approved");
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De co noi dung",
    description: null,
    status: "published",
  });

  const created = await taoCauHoiChoExam(teacherToken, {
    examCode: exam.examCode,
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
      explanationText: "Dap an co ban.",
    },
  });

  assert.equal(created.question.questionOrder, 1);
  assert.equal(created.answerKey.correctAnswerText, "4");

  const listed = await lietKeCauHoiTheoExam(teacherToken, exam.examCode);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.question.id, created.question.id);
});

test("non-owner teacher bi chan khi tao cau hoi exam", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacherOwner = await taoTaiKhoanTest(
    "exam-question-owner-2@test.local",
    "SafePass123!",
    "exam-question-owner-2",
  );
  await nangTrangThaiGiaoVien(teacherOwner, "approved");
  const ownerToken = await dangNhapLayToken(teacherOwner);
  const lop = await taoLopHocBoiGiaoVien(ownerToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(ownerToken, {
    classCode: lop.classRecord.classCode,
    title: "De bi chan non-owner",
    description: null,
    status: "published",
  });

  const teacherKhac = await taoTaiKhoanTest(
    "exam-question-non-owner@test.local",
    "SafePass123!",
    "exam-question-non-owner",
  );
  await nangTrangThaiGiaoVien(teacherKhac, "approved");
  const teacherKhacToken = await dangNhapLayToken(teacherKhac);

  await assert.rejects(
    () =>
      taoCauHoiChoExam(teacherKhacToken, {
        examCode: exam.examCode,
        questionOrder: 1,
        questionType: "true_false",
        promptText: "Trai dat phang?",
        points: 1,
        metadataJson: {},
        answerKey: {
          keyType: "true_false",
          correctAnswerText: "false",
          correctAnswerJson: {},
          explanationText: null,
        },
      }),
    (error) => assertAuthError(error, "EXAM_CONTENT_PERMISSION_REQUIRED"),
  );
});

test("invalid answer key bi chan", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest(
    "exam-question-invalid-key@test.local",
    "SafePass123!",
    "exam-question-invalid-key",
  );
  await nangTrangThaiGiaoVien(teacher, "approved");
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De invalid key",
    description: null,
    status: "published",
  });

  await assert.rejects(
    () =>
      taoCauHoiChoExam(teacherToken, {
        examCode: exam.examCode,
        questionOrder: 1,
        questionType: "multiple_choice_single",
        promptText: "Lua chon dung la gi?",
        points: 1,
        metadataJson: {
          options: ["A", "B"],
        },
        answerKey: {
          keyType: "multiple_choice_single",
          correctAnswerText: "C",
          correctAnswerJson: {},
          explanationText: null,
        },
      }),
    (error) => assertAuthError(error, "INVALID_ANSWER_KEY"),
  );
});

test("question order conflict khi tao va cap nhat", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest(
    "exam-question-order@test.local",
    "SafePass123!",
    "exam-question-order",
  );
  await nangTrangThaiGiaoVien(teacher, "approved");
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De conflict order",
    description: null,
    status: "published",
  });

  const q1 = await taoCauHoiChoExam(teacherToken, {
    examCode: exam.examCode,
    questionOrder: 1,
    questionType: "true_false",
    promptText: "Menh de 1",
    points: 1,
    metadataJson: {},
    answerKey: {
      keyType: "true_false",
      correctAnswerText: "true",
      correctAnswerJson: {},
      explanationText: null,
    },
  });
  const q2 = await taoCauHoiChoExam(teacherToken, {
    examCode: exam.examCode,
    questionOrder: 2,
    questionType: "short_answer",
    promptText: "Menh de 2",
    points: 1,
    metadataJson: {},
    answerKey: {
      keyType: "short_answer",
      correctAnswerText: "dap an 2",
      correctAnswerJson: {},
      explanationText: null,
    },
  });

  await assert.rejects(
    () =>
      taoCauHoiChoExam(teacherToken, {
        examCode: exam.examCode,
        questionOrder: 1,
        questionType: "essay_placeholder",
        promptText: "Menh de conflict",
        points: 1,
        metadataJson: {},
        answerKey: {
          keyType: "essay_placeholder",
          correctAnswerText: null,
          correctAnswerJson: {},
          explanationText: null,
        },
      }),
    (error) => assertAuthError(error, "EXAM_QUESTION_ORDER_CONFLICT"),
  );

  await assert.rejects(
    () =>
      capNhatCauHoiChoExam(teacherToken, q2.question.id, {
        questionOrder: 1,
        questionType: q2.question.questionType,
        promptText: q2.question.promptText,
        points: q2.question.points,
        metadataJson: q2.question.metadataJson,
        answerKey: q2.answerKey,
      }),
    (error) => assertAuthError(error, "EXAM_QUESTION_ORDER_CONFLICT"),
  );

  assert.ok(q1.question.id.length > 0);
});

test("update va delete sai quyen bi chan", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacherOwner = await taoTaiKhoanTest(
    "exam-question-owner-3@test.local",
    "SafePass123!",
    "exam-question-owner-3",
  );
  await nangTrangThaiGiaoVien(teacherOwner, "approved");
  const ownerToken = await dangNhapLayToken(teacherOwner);
  const lop = await taoLopHocBoiGiaoVien(ownerToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(ownerToken, {
    classCode: lop.classRecord.classCode,
    title: "De update delete permission",
    description: null,
    status: "published",
  });

  const created = await taoCauHoiChoExam(ownerToken, {
    examCode: exam.examCode,
    questionOrder: 1,
    questionType: "short_answer",
    promptText: "Thu nghiem cap nhat",
    points: 2,
    metadataJson: {},
    answerKey: {
      keyType: "short_answer",
      correctAnswerText: "abc",
      correctAnswerJson: {},
      explanationText: null,
    },
  });

  const teacherKhac = await taoTaiKhoanTest(
    "exam-question-owner-3-other@test.local",
    "SafePass123!",
    "exam-question-owner-3-other",
  );
  await nangTrangThaiGiaoVien(teacherKhac, "approved");
  const otherToken = await dangNhapLayToken(teacherKhac);

  await assert.rejects(
    () =>
      capNhatCauHoiChoExam(otherToken, created.question.id, {
        questionOrder: 1,
        questionType: created.question.questionType,
        promptText: "cap nhat trai phep",
        points: 2,
        metadataJson: {},
        answerKey: {
          keyType: "short_answer",
          correctAnswerText: "abc",
          correctAnswerJson: {},
          explanationText: null,
        },
      }),
    (error) => assertAuthError(error, "EXAM_CONTENT_PERMISSION_REQUIRED"),
  );

  await assert.rejects(
    () => xoaCauHoiChoExam(otherToken, created.question.id),
    (error) => assertAuthError(error, "EXAM_CONTENT_PERMISSION_REQUIRED"),
  );
});
