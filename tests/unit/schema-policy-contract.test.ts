import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationFile = join(process.cwd(), "db", "migrations", "2026-03-14_00-20-00--auth-foundation.sql");
const sessionHardeningMigrationFile = join(
  process.cwd(),
  "db",
  "migrations",
  "2026-03-14_02-20-00--app-sessions-token-hash-hardening.sql",
);
const teacherGuardMigrationFile = join(
  process.cwd(),
  "db",
  "migrations",
  "2026-03-14_02-30-00--teacher-request-guard-custom-auth.sql",
);
const adminReviewMigrationFile = join(
  process.cwd(),
  "db",
  "migrations",
  "2026-03-14_11-40-00--admin-review-teacher-verification-flow.sql",
);
const classFoundationMigrationFile = join(
  process.cwd(),
  "db",
  "migrations",
  "2026-03-14_22-30-00--classes-foundation.sql",
);
const classExamsFoundationMigrationFile = join(
  process.cwd(),
  "db",
  "migrations",
  "2026-03-15_17-00-00--class-exams-foundation.sql",
);
const examQuestionsFoundationMigrationFile = join(
  process.cwd(),
  "db",
  "migrations",
  "2026-03-16_11-20-00--exam-questions-foundation.sql",
);
const policyFile = join(process.cwd(), "db", "policies", "2026-03-14_00-30-00--auth-foundation-rls.sql");
const classPolicyFile = join(
  process.cwd(),
  "db",
  "policies",
  "2026-03-14_22-40-00--classes-foundation-rls.sql",
);
const classExamsPolicyFile = join(
  process.cwd(),
  "db",
  "policies",
  "2026-03-15_17-10-00--class-exams-foundation-rls.sql",
);
const examQuestionsPolicyFile = join(
  process.cwd(),
  "db",
  "policies",
  "2026-03-16_11-30-00--exam-questions-foundation-rls.sql",
);

const migrationSql = readFileSync(migrationFile, "utf8");
const sessionHardeningMigrationSql = readFileSync(sessionHardeningMigrationFile, "utf8");
const teacherGuardMigrationSql = readFileSync(teacherGuardMigrationFile, "utf8");
const adminReviewMigrationSql = readFileSync(adminReviewMigrationFile, "utf8");
const classFoundationMigrationSql = readFileSync(classFoundationMigrationFile, "utf8");
const classExamsFoundationMigrationSql = readFileSync(classExamsFoundationMigrationFile, "utf8");
const examQuestionsFoundationMigrationSql = readFileSync(examQuestionsFoundationMigrationFile, "utf8");
const policySql = readFileSync(policyFile, "utf8");
const classPolicySql = readFileSync(classPolicyFile, "utf8");
const classExamsPolicySql = readFileSync(classExamsPolicyFile, "utf8");
const examQuestionsPolicySql = readFileSync(examQuestionsPolicyFile, "utf8");

test("migration phai co cac bang auth nen tang", () => {
  assert.match(migrationSql, /create table if not exists public\.user_accounts/i);
  assert.match(migrationSql, /create table if not exists public\.user_profiles/i);
  assert.match(migrationSql, /create table if not exists public\.teacher_verification_requests/i);
  assert.match(migrationSql, /create table if not exists public\.teacher_verification_audit_logs/i);
  assert.match(migrationSql, /create table if not exists public\.app_sessions/i);
});

test("migration hardening phai ep app_sessions luu token_hash", () => {
  assert.match(sessionHardeningMigrationSql, /rename column token to token_hash/i);
  assert.match(sessionHardeningMigrationSql, /primary key \(token_hash\)/i);
  assert.match(sessionHardeningMigrationSql, /char_length\(token_hash\) = 64/i);
});

test("migration guard teacher request phai support custom auth path", () => {
  assert.match(teacherGuardMigrationSql, /auth\.uid\(\) is null or not public\.app_is_admin/i);
  assert.match(teacherGuardMigrationSql, /new\.status = 'pending_review'/i);
  assert.match(teacherGuardMigrationSql, /reviewed_by = null/i);
});

test("migration admin review phai co ham xu ly dong bo request va account", () => {
  assert.match(adminReviewMigrationSql, /create or replace function public\.app_admin_review_teacher_verification/i);
  assert.match(adminReviewMigrationSql, /raise exception 'ADMIN_PERMISSION_REQUIRED'/i);
  assert.match(adminReviewMigrationSql, /raise exception 'REQUEST_ALREADY_REVIEWED'/i);
  assert.match(adminReviewMigrationSql, /teacher_verification_status = v_next_status/i);
  assert.match(adminReviewMigrationSql, /status = v_next_status/i);
});

test("migration classes phai co bang classes va class_members", () => {
  assert.match(classFoundationMigrationSql, /create table if not exists public\.classes/i);
  assert.match(classFoundationMigrationSql, /create table if not exists public\.class_members/i);
  assert.match(classFoundationMigrationSql, /uq_classes_class_code/i);
  assert.match(classFoundationMigrationSql, /uq_class_members_class_id_user_id/i);
  assert.match(classFoundationMigrationSql, /app_is_teacher_approved/i);
});

test("migration class exams phai co bang class_exams va class_exam_attempts", () => {
  assert.match(classExamsFoundationMigrationSql, /create table if not exists public\.class_exams/i);
  assert.match(
    classExamsFoundationMigrationSql,
    /create table if not exists public\.class_exam_attempts/i,
  );
  assert.match(classExamsFoundationMigrationSql, /uq_class_exams_exam_code/i);
  assert.match(classExamsFoundationMigrationSql, /uq_class_exam_attempts_exam_user/i);
  assert.match(classExamsFoundationMigrationSql, /app_is_class_member/i);
});

test("migration exam questions phai co bang exam_questions va exam_answer_keys", () => {
  assert.match(
    examQuestionsFoundationMigrationSql,
    /create table if not exists public\.exam_questions/i,
  );
  assert.match(
    examQuestionsFoundationMigrationSql,
    /create table if not exists public\.exam_answer_keys/i,
  );
  assert.match(examQuestionsFoundationMigrationSql, /uq_exam_questions_exam_order/i);
  assert.match(examQuestionsFoundationMigrationSql, /uq_exam_answer_keys_question_id/i);
  assert.match(examQuestionsFoundationMigrationSql, /app_is_exam_owner/i);
  assert.match(examQuestionsFoundationMigrationSql, /app_guard_exam_answer_key_type/i);
});

test("migration admin review phai ghi actor audit tu reviewed_by khi auth.uid null", () => {
  assert.match(adminReviewMigrationSql, /coalesce\(auth\.uid\(\), new\.reviewed_by, old\.reviewed_by, new\.user_id\)/i);
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
  assert.ok(!/using\s*\(\s*true\s*\)/i.test(classPolicySql));
  assert.ok(!/with check\s*\(\s*true\s*\)/i.test(classPolicySql));
  assert.ok(!/using\s*\(\s*true\s*\)/i.test(classExamsPolicySql));
  assert.ok(!/with check\s*\(\s*true\s*\)/i.test(classExamsPolicySql));
  assert.ok(!/using\s*\(\s*true\s*\)/i.test(examQuestionsPolicySql));
  assert.ok(!/with check\s*\(\s*true\s*\)/i.test(examQuestionsPolicySql));
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

test("policy classes phai khoa tao lop va membership theo ownership", () => {
  assert.match(classPolicySql, /p_classes_insert_teacher_approved_or_admin/i);
  assert.match(classPolicySql, /app_is_teacher_approved/i);
  assert.match(classPolicySql, /p_class_members_insert_controlled_join_or_admin/i);
  assert.match(classPolicySql, /member_role = 'student'/i);
});

test("policy class exams phai khoa tao de va vao bai theo ownership membership", () => {
  assert.match(classExamsPolicySql, /p_class_exams_insert_teacher_owner_or_admin/i);
  assert.match(classExamsPolicySql, /app_is_teacher_approved/i);
  assert.match(classExamsPolicySql, /p_class_exam_attempts_insert_owner_member_or_admin/i);
  assert.match(classExamsPolicySql, /ce\.status = 'published'/i);
  assert.match(classExamsPolicySql, /app_is_class_member/i);
});

test("policy exam questions phai khoa ownership exam content", () => {
  assert.match(examQuestionsPolicySql, /p_exam_questions_insert_owner_or_admin/i);
  assert.match(examQuestionsPolicySql, /p_exam_questions_update_owner_or_admin/i);
  assert.match(examQuestionsPolicySql, /p_exam_answer_keys_insert_owner_or_admin/i);
  assert.match(examQuestionsPolicySql, /p_exam_answer_keys_update_owner_or_admin/i);
  assert.match(examQuestionsPolicySql, /app_is_exam_owner/i);
});
