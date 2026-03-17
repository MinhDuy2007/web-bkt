-- Migration: 20260317092000__policy-manual-grading-foundation-rls.sql
-- Nguon: db/policies/2026-03-17_09-20-00--manual-grading-foundation-rls.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

drop policy if exists p_class_exam_attempt_answers_select_owner_or_admin on public.class_exam_attempt_answers;
create policy p_class_exam_attempt_answers_select_owner_or_admin
on public.class_exam_attempt_answers
for select
to authenticated
using (
  public.app_is_admin(auth.uid())
  or public.app_is_attempt_owner(attempt_id, auth.uid())
  or public.app_is_exam_owner_by_attempt_answer(id, auth.uid())
);

drop policy if exists p_class_exam_attempt_answers_update_owner_started_or_admin on public.class_exam_attempt_answers;
create policy p_class_exam_attempt_answers_update_owner_started_or_admin
on public.class_exam_attempt_answers
for update
to authenticated
using (
  public.app_is_admin(auth.uid())
  or (
    public.app_is_attempt_owner(attempt_id, auth.uid())
    and exists (
      select 1
      from public.class_exam_attempts cea
      where cea.id = class_exam_attempt_answers.attempt_id
        and cea.status = 'started'
    )
  )
  or (
    public.app_is_exam_owner_by_attempt_answer(id, auth.uid())
    and exists (
      select 1
      from public.class_exam_attempts cea
      inner join public.exam_questions eq on eq.id = class_exam_attempt_answers.question_id
      where cea.id = class_exam_attempt_answers.attempt_id
        and cea.status = 'submitted'
        and eq.question_type = 'essay_placeholder'
    )
  )
)
with check (
  public.app_is_admin(auth.uid())
  or (
    public.app_is_attempt_owner(attempt_id, auth.uid())
    and exists (
      select 1
      from public.class_exam_attempts cea
      where cea.id = class_exam_attempt_answers.attempt_id
        and cea.status = 'started'
    )
  )
  or (
    public.app_is_exam_owner_by_attempt_answer(id, auth.uid())
    and exists (
      select 1
      from public.class_exam_attempts cea
      inner join public.exam_questions eq on eq.id = class_exam_attempt_answers.question_id
      where cea.id = class_exam_attempt_answers.attempt_id
        and cea.status = 'submitted'
        and eq.question_type = 'essay_placeholder'
    )
  )
);

drop policy if exists p_class_exam_attempts_update_owner_or_admin on public.class_exam_attempts;
create policy p_class_exam_attempts_update_owner_or_admin
on public.class_exam_attempts
for update
to authenticated
using (
  public.app_is_admin(auth.uid())
  or user_id = auth.uid()
  or (
    public.app_is_exam_owner_by_attempt(id, auth.uid())
    and status = 'submitted'
  )
)
with check (
  public.app_is_admin(auth.uid())
  or user_id = auth.uid()
  or (
    public.app_is_exam_owner_by_attempt(id, auth.uid())
    and status = 'submitted'
  )
);
