alter table public.classes enable row level security;
alter table public.class_members enable row level security;

drop policy if exists p_classes_select_member_teacher_or_admin on public.classes;
create policy p_classes_select_member_teacher_or_admin
on public.classes
for select
to authenticated
using (
  public.app_is_admin(auth.uid())
  or teacher_user_id = auth.uid()
  or exists (
    select 1
    from public.class_members cm
    where cm.class_id = classes.id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists p_classes_insert_teacher_approved_or_admin on public.classes;
create policy p_classes_insert_teacher_approved_or_admin
on public.classes
for insert
to authenticated
with check (
  (
    teacher_user_id = auth.uid()
    and (public.app_is_teacher_approved(auth.uid()) or public.app_is_admin(auth.uid()))
  )
);

drop policy if exists p_classes_update_teacher_owner_or_admin on public.classes;
create policy p_classes_update_teacher_owner_or_admin
on public.classes
for update
to authenticated
using (
  teacher_user_id = auth.uid() or public.app_is_admin(auth.uid())
)
with check (
  teacher_user_id = auth.uid() or public.app_is_admin(auth.uid())
);

drop policy if exists p_class_members_select_owner_teacher_or_admin on public.class_members;
create policy p_class_members_select_owner_teacher_or_admin
on public.class_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.app_is_admin(auth.uid())
  or exists (
    select 1
    from public.classes c
    where c.id = class_members.class_id
      and c.teacher_user_id = auth.uid()
  )
);

drop policy if exists p_class_members_insert_controlled_join_or_admin on public.class_members;
create policy p_class_members_insert_controlled_join_or_admin
on public.class_members
for insert
to authenticated
with check (
  public.app_is_admin(auth.uid())
  or (
    user_id = auth.uid()
    and member_role = 'student'
  )
  or (
    user_id = auth.uid()
    and member_role = 'teacher'
    and exists (
      select 1
      from public.classes c
      where c.id = class_members.class_id
        and c.teacher_user_id = auth.uid()
    )
  )
);

drop policy if exists p_class_members_delete_owner_teacher_or_admin on public.class_members;
create policy p_class_members_delete_owner_teacher_or_admin
on public.class_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.app_is_admin(auth.uid())
  or exists (
    select 1
    from public.classes c
    where c.id = class_members.class_id
      and c.teacher_user_id = auth.uid()
  )
);
