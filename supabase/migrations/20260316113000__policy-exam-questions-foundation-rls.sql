-- Migration: 20260316113000__policy-exam-questions-foundation-rls.sql
-- Nguon: db/policies/2026-03-16_11-30-00--exam-questions-foundation-rls.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

alter table public.exam_questions enable row level security;
alter table public.exam_answer_keys enable row level security;

drop policy if exists p_exam_questions_select_owner_or_admin on public.exam_questions;
create policy p_exam_questions_select_owner_or_admin
on public.exam_questions
for select
to authenticated
using (
  public.app_is_admin(auth.uid())
  or public.app_is_exam_owner(class_exam_id, auth.uid())
);

drop policy if exists p_exam_questions_insert_owner_or_admin on public.exam_questions;
create policy p_exam_questions_insert_owner_or_admin
on public.exam_questions
for insert
to authenticated
with check (
  public.app_is_admin(auth.uid())
  or (
    created_by_user_id = auth.uid()
    and public.app_is_exam_owner(class_exam_id, auth.uid())
  )
);

drop policy if exists p_exam_questions_update_owner_or_admin on public.exam_questions;
create policy p_exam_questions_update_owner_or_admin
on public.exam_questions
for update
to authenticated
using (
  public.app_is_admin(auth.uid())
  or public.app_is_exam_owner(class_exam_id, auth.uid())
)
with check (
  public.app_is_admin(auth.uid())
  or (
    created_by_user_id = auth.uid()
    and public.app_is_exam_owner(class_exam_id, auth.uid())
  )
);

drop policy if exists p_exam_questions_delete_owner_or_admin on public.exam_questions;
create policy p_exam_questions_delete_owner_or_admin
on public.exam_questions
for delete
to authenticated
using (
  public.app_is_admin(auth.uid())
  or public.app_is_exam_owner(class_exam_id, auth.uid())
);

drop policy if exists p_exam_answer_keys_select_owner_or_admin on public.exam_answer_keys;
create policy p_exam_answer_keys_select_owner_or_admin
on public.exam_answer_keys
for select
to authenticated
using (
  public.app_is_admin(auth.uid())
  or exists (
    select 1
    from public.exam_questions eq
    where eq.id = exam_answer_keys.question_id
      and public.app_is_exam_owner(eq.class_exam_id, auth.uid())
  )
);

drop policy if exists p_exam_answer_keys_insert_owner_or_admin on public.exam_answer_keys;
create policy p_exam_answer_keys_insert_owner_or_admin
on public.exam_answer_keys
for insert
to authenticated
with check (
  public.app_is_admin(auth.uid())
  or exists (
    select 1
    from public.exam_questions eq
    where eq.id = exam_answer_keys.question_id
      and public.app_is_exam_owner(eq.class_exam_id, auth.uid())
      and eq.created_by_user_id = auth.uid()
  )
);

drop policy if exists p_exam_answer_keys_update_owner_or_admin on public.exam_answer_keys;
create policy p_exam_answer_keys_update_owner_or_admin
on public.exam_answer_keys
for update
to authenticated
using (
  public.app_is_admin(auth.uid())
  or exists (
    select 1
    from public.exam_questions eq
    where eq.id = exam_answer_keys.question_id
      and public.app_is_exam_owner(eq.class_exam_id, auth.uid())
  )
)
with check (
  public.app_is_admin(auth.uid())
  or exists (
    select 1
    from public.exam_questions eq
    where eq.id = exam_answer_keys.question_id
      and public.app_is_exam_owner(eq.class_exam_id, auth.uid())
      and eq.created_by_user_id = auth.uid()
  )
);

drop policy if exists p_exam_answer_keys_delete_owner_or_admin on public.exam_answer_keys;
create policy p_exam_answer_keys_delete_owner_or_admin
on public.exam_answer_keys
for delete
to authenticated
using (
  public.app_is_admin(auth.uid())
  or exists (
    select 1
    from public.exam_questions eq
    where eq.id = exam_answer_keys.question_id
      and public.app_is_exam_owner(eq.class_exam_id, auth.uid())
  )
);
