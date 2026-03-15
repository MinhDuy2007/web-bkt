-- Migration: 20260315171000__policy-class-exams-foundation-rls.sql
-- Nguon: db/policies/2026-03-15_17-10-00--class-exams-foundation-rls.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

alter table public.class_exams enable row level security;
alter table public.class_exam_attempts enable row level security;

drop policy if exists p_class_exams_select_member_teacher_or_admin on public.class_exams;
create policy p_class_exams_select_member_teacher_or_admin
on public.class_exams
for select
to authenticated
using (
  public.app_is_admin(auth.uid())
  or exists (
    select 1
    from public.classes c
    where c.id = class_exams.class_id
      and c.teacher_user_id = auth.uid()
  )
  or public.app_is_class_member(class_exams.class_id, auth.uid())
);

drop policy if exists p_class_exams_insert_teacher_owner_or_admin on public.class_exams;
create policy p_class_exams_insert_teacher_owner_or_admin
on public.class_exams
for insert
to authenticated
with check (
  public.app_is_admin(auth.uid())
  or (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.classes c
      where c.id = class_exams.class_id
        and c.teacher_user_id = auth.uid()
    )
    and public.app_is_teacher_approved(auth.uid())
  )
);

drop policy if exists p_class_exams_update_teacher_owner_or_admin on public.class_exams;
create policy p_class_exams_update_teacher_owner_or_admin
on public.class_exams
for update
to authenticated
using (
  public.app_is_admin(auth.uid())
  or (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.classes c
      where c.id = class_exams.class_id
        and c.teacher_user_id = auth.uid()
    )
  )
)
with check (
  public.app_is_admin(auth.uid())
  or (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.classes c
      where c.id = class_exams.class_id
        and c.teacher_user_id = auth.uid()
    )
  )
);

drop policy if exists p_class_exam_attempts_select_owner_teacher_or_admin on public.class_exam_attempts;
create policy p_class_exam_attempts_select_owner_teacher_or_admin
on public.class_exam_attempts
for select
to authenticated
using (
  user_id = auth.uid()
  or public.app_is_admin(auth.uid())
  or exists (
    select 1
    from public.class_exams ce
    inner join public.classes c on c.id = ce.class_id
    where ce.id = class_exam_attempts.class_exam_id
      and c.teacher_user_id = auth.uid()
  )
);

drop policy if exists p_class_exam_attempts_insert_owner_member_or_admin on public.class_exam_attempts;
create policy p_class_exam_attempts_insert_owner_member_or_admin
on public.class_exam_attempts
for insert
to authenticated
with check (
  public.app_is_admin(auth.uid())
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.class_exams ce
      where ce.id = class_exam_attempts.class_exam_id
        and ce.status = 'published'
        and public.app_is_class_member(ce.class_id, auth.uid())
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
)
with check (
  public.app_is_admin(auth.uid())
  or user_id = auth.uid()
);
