-- Migration: 20260317111000__essay-ai-grading-suggestions-foundation.sql
-- Nguon: db/migrations/2026-03-17_11-10-00--essay-ai-grading-suggestions-foundation.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

create table if not exists public.ai_grading_suggestions (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.class_exam_attempt_answers (id) on delete cascade,
  suggested_points numeric(8, 2) not null,
  suggested_feedback text null,
  confidence_score numeric(5, 2) null,
  provider_kind text not null,
  model_name text not null,
  prompt_version text null,
  status text not null default 'pending',
  response_json jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null,
  reviewed_by uuid null references public.user_accounts (id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists idx_ai_grading_suggestions_answer_id
  on public.ai_grading_suggestions (answer_id);

create index if not exists idx_ai_grading_suggestions_status_generated_at
  on public.ai_grading_suggestions (status, generated_at desc);

create unique index if not exists uq_ai_grading_suggestions_one_pending_per_answer
  on public.ai_grading_suggestions (answer_id)
  where status = 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_ai_grading_suggestions_status'
      and conrelid = 'public.ai_grading_suggestions'::regclass
  ) then
    alter table public.ai_grading_suggestions
      add constraint ck_ai_grading_suggestions_status
      check (status in ('pending', 'accepted', 'rejected', 'superseded'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_ai_grading_suggestions_points_non_negative'
      and conrelid = 'public.ai_grading_suggestions'::regclass
  ) then
    alter table public.ai_grading_suggestions
      add constraint ck_ai_grading_suggestions_points_non_negative
      check (suggested_points >= 0 and suggested_points <= 1000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_ai_grading_suggestions_confidence_range'
      and conrelid = 'public.ai_grading_suggestions'::regclass
  ) then
    alter table public.ai_grading_suggestions
      add constraint ck_ai_grading_suggestions_confidence_range
      check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_ai_grading_suggestions_review_fields'
      and conrelid = 'public.ai_grading_suggestions'::regclass
  ) then
    alter table public.ai_grading_suggestions
      add constraint ck_ai_grading_suggestions_review_fields
      check (
        (status = 'pending' and reviewed_by is null and reviewed_at is null)
        or (status in ('accepted', 'rejected') and reviewed_by is not null and reviewed_at is not null)
        or status = 'superseded'
      );
  end if;
end
$$;

create or replace function public.app_is_exam_owner_by_ai_suggestion(
  p_suggestion_id uuid,
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
    from public.ai_grading_suggestions ags
    inner join public.class_exam_attempt_answers aa on aa.id = ags.answer_id
    inner join public.class_exam_attempts cea on cea.id = aa.attempt_id
    inner join public.class_exams ce on ce.id = cea.class_exam_id
    where ags.id = p_suggestion_id
      and ce.created_by_user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.app_guard_ai_grading_suggestion_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_type text;
  v_question_points numeric(8, 2);
  v_attempt_status text;
  v_answer_text text;
begin
  select
    q.question_type,
    q.points,
    cea.status,
    aa.answer_text
  into
    v_question_type,
    v_question_points,
    v_attempt_status,
    v_answer_text
  from public.class_exam_attempt_answers aa
  inner join public.exam_questions q on q.id = aa.question_id
  inner join public.class_exam_attempts cea on cea.id = aa.attempt_id
  where aa.id = new.answer_id;

  if v_question_type is null then
    raise exception 'ANSWER_NOT_FOUND';
  end if;

  if v_question_type <> 'essay_placeholder' then
    raise exception 'ESSAY_MANUAL_GRADING_ONLY';
  end if;

  if v_attempt_status <> 'submitted' then
    raise exception 'EXAM_ATTEMPT_NOT_SUBMITTED';
  end if;

  if nullif(btrim(coalesce(v_answer_text, '')), '') is null then
    raise exception 'ESSAY_ANSWER_EMPTY';
  end if;

  if new.suggested_points < 0 or new.suggested_points > v_question_points then
    raise exception 'AI_SUGGESTED_POINTS_OUT_OF_RANGE';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_ai_grading_suggestions on public.ai_grading_suggestions;
create trigger trg_guard_ai_grading_suggestions
before insert or update on public.ai_grading_suggestions
for each row
execute function public.app_guard_ai_grading_suggestion_consistency();
