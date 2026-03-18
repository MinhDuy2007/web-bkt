create table if not exists public.ai_grading_usage_logs (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.class_exam_attempt_answers (id) on delete cascade,
  suggestion_id uuid null references public.ai_grading_suggestions (id) on delete set null,
  actor_user_id uuid null references public.user_accounts (id) on delete set null,
  provider_kind text not null,
  model_name text not null,
  prompt_version text null,
  request_status text not null,
  error_code text null,
  latency_ms integer null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_ai_grading_usage_logs_answer_id_created_at
  on public.ai_grading_usage_logs (answer_id, created_at desc);

create index if not exists idx_ai_grading_usage_logs_suggestion_id
  on public.ai_grading_usage_logs (suggestion_id);

create index if not exists idx_ai_grading_usage_logs_request_status_created_at
  on public.ai_grading_usage_logs (request_status, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_ai_grading_usage_logs_request_status'
      and conrelid = 'public.ai_grading_usage_logs'::regclass
  ) then
    alter table public.ai_grading_usage_logs
      add constraint ck_ai_grading_usage_logs_request_status
      check (request_status in ('succeeded', 'failed', 'timeout'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_ai_grading_usage_logs_latency_non_negative'
      and conrelid = 'public.ai_grading_usage_logs'::regclass
  ) then
    alter table public.ai_grading_usage_logs
      add constraint ck_ai_grading_usage_logs_latency_non_negative
      check (latency_ms is null or latency_ms >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_ai_grading_usage_logs_metadata_object'
      and conrelid = 'public.ai_grading_usage_logs'::regclass
  ) then
    alter table public.ai_grading_usage_logs
      add constraint ck_ai_grading_usage_logs_metadata_object
      check (jsonb_typeof(metadata_json) = 'object');
  end if;
end
$$;
