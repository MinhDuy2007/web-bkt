import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import { laySessionTuCookieRequest, taoJsonLoi } from "@/server/auth/request";

function taoSessionCongKhaiChoBrowser(session: NonNullable<Awaited<ReturnType<typeof laySessionTuCookieRequest>>>) {
  return {
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    user: session.user,
    profile: session.profile,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await laySessionTuCookieRequest(request);
    if (!session) {
      throw new AuthError({
        code: "AUTH_REQUIRED",
        message: "Can dang nhap de xem phien lam viec.",
        statusCode: 401,
      });
    }

    return NextResponse.json({
      ok: true,
      data: taoSessionCongKhaiChoBrowser(session),
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
