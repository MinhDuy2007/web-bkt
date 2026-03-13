import type { AuthRepository } from "@/server/auth/repository/auth-repository";
import { AuthError } from "@/server/auth/errors";
import { layMockAuthRepository } from "@/server/auth/repository/mock-auth-repository";
import { taoSupabaseAuthRepository } from "@/server/auth/repository/supabase-auth-repository";
import { coSupabaseDuDieuKien, layBienMoiTruongServer } from "@/server/config/env";

let cachedSupabaseRepository: AuthRepository | null = null;

export function layAuthRepository(): AuthRepository {
  const env = layBienMoiTruongServer();
  if (env.authAdapterMode === "mock") {
    return layMockAuthRepository();
  }

  if (!coSupabaseDuDieuKien(env)) {
    throw new AuthError({
      code: "SUPABASE_CONFIG_INVALID",
      message:
        "AUTH_ADAPTER_MODE dang la supabase nhung bo bien moi truong Supabase chua day du.",
      statusCode: 500,
    });
  }

  if (!cachedSupabaseRepository) {
    cachedSupabaseRepository = taoSupabaseAuthRepository();
  }

  return cachedSupabaseRepository;
}

