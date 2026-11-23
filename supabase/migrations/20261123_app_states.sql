-- Run after 20261118_secure_tracecdr.sql. Stores the complete browser workspace
-- per user so every analysis module sees the same imported and edited data.
create table if not exists public.app_states (
  owner_id uuid references auth.users(id) on delete cascade primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_states enable row level security;
grant select, insert, update on public.app_states to authenticated;

create policy "app_states_select_policy" on public.app_states
  for select to authenticated using (owner_id = auth.uid());

create policy "app_states_insert_policy" on public.app_states
  for insert to authenticated
  with check (owner_id = auth.uid() and public.current_role() in ('analyst', 'superadmin'));

create policy "app_states_update_policy" on public.app_states
  for update to authenticated
  using (owner_id = auth.uid() and public.current_role() in ('analyst', 'superadmin'))
  with check (owner_id = auth.uid() and public.current_role() in ('analyst', 'superadmin'));

-- New Auth users receive a minimal profile. Client supplied role metadata is
-- deliberately ignored; only a server administrator may grant superadmin.
create or replace function public.tracecdr_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, username, role)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(new.email, '@', 1)),
          'analyst')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger tracecdr_auth_user_created
after insert on auth.users
for each row execute function public.tracecdr_new_user_profile();
