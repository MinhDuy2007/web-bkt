import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import {
  batBuocCoSessionCookieToken,
  batBuocOriginHopLeChoMutation,
  taoJsonLoi,
} from "@/server/auth/request";
import {
  chuanHoaAttemptId,
  chuanHoaLuuCauTraLoiTheoAttemptPayload,
  lietKeCauTraLoiTheoAttempt,
  luuCauTraLoiTheoAttempt,
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

    const payload = chuanHoaLuuCauTraLoiTheoAttemptPayload(body);
    const data = await luuCauTraLoiTheoAttempt(token, payload);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const token = batBuocCoSessionCookieToken(request);
    const url = new URL(request.url);
    const attemptId = chuanHoaAttemptId(url.searchParams.get("attemptId") ?? "");
    const data = await lietKeCauTraLoiTheoAttempt(token, attemptId);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
