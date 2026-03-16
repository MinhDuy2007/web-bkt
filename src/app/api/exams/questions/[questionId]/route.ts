import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import {
  batBuocCoSessionCookieToken,
  batBuocOriginHopLeChoMutation,
  taoJsonLoi,
} from "@/server/auth/request";
import {
  capNhatCauHoiChoExam,
  chuanHoaCapNhatCauHoiChoExamPayload,
  chuanHoaQuestionId,
  xoaCauHoiChoExam,
} from "@/server/exams/service";

type RouteContext = {
  params: Promise<{ questionId: string }> | { questionId: string };
};

async function docQuestionId(context: RouteContext): Promise<string> {
  const resolved = await context.params;
  return chuanHoaQuestionId(resolved?.questionId);
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    batBuocOriginHopLeChoMutation(request);
    const token = batBuocCoSessionCookieToken(request);
    const questionId = await docQuestionId(context);

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

    const payload = chuanHoaCapNhatCauHoiChoExamPayload(body);
    const data = await capNhatCauHoiChoExam(token, questionId, payload);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    batBuocOriginHopLeChoMutation(request);
    const token = batBuocCoSessionCookieToken(request);
    const questionId = await docQuestionId(context);
    const data = await xoaCauHoiChoExam(token, questionId);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
