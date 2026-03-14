import { AuthError } from "@/server/auth/errors";
import {
  batBuocQuyenNguoiDungCoBan,
  batBuocQuyenTaoLop,
} from "@/server/auth/permissions";
import { layPhienDangNhap } from "@/server/auth/service";
import { layClassroomRepository } from "@/server/classes/repository";
import type {
  CreateClassResult,
  JoinClassByCodeInput,
} from "@/server/classes/repository/classroom-repository";
import type { MyClassItemRecord } from "@/types/classroom";

const MA_KY_TU = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MA_LOP_PATTERN = /^[A-Z0-9]{4,16}$/;
const MA_THAM_GIA_PATTERN = /^[A-Z0-9]{4,16}$/;

export type TaoLopHocPayload = {
  educationLevel: string;
  subjectName: string;
  schoolName: string | null;
  gradeLabel: string;
  fullClassName: string;
};

export type ThamGiaLopHocBangMaPayload = {
  classCode: string;
  joinCode: string;
};

function docObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Du lieu dau vao khong hop le.",
      statusCode: 400,
    });
  }

  return payload as Record<string, unknown>;
}

function docChuoi(
  rawValue: unknown,
  fieldName: string,
  minLength: number,
  maxLength: number,
): string {
  if (typeof rawValue !== "string") {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la chuoi.`,
      statusCode: 400,
    });
  }

  const normalized = rawValue.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai co do dai tu ${minLength} den ${maxLength} ky tu.`,
      statusCode: 400,
    });
  }

  return normalized;
}

function docChuoiTuyChon(rawValue: unknown, fieldName: string, maxLength: number): string | null {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }

  if (typeof rawValue !== "string") {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} phai la chuoi neu duoc cung cap.`,
      statusCode: 400,
    });
  }

  const normalized = rawValue.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: `Truong ${fieldName} khong duoc vuot qua ${maxLength} ky tu.`,
      statusCode: 400,
    });
  }

  return normalized;
}

function taoMaNgauNhien(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * MA_KY_TU.length);
    value += MA_KY_TU[randomIndex] ?? "X";
  }

  return value;
}

function taoMaLopHoc(): string {
  return `CL${taoMaNgauNhien(6)}`;
}

function taoMaThamGia(): string {
  return taoMaNgauNhien(8);
}

export function chuanHoaTaoLopHocPayload(payload: unknown): TaoLopHocPayload {
  const data = docObject(payload);

  return {
    educationLevel: docChuoi(data.educationLevel, "educationLevel", 2, 64),
    subjectName: docChuoi(data.subjectName, "subjectName", 2, 120),
    schoolName: docChuoiTuyChon(data.schoolName, "schoolName", 160),
    gradeLabel: docChuoi(data.gradeLabel, "gradeLabel", 1, 64),
    fullClassName: docChuoi(data.fullClassName, "fullClassName", 3, 160),
  };
}

export function chuanHoaThamGiaLopHocBangMaPayload(
  payload: unknown,
): ThamGiaLopHocBangMaPayload {
  const data = docObject(payload);
  const classCode = docChuoi(data.classCode, "classCode", 4, 16).toUpperCase();
  const joinCode = docChuoi(data.joinCode, "joinCode", 4, 16).toUpperCase();

  if (!MA_LOP_PATTERN.test(classCode)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong classCode khong dung dinh dang.",
      statusCode: 400,
    });
  }

  if (!MA_THAM_GIA_PATTERN.test(joinCode)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong joinCode khong dung dinh dang.",
      statusCode: 400,
    });
  }

  return {
    classCode,
    joinCode,
  };
}

export async function taoLopHocBoiGiaoVien(
  token: string,
  payload: TaoLopHocPayload,
): Promise<CreateClassResult> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layClassroomRepository();
  const nowIso = new Date().toISOString();

  const soLanThuToiDa = 6;
  for (let soLanThu = 1; soLanThu <= soLanThuToiDa; soLanThu += 1) {
    try {
      return await repository.createClassByTeacher({
        classCode: taoMaLopHoc(),
        educationLevel: payload.educationLevel,
        subjectName: payload.subjectName,
        schoolName: payload.schoolName,
        gradeLabel: payload.gradeLabel,
        fullClassName: payload.fullClassName,
        teacherUserId: verifiedSession.user.id,
        joinCode: taoMaThamGia(),
        status: "active",
        createdAt: nowIso,
      });
    } catch (error) {
      if (error instanceof AuthError && error.code === "CLASS_CODE_ALREADY_EXISTS") {
        continue;
      }

      throw error;
    }
  }

  throw new AuthError({
    code: "CLASS_CODE_GENERATION_FAILED",
    message: "Khong tao duoc ma lop hoc hop le sau nhieu lan thu.",
    statusCode: 500,
  });
}

export async function lietKeLopHocCuaToi(token: string): Promise<MyClassItemRecord[]> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layClassroomRepository();

  return repository.listMyClasses(verifiedSession.user.id);
}

export async function thamGiaLopHocBangMa(
  token: string,
  payload: ThamGiaLopHocBangMaPayload,
): Promise<MyClassItemRecord> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layClassroomRepository();

  const input: JoinClassByCodeInput = {
    classCode: payload.classCode,
    joinCode: payload.joinCode,
    userId: verifiedSession.user.id,
    memberRole: "student",
  };

  return repository.joinClassByCode(input);
}
