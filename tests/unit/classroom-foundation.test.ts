import assert from "node:assert/strict";
import test from "node:test";
import { AuthError } from "@/server/auth/errors";
import { layAuthRepository } from "@/server/auth/repository";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { datLaiKhoLopHocGiaLap } from "@/server/classes/repository/mock-classroom-repository";
import {
  taoLopHocBoiGiaoVien,
  thamGiaLopHocBangMa,
  type TaoLopHocPayload,
} from "@/server/classes/service";
import { chuanHoaDangKyPayload, dangKyTaiKhoan, dangNhapTaiKhoan } from "@/server/auth/service";

process.env.AUTH_ADAPTER_MODE = "mock";

type ThongTinTaiKhoanTest = {
  id: string;
  email: string;
  password: string;
};

const payloadTaoLopMau: TaoLopHocPayload = {
  educationLevel: "THPT",
  subjectName: "Toán",
  schoolName: "THPT Nguyễn Huệ",
  gradeLabel: "Khối 11A",
  fullClassName: "Lớp ôn thi Toán 11A",
};

async function taoTaiKhoanTest(
  email: string,
  password: string,
  displayName: string,
): Promise<ThongTinTaiKhoanTest> {
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

async function dangNhapLayToken(taiKhoan: ThongTinTaiKhoanTest): Promise<string> {
  const session = await dangNhapTaiKhoan({
    email: taiKhoan.email,
    password: taiKhoan.password,
  });

  return session.token;
}

async function nangTrangThaiGiaoVien(
  taiKhoan: ThongTinTaiKhoanTest,
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

test("user thuong bi chan khi tao lop", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();

  const user = await taoTaiKhoanTest("class-normal@test.local", "SafePass123!", "class-normal");
  const token = await dangNhapLayToken(user);

  await assert.rejects(
    () => taoLopHocBoiGiaoVien(token, payloadTaoLopMau),
    (error) => assertAuthError(error, "CLASS_PERMISSION_REQUIRED"),
  );
});

test("teacher pending bi chan khi tao lop", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();

  const teacherPending = await taoTaiKhoanTest(
    "class-teacher-pending@test.local",
    "SafePass123!",
    "class-teacher-pending",
  );
  await nangTrangThaiGiaoVien(teacherPending, "pending_review");
  const token = await dangNhapLayToken(teacherPending);

  await assert.rejects(
    () => taoLopHocBoiGiaoVien(token, payloadTaoLopMau),
    (error) => assertAuthError(error, "CLASS_PERMISSION_REQUIRED"),
  );
});

test("teacher approved tao lop thanh cong", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();

  const teacherApproved = await taoTaiKhoanTest(
    "class-teacher-approved@test.local",
    "SafePass123!",
    "class-teacher-approved",
  );
  await nangTrangThaiGiaoVien(teacherApproved, "approved");
  const token = await dangNhapLayToken(teacherApproved);

  const result = await taoLopHocBoiGiaoVien(token, payloadTaoLopMau);

  assert.equal(result.classRecord.teacherUserId, teacherApproved.id);
  assert.equal(result.classRecord.status, "active");
  assert.equal(result.classRecord.classCode.startsWith("CL"), true);
  assert.equal(result.classRecord.joinCode.length, 8);
  assert.equal(result.teacherMembership.memberRole, "teacher");
  assert.equal(result.teacherMembership.userId, teacherApproved.id);
});

test("join code sai bi bao loi dung", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();

  const teacherApproved = await taoTaiKhoanTest(
    "class-join-teacher@test.local",
    "SafePass123!",
    "class-join-teacher",
  );
  await nangTrangThaiGiaoVien(teacherApproved, "approved");
  const teacherToken = await dangNhapLayToken(teacherApproved);
  const created = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);

  const student = await taoTaiKhoanTest("class-join-student@test.local", "SafePass123!", "class-join-student");
  const studentToken = await dangNhapLayToken(student);

  await assert.rejects(
    () =>
      thamGiaLopHocBangMa(studentToken, {
        classCode: created.classRecord.classCode,
        joinCode: "SAIMA123",
      }),
    (error) => assertAuthError(error, "CLASS_JOIN_CODE_INVALID"),
  );
});

test("duplicate member bi chan dung", async () => {
  datLaiKhoAuthGiaLap();
  datLaiKhoLopHocGiaLap();

  const teacherApproved = await taoTaiKhoanTest(
    "class-dup-teacher@test.local",
    "SafePass123!",
    "class-dup-teacher",
  );
  await nangTrangThaiGiaoVien(teacherApproved, "approved");
  const teacherToken = await dangNhapLayToken(teacherApproved);
  const created = await taoLopHocBoiGiaoVien(teacherToken, payloadTaoLopMau);

  const student = await taoTaiKhoanTest("class-dup-student@test.local", "SafePass123!", "class-dup-student");
  const studentToken = await dangNhapLayToken(student);

  const joined = await thamGiaLopHocBangMa(studentToken, {
    classCode: created.classRecord.classCode,
    joinCode: created.classRecord.joinCode,
  });
  assert.equal(joined.membership.memberRole, "student");

  await assert.rejects(
    () =>
      thamGiaLopHocBangMa(studentToken, {
        classCode: created.classRecord.classCode,
        joinCode: created.classRecord.joinCode,
      }),
    (error) => assertAuthError(error, "CLASS_MEMBER_ALREADY_EXISTS"),
  );
});
