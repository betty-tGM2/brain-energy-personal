create table if not exists public.user_app_state (
  user_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.user_app_state to authenticated;
grant all on public.user_app_state to service_role;

alter table public.user_app_state enable row level security;

drop policy if exists user_app_state_select_own on public.user_app_state;
create policy user_app_state_select_own on public.user_app_state
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_app_state_insert_own on public.user_app_state;
create policy user_app_state_insert_own on public.user_app_state
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists user_app_state_update_own on public.user_app_state;
create policy user_app_state_update_own on public.user_app_state
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists user_app_state_delete_own on public.user_app_state;
create policy user_app_state_delete_own on public.user_app_state
  for delete to authenticated
  using (user_id = (select auth.uid()));
