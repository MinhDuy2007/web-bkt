import type { AuthAdapterMode } from "@/types/auth";

export type ServerEnv = {
  appName: string;
  authAdapterMode: AuthAdapterMode;
  authSessionTtlMinutes: number;
  sessionTokenPepper: string;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseServiceRoleKey: string | null;
  databaseUrl: string | null;
  aiWorkerBaseUrl: string | null;
  javaSecurityServiceUrl: string | null;
};

const AUTH_ADAPTER_MODES: AuthAdapterMode[] = ["mock", "supabase"];
const SESSION_TTL_DEFAULT_MINUTES = 120;
const SESSION_TOKEN_PEPPER_DEV_FALLBACK = "dev-only-session-token-pepper";
let cachedServerEnv: ServerEnv | null = null;

function docGiaTriMoiTruong(key: string): string {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

function docGiaTriTuyChon(key: string): string | null {
  const value = docGiaTriMoiTruong(key);
  return value.length > 0 ? value : null;
}

function chuyenThanhSoDuong(key: string, fallbackValue: number): number {
  const raw = docGiaTriMoiTruong(key);
  if (!raw) {
    return fallbackValue;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`[env] ${key} phai la so duong.`);
  }

  return Math.floor(parsed);
}

function docCheDoAuth(): AuthAdapterMode {
  const rawMode = docGiaTriMoiTruong("AUTH_ADAPTER_MODE") || "mock";
  if (!AUTH_ADAPTER_MODES.includes(rawMode as AuthAdapterMode)) {
    throw new Error(`[env] AUTH_ADAPTER_MODE khong hop le: ${rawMode}.`);
  }

  return rawMode as AuthAdapterMode;
}

function docSessionTokenPepper(appName: string): { value: string; usingFallback: boolean } {
  const configured = docGiaTriMoiTruong("SESSION_TOKEN_PEPPER");
  if (configured) {
    return {
      value: configured,
      usingFallback: false,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("[env] SESSION_TOKEN_PEPPER bat buoc co trong moi truong production.");
  }

  return {
    value: `${appName}-${SESSION_TOKEN_PEPPER_DEV_FALLBACK}`,
    usingFallback: true,
  };
}

export function layBienMoiTruongServer(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const appName = docGiaTriMoiTruong("NEXT_PUBLIC_APP_NAME") || "web-bkt";
  const authAdapterMode = docCheDoAuth();
  const sessionTokenPepper = docSessionTokenPepper(appName);

  const env: ServerEnv = {
    appName,
    authAdapterMode,
    authSessionTtlMinutes: chuyenThanhSoDuong(
      "AUTH_SESSION_TTL_MINUTES",
      SESSION_TTL_DEFAULT_MINUTES,
    ),
    sessionTokenPepper: sessionTokenPepper.value,
    supabaseUrl: docGiaTriTuyChon("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: docGiaTriTuyChon("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: docGiaTriTuyChon("SUPABASE_SERVICE_ROLE_KEY"),
    databaseUrl: docGiaTriTuyChon("DATABASE_URL"),
    aiWorkerBaseUrl: docGiaTriTuyChon("AI_WORKER_BASE_URL"),
    javaSecurityServiceUrl: docGiaTriTuyChon("JAVA_SECURITY_SERVICE_URL"),
  };

  if (env.authAdapterMode === "supabase") {
    if (!env.supabaseUrl || !env.supabaseAnonKey || !env.databaseUrl) {
      throw new Error(
        "[env] AUTH_ADAPTER_MODE=supabase can NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL.",
      );
    }
    if (sessionTokenPepper.usingFallback) {
      throw new Error(
        "[env] AUTH_ADAPTER_MODE=supabase can cau hinh SESSION_TOKEN_PEPPER rieng, khong dung fallback.",
      );
    }
  }

  cachedServerEnv = env;
  return env;
}

export function coSupabaseDuDieuKien(env = layBienMoiTruongServer()): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && env.databaseUrl);
}

export function coSupabaseServiceRoleDuDieuKien(env = layBienMoiTruongServer()): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}
