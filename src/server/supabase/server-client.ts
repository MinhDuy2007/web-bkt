import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { layBienMoiTruongServer } from "@/server/config/env";

let cachedServerClient: SupabaseClient | null = null;

export function coSupabaseSanSangServer(): boolean {
  const env = layBienMoiTruongServer();
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function taoSupabaseServerClient(): SupabaseClient {
  if (cachedServerClient) {
    return cachedServerClient;
  }

  const env = layBienMoiTruongServer();
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      "[supabase-server] Chua du cau hinh NEXT_PUBLIC_SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  cachedServerClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedServerClient;
}

