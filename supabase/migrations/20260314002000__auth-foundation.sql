-- Migration: 20260314002000__auth-foundation.sql
-- Nguon: db/migrations/2026-03-14_00-20-00--auth-foundation.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

create extension if not exists pgcrypto;

create table if not exists public.user_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  roles text[] not null default array['user', 'student']::text[],
  account_status text not null default 'active',
  identity_status text not null default 'unverified',
  teacher_verification_status text not null default 'none',
  created_by_user_id uuid null references public.user_accounts (id) on delete set null,
  last_login_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ck_user_accounts_roles
    check (
      cardinality(roles) > 0
      and roles <@ array['admin', 'teacher', 'student', 'user']::text[]
    ),
  constraint ck_user_accounts_account_status
    check (account_status in ('active', 'suspended', 'pending')),
  constraint ck_user_accounts_identity_status
    check (identity_status in ('unverified', 'basic_verified')),
  constraint ck_user_accounts_teacher_status
    check (teacher_verification_status in ('none', 'pending_review', 'approved', 'rejected')),
  constraint ck_user_accounts_teacher_approved_role
    check (
      teacher_verification_status <> 'approved'
      or roles @> array['teacher']::text[]
    )
);

create unique index if not exists uq_user_accounts_email_lower
  on public.user_accounts ((lower(email)));

create table if not exists public.user_profiles (
  user_id uuid primary key references public.user_accounts (id) on delete cascade,
  display_name text not null,
  full_name text not null,
  birth_year integer null,
  school_name text null,
  bio text null,
  avatar_url text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ck_user_profiles_display_name_len
    check (char_length(display_name) between 2 and 64),
  constraint ck_user_profiles_full_name_len
    check (char_length(full_name) between 2 and 128),
  constraint ck_user_profiles_birth_year
    check (
      birth_year is null
      or birth_year between 1900 and extract(year from timezone('utc', now()))::int
    )
);

create table if not exists public.teacher_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_accounts (id) on delete cascade,
  full_name text not null,
  school_name text not null,
  teaching_subjects text[] not null,
  evidence_note text not null,
  evidence_urls text[] not null default array[]::text[],
  status text not null default 'pending_review',
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_by uuid null references public.user_accounts (id) on delete set null,
  reviewed_at timestamptz null,
  admin_note text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_teacher_verification_requests_user_id unique (user_id),
  constraint ck_teacher_verification_requests_status
    check (status in ('pending_review', 'approved', 'rejected')),
  constraint ck_teacher_verification_requests_subjects
    check (cardinality(teaching_subjects) > 0),
  constraint ck_teacher_verification_requests_review_fields
    check (
      (status = 'pending_review' and reviewed_by is null and reviewed_at is null)
      or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    )
);

create index if not exists idx_teacher_verification_requests_status
  on public.teacher_verification_requests (status);

create table if not exists public.teacher_verification_audit_logs (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.teacher_verification_requests (id) on delete cascade,
  user_id uuid not null references public.user_accounts (id) on delete cascade,
  actor_user_id uuid null references public.user_accounts (id) on delete set null,
  action text not null,
  old_status text null,
  new_status text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ck_teacher_verification_audit_logs_action
    check (action in ('submitted', 'approved', 'rejected', 'updated')),
  constraint ck_teacher_verification_audit_logs_old_status
    check (old_status is null or old_status in ('pending_review', 'approved', 'rejected')),
  constraint ck_teacher_verification_audit_logs_new_status
    check (new_status is null or new_status in ('pending_review', 'approved', 'rejected'))
);

create index if not exists idx_teacher_verification_audit_logs_request_id
  on public.teacher_verification_audit_logs (request_id);

create table if not exists public.app_sessions (
  token text primary key,
  user_id uuid not null references public.user_accounts (id) on delete cascade,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ck_app_sessions_expiration check (expires_at > issued_at)
);

create index if not exists idx_app_sessions_user_id
  on public.app_sessions (user_id);

create index if not exists idx_app_sessions_expires_at
  on public.app_sessions (expires_at);

create or replace function public.app_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.app_is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

create or replace function public.app_is_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_accounts ua
    where ua.id = coalesce(target_user_id, auth.uid())
      and ua.account_status = 'active'
      and ua.roles @> array['admin']::text[]
  );
$$;

create or replace function public.app_guard_teacher_verification_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_is_service_role() then
    new.updated_at = timezone('utc', now());
    return new;
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Phai dang nhap de gui yeu cau xac minh giao vien';
    end if;

    if not public.app_is_admin(auth.uid()) then
      if new.user_id <> auth.uid() then
        raise exception 'Khong duoc gui yeu cau cho tai khoan khac';
      end if;
      new.status = 'pending_review';
      new.reviewed_by = null;
      new.reviewed_at = null;
      new.admin_note = null;
      new.submitted_at = coalesce(new.submitted_at, timezone('utc', now()));
    end if;
  else
    if not public.app_is_admin(auth.uid()) then
      raise exception 'Chi admin moi duoc cap nhat ket qua review';
    end if;

    if new.status = 'pending_review' then
      new.reviewed_by = null;
      new.reviewed_at = null;
    elsif new.reviewed_by is null or new.reviewed_at is null then
      raise exception 'Trang thai review yeu cau reviewed_by va reviewed_at';
    end if;
  end if;

  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

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
    coalesce(auth.uid(), old.reviewed_by, new.user_id),
    v_action,
    old.status,
    new.status,
    jsonb_build_object('source', 'trigger_update')
  );

  return new;
end;
$$;

drop trigger if exists tr_user_accounts_set_updated_at on public.user_accounts;
create trigger tr_user_accounts_set_updated_at
before update on public.user_accounts
for each row
execute function public.app_set_updated_at();

drop trigger if exists tr_user_profiles_set_updated_at on public.user_profiles;
create trigger tr_user_profiles_set_updated_at
before update on public.user_profiles
for each row
execute function public.app_set_updated_at();

drop trigger if exists tr_teacher_verification_requests_guard on public.teacher_verification_requests;
create trigger tr_teacher_verification_requests_guard
before insert or update on public.teacher_verification_requests
for each row
execute function public.app_guard_teacher_verification_request();

drop trigger if exists tr_teacher_verification_requests_audit on public.teacher_verification_requests;
create trigger tr_teacher_verification_requests_audit
after insert or update on public.teacher_verification_requests
for each row
execute function public.app_log_teacher_verification_event();
