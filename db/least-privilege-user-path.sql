-- Mau least-privilege cho user-facing app path.
-- File nay la tai lieu van hanh, KHONG tu dong chay trong migration hien tai.

-- 1) Tao role danh rieng cho app path (ten role co the doi theo moi truong).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user_runtime') then
    create role app_user_runtime nologin;
  end if;
end;
$$;

-- 2) Cho phep ket noi va dung schema public.
grant usage on schema public to app_user_runtime;

-- 3) Grant quyen toi thieu tren cac bang app can dung.
grant select, insert, update, delete on table public.user_accounts to app_user_runtime;
grant select, insert, update, delete on table public.user_profiles to app_user_runtime;
grant select, insert, update, delete on table public.app_sessions to app_user_runtime;
grant select, insert, update, delete on table public.teacher_verification_requests to app_user_runtime;

-- Audit log chi cho phep insert o user path neu can trigger phat sinh.
grant insert on table public.teacher_verification_audit_logs to app_user_runtime;

-- 4) Revoke quyen DDL va quyen khong can thiet.
revoke create on schema public from app_user_runtime;
revoke all on all sequences in schema public from app_user_runtime;
revoke execute on all functions in schema public from app_user_runtime;

-- 5) Neu can goi mot so function, grant co chon loc:
grant execute on function public.app_set_updated_at() to app_user_runtime;

-- 6) Gan role vao user ket noi thuc te (vi du user connection pool).
-- grant app_user_runtime to your_db_login_user;
