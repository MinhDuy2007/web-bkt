"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { layBienMoiTruongCongKhai } from "@/lib/config/public-env";

let cachedBrowserClient: SupabaseClient | null = null;

export function coSupabaseSanSangBrowser(): boolean {
  const env = layBienMoiTruongCongKhai();
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function taoSupabaseBrowserClient(): SupabaseClient {
  if (cachedBrowserClient) {
    return cachedBrowserClient;
  }

  const env = layBienMoiTruongCongKhai();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "[supabase-browser] Chua du cau hinh NEXT_PUBLIC_SUPABASE_URL hoac NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  cachedBrowserClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return cachedBrowserClient;
}

