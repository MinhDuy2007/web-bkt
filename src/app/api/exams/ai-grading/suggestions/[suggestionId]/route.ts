import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import {
  batBuocCoSessionCookieToken,
  batBuocOriginHopLeChoMutation,
  taoJsonLoi,
} from "@/server/auth/request";
import {
  boQuaGoiYChamAI,
  chapNhanGoiYChamAI,
  chuanHoaSuggestionId,
  chuanHoaXuLyGoiYChamAIPayload,
} from "@/server/exams/service";

type RouteContext = {
  params: Promise<{
    suggestionId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    batBuocOriginHopLeChoMutation(request);
    const token = batBuocCoSessionCookieToken(request);
    const { suggestionId } = await context.params;

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

    const payload = chuanHoaXuLyGoiYChamAIPayload(body);
    const normalizedSuggestionId = chuanHoaSuggestionId(suggestionId);
    const data =
      payload.action === "accept"
        ? await chapNhanGoiYChamAI(token, normalizedSuggestionId)
        : await boQuaGoiYChamAI(token, normalizedSuggestionId);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
