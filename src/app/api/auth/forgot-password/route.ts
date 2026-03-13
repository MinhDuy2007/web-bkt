import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import { taoAuditMetadataTuRequest, taoJsonLoi } from "@/server/auth/request";
import { chuanHoaQuenMatKhauPayload, quenMatKhauPlaceholder } from "@/server/auth/service";

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

    const payload = chuanHoaQuenMatKhauPayload(body);
    const result = await quenMatKhauPlaceholder(payload, taoAuditMetadataTuRequest(request));

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}

