import type { AuthAdapterMode } from "@/types/auth";

export type ServerEnv = {
  appName: string;
  appOrigin: string | null;
  authAdapterMode: AuthAdapterMode;
  authSessionTtlMinutes: number;
  sessionTokenPepper: string;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseServiceRoleKey: string | null;
  databaseUrl: string | null;
  databaseExpectedUser: string | null;
  aiGradingProviderMode: "mock" | "openai" | "disabled";
  aiGradingModelName: string;
  aiGradingTimeoutMs: number;
  aiGradingPromptVersion: string;
  openaiApiKey: string | null;
  openaiApiBaseUrl: string;
  aiWorkerBaseUrl: string | null;
  javaSecurityServiceUrl: string | null;
};

const AUTH_ADAPTER_MODES: AuthAdapterMode[] = ["mock", "supabase"];
const SESSION_TTL_DEFAULT_MINUTES = 120;
const SESSION_TOKEN_PEPPER_DEV_FALLBACK = "dev-only-session-token-pepper";
const AI_GRADING_PROVIDER_MODES = ["mock", "openai", "disabled"] as const;
const AI_GRADING_TIMEOUT_DEFAULT_MS = 15000;
const AI_GRADING_PROMPT_VERSION_DEFAULT = "essay-openai-v1";
const OPENAI_API_BASE_URL_DEFAULT = "https://api.openai.com/v1";
let cachedServerEnv: ServerEnv | null = null;

function docGiaTriMoiTruong(key: string): string {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

function docGiaTriTuyChon(key: string): string | null {
  const value = docGiaTriMoiTruong(key);
  return value.length > 0 ? value : null;
}

function docOriginTuyChon(key: string): string | null {
  const rawValue = docGiaTriTuyChon(key);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = new URL(rawValue);
    return parsed.origin;
  } catch {
    throw new Error(`[env] ${key} phai la URL hop le (vi du: https://app.example.com).`);
  }
}

function docUrlTuyChon(key: string, fallbackValue?: string): string {
  const rawValue = docGiaTriMoiTruong(key) || fallbackValue || "";
  try {
    const parsed = new URL(rawValue);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`[env] ${key} phai la URL hop le.`);
  }
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

function docCheDoAiGrading(): "mock" | "openai" | "disabled" {
  const rawMode = docGiaTriMoiTruong("AI_GRADING_PROVIDER_MODE") || "mock";
  if (!AI_GRADING_PROVIDER_MODES.includes(rawMode as "mock" | "openai" | "disabled")) {
    throw new Error(`[env] AI_GRADING_PROVIDER_MODE khong hop le: ${rawMode}.`);
  }

  return rawMode as "mock" | "openai" | "disabled";
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
  const aiGradingProviderMode = docCheDoAiGrading();
  const aiGradingModelName =
    docGiaTriMoiTruong("AI_GRADING_MODEL_NAME") ||
    (aiGradingProviderMode === "openai" ? "gpt-4o-mini" : "mock-essay-grader-v1");

  const env: ServerEnv = {
    appName,
    appOrigin: docOriginTuyChon("APP_ORIGIN"),
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
    databaseExpectedUser: docGiaTriTuyChon("DATABASE_EXPECTED_USER"),
    aiGradingProviderMode,
    aiGradingModelName,
    aiGradingTimeoutMs: chuyenThanhSoDuong(
      "AI_GRADING_TIMEOUT_MS",
      AI_GRADING_TIMEOUT_DEFAULT_MS,
    ),
    aiGradingPromptVersion:
      docGiaTriMoiTruong("AI_GRADING_PROMPT_VERSION") || AI_GRADING_PROMPT_VERSION_DEFAULT,
    openaiApiKey: docGiaTriTuyChon("OPENAI_API_KEY"),
    openaiApiBaseUrl: docUrlTuyChon("OPENAI_API_BASE_URL", OPENAI_API_BASE_URL_DEFAULT),
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

  if (env.aiGradingProviderMode === "openai" && !env.openaiApiKey) {
    throw new Error(
      "[env] AI_GRADING_PROVIDER_MODE=openai can OPENAI_API_KEY de goi provider that o server.",
    );
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

export function datLaiBienMoiTruongServerChoTest(): void {
  cachedServerEnv = null;
}
