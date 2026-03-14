import { AuthError } from "@/server/auth/errors";
import type { ClassroomRepository } from "@/server/classes/repository/classroom-repository";
import { layMockClassroomRepository } from "@/server/classes/repository/mock-classroom-repository";
import { taoPostgresClassroomRepository } from "@/server/classes/repository/postgres-classroom-repository";
import { coSupabaseDuDieuKien, layBienMoiTruongServer } from "@/server/config/env";

let cachedPostgresClassroomRepository: ClassroomRepository | null = null;

export function layClassroomRepository(): ClassroomRepository {
  const env = layBienMoiTruongServer();
  if (env.authAdapterMode === "mock") {
    return layMockClassroomRepository();
  }

  if (!coSupabaseDuDieuKien(env)) {
    throw new AuthError({
      code: "SUPABASE_CONFIG_INVALID",
      message:
        "AUTH_ADAPTER_MODE=supabase can NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL.",
      statusCode: 500,
    });
  }

  if (!cachedPostgresClassroomRepository) {
    cachedPostgresClassroomRepository = taoPostgresClassroomRepository();
  }

  return cachedPostgresClassroomRepository;
}
