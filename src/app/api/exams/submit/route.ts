import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import {
  batBuocCoSessionCookieToken,
  batBuocOriginHopLeChoMutation,
  taoJsonLoi,
} from "@/server/auth/request";
import { chuanHoaNopBaiKiemTraPayload, nopBaiKiemTra } from "@/server/exams/service";

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

    const payload = chuanHoaNopBaiKiemTraPayload(body);
    const data = await nopBaiKiemTra(token, payload);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
