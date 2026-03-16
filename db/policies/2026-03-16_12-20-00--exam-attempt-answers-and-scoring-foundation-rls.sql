alter table public.class_exam_attempt_answers enable row level security;

drop policy if exists p_class_exam_attempt_answers_select_owner_or_admin on public.class_exam_attempt_answers;
create policy p_class_exam_attempt_answers_select_owner_or_admin
on public.class_exam_attempt_answers
for select
to authenticated
using (
  public.app_is_admin(auth.uid())
  or public.app_is_attempt_owner(attempt_id, auth.uid())
);

drop policy if exists p_class_exam_attempt_answers_insert_owner_started_or_admin on public.class_exam_attempt_answers;
create policy p_class_exam_attempt_answers_insert_owner_started_or_admin
on public.class_exam_attempt_answers
for insert
to authenticated
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
);

drop policy if exists p_class_exam_attempt_answers_update_owner_started_or_admin on public.class_exam_attempt_answers;
create policy p_class_exam_attempt_answers_update_owner_started_or_admin
on public.class_exam_attempt_answers
for update
to authenticated
using (
  public.app_is_admin(auth.uid())
  or public.app_is_attempt_owner(attempt_id, auth.uid())
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
);

drop policy if exists p_class_exam_attempt_answers_delete_owner_started_or_admin on public.class_exam_attempt_answers;
create policy p_class_exam_attempt_answers_delete_owner_started_or_admin
on public.class_exam_attempt_answers
for delete
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
);
