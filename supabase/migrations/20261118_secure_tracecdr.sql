-- ====================================================================
-- TRACECDR ENTERPRISE DATABASE SCHEMA & STRICT ROW-LEVEL SECURITY (RLS)
-- File: supabase/migrations/20261118_secure_tracecdr.sql
-- ====================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USER PROFILES & ROLE-BASED ACCESS CONTROL
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  username text not null,
  role text not null check (role in ('superadmin', 'analyst', 'viewer')) default 'analyst',
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for lookup performance
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);


-- Helper function: Check if current caller is superadmin
create or replace function public.is_superadmin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin' and is_active = true
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Helper function: Get caller role
create or replace function public.current_role()
returns text as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles
  where id = auth.uid() and is_active = true;
  return coalesce(user_role, 'viewer');
end;
$$ language plpgsql security definer set search_path = public;

-- 2. CASE REGISTRY (STRICT PER-USER OR ADMIN-OVERVIEW MODEL)
create table if not exists public.cases (
  id uuid default gen_random_uuid() primary key,
  fir text not null,
  title text not null,
  suspect text,
  status text not null check (status in ('Open', 'Under investigation', 'Charge-sheeted', 'Closed')) default 'Open',
  charges jsonb default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete restrict not null,
  version integer not null default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_case_fir_creator unique (fir, created_by)
);

create index if not exists idx_cases_created_by on public.cases(created_by);
create index if not exists idx_cases_fir on public.cases(fir);

-- 3. EVIDENCE IMPORT AUDIT METADATA
create table if not exists public.cdr_imports (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references public.cases(id) on delete cascade not null,
  filename text not null,
  file_hash_sha256 text not null,
  mapping_profile text not null,
  total_records integer not null default 0,
  valid_records integer not null default 0,
  rejected_records integer not null default 0,
  validation_warnings jsonb default '[]'::jsonb,
  imported_by uuid references auth.users(id) not null,
  imported_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_imports_case on public.cdr_imports(case_id);
create index if not exists idx_imports_hash on public.cdr_imports(file_hash_sha256);

-- 4. CDR RECORDS TABLE (SCOPED TO CASE WITH DEDUPLICATION)
create table if not exists public.cdr_records (
  id bigserial primary key,
  case_id uuid references public.cases(id) on delete cascade not null,
  import_id uuid references public.cdr_imports(id) on delete set null,
  idempotency_hash text not null, -- sha256(case_id + a + b + start_utc + dur + cell)
  a_party text not null,
  b_party text not null,
  start_time_utc timestamp with time zone not null,
  call_date date not null,
  call_time time not null,
  duration integer not null default 0 check (duration >= 0),
  call_type text not null default 'CALL',
  imei text default '',
  imsi text default '',
  cell_id text default '',
  tower_address text default '',
  latitude double precision,
  longitude double precision,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint uq_cdr_case_idempotency unique (case_id, idempotency_hash)
);

create index if not exists idx_cdr_case on public.cdr_records(case_id);
create index if not exists idx_cdr_parties on public.cdr_records(a_party, b_party);
create index if not exists idx_cdr_time on public.cdr_records(start_time_utc);
create index if not exists idx_cdr_imei on public.cdr_records(imei);
create index if not exists idx_cdr_imsi on public.cdr_records(imsi);

-- 5. IMMUTABLE APPEND-ONLY AUDIT LOGS
create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null,
  actor_role text not null,
  action text not null,
  target_type text, -- 'CASE', 'CDR', 'USER', 'SYSTEM'
  target_id text,
  case_id uuid references public.cases(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_audit_case on public.audit_logs(case_id);
create index if not exists idx_audit_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);

-- Revoke all modification permissions on audit logs to ensure immutability
revoke update, delete, truncate on public.audit_logs from public, anon, authenticated;

-- ====================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.cdr_imports enable row level security;
alter table public.cdr_records enable row level security;
alter table public.audit_logs enable row level security;

-- PROFILES POLICIES
-- Users can read their own profile; Superadmins can read all profiles
create policy "profiles_select_policy" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_superadmin());

-- Only superadmins can update roles or disable accounts; normal users can only update username
create policy "profiles_update_policy" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_superadmin())
  with check (
    -- If not superadmin, role and is_active must remain unchanged
    case when not public.is_superadmin() then
      role = (select role from public.profiles where id = auth.uid()) and
      is_active = (select is_active from public.profiles where id = auth.uid())
    else true end
  );

-- CASES POLICIES
-- Superadmins can view all cases; Analysts and Viewers can only view cases they created or are assigned to
create policy "cases_select_policy" on public.cases
  for select to authenticated
  using (created_by = auth.uid() or public.is_superadmin());

-- Only Analysts and Superadmins can create cases; Viewers CANNOT create
create policy "cases_insert_policy" on public.cases
  for insert to authenticated
  with check (
    created_by = auth.uid() and
    public.current_role() in ('analyst', 'superadmin')
  );

-- Only creator or Superadmin can update cases; Viewers CANNOT update
create policy "cases_update_policy" on public.cases
  for update to authenticated
  using (
    (created_by = auth.uid() and public.current_role() in ('analyst', 'superadmin')) or
    public.is_superadmin()
  )
  with check (
    (created_by = auth.uid() and public.current_role() in ('analyst', 'superadmin')) or
    public.is_superadmin()
  );

-- Only creator or Superadmin can delete cases; Viewers CANNOT delete
create policy "cases_delete_policy" on public.cases
  for delete to authenticated
  using (
    (created_by = auth.uid() and public.current_role() in ('analyst', 'superadmin')) or
    public.is_superadmin()
  );

-- CDR IMPORTS POLICIES
create policy "cdr_imports_select_policy" on public.cdr_imports
  for select to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = cdr_imports.case_id and (c.created_by = auth.uid() or public.is_superadmin())
    )
  );

create policy "cdr_imports_insert_policy" on public.cdr_imports
  for insert to authenticated
  with check (
    imported_by = auth.uid() and
    public.current_role() in ('analyst', 'superadmin') and
    exists (
      select 1 from public.cases c
      where c.id = cdr_imports.case_id and (c.created_by = auth.uid() or public.is_superadmin())
    )
  );

-- CDR RECORDS POLICIES
-- Scoped strictly to cases accessible to the user
create policy "cdr_records_select_policy" on public.cdr_records
  for select to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = cdr_records.case_id and (c.created_by = auth.uid() or public.is_superadmin())
    )
  );

create policy "cdr_records_insert_policy" on public.cdr_records
  for insert to authenticated
  with check (
    public.current_role() in ('analyst', 'superadmin') and
    exists (
      select 1 from public.cases c
      where c.id = cdr_records.case_id and (c.created_by = auth.uid() or public.is_superadmin())
    )
  );

create policy "cdr_records_update_policy" on public.cdr_records
  for update to authenticated
  using (
    public.current_role() in ('analyst', 'superadmin') and
    exists (
      select 1 from public.cases c
      where c.id = cdr_records.case_id and (c.created_by = auth.uid() or public.is_superadmin())
    )
  );

create policy "cdr_records_delete_policy" on public.cdr_records
  for delete to authenticated
  using (
    public.current_role() in ('analyst', 'superadmin') and
    exists (
      select 1 from public.cases c
      where c.id = cdr_records.case_id and (c.created_by = auth.uid() or public.is_superadmin())
    )
  );

-- AUDIT LOGS POLICIES
-- Authenticated users can insert audit logs for their own actions
create policy "audit_insert_policy" on public.audit_logs
  for insert to authenticated
  with check (
    actor_id = auth.uid() and
    actor_role = public.current_role()
  );

-- Only Superadmins or the case owner can view relevant audit logs
create policy "audit_select_policy" on public.audit_logs
  for select to authenticated
  using (
    actor_id = auth.uid() or
    public.is_superadmin() or
    (case_id is not null and exists (
      select 1 from public.cases c
      where c.id = audit_logs.case_id and c.created_by = auth.uid()
    ))
  );

-- Ensure NO update or delete policies exist for audit_logs (append-only)

-- 6. AUTOMATED SERVER-SIDE AUDIT TRIGGER ON CASE MUTATIONS
create or replace function public.audit_case_mutation()
returns trigger as $$
declare
  acting_user uuid := auth.uid();
  acting_email text;
  acting_role text := public.current_role();
begin
  select email into acting_email from auth.users where id = acting_user;

  if TG_OP = 'INSERT' then
    insert into public.audit_logs (actor_id, actor_email, actor_role, action, target_type, target_id, case_id, details)
    values (acting_user, coalesce(acting_email, 'system'), acting_role, 'CASE_CREATED', 'CASE', NEW.id::text, NEW.id, jsonb_build_object('fir', NEW.fir, 'title', NEW.title));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_logs (actor_id, actor_email, actor_role, action, target_type, target_id, case_id, details)
    values (acting_user, coalesce(acting_email, 'system'), acting_role, 'CASE_UPDATED', 'CASE', NEW.id::text, NEW.id, jsonb_build_object('fir', NEW.fir, 'status_from', OLD.status, 'status_to', NEW.status, 'ver_from', OLD.version, 'ver_to', NEW.version));
    NEW.version := OLD.version + 1;
    NEW.updated_at := timezone('utc'::text, now());
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_logs (actor_id, actor_email, actor_role, action, target_type, target_id, case_id, details)
    values (acting_user, coalesce(acting_email, 'system'), acting_role, 'CASE_DELETED', 'CASE', OLD.id::text, OLD.id, jsonb_build_object('fir', OLD.fir, 'title', OLD.title));
    return OLD;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_audit_case on public.cases;
create trigger trg_audit_case
  before insert or update or delete on public.cases
  for each row execute procedure public.audit_case_mutation();
