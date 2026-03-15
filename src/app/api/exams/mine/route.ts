import { NextResponse } from "next/server";
import { AuthError } from "@/server/auth/errors";
import { batBuocCoSessionCookieToken, taoJsonLoi } from "@/server/auth/request";
import {
  lietKeBaiKiemTraDaTao,
  lietKeLuotVaoBaiCuaToi,
} from "@/server/exams/service";
import type { MyCreatedClassExamItem } from "@/types/exam";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const token = batBuocCoSessionCookieToken(request);
    const attempts = await lietKeLuotVaoBaiCuaToi(token);
    let createdExams: MyCreatedClassExamItem[] = [];

    try {
      createdExams = await lietKeBaiKiemTraDaTao(token);
    } catch (error) {
      if (!(error instanceof AuthError && error.code === "CLASS_PERMISSION_REQUIRED")) {
        throw error;
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        createdExams,
        attempts,
      },
    });
  } catch (error) {
    return taoJsonLoi(error);
  }
}
