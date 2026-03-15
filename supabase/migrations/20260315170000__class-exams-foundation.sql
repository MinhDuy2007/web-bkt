-- Migration: 20260315170000__class-exams-foundation.sql
-- Nguon: db/migrations/2026-03-15_17-00-00--class-exams-foundation.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

create table if not exists public.class_exams (
  id uuid primary key default gen_random_uuid(),
  exam_code text not null,
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  description text null,
  created_by_user_id uuid not null references public.user_accounts (id) on delete restrict,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_class_exams_exam_code unique (exam_code),
  constraint ck_class_exams_exam_code_format
    check (exam_code ~ '^[A-Z0-9]{6,16}$'),
  constraint ck_class_exams_title_len
    check (char_length(title) between 3 and 180),
  constraint ck_class_exams_status
    check (status in ('draft', 'published', 'archived'))
);

create index if not exists idx_class_exams_class_id
  on public.class_exams (class_id);

create index if not exists idx_class_exams_created_by_user_id
  on public.class_exams (created_by_user_id);

create index if not exists idx_class_exams_status
  on public.class_exams (status);

create table if not exists public.class_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  class_exam_id uuid not null references public.class_exams (id) on delete cascade,
  user_id uuid not null references public.user_accounts (id) on delete cascade,
  status text not null default 'started',
  started_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_class_exam_attempts_exam_user unique (class_exam_id, user_id),
  constraint ck_class_exam_attempts_status
    check (status in ('started', 'submitted')),
  constraint ck_class_exam_attempts_submitted_at
    check (
      (status = 'started' and submitted_at is null)
      or (status = 'submitted' and submitted_at is not null and submitted_at >= started_at)
    )
);

create index if not exists idx_class_exam_attempts_user_id
  on public.class_exam_attempts (user_id);

create index if not exists idx_class_exam_attempts_class_exam_id
  on public.class_exam_attempts (class_exam_id);

create index if not exists idx_class_exam_attempts_status
  on public.class_exam_attempts (status);

create or replace function public.app_is_class_member(
  p_class_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_members cm
    where cm.class_id = p_class_id
      and cm.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

drop trigger if exists tr_class_exams_set_updated_at on public.class_exams;
create trigger tr_class_exams_set_updated_at
before update on public.class_exams
for each row
execute function public.app_set_updated_at();

drop trigger if exists tr_class_exam_attempts_set_updated_at on public.class_exam_attempts;
create trigger tr_class_exam_attempts_set_updated_at
before update on public.class_exam_attempts
for each row
execute function public.app_set_updated_at();
