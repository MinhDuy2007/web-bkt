import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import { batBuocCoSessionCookieToken, taoJsonLoi } from "@/server/auth/request";
import {
  lietKeYeuCauXacMinhGiaoVienChoAdmin,
  type TrangThaiLocYeuCauXacMinhGiaoVien,
} from "@/server/auth/service";

const TRANG_THAI_HOP_LE = new Set<TrangThaiLocYeuCauXacMinhGiaoVien>([
  "all",
  "pending_review",
  "approved",
  "rejected",
]);
const PAGE_MAC_DINH = 1;
const LIMIT_MAC_DINH = 12;
const LIMIT_TOI_DA = 50;

function docSoNguyenDuong(rawValue: string | null, fieldName: string, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AuthError({
      code: "INVALID_QUERY",
      message: `Truong ${fieldName} phai la so nguyen duong.`,
      statusCode: 400,
    });
  }

  return parsed;
}

function docTrangThai(rawValue: string | null): TrangThaiLocYeuCauXacMinhGiaoVien {
  if (!rawValue) {
    return "all";
  }

  if (!TRANG_THAI_HOP_LE.has(rawValue as TrangThaiLocYeuCauXacMinhGiaoVien)) {
    throw new AuthError({
      code: "INVALID_QUERY",
      message: "Trang thai loc khong hop le.",
      statusCode: 400,
    });
  }

  return rawValue as TrangThaiLocYeuCauXacMinhGiaoVien;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const token = batBuocCoSessionCookieToken(request);
    const url = new URL(request.url);

    const page = docSoNguyenDuong(url.searchParams.get("page"), "page", PAGE_MAC_DINH);
    const limit = docSoNguyenDuong(url.searchParams.get("limit"), "limit", LIMIT_MAC_DINH);
    if (limit > LIMIT_TOI_DA) {
      throw new AuthError({
        code: "INVALID_QUERY",
        message: `Truong limit khong duoc lon hon ${LIMIT_TOI_DA}.`,
        statusCode: 400,
      });
    }

    const status = docTrangThai(url.searchParams.get("status"));
    const data = await lietKeYeuCauXacMinhGiaoVienChoAdmin(token, {
      status,
      page,
      limit,
    });

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
