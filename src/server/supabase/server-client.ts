import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { layBienMoiTruongServer } from "@/server/config/env";

let cachedAdminServerClient: SupabaseClient | null = null;

export function coSupabaseSanSangAdminServer(): boolean {
  const env = layBienMoiTruongServer();
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function taoSupabaseAdminServerClient(): SupabaseClient {
  if (cachedAdminServerClient) {
    return cachedAdminServerClient;
  }

  const env = layBienMoiTruongServer();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      "[supabase-admin] Chua du cau hinh NEXT_PUBLIC_SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  cachedAdminServerClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedAdminServerClient;
}

export function coSupabaseSanSangServer(): boolean {
  return coSupabaseSanSangAdminServer();
}

export function taoSupabaseServerClient(): SupabaseClient {
  return taoSupabaseAdminServerClient();
}
