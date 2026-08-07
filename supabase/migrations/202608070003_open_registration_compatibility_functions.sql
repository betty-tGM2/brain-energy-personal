create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select auth.uid() is not null; $$;

create or replace function public.is_email_allowed(candidate_email text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select nullif(trim(candidate_email), '') is not null; $$;

revoke all on function public.is_allowed_user() from public;
revoke all on function public.is_email_allowed(text) from public;
grant execute on function public.is_allowed_user() to authenticated;
grant execute on function public.is_email_allowed(text) to anon, authenticated;
