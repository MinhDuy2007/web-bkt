alter table public.class_exam_attempts
  add column if not exists final_score numeric(10, 2);

alter table public.class_exam_attempt_answers
  add column if not exists manual_awarded_points numeric(8, 2),
  add column if not exists grading_note text null,
  add column if not exists graded_by uuid null references public.user_accounts (id) on delete set null,
  add column if not exists graded_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_class_exam_attempts_final_score_non_negative'
      and conrelid = 'public.class_exam_attempts'::regclass
  ) then
    alter table public.class_exam_attempts
      add constraint ck_class_exam_attempts_final_score_non_negative
      check (final_score is null or final_score >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_class_exam_attempts_final_score_gte_auto_score'
      and conrelid = 'public.class_exam_attempts'::regclass
  ) then
    alter table public.class_exam_attempts
      add constraint ck_class_exam_attempts_final_score_gte_auto_score
      check (
        final_score is null
        or auto_graded_score is null
        or final_score >= auto_graded_score
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_class_exam_attempt_answers_manual_awarded_points'
      and conrelid = 'public.class_exam_attempt_answers'::regclass
  ) then
    alter table public.class_exam_attempt_answers
      add constraint ck_class_exam_attempt_answers_manual_awarded_points
      check (
        manual_awarded_points is null
        or (manual_awarded_points >= 0 and manual_awarded_points <= 1000)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_class_exam_attempt_answers_manual_points_match_awarded'
      and conrelid = 'public.class_exam_attempt_answers'::regclass
  ) then
    alter table public.class_exam_attempt_answers
      add constraint ck_class_exam_attempt_answers_manual_points_match_awarded
      check (
        manual_awarded_points is null
        or awarded_points = manual_awarded_points
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_class_exam_attempt_answers_grading_note_length'
      and conrelid = 'public.class_exam_attempt_answers'::regclass
  ) then
    alter table public.class_exam_attempt_answers
      add constraint ck_class_exam_attempt_answers_grading_note_length
      check (grading_note is null or char_length(grading_note) <= 4000);
  end if;
end
$$;

update public.class_exam_attempts
set final_score = auto_graded_score
where final_score is null
  and submitted_at is not null
  and pending_manual_grading_count = 0;

create or replace function public.app_is_exam_owner_by_attempt_answer(
  p_answer_id uuid,
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
    from public.class_exam_attempt_answers aa
    inner join public.class_exam_attempts cea on cea.id = aa.attempt_id
    inner join public.class_exams ce on ce.id = cea.class_exam_id
    where aa.id = p_answer_id
      and ce.created_by_user_id = coalesce(p_user_id, auth.uid())
  );
$$;

create or replace function public.app_is_exam_owner_by_attempt(
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
    inner join public.class_exams ce on ce.id = cea.class_exam_id
    where cea.id = p_attempt_id
      and ce.created_by_user_id = coalesce(p_user_id, auth.uid())
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

  select eq.class_exam_id
  into v_question_exam_id
  from public.exam_questions eq
  where eq.id = new.question_id;

  if v_question_exam_id is null or v_question_exam_id <> v_attempt_exam_id then
    raise exception 'ATTEMPT_QUESTION_MISMATCH';
  end if;

  if tg_op = 'INSERT' then
    if v_attempt_status <> 'started' then
      raise exception 'ATTEMPT_ALREADY_SUBMITTED';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    if v_attempt_status = 'started' then
      return new;
    end if;

    if v_attempt_status = 'submitted' then
      if old.attempt_id is distinct from new.attempt_id
        or old.question_id is distinct from new.question_id
        or old.answer_text is distinct from new.answer_text
        or old.answer_json is distinct from new.answer_json then
        raise exception 'ATTEMPT_ALREADY_SUBMITTED';
      end if;

      return new;
    end if;
  end if;

  raise exception 'ATTEMPT_STATUS_INVALID';
end;
$$;
