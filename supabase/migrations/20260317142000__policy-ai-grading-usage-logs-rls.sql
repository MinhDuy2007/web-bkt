-- Migration: 20260317142000__policy-ai-grading-usage-logs-rls.sql
-- Nguon: db/policies/2026-03-17_14-20-00--ai-grading-usage-logs-rls.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

alter table public.ai_grading_usage_logs enable row level security;

drop policy if exists p_ai_grading_usage_logs_select_owner_or_admin on public.ai_grading_usage_logs;
create policy p_ai_grading_usage_logs_select_owner_or_admin
on public.ai_grading_usage_logs
for select
to authenticated
using (
  public.app_is_admin(auth.uid())
  or public.app_is_exam_owner_by_attempt_answer(answer_id, auth.uid())
);

drop policy if exists p_ai_grading_usage_logs_insert_owner_or_admin on public.ai_grading_usage_logs;
create policy p_ai_grading_usage_logs_insert_owner_or_admin
on public.ai_grading_usage_logs
for insert
to authenticated
with check (
  public.app_is_admin(auth.uid())
  or public.app_is_exam_owner_by_attempt_answer(answer_id, auth.uid())
);
