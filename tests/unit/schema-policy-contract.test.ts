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
const examAttemptAnswersMigrationFile = join(
  process.cwd(),
  "db",
  "migrations",
  "2026-03-16_12-10-00--exam-attempt-answers-and-scoring-foundation.sql",
);
const manualGradingMigrationFile = join(
  process.cwd(),
  "db",
  "migrations",
  "2026-03-17_09-10-00--manual-grading-foundation.sql",
);
const aiAssistedGradingMigrationFile = join(
  process.cwd(),
  "db",
  "migrations",
  "2026-03-17_11-10-00--essay-ai-grading-suggestions-foundation.sql",
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
const examAttemptAnswersPolicyFile = join(
  process.cwd(),
  "db",
  "policies",
  "2026-03-16_12-20-00--exam-attempt-answers-and-scoring-foundation-rls.sql",
);
const manualGradingPolicyFile = join(
  process.cwd(),
  "db",
  "policies",
  "2026-03-17_09-20-00--manual-grading-foundation-rls.sql",
);
const aiAssistedGradingPolicyFile = join(
  process.cwd(),
  "db",
  "policies",
  "2026-03-17_11-20-00--essay-ai-grading-suggestions-foundation-rls.sql",
);

const migrationSql = readFileSync(migrationFile, "utf8");
const sessionHardeningMigrationSql = readFileSync(sessionHardeningMigrationFile, "utf8");
const teacherGuardMigrationSql = readFileSync(teacherGuardMigrationFile, "utf8");
const adminReviewMigrationSql = readFileSync(adminReviewMigrationFile, "utf8");
const classFoundationMigrationSql = readFileSync(classFoundationMigrationFile, "utf8");
const classExamsFoundationMigrationSql = readFileSync(classExamsFoundationMigrationFile, "utf8");
const examQuestionsFoundationMigrationSql = readFileSync(examQuestionsFoundationMigrationFile, "utf8");
const examAttemptAnswersMigrationSql = readFileSync(examAttemptAnswersMigrationFile, "utf8");
const manualGradingMigrationSql = readFileSync(manualGradingMigrationFile, "utf8");
const aiAssistedGradingMigrationSql = readFileSync(aiAssistedGradingMigrationFile, "utf8");
const policySql = readFileSync(policyFile, "utf8");
const classPolicySql = readFileSync(classPolicyFile, "utf8");
const classExamsPolicySql = readFileSync(classExamsPolicyFile, "utf8");
const examQuestionsPolicySql = readFileSync(examQuestionsPolicyFile, "utf8");
const examAttemptAnswersPolicySql = readFileSync(examAttemptAnswersPolicyFile, "utf8");
const manualGradingPolicySql = readFileSync(manualGradingPolicyFile, "utf8");
const aiAssistedGradingPolicySql = readFileSync(aiAssistedGradingPolicyFile, "utf8");

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

test("migration attempt answers phai co bang tra loi va cot scoring attempt", () => {
  assert.match(
    examAttemptAnswersMigrationSql,
    /create table if not exists public\.class_exam_attempt_answers/i,
  );
  assert.match(
    examAttemptAnswersMigrationSql,
    /add column if not exists auto_graded_score numeric\(10, 2\)/i,
  );
  assert.match(
    examAttemptAnswersMigrationSql,
    /add column if not exists max_auto_graded_score numeric\(10, 2\)/i,
  );
  assert.match(
    examAttemptAnswersMigrationSql,
    /add column if not exists pending_manual_grading_count integer/i,
  );
  assert.match(examAttemptAnswersMigrationSql, /uq_class_exam_attempt_answers_attempt_question/i);
  assert.match(examAttemptAnswersMigrationSql, /app_is_attempt_owner/i);
  assert.match(examAttemptAnswersMigrationSql, /app_guard_attempt_answer_consistency/i);
});

test("migration manual grading phai mo rong attempt va answer cho cham tay", () => {
  assert.match(manualGradingMigrationSql, /add column if not exists final_score numeric\(10, 2\)/i);
  assert.match(manualGradingMigrationSql, /add column if not exists manual_awarded_points numeric\(8, 2\)/i);
  assert.match(manualGradingMigrationSql, /add column if not exists grading_note text null/i);
  assert.match(manualGradingMigrationSql, /add column if not exists graded_by uuid null/i);
  assert.match(manualGradingMigrationSql, /create or replace function public\.app_is_exam_owner_by_attempt_answer/i);
  assert.match(manualGradingMigrationSql, /create or replace function public\.app_is_exam_owner_by_attempt/i);
});

test("migration AI-assisted grading phai co bang goi y va trigger guard essay", () => {
  assert.match(aiAssistedGradingMigrationSql, /create table if not exists public\.ai_grading_suggestions/i);
  assert.match(
    aiAssistedGradingMigrationSql,
    /uq_ai_grading_suggestions_one_pending_per_answer/i,
  );
  assert.match(
    aiAssistedGradingMigrationSql,
    /status in \('pending', 'accepted', 'rejected', 'superseded'\)/i,
  );
  assert.match(
    aiAssistedGradingMigrationSql,
    /create or replace function public\.app_is_exam_owner_by_ai_suggestion/i,
  );
  assert.match(
    aiAssistedGradingMigrationSql,
    /create or replace function public\.app_guard_ai_grading_suggestion_consistency/i,
  );
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
  assert.ok(!/using\s*\(\s*true\s*\)/i.test(examAttemptAnswersPolicySql));
  assert.ok(!/with check\s*\(\s*true\s*\)/i.test(examAttemptAnswersPolicySql));
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

test("policy attempt answers phai khoa owner attempt va started status", () => {
  assert.match(
    examAttemptAnswersPolicySql,
    /p_class_exam_attempt_answers_select_owner_or_admin/i,
  );
  assert.match(
    examAttemptAnswersPolicySql,
    /p_class_exam_attempt_answers_insert_owner_started_or_admin/i,
  );
  assert.match(
    examAttemptAnswersPolicySql,
    /p_class_exam_attempt_answers_update_owner_started_or_admin/i,
  );
  assert.match(
    examAttemptAnswersPolicySql,
    /p_class_exam_attempt_answers_delete_owner_started_or_admin/i,
  );
  assert.match(examAttemptAnswersPolicySql, /app_is_attempt_owner/i);
  assert.match(examAttemptAnswersPolicySql, /cea\.status = 'started'/i);
});

test("policy manual grading phai cho owner exam cham essay va cap nhat attempt submitted", () => {
  assert.match(manualGradingPolicySql, /app_is_exam_owner_by_attempt_answer/i);
  assert.match(manualGradingPolicySql, /eq\.question_type = 'essay_placeholder'/i);
  assert.match(manualGradingPolicySql, /app_is_exam_owner_by_attempt\(id, auth\.uid\(\)\)/i);
  assert.match(manualGradingPolicySql, /status = 'submitted'/i);
});

test("policy AI-assisted grading phai khoa suggestion theo owner exam hoac admin", () => {
  assert.match(aiAssistedGradingPolicySql, /p_ai_grading_suggestions_select_owner_or_admin/i);
  assert.match(aiAssistedGradingPolicySql, /p_ai_grading_suggestions_insert_owner_or_admin/i);
  assert.match(aiAssistedGradingPolicySql, /p_ai_grading_suggestions_update_owner_or_admin/i);
  assert.match(aiAssistedGradingPolicySql, /app_is_exam_owner_by_ai_suggestion/i);
  assert.match(aiAssistedGradingPolicySql, /app_is_exam_owner_by_attempt_answer/i);
});
