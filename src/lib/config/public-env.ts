export type PublicEnv = {
  appName: string;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
};

let cachedPublicEnv: PublicEnv | null = null;

function docGiaTriCongKhai(key: string): string | null {
  const value = process.env[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function layBienMoiTruongCongKhai(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv;
  }

  cachedPublicEnv = {
    appName: docGiaTriCongKhai("NEXT_PUBLIC_APP_NAME") ?? "web-bkt",
    supabaseUrl: docGiaTriCongKhai("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: docGiaTriCongKhai("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };

  return cachedPublicEnv;
}

