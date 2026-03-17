-- Migration: 20260317112000__policy-essay-ai-grading-suggestions-foundation-rls.sql
-- Nguon: db/policies/2026-03-17_11-20-00--essay-ai-grading-suggestions-foundation-rls.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

alter table public.ai_grading_suggestions enable row level security;

drop policy if exists p_ai_grading_suggestions_select_owner_or_admin on public.ai_grading_suggestions;
create policy p_ai_grading_suggestions_select_owner_or_admin
on public.ai_grading_suggestions
for select
to authenticated
using (
  public.app_is_admin(auth.uid())
  or public.app_is_exam_owner_by_ai_suggestion(id, auth.uid())
);

drop policy if exists p_ai_grading_suggestions_insert_owner_or_admin on public.ai_grading_suggestions;
create policy p_ai_grading_suggestions_insert_owner_or_admin
on public.ai_grading_suggestions
for insert
to authenticated
with check (
  public.app_is_admin(auth.uid())
  or public.app_is_exam_owner_by_attempt_answer(answer_id, auth.uid())
);

drop policy if exists p_ai_grading_suggestions_update_owner_or_admin on public.ai_grading_suggestions;
create policy p_ai_grading_suggestions_update_owner_or_admin
on public.ai_grading_suggestions
for update
to authenticated
using (
  public.app_is_admin(auth.uid())
  or public.app_is_exam_owner_by_ai_suggestion(id, auth.uid())
)
with check (
  public.app_is_admin(auth.uid())
  or public.app_is_exam_owner_by_ai_suggestion(id, auth.uid())
);
