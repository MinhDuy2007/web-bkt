import type { AuthRepository } from "@/server/auth/repository/auth-repository";
import { AuthError } from "@/server/auth/errors";
import { layMockAuthRepository } from "@/server/auth/repository/mock-auth-repository";
import { taoPostgresAuthRepository } from "@/server/auth/repository/postgres-auth-repository";
import { taoSupabaseAdminAuthRepository } from "@/server/auth/repository/supabase-auth-repository";
import {
  coSupabaseDuDieuKien,
  coSupabaseServiceRoleDuDieuKien,
  layBienMoiTruongServer,
} from "@/server/config/env";

let cachedPostgresRepository: AuthRepository | null = null;
let cachedAdminSupabaseRepository: AuthRepository | null = null;

// Repository nay duoc dung cho user-facing path.
export function layAuthRepository(): AuthRepository {
  const env = layBienMoiTruongServer();
  if (env.authAdapterMode === "mock") {
    return layMockAuthRepository();
  }

  if (!coSupabaseDuDieuKien(env)) {
    throw new AuthError({
      code: "SUPABASE_CONFIG_INVALID",
      message:
        "AUTH_ADAPTER_MODE=supabase can NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL.",
      statusCode: 500,
    });
  }

  if (!cachedPostgresRepository) {
    cachedPostgresRepository = taoPostgresAuthRepository();
  }

  return cachedPostgresRepository;
}

// Repository nay chi duoc dung cho admin/internal path.
export function layAuthAdminRepository(): AuthRepository {
  const env = layBienMoiTruongServer();
  if (!coSupabaseServiceRoleDuDieuKien(env)) {
    throw new AuthError({
      code: "SUPABASE_ADMIN_CONFIG_INVALID",
      message:
        "Admin service-role path can NEXT_PUBLIC_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY.",
      statusCode: 500,
    });
  }

  if (!cachedAdminSupabaseRepository) {
    cachedAdminSupabaseRepository = taoSupabaseAdminAuthRepository();
  }

  return cachedAdminSupabaseRepository;
}
