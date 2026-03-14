import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import {
  batBuocCoSessionCookieToken,
  batBuocOriginHopLeChoMutation,
  taoAuditMetadataTuRequest,
  taoJsonLoi,
} from "@/server/auth/request";
import {
  chuanHoaDuyetYeuCauXacMinhGiaoVienPayload,
  duyetYeuCauXacMinhGiaoVienBoiAdmin,
} from "@/server/auth/service";

type RouteContext = {
  params: Promise<{ requestId: string }> | { requestId: string };
};

async function docRequestId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  const requestId = resolved?.requestId;
  if (typeof requestId !== "string" || requestId.trim().length === 0) {
    throw new AuthError({
      code: "INVALID_REQUEST_ID",
      message: "Khong tim thay requestId hop le tren duong dan.",
      statusCode: 400,
    });
  }

  return requestId;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    batBuocOriginHopLeChoMutation(request);
    const token = batBuocCoSessionCookieToken(request);
    const requestId = await docRequestId(context);

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

    const payload = chuanHoaDuyetYeuCauXacMinhGiaoVienPayload(body);
    const result = await duyetYeuCauXacMinhGiaoVienBoiAdmin(
      token,
      requestId,
      payload,
      taoAuditMetadataTuRequest(request),
    );

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
