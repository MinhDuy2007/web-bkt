-- Migration: 20260314114000__admin-review-teacher-verification-flow.sql
-- Nguon: db/migrations/2026-03-14_11-40-00--admin-review-teacher-verification-flow.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

create or replace function public.app_log_teacher_verification_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    insert into public.teacher_verification_audit_logs (
      request_id,
      user_id,
      actor_user_id,
      action,
      old_status,
      new_status,
      metadata
    )
    values (
      new.id,
      new.user_id,
      coalesce(auth.uid(), new.user_id),
      'submitted',
      null,
      new.status,
      jsonb_build_object('source', 'trigger_insert')
    );
    return new;
  end if;

  if new.status <> old.status then
    if new.status = 'approved' then
      v_action = 'approved';
    elsif new.status = 'rejected' then
      v_action = 'rejected';
    else
      v_action = 'updated';
    end if;
  else
    v_action = 'updated';
  end if;

  insert into public.teacher_verification_audit_logs (
    request_id,
    user_id,
    actor_user_id,
    action,
    old_status,
    new_status,
    metadata
  )
  values (
    new.id,
    new.user_id,
    coalesce(auth.uid(), new.reviewed_by, old.reviewed_by, new.user_id),
    v_action,
    old.status,
    new.status,
    jsonb_build_object('source', 'trigger_update')
  );

  return new;
end;
$$;

create or replace function public.app_admin_review_teacher_verification(
  p_request_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_admin_note text default null
)
returns table (
  request_row jsonb,
  account_row jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.user_accounts%rowtype;
  v_request public.teacher_verification_requests%rowtype;
  v_updated_request public.teacher_verification_requests%rowtype;
  v_target_account public.user_accounts%rowtype;
  v_updated_account public.user_accounts%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_next_status text;
  v_next_roles text[];
begin
  if p_action = 'approve' then
    v_next_status := 'approved';
  elsif p_action = 'reject' then
    v_next_status := 'rejected';
  else
    raise exception 'INVALID_REVIEW_ACTION';
  end if;

  select *
  into v_actor
  from public.user_accounts
  where id = p_actor_user_id
  for update;

  if not found then
    raise exception 'ADMIN_ACTOR_NOT_FOUND';
  end if;

  if v_actor.account_status <> 'active'
    or not (v_actor.roles @> array['admin']::text[]) then
    raise exception 'ADMIN_PERMISSION_REQUIRED';
  end if;

  select *
  into v_request
  from public.teacher_verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_request.status <> 'pending_review' then
    raise exception 'REQUEST_ALREADY_REVIEWED';
  end if;

  select *
  into v_target_account
  from public.user_accounts
  where id = v_request.user_id
  for update;

  if not found then
    raise exception 'TARGET_ACCOUNT_NOT_FOUND';
  end if;

  if v_next_status = 'approved' then
    if v_target_account.roles @> array['teacher']::text[] then
      v_next_roles := v_target_account.roles;
    else
      v_next_roles := v_target_account.roles || array['teacher']::text[];
    end if;
  else
    v_next_roles := array_remove(v_target_account.roles, 'teacher');
    if cardinality(v_next_roles) = 0 then
      v_next_roles := array['user']::text[];
    end if;
  end if;

  update public.teacher_verification_requests
  set
    status = v_next_status,
    reviewed_by = p_actor_user_id,
    reviewed_at = v_now,
    admin_note = nullif(trim(p_admin_note), ''),
    updated_at = v_now
  where id = v_request.id
  returning *
  into v_updated_request;

  update public.user_accounts
  set
    teacher_verification_status = v_next_status,
    roles = v_next_roles,
    updated_at = v_now
  where id = v_target_account.id
  returning *
  into v_updated_account;

  return query
  select
    to_jsonb(v_updated_request),
    to_jsonb(v_updated_account);
end;
$$;
