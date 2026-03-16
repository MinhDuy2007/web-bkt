alter table public.class_exam_attempts
  add column if not exists auto_graded_score numeric(10, 2),
  add column if not exists max_auto_graded_score numeric(10, 2),
  add column if not exists pending_manual_grading_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_class_exam_attempts_auto_score_non_negative'
      and conrelid = 'public.class_exam_attempts'::regclass
  ) then
    alter table public.class_exam_attempts
      add constraint ck_class_exam_attempts_auto_score_non_negative
      check (auto_graded_score is null or auto_graded_score >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_class_exam_attempts_max_auto_score_non_negative'
      and conrelid = 'public.class_exam_attempts'::regclass
  ) then
    alter table public.class_exam_attempts
      add constraint ck_class_exam_attempts_max_auto_score_non_negative
      check (max_auto_graded_score is null or max_auto_graded_score >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_class_exam_attempts_pending_manual_non_negative'
      and conrelid = 'public.class_exam_attempts'::regclass
  ) then
    alter table public.class_exam_attempts
      add constraint ck_class_exam_attempts_pending_manual_non_negative
      check (pending_manual_grading_count >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_class_exam_attempts_score_consistency'
      and conrelid = 'public.class_exam_attempts'::regclass
  ) then
    alter table public.class_exam_attempts
      add constraint ck_class_exam_attempts_score_consistency
      check (
        auto_graded_score is null
        or max_auto_graded_score is null
        or auto_graded_score <= max_auto_graded_score
      );
  end if;
end
$$;

create table if not exists public.class_exam_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.class_exam_attempts (id) on delete cascade,
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  answer_text text null,
  answer_json jsonb not null default '{}'::jsonb,
  awarded_points numeric(8, 2) null,
  scored_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_class_exam_attempt_answers_attempt_question unique (attempt_id, question_id),
  constraint ck_class_exam_attempt_answers_answer_json_object
    check (jsonb_typeof(answer_json) = 'object'),
  constraint ck_class_exam_attempt_answers_awarded_points
    check (awarded_points is null or (awarded_points >= 0 and awarded_points <= 1000))
);

create index if not exists idx_class_exam_attempt_answers_attempt_id
  on public.class_exam_attempt_answers (attempt_id);

create index if not exists idx_class_exam_attempt_answers_question_id
  on public.class_exam_attempt_answers (question_id);

create or replace function public.app_is_attempt_owner(
  p_attempt_id uuid,
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
    from public.class_exam_attempts cea
    where cea.id = p_attempt_id
      and cea.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.app_guard_attempt_answer_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_status text;
  v_attempt_exam_id uuid;
  v_question_exam_id uuid;
begin
  select cea.status, cea.class_exam_id
  into v_attempt_status, v_attempt_exam_id
  from public.class_exam_attempts cea
  where cea.id = new.attempt_id;

  if v_attempt_exam_id is null then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;

  if v_attempt_status <> 'started' then
    raise exception 'ATTEMPT_ALREADY_SUBMITTED';
  end if;

  select eq.class_exam_id
  into v_question_exam_id
  from public.exam_questions eq
  where eq.id = new.question_id;

  if v_question_exam_id is null or v_question_exam_id <> v_attempt_exam_id then
    raise exception 'ATTEMPT_QUESTION_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_class_exam_attempt_answers_set_updated_at on public.class_exam_attempt_answers;
create trigger tr_class_exam_attempt_answers_set_updated_at
before update on public.class_exam_attempt_answers
for each row
execute function public.app_set_updated_at();

drop trigger if exists tr_class_exam_attempt_answers_guard_consistency on public.class_exam_attempt_answers;
create trigger tr_class_exam_attempt_answers_guard_consistency
before insert or update on public.class_exam_attempt_answers
for each row
execute function public.app_guard_attempt_answer_consistency();
