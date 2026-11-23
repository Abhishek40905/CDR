-- Make deactivation effective for direct Supabase Data API access as well as
-- Edge Functions. Restrictive policies combine with existing ownership rules.
create or replace function public.tracecdr_is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$;

-- Explicit grants keep the browser paths working even when a project's
-- default public-schema grants have been tightened.
grant select on public.profiles to authenticated;
grant select, insert, update on public.app_states to authenticated;
grant select, insert on public.audit_logs to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'cases', 'cdr_imports', 'cdr_records', 'audit_logs', 'app_states'
  ] loop
    execute format('drop policy if exists active_user_guard on public.%I', table_name);
    execute format(
      'create policy active_user_guard on public.%I as restrictive for all to authenticated using (public.tracecdr_is_active_user()) with check (public.tracecdr_is_active_user())',
      table_name
    );
  end loop;
end;
$$;
