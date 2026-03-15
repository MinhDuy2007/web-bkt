import { AuthError } from "@/server/auth/errors";
import type { ExamRepository } from "@/server/exams/repository/exam-repository";
import { layMockExamRepository } from "@/server/exams/repository/mock-exam-repository";
import { taoPostgresExamRepository } from "@/server/exams/repository/postgres-exam-repository";
import { coSupabaseDuDieuKien, layBienMoiTruongServer } from "@/server/config/env";

let cachedPostgresExamRepository: ExamRepository | null = null;

export function layExamRepository(): ExamRepository {
  const env = layBienMoiTruongServer();
  if (env.authAdapterMode === "mock") {
    return layMockExamRepository();
  }

  if (!coSupabaseDuDieuKien(env)) {
    throw new AuthError({
      code: "SUPABASE_CONFIG_INVALID",
      message:
        "AUTH_ADAPTER_MODE=supabase can NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL.",
      statusCode: 500,
    });
  }

  if (!cachedPostgresExamRepository) {
    cachedPostgresExamRepository = taoPostgresExamRepository();
  }

  return cachedPostgresExamRepository;
}
