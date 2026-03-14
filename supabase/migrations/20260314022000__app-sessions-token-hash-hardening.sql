-- Migration: 20260314022000__app-sessions-token-hash-hardening.sql
-- Nguon: db/migrations/2026-03-14_02-20-00--app-sessions-token-hash-hardening.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_sessions'
      and column_name = 'token'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_sessions'
      and column_name = 'token_hash'
  ) then
    truncate table public.app_sessions;
    alter table public.app_sessions rename column token to token_hash;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_sessions'
      and column_name = 'token_hash'
  ) then
    alter table public.app_sessions add column token_hash text;
  end if;
end;
$$;

alter table public.app_sessions
  alter column token_hash set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_sessions'
      and column_name = 'token'
  ) then
    alter table public.app_sessions drop column token;
  end if;
end;
$$;

alter table public.app_sessions
  drop constraint if exists app_sessions_pkey;

alter table public.app_sessions
  add constraint app_sessions_pkey primary key (token_hash);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ck_app_sessions_token_hash_len'
      and conrelid = 'public.app_sessions'::regclass
  ) then
    alter table public.app_sessions
      add constraint ck_app_sessions_token_hash_len
      check (char_length(token_hash) = 64);
  end if;
end;
$$;
