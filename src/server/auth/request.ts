import { NextResponse } from "next/server";
import { AuthError, laAuthError } from "@/server/auth/errors";
import { layPhienDangNhap } from "@/server/auth/service";
import { layBienMoiTruongServer } from "@/server/config/env";
import type { AuditMetadata, AuthSession } from "@/types/auth";

const SESSION_HEADER_NAME = "x-session-token";
const AUTHORIZATION_BEARER_PREFIX = "Bearer ";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type SessionTokenSource = "authorization" | "header" | "cookie" | null;

type DocSessionTokenOptions = {
  choPhepAuthorization?: boolean;
  choPhepHeader?: boolean;
  choPhepCookie?: boolean;
};

function layCookieTheoTen(rawCookie: string | null, cookieName: string): string | null {
  if (!rawCookie) {
    return null;
  }

  const segments = rawCookie.split(";").map((item) => item.trim());
  for (const segment of segments) {
    if (!segment.includes("=")) {
      continue;
    }

    const [name, value] = segment.split("=");
    if (name === cookieName && value) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

export function laySessionTokenTuRequest(request: Request): string | null {
  const ketQua = laySessionTokenVaNguonTuRequest(request, {
    choPhepAuthorization: true,
    choPhepHeader: true,
    choPhepCookie: true,
  });
  return ketQua.token;
}

function laySessionTokenVaNguonTuRequest(
  request: Request,
  options: DocSessionTokenOptions,
): { token: string | null; source: SessionTokenSource } {
  if (options.choPhepAuthorization) {
    const authorization = request.headers.get("authorization");
    if (authorization?.startsWith(AUTHORIZATION_BEARER_PREFIX)) {
      const token = authorization.slice(AUTHORIZATION_BEARER_PREFIX.length).trim();
      if (token) {
        return {
          token,
          source: "authorization",
        };
      }
    }
  }

  if (options.choPhepHeader) {
    const headerToken = request.headers.get(SESSION_HEADER_NAME)?.trim();
    if (headerToken) {
      return {
        token: headerToken,
        source: "header",
      };
    }
  }

  if (options.choPhepCookie) {
    const cookieToken = layCookieTheoTen(request.headers.get("cookie"), "session_token");
    if (cookieToken?.trim()) {
      return {
        token: cookieToken.trim(),
        source: "cookie",
      };
    }
  }

  return {
    token: null,
    source: null,
  };
}

export function laySessionTokenTuCookieRequest(request: Request): string | null {
  const ketQua = laySessionTokenVaNguonTuRequest(request, {
    choPhepAuthorization: false,
    choPhepHeader: false,
    choPhepCookie: true,
  });
  return ketQua.token;
}

export async function laySessionTuRequest(request: Request): Promise<AuthSession | null> {
  const token = laySessionTokenTuRequest(request);
  if (!token) {
    return null;
  }

  return layPhienDangNhap(token);
}

export async function laySessionTuCookieRequest(request: Request): Promise<AuthSession | null> {
  const token = laySessionTokenTuCookieRequest(request);
  if (!token) {
    return null;
  }

  return layPhienDangNhap(token);
}

export function taoAuditMetadataTuRequest(request: Request): AuditMetadata {
  return {
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    requestId: request.headers.get("x-request-id"),
  };
}

export function taoJsonLoi(error: unknown): NextResponse {
  if (laAuthError(error)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "UNHANDLED_ERROR",
        message: "He thong gap loi khong xac dinh.",
      },
    },
    { status: 500 },
  );
}

export function batBuocCoSessionToken(request: Request): string {
  const token = laySessionTokenTuRequest(request);
  if (!token) {
    throw new AuthError({
      code: "AUTH_REQUIRED",
      message: "Can dang nhap de thuc hien thao tac nay.",
      statusCode: 401,
    });
  }

  return token;
}

export function batBuocCoSessionCookieToken(request: Request): string {
  const token = laySessionTokenTuCookieRequest(request);
  if (!token) {
    throw new AuthError({
      code: "AUTH_REQUIRED",
      message: "Can dang nhap bang browser session hop le de thuc hien thao tac nay.",
      statusCode: 401,
    });
  }

  return token;
}

function docOriginTuHeaderReferer(rawReferer: string | null): string | null {
  if (!rawReferer) {
    return null;
  }

  try {
    return new URL(rawReferer).origin;
  } catch {
    return null;
  }
}

function layOriginKyVong(request: Request): string {
  const env = layBienMoiTruongServer();
  if (env.appOrigin) {
    return env.appOrigin;
  }

  try {
    return new URL(request.url).origin;
  } catch {
    throw new AuthError({
      code: "INVALID_REQUEST_URL",
      message: "Khong xac dinh duoc origin hop le cua request.",
      statusCode: 400,
    });
  }
}

export function batBuocOriginHopLeChoMutation(request: Request): void {
  const method = request.method.toUpperCase();
  if (!MUTATION_METHODS.has(method)) {
    return;
  }

  const originKyVong = layOriginKyVong(request);
  const originHeader = request.headers.get("origin");
  const refererOrigin = docOriginTuHeaderReferer(request.headers.get("referer"));
  const originThucTe = originHeader ?? refererOrigin;

  if (!originThucTe || originThucTe !== originKyVong) {
    throw new AuthError({
      code: "ORIGIN_FORBIDDEN",
      message: "Request bi tu choi do khong vuot qua kiem tra origin/referer cho mutation.",
      statusCode: 403,
    });
  }
}
