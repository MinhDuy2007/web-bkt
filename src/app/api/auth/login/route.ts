import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import { taoAuditMetadataTuRequest, taoJsonLoi } from "@/server/auth/request";
import { chuanHoaDangNhapPayload, dangNhapTaiKhoan } from "@/server/auth/service";

export async function POST(request: Request): Promise<NextResponse> {
  try {
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

    const response = NextResponse.json({
      ok: true,
      data: session,
    });

    response.headers.set("x-session-token", session.token);
    response.cookies.set({
      name: "session_token",
      value: session.token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (error) {
    return taoJsonLoi(error);
  }
}

