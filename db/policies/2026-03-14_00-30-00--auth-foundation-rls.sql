alter table public.user_accounts enable row level security;
alter table public.user_profiles enable row level security;
alter table public.teacher_verification_requests enable row level security;
alter table public.teacher_verification_audit_logs enable row level security;
alter table public.app_sessions enable row level security;

drop policy if exists p_user_accounts_select_owner_or_admin on public.user_accounts;
create policy p_user_accounts_select_owner_or_admin
on public.user_accounts
for select
to authenticated
using (auth.uid() = id or public.app_is_admin(auth.uid()));

drop policy if exists p_user_accounts_update_admin_only on public.user_accounts;
create policy p_user_accounts_update_admin_only
on public.user_accounts
for update
to authenticated
using (public.app_is_admin(auth.uid()))
with check (public.app_is_admin(auth.uid()));

drop policy if exists p_user_profiles_select_owner_or_admin on public.user_profiles;
create policy p_user_profiles_select_owner_or_admin
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id or public.app_is_admin(auth.uid()));

drop policy if exists p_user_profiles_insert_owner_or_admin on public.user_profiles;
create policy p_user_profiles_insert_owner_or_admin
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = user_id or public.app_is_admin(auth.uid()));

drop policy if exists p_user_profiles_update_owner_or_admin on public.user_profiles;
create policy p_user_profiles_update_owner_or_admin
on public.user_profiles
for update
to authenticated
using (auth.uid() = user_id or public.app_is_admin(auth.uid()))
with check (auth.uid() = user_id or public.app_is_admin(auth.uid()));

drop policy if exists p_teacher_requests_select_owner_or_admin on public.teacher_verification_requests;
create policy p_teacher_requests_select_owner_or_admin
on public.teacher_verification_requests
for select
to authenticated
using (auth.uid() = user_id or public.app_is_admin(auth.uid()));

drop policy if exists p_teacher_requests_insert_owner_or_admin on public.teacher_verification_requests;
create policy p_teacher_requests_insert_owner_or_admin
on public.teacher_verification_requests
for insert
to authenticated
with check (
  (auth.uid() = user_id and status = 'pending_review' and reviewed_by is null and reviewed_at is null and admin_note is null)
  or public.app_is_admin(auth.uid())
);

drop policy if exists p_teacher_requests_update_admin_only on public.teacher_verification_requests;
create policy p_teacher_requests_update_admin_only
on public.teacher_verification_requests
for update
to authenticated
using (public.app_is_admin(auth.uid()))
with check (public.app_is_admin(auth.uid()));

drop policy if exists p_teacher_audit_logs_select_admin_only on public.teacher_verification_audit_logs;
create policy p_teacher_audit_logs_select_admin_only
on public.teacher_verification_audit_logs
for select
to authenticated
using (public.app_is_admin(auth.uid()));

drop policy if exists p_teacher_audit_logs_insert_admin_only on public.teacher_verification_audit_logs;
create policy p_teacher_audit_logs_insert_admin_only
on public.teacher_verification_audit_logs
for insert
to authenticated
with check (public.app_is_admin(auth.uid()));

drop policy if exists p_app_sessions_select_owner_or_admin on public.app_sessions;
create policy p_app_sessions_select_owner_or_admin
on public.app_sessions
for select
to authenticated
using (auth.uid() = user_id or public.app_is_admin(auth.uid()));

drop policy if exists p_app_sessions_insert_owner_or_admin on public.app_sessions;
create policy p_app_sessions_insert_owner_or_admin
on public.app_sessions
for insert
to authenticated
with check (auth.uid() = user_id or public.app_is_admin(auth.uid()));

drop policy if exists p_app_sessions_delete_owner_or_admin on public.app_sessions;
create policy p_app_sessions_delete_owner_or_admin
on public.app_sessions
for delete
to authenticated
using (auth.uid() = user_id or public.app_is_admin(auth.uid()));
