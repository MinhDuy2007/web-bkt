import { NextResponse } from "next/server";
import { AuthError, laAuthError } from "@/server/auth/errors";
import { layPhienDangNhap } from "@/server/auth/service";
import type { AuditMetadata, AuthSession } from "@/types/auth";

const SESSION_HEADER_NAME = "x-session-token";
const AUTHORIZATION_BEARER_PREFIX = "Bearer ";

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
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith(AUTHORIZATION_BEARER_PREFIX)) {
    return authorization.slice(AUTHORIZATION_BEARER_PREFIX.length).trim();
  }

  const headerToken = request.headers.get(SESSION_HEADER_NAME)?.trim();
  if (headerToken) {
    return headerToken;
  }

  const cookieToken = layCookieTheoTen(request.headers.get("cookie"), "session_token");
  return cookieToken?.trim() || null;
}

export async function laySessionTuRequest(request: Request): Promise<AuthSession | null> {
  const token = laySessionTokenTuRequest(request);
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

