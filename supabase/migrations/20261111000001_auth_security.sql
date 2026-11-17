-- Registration details, device sessions, and server-side PIN storage

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text;
create unique index if not exists profiles_phone_idx on public.profiles (phone) where phone is not null;

-- New users: copy name and phone from the sign-up metadata
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, first_name, last_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    nullif(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;

-- PIN hash lives in its own table with RLS on and NO policies: the app's anon/user keys can never read it,
-- only the API (service role). A 4-digit PIN is easy to brute-force if its hash leaks, so it must not be client-readable.
create table if not exists public.user_security (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text,
  pin_salt text,
  pin_failed int not null default 0,
  pin_locked_until timestamptz,
  pin_set_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.user_security enable row level security;

-- One row per signed-in device (keyed by the Supabase auth session id inside the JWT)
create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  auth_session_id uuid not null unique,
  device_id text,
  device_name text not null default 'Unknown device',
  platform text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists device_sessions_user_idx on public.device_sessions (user_id, revoked_at);
alter table public.device_sessions enable row level security;
-- Read-only for the owner. Only the API (service role) can create, touch or revoke rows.
drop policy if exists device_sessions_read on public.device_sessions;
create policy device_sessions_read on public.device_sessions for select to authenticated using (user_id = auth.uid());

-- Really kill auth sessions (refresh tokens go with them). Callable by the service role only.
create or replace function public.revoke_auth_session(p_user uuid, p_session uuid) returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.sessions where id = p_session and user_id = p_user;
$$;
create or replace function public.revoke_other_auth_sessions(p_user uuid, p_keep uuid) returns int
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  delete from auth.sessions where user_id = p_user and id <> p_keep;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.revoke_auth_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_other_auth_sessions(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_auth_session(uuid, uuid) to service_role;
grant execute on function public.revoke_other_auth_sessions(uuid, uuid) to service_role;
