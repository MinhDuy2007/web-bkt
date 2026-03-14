import { NextResponse } from "next/server";
import { batBuocCoSessionCookieToken, taoJsonLoi } from "@/server/auth/request";
import { layHoSoHienTai } from "@/server/auth/service";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const token = batBuocCoSessionCookieToken(request);
    const profile = await layHoSoHienTai(token);

    return NextResponse.json({
      ok: true,
      data: profile,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
