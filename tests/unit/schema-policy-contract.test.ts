import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationFile = join(process.cwd(), "db", "migrations", "2026-03-14_00-20-00--auth-foundation.sql");
const policyFile = join(process.cwd(), "db", "policies", "2026-03-14_00-30-00--auth-foundation-rls.sql");

const migrationSql = readFileSync(migrationFile, "utf8");
const policySql = readFileSync(policyFile, "utf8");

test("migration phai co cac bang auth nen tang", () => {
  assert.match(migrationSql, /create table if not exists public\.user_accounts/i);
  assert.match(migrationSql, /create table if not exists public\.user_profiles/i);
  assert.match(migrationSql, /create table if not exists public\.teacher_verification_requests/i);
  assert.match(migrationSql, /create table if not exists public\.teacher_verification_audit_logs/i);
  assert.match(migrationSql, /create table if not exists public\.app_sessions/i);
});

test("migration phai khoa ro cac trang thai va role nhay cam", () => {
  assert.match(migrationSql, /account_status in \('active', 'suspended', 'pending'\)/i);
  assert.match(migrationSql, /identity_status in \('unverified', 'basic_verified'\)/i);
  assert.match(
    migrationSql,
    /teacher_verification_status in \('none', 'pending_review', 'approved', 'rejected'\)/i,
  );
  assert.match(
    migrationSql,
    /roles <@ array\['admin', 'teacher', 'student', 'user'\]::text\[\]/i,
  );
});

test("policy khong duoc mo rong kieu using true", () => {
  assert.ok(!/using\s*\(\s*true\s*\)/i.test(policySql));
  assert.ok(!/with check\s*\(\s*true\s*\)/i.test(policySql));
});

test("policy teacher verification phai chan user tu set duyet", () => {
  assert.match(policySql, /p_teacher_requests_insert_owner_or_admin/i);
  assert.match(policySql, /status = 'pending_review'/i);
  assert.match(policySql, /reviewed_by is null/i);
  assert.match(policySql, /reviewed_at is null/i);
  assert.match(policySql, /admin_note is null/i);
  assert.match(policySql, /p_teacher_requests_update_admin_only/i);
});

test("policy user accounts phai khoa update cho admin", () => {
  assert.match(policySql, /p_user_accounts_update_admin_only/i);
  assert.match(policySql, /public\.app_is_admin\(auth\.uid\(\)\)/i);
});

