-- User-owned screen-time rules and daily totals. Native enforcement stays on device.
create table if not exists public.screen_time_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  app_identifier text not null check (length(trim(app_identifier)) between 3 and 200),
  app_name text not null check (length(trim(app_name)) between 1 and 100),
  daily_limit_minutes integer not null check (daily_limit_minutes between 5 and 1440),
  block_minutes integer not null check (block_minutes in (60,120)),
  commitment_mode boolean not null default false,
  enabled boolean not null default true,
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,app_identifier)
);
create table if not exists public.screen_time_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  app_identifier text not null,
  used_on date not null,
  minutes integer not null check (minutes between 0 and 1440),
  updated_at timestamptz not null default now(),
  primary key(user_id,app_identifier,used_on),
  foreign key(user_id,app_identifier) references public.screen_time_rules(user_id,app_identifier) on delete cascade
);
create index if not exists screen_time_usage_day_idx on public.screen_time_usage(user_id,used_on desc);
create or replace function public.keep_screen_time_usage_monotonic() returns trigger language plpgsql as $$
begin new.minutes:=greatest(new.minutes,old.minutes); return new; end; $$;
drop trigger if exists screen_time_usage_no_decrease on public.screen_time_usage;
create trigger screen_time_usage_no_decrease before update on public.screen_time_usage for each row execute function public.keep_screen_time_usage_monotonic();
create or replace function public.protect_screen_time_commitment() returns trigger language plpgsql as $$
begin
  if old.commitment_mode and old.blocked_until>now() and
    (new.enabled=false or new.commitment_mode=false or new.daily_limit_minutes>old.daily_limit_minutes or new.block_minutes<old.block_minutes or new.app_identifier<>old.app_identifier or new.user_id<>old.user_id or new.blocked_until is null or new.blocked_until<old.blocked_until)
  then raise exception 'Active commitment cannot be weakened'; end if;
  return new;
end; $$;
drop trigger if exists screen_time_commitment_update on public.screen_time_rules;
create trigger screen_time_commitment_update before update on public.screen_time_rules for each row execute function public.protect_screen_time_commitment();
create or replace function public.protect_screen_time_commitment_delete() returns trigger language plpgsql as $$
begin if old.commitment_mode and old.blocked_until>now() then raise exception 'Active commitment cannot be deleted'; end if; return old; end; $$;
drop trigger if exists screen_time_commitment_delete on public.screen_time_rules;
create trigger screen_time_commitment_delete before delete on public.screen_time_rules for each row execute function public.protect_screen_time_commitment_delete();
alter table public.screen_time_rules enable row level security;
alter table public.screen_time_usage enable row level security;
drop policy if exists screen_time_rules_owner on public.screen_time_rules;
create policy screen_time_rules_owner on public.screen_time_rules to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists screen_time_usage_owner on public.screen_time_usage;
create policy screen_time_usage_owner on public.screen_time_usage to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update,delete on public.screen_time_rules,public.screen_time_usage to authenticated;
