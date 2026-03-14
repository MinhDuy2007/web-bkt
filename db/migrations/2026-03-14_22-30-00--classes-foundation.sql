create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  class_code text not null,
  education_level text not null,
  subject_name text not null,
  school_name text null,
  grade_label text not null,
  full_class_name text not null,
  teacher_user_id uuid not null references public.user_accounts (id) on delete restrict,
  join_code text not null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_classes_class_code unique (class_code),
  constraint ck_classes_class_code_format
    check (class_code ~ '^[A-Z0-9]{4,16}$'),
  constraint ck_classes_join_code_format
    check (join_code ~ '^[A-Z0-9]{4,16}$'),
  constraint ck_classes_status
    check (status in ('active', 'archived')),
  constraint ck_classes_education_level_len
    check (char_length(education_level) between 2 and 64),
  constraint ck_classes_subject_name_len
    check (char_length(subject_name) between 2 and 120),
  constraint ck_classes_grade_label_len
    check (char_length(grade_label) between 1 and 64),
  constraint ck_classes_full_class_name_len
    check (char_length(full_class_name) between 3 and 160)
);

create index if not exists idx_classes_teacher_user_id
  on public.classes (teacher_user_id);

create index if not exists idx_classes_status
  on public.classes (status);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.user_accounts (id) on delete cascade,
  member_role text not null,
  joined_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint uq_class_members_class_id_user_id unique (class_id, user_id),
  constraint ck_class_members_member_role
    check (member_role in ('teacher', 'student'))
);

create index if not exists idx_class_members_user_id
  on public.class_members (user_id);

create index if not exists idx_class_members_class_id
  on public.class_members (class_id);

create or replace function public.app_is_teacher_approved(target_user_id uuid default auth.uid())
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
      and ua.teacher_verification_status = 'approved'
      and ua.roles @> array['teacher']::text[]
  );
$$;

drop trigger if exists tr_classes_set_updated_at on public.classes;
create trigger tr_classes_set_updated_at
before update on public.classes
for each row
execute function public.app_set_updated_at();
