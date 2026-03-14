import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bamSessionToken } from "@/server/auth/session-token";

const repositoryIndexFile = join(process.cwd(), "src", "server", "auth", "repository", "index.ts");
const authRepositoryContractFile = join(
  process.cwd(),
  "src",
  "server",
  "auth",
  "repository",
  "auth-repository.ts",
);

test("session token phai duoc bam co do dai 64 ky tu hex", () => {
  const token = "session-token-mau";
  const hash = bamSessionToken(token);

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
});

test("session token khac nhau phai ra hash khac nhau", () => {
  const hashA = bamSessionToken("token-a");
  const hashB = bamSessionToken("token-b");

  assert.notEqual(hashA, hashB);
});

test("contract repository phai dung token_hash thay vi token tho", () => {
  const source = readFileSync(authRepositoryContractFile, "utf8");
  assert.match(source, /tokenHash:\s*string/);
  assert.match(source, /findSessionByTokenHash/);
  assert.match(source, /deleteSessionByTokenHash/);
  assert.ok(!/findSessionByToken\(/.test(source));
});

test("user-facing repository path khong duoc dung service role truc tiep", () => {
  const source = readFileSync(repositoryIndexFile, "utf8");
  const userPathSection = source.split("export function layAuthAdminRepository")[0];

  assert.match(userPathSection, /taoPostgresAuthRepository/);
  assert.match(userPathSection, /return cachedPostgresRepository/);
  assert.ok(!/taoSupabaseAdminAuthRepository\(/.test(userPathSection));
});

test("co tach rieng admin service-role path", () => {
  const source = readFileSync(repositoryIndexFile, "utf8");

  assert.match(source, /export function layAuthAdminRepository/);
  assert.match(source, /coSupabaseServiceRoleDuDieuKien/);
  assert.match(source, /taoSupabaseAdminAuthRepository/);
});
