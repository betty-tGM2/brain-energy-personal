drop policy if exists "allowed users select own state" on public.user_app_state;
drop policy if exists "allowed users insert own state" on public.user_app_state;
drop policy if exists "allowed users update own state" on public.user_app_state;
drop policy if exists "allowed users delete own state" on public.user_app_state;

create policy "users select own state"
on public.user_app_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users insert own state"
on public.user_app_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update own state"
on public.user_app_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users delete own state"
on public.user_app_state
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop function if exists public.is_email_allowed(text);
drop function if exists public.is_allowed_user();
