create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  class_exam_id uuid not null references public.class_exams (id) on delete cascade,
  question_order integer not null,
  question_type text not null,
  prompt_text text not null,
  points numeric(8, 2) not null default 1,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null references public.user_accounts (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_exam_questions_exam_order unique (class_exam_id, question_order),
  constraint ck_exam_questions_question_order
    check (question_order between 1 and 5000),
  constraint ck_exam_questions_question_type
    check (
      question_type in (
        'multiple_choice_single',
        'true_false',
        'short_answer',
        'essay_placeholder'
      )
    ),
  constraint ck_exam_questions_prompt_len
    check (char_length(prompt_text) between 3 and 5000),
  constraint ck_exam_questions_points
    check (points > 0 and points <= 1000),
  constraint ck_exam_questions_metadata_json_object
    check (jsonb_typeof(metadata_json) = 'object')
);

create index if not exists idx_exam_questions_class_exam_id
  on public.exam_questions (class_exam_id);

create index if not exists idx_exam_questions_created_by_user_id
  on public.exam_questions (created_by_user_id);

create table if not exists public.exam_answer_keys (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  key_type text not null,
  correct_answer_text text null,
  correct_answer_json jsonb not null default '{}'::jsonb,
  explanation_text text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_exam_answer_keys_question_id unique (question_id),
  constraint ck_exam_answer_keys_key_type
    check (
      key_type in (
        'multiple_choice_single',
        'true_false',
        'short_answer',
        'essay_placeholder'
      )
    ),
  constraint ck_exam_answer_keys_correct_answer_json_object
    check (jsonb_typeof(correct_answer_json) = 'object'),
  constraint ck_exam_answer_keys_explanation_len
    check (explanation_text is null or char_length(explanation_text) <= 2000)
);

create index if not exists idx_exam_answer_keys_question_id
  on public.exam_answer_keys (question_id);

create or replace function public.app_is_exam_owner(
  p_class_exam_id uuid,
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
    from public.class_exams ce
    where ce.id = p_class_exam_id
      and ce.created_by_user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.app_guard_exam_answer_key_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_type text;
begin
  select eq.question_type
  into v_question_type
  from public.exam_questions eq
  where eq.id = new.question_id;

  if v_question_type is null then
    raise exception 'QUESTION_NOT_FOUND';
  end if;

  if new.key_type <> v_question_type then
    raise exception 'ANSWER_KEY_TYPE_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_exam_questions_set_updated_at on public.exam_questions;
create trigger tr_exam_questions_set_updated_at
before update on public.exam_questions
for each row
execute function public.app_set_updated_at();

drop trigger if exists tr_exam_answer_keys_set_updated_at on public.exam_answer_keys;
create trigger tr_exam_answer_keys_set_updated_at
before update on public.exam_answer_keys
for each row
execute function public.app_set_updated_at();

drop trigger if exists tr_exam_answer_keys_guard_key_type on public.exam_answer_keys;
create trigger tr_exam_answer_keys_guard_key_type
before insert or update on public.exam_answer_keys
for each row
execute function public.app_guard_exam_answer_key_type();
