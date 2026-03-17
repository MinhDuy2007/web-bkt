import { NextResponse } from "next/server";
import { batBuocCoSessionCookieToken, taoJsonLoi } from "@/server/auth/request";
import {
  chuanHoaVaoBaiKiemTraPayload,
  lietKeCacCauEssayCanChamTheoExam,
} from "@/server/exams/service";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const token = batBuocCoSessionCookieToken(request);
    const url = new URL(request.url);
    const payload = chuanHoaVaoBaiKiemTraPayload({
      examCode: url.searchParams.get("examCode") ?? "",
    });
    const data = await lietKeCacCauEssayCanChamTheoExam(token, payload);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
