import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import {
  batBuocOriginHopLeChoMutation,
  taoAuditMetadataTuRequest,
  taoJsonLoi,
} from "@/server/auth/request";
import { layBienMoiTruongServer } from "@/server/config/env";
import { chuanHoaDangNhapPayload, dangNhapTaiKhoan } from "@/server/auth/service";

function taoSessionCongKhaiChoBrowser(session: Awaited<ReturnType<typeof dangNhapTaiKhoan>>) {
  return {
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    user: session.user,
    profile: session.profile,
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    batBuocOriginHopLeChoMutation(request);

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

    const payload = chuanHoaDangNhapPayload(body);
    const session = await dangNhapTaiKhoan(payload, taoAuditMetadataTuRequest(request));
    const env = layBienMoiTruongServer();
    const maxAgeSeconds = env.authSessionTtlMinutes * 60;

    const response = NextResponse.json({
      ok: true,
      data: taoSessionCongKhaiChoBrowser(session),
    });

    response.cookies.set({
      name: "session_token",
      value: session.token,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: maxAgeSeconds,
    });

    return response;
  } catch (error) {
    return taoJsonLoi(error);
  }
}
