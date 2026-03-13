import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import { taoJsonLoi, laySessionTuRequest } from "@/server/auth/request";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const session = await laySessionTuRequest(request);
    if (!session) {
      throw new AuthError({
        code: "AUTH_REQUIRED",
        message: "Can dang nhap de xem phien lam viec.",
        statusCode: 401,
      });
    }

    return NextResponse.json({
      ok: true,
      data: session,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}

