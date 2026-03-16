import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import {
  batBuocCoSessionCookieToken,
  batBuocOriginHopLeChoMutation,
  taoJsonLoi,
} from "@/server/auth/request";
import {
  chuanHoaTaoCauHoiChoExamPayload,
  chuanHoaVaoBaiKiemTraPayload,
  lietKeCauHoiTheoExam,
  taoCauHoiChoExam,
} from "@/server/exams/service";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    batBuocOriginHopLeChoMutation(request);
    const token = batBuocCoSessionCookieToken(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AuthError({
        code: "INVALID_JSON",
        message: "Noi dung gui len khong phai JSON hop le.",
        statusCode: 400,
      });
    }

    const payload = chuanHoaTaoCauHoiChoExamPayload(body);
    const data = await taoCauHoiChoExam(token, payload);

    return NextResponse.json(
      {
        ok: true,
        data,
      },
      { status: 201 },
    );
  } catch (error) {
    return taoJsonLoi(error);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const token = batBuocCoSessionCookieToken(request);
    const url = new URL(request.url);
    const examCode = url.searchParams.get("examCode");
    const normalized = chuanHoaVaoBaiKiemTraPayload({
      examCode: examCode ?? "",
    });
    const data = await lietKeCauHoiTheoExam(token, normalized.examCode);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
