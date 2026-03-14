import test from "node:test";
import assert from "node:assert/strict";
import { datLaiKhoAuthGiaLap } from "@/server/auth/repository/mock-auth-repository";
import { chuanHoaDangKyPayload, dangKyTaiKhoan } from "@/server/auth/service";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as sessionGet } from "@/app/api/auth/session/route";
import { POST as teacherRequestPost } from "@/app/api/teacher-verification/request/route";

function docSessionCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("Khong tim thay set-cookie header.");
  }

  const matched = setCookieHeader.match(/session_token=([^;]+)/);
  if (!matched?.[1]) {
    throw new Error("Khong tim thay session_token trong set-cookie.");
  }

  return `session_token=${matched[1]}`;
}

async function taoSessionCookieChoBrowser(): Promise<string> {
  datLaiKhoAuthGiaLap();

  await dangKyTaiKhoan(
    chuanHoaDangKyPayload({
      email: "browser-user@test.local",
      password: "SafePass123!",
      displayName: "browser-user",
      fullName: "Browser User",
    }),
  );

  const loginRequest = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      email: "browser-user@test.local",
      password: "SafePass123!",
    }),
  });

  const loginResponse = await loginPost(loginRequest);
  assert.equal(loginResponse.status, 200);
  return docSessionCookie(loginResponse.headers.get("set-cookie"));
}

test("browser login flow khong tra raw session token trong body va header", async () => {
  datLaiKhoAuthGiaLap();

  await dangKyTaiKhoan(
    chuanHoaDangKyPayload({
      email: "no-token-user@test.local",
      password: "SafePass123!",
      displayName: "no-token-user",
      fullName: "No Token User",
    }),
  );

  const loginRequest = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      email: "no-token-user@test.local",
      password: "SafePass123!",
    }),
  });

  const response = await loginPost(loginRequest);
  const body = (await response.json()) as {
    ok: boolean;
    data: Record<string, unknown>;
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.has("x-session-token"), false);
  assert.equal(typeof response.headers.get("set-cookie"), "string");
  assert.equal("token" in body.data, false);
});

test("session lookup van hoat dong dung qua cookie browser", async () => {
  const cookieHeader = await taoSessionCookieChoBrowser();

  const sessionRequest = new Request("http://localhost:3000/api/auth/session", {
    method: "GET",
    headers: {
      cookie: cookieHeader,
    },
  });

  const response = await sessionGet(sessionRequest);
  const body = (await response.json()) as {
    ok: boolean;
    data: Record<string, unknown>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal("token" in body.data, false);
});

test("mutation route dung cookie auth bi chan neu origin khong hop le", async () => {
  const cookieHeader = await taoSessionCookieChoBrowser();

  const request = new Request("http://localhost:3000/api/teacher-verification/request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      origin: "http://evil.local",
    },
    body: JSON.stringify({
      fullName: "Browser User",
      schoolName: "THPT A",
      teachingSubjects: ["Toan"],
      evidenceNote: "Toi la giao vien da co kinh nghiem giang day.",
      evidenceUrls: [],
    }),
  });

  const response = await teacherRequestPost(request);
  const body = (await response.json()) as {
    ok: boolean;
    error: { code: string };
  };

  assert.equal(response.status, 403);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "ORIGIN_FORBIDDEN");
});

test("mutation route pass khi origin hop le va cookie hop le", async () => {
  const cookieHeader = await taoSessionCookieChoBrowser();

  const request = new Request("http://localhost:3000/api/teacher-verification/request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      origin: "http://localhost:3000",
    },
    body: JSON.stringify({
      fullName: "Browser User",
      schoolName: "THPT B",
      teachingSubjects: ["Vat ly"],
      evidenceNote: "Toi gui ho so xac minh giao vien cho he thong.",
      evidenceUrls: [],
    }),
  });

  const response = await teacherRequestPost(request);
  assert.equal(response.status, 201);
});
