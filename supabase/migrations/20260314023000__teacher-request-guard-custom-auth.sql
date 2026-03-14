-- Migration: 20260314023000__teacher-request-guard-custom-auth.sql
-- Nguon: db/migrations/2026-03-14_02-30-00--teacher-request-guard-custom-auth.sql
-- Dong bo tu dong boi scripts/prepare-supabase-migrations.mjs

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
    if auth.uid() is not null and not public.app_is_admin(auth.uid()) and new.user_id <> auth.uid() then
      raise exception 'Khong duoc gui yeu cau cho tai khoan khac';
    end if;

    if auth.uid() is null or not public.app_is_admin(auth.uid()) then
      new.status = 'pending_review';
      new.reviewed_by = null;
      new.reviewed_at = null;
      new.admin_note = null;
      new.submitted_at = coalesce(new.submitted_at, timezone('utc', now()));
    end if;
  else
    if auth.uid() is not null and not public.app_is_admin(auth.uid()) then
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
