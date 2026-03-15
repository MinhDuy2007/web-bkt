import assert from "node:assert/strict";
import test from "node:test";
import { AuthError } from "@/server/auth/errors";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { dangKyTaiKhoan, dangNhapTaiKhoan, chuanHoaDangKyPayload } from "@/server/auth/service";
import { datLaiKhoLopHocGiaLap } from "@/server/classes/repository/mock-classroom-repository";
import {
  taoLopHocBoiGiaoVien,
  thamGiaLopHocBangMa,
  type TaoLopHocPayload,
} from "@/server/classes/service";
import { datLaiKhoBaiKiemTraGiaLap } from "@/server/exams/repository/mock-exam-repository";
import { taoBaiKiemTraTheoLop, vaoBaiKiemTraTheoMa } from "@/server/exams/service";

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

test("user thuong bi chan khi tao bai kiem tra theo lop", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest(
    "exam-teacher-1@test.local",
    "SafePass123!",
    "exam-teacher-1",
  );
  await nangTrangThaiGiaoVien(teacher, "approved");
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);

  const normalUser = await taoTaiKhoanTest(
    "exam-normal@test.local",
    "SafePass123!",
    "exam-normal",
  );
  const normalUserToken = await dangNhapLayToken(normalUser);

  await assert.rejects(
    () =>
      taoBaiKiemTraTheoLop(normalUserToken, {
        classCode: lop.classRecord.classCode,
        title: "De kiem tra 15 phut",
        description: null,
        status: "published",
      }),
    (error) => assertAuthError(error, "CLASS_PERMISSION_REQUIRED"),
  );
});

test("teacher pending bi chan khi tao bai kiem tra theo lop", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacherApproved = await taoTaiKhoanTest(
    "exam-teacher-owner@test.local",
    "SafePass123!",
    "exam-teacher-owner",
  );
  await nangTrangThaiGiaoVien(teacherApproved, "approved");
  const teacherOwnerToken = await dangNhapLayToken(teacherApproved);
  const lop = await taoLopHocBoiGiaoVien(teacherOwnerToken, payloadTaoLopMau);

  const teacherPending = await taoTaiKhoanTest(
    "exam-teacher-pending@test.local",
    "SafePass123!",
    "exam-teacher-pending",
  );
  await nangTrangThaiGiaoVien(teacherPending, "pending_review");
  const teacherPendingToken = await dangNhapLayToken(teacherPending);

  await assert.rejects(
    () =>
      taoBaiKiemTraTheoLop(teacherPendingToken, {
        classCode: lop.classRecord.classCode,
        title: "De kiem tra giua ky",
        description: null,
        status: "published",
      }),
    (error) => assertAuthError(error, "CLASS_PERMISSION_REQUIRED"),
  );
});

test("teacher approved tao de cho lop cua minh thanh cong", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest(
    "exam-teacher-ok@test.local",
    "SafePass123!",
    "exam-teacher-ok",
  );
  await nangTrangThaiGiaoVien(teacher, "approved");
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);

  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De kiem tra toan chuong 1",
    description: "Bo de thu nghiem",
    status: "published",
  });

  assert.equal(exam.createdByUserId, teacher.id);
  assert.equal(exam.classId, lop.classRecord.id);
  assert.equal(exam.status, "published");
  assert.equal(exam.examCode.startsWith("EX"), true);
});

test("teacher approved khong duoc tao de cho lop khong so huu", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacherOwner = await taoTaiKhoanTest(
    "exam-owner@test.local",
    "SafePass123!",
    "exam-owner",
  );
  await nangTrangThaiGiaoVien(teacherOwner, "approved");
  const ownerToken = await dangNhapLayToken(teacherOwner);
  const lop = await taoLopHocBoiGiaoVien(ownerToken, payloadTaoLopMau);

  const teacherKhac = await taoTaiKhoanTest(
    "exam-other-teacher@test.local",
    "SafePass123!",
    "exam-other-teacher",
  );
  await nangTrangThaiGiaoVien(teacherKhac, "approved");
  const teacherKhacToken = await dangNhapLayToken(teacherKhac);

  await assert.rejects(
    () =>
      taoBaiKiemTraTheoLop(teacherKhacToken, {
        classCode: lop.classRecord.classCode,
        title: "De nay khong duoc phep",
        description: null,
        status: "published",
      }),
    (error) => assertAuthError(error, "CLASS_OWNERSHIP_REQUIRED"),
  );
});

test("thanh vien lop vao bai thanh cong va duplicate attempt bi chan", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest(
    "exam-start-teacher@test.local",
    "SafePass123!",
    "exam-start-teacher",
  );
  await nangTrangThaiGiaoVien(teacher, "approved");
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De vao bai thu nghiem",
    description: null,
    status: "published",
  });

  const student = await taoTaiKhoanTest(
    "exam-start-student@test.local",
    "SafePass123!",
    "exam-start-student",
  );
  const studentToken = await dangNhapLayToken(student);
  await thamGiaLopHocBangMa(studentToken, {
    classCode: lop.classRecord.classCode,
    joinCode: lop.classRecord.joinCode,
  });

  const firstAttempt = await vaoBaiKiemTraTheoMa(studentToken, {
    examCode: exam.examCode,
  });
  assert.equal(firstAttempt.attempt.userId, student.id);
  assert.equal(firstAttempt.attempt.status, "started");

  await assert.rejects(
    () =>
      vaoBaiKiemTraTheoMa(studentToken, {
        examCode: exam.examCode,
      }),
    (error) => assertAuthError(error, "EXAM_ATTEMPT_ALREADY_EXISTS"),
  );
});

test("user khong la thanh vien lop bi chan khi vao bai", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();
  datLaiKhoBaiKiemTraGiaLap();

  const teacher = await taoTaiKhoanTest(
    "exam-membership-teacher@test.local",
    "SafePass123!",
    "exam-membership-teacher",
  );
  await nangTrangThaiGiaoVien(teacher, "approved");
  const teacherToken = await dangNhapLayToken(teacher);
  const lop = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);
  const exam = await taoBaiKiemTraTheoLop(teacherToken, {
    classCode: lop.classRecord.classCode,
    title: "De danh cho thanh vien",
    description: null,
    status: "published",
  });

  const outsider = await taoTaiKhoanTest(
    "exam-outsider@test.local",
    "SafePass123!",
    "exam-outsider",
  );
  const outsiderToken = await dangNhapLayToken(outsider);

  await assert.rejects(
    () =>
      vaoBaiKiemTraTheoMa(outsiderToken, {
        examCode: exam.examCode,
      }),
    (error) => assertAuthError(error, "CLASS_MEMBERSHIP_REQUIRED"),
  );
});
