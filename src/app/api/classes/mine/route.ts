import { NextResponse } from "next/server";
import { batBuocCoSessionCookieToken, taoJsonLoi } from "@/server/auth/request";
import { lietKeLopHocCuaToi } from "@/server/classes/service";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const token = batBuocCoSessionCookieToken(request);
    const data = await lietKeLopHocCuaToi(token);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
