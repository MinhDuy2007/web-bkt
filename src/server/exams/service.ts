import { AuthError } from "@/server/auth/errors";
import {
  batBuocQuyenNguoiDungCoBan,
  batBuocQuyenTaoLop,
} from "@/server/auth/permissions";
import { layPhienDangNhap } from "@/server/auth/service";
import { layExamRepository } from "@/server/exams/repository";
import type { CreateClassExamInput } from "@/server/exams/repository/exam-repository";
import type {
  ClassExamAttemptRecord,
  ClassExamStatus,
  MyCreatedClassExamItem,
  StartClassExamResult,
} from "@/types/exam";

const MA_KY_TU = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MA_LOP_PATTERN = /^[A-Z0-9]{4,16}$/;
const MA_BAI_KIEM_TRA_PATTERN = /^[A-Z0-9]{6,16}$/;

export type TaoBaiKiemTraTheoLopPayload = {
  classCode: string;
  title: string;
  description: string | null;
  status: ClassExamStatus;
};

export type VaoBaiKiemTraPayload = {
  examCode: string;
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

function docStatus(rawValue: unknown): ClassExamStatus {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return "published";
  }

  if (rawValue === "draft" || rawValue === "published" || rawValue === "archived") {
    return rawValue;
  }

  throw new AuthError({
    code: "INVALID_INPUT",
    message: "Truong status chi chap nhan draft, published hoac archived.",
    statusCode: 400,
  });
}

function taoMaNgauNhien(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * MA_KY_TU.length);
    value += MA_KY_TU[randomIndex] ?? "X";
  }

  return value;
}

function taoMaBaiKiemTra(): string {
  return `EX${taoMaNgauNhien(8)}`;
}

export function chuanHoaTaoBaiKiemTraTheoLopPayload(payload: unknown): TaoBaiKiemTraTheoLopPayload {
  const data = docObject(payload);
  const classCode = docChuoi(data.classCode, "classCode", 4, 16).toUpperCase();
  if (!MA_LOP_PATTERN.test(classCode)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong classCode khong dung dinh dang.",
      statusCode: 400,
    });
  }

  return {
    classCode,
    title: docChuoi(data.title, "title", 3, 180),
    description: docChuoiTuyChon(data.description, "description", 1200),
    status: docStatus(data.status),
  };
}

export function chuanHoaVaoBaiKiemTraPayload(payload: unknown): VaoBaiKiemTraPayload {
  const data = docObject(payload);
  const examCode = docChuoi(data.examCode, "examCode", 6, 16).toUpperCase();
  if (!MA_BAI_KIEM_TRA_PATTERN.test(examCode)) {
    throw new AuthError({
      code: "INVALID_INPUT",
      message: "Truong examCode khong dung dinh dang.",
      statusCode: 400,
    });
  }

  return {
    examCode,
  };
}

export async function taoBaiKiemTraTheoLop(
  token: string,
  payload: TaoBaiKiemTraTheoLopPayload,
) {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();
  const nowIso = new Date().toISOString();

  const soLanThuToiDa = 6;
  for (let soLanThu = 1; soLanThu <= soLanThuToiDa; soLanThu += 1) {
    try {
      const input: CreateClassExamInput = {
        examCode: taoMaBaiKiemTra(),
        classCode: payload.classCode,
        title: payload.title,
        description: payload.description,
        createdByUserId: verifiedSession.user.id,
        status: payload.status,
        createdAt: nowIso,
      };
      return await repository.createClassExamByTeacher(input);
    } catch (error) {
      if (error instanceof AuthError && error.code === "EXAM_CODE_ALREADY_EXISTS") {
        continue;
      }
      throw error;
    }
  }

  throw new AuthError({
    code: "EXAM_CODE_GENERATION_FAILED",
    message: "Khong tao duoc ma bai kiem tra hop le sau nhieu lan thu.",
    statusCode: 500,
  });
}

export async function lietKeBaiKiemTraDaTao(token: string): Promise<MyCreatedClassExamItem[]> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenTaoLop(session);
  const repository = layExamRepository();

  return repository.listMyCreatedClassExams(verifiedSession.user.id);
}

export async function vaoBaiKiemTraTheoMa(
  token: string,
  payload: VaoBaiKiemTraPayload,
): Promise<StartClassExamResult> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layExamRepository();

  return repository.startClassExam({
    examCode: payload.examCode,
    userId: verifiedSession.user.id,
    startedAt: new Date().toISOString(),
  });
}

export async function lietKeLuotVaoBaiCuaToi(token: string): Promise<ClassExamAttemptRecord[]> {
  const session = await layPhienDangNhap(token);
  const verifiedSession = batBuocQuyenNguoiDungCoBan(session);
  const repository = layExamRepository();

  return repository.listMyExamAttempts(verifiedSession.user.id);
}
