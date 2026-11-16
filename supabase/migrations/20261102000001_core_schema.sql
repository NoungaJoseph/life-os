-- MY LIFE OS: core schema (Phase 1 foundation: identity, taxonomy, goals, tasks, habits)
-- Remaining module tables (finance, food, fitness, reading, social, projects, reviews, reminders)
-- are added in later migrations, one phase at a time.

create extension if not exists "pgcrypto";

-- Shared trigger to keep updated_at fresh
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Africa/Douala',
  currency char(3) not null default 'XAF',
  language text not null default 'en',
  preferences jsonb not null default '{}'::jsonb,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.life_visions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  identity_statement text,
  ideal_life text,
  long_term_ambitions text,
  pillar_priorities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger life_visions_updated before update on public.life_visions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Taxonomy: pillars and areas. user_id is null for system defaults,
-- set for user-created custom pillars/areas.
-- ---------------------------------------------------------------------------
create table public.life_pillars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  slug text not null,
  name text not null,
  purpose text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index life_pillars_slug_idx on public.life_pillars (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

create table public.life_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index life_areas_slug_idx on public.life_areas (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

-- An area can belong to several pillars
create table public.life_area_pillars (
  life_area_id uuid not null references public.life_areas(id) on delete cascade,
  pillar_id uuid not null references public.life_pillars(id) on delete cascade,
  primary key (life_area_id, pillar_id)
);

create table public.user_life_areas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  life_area_id uuid not null references public.life_areas(id) on delete cascade,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, life_area_id)
);

-- ---------------------------------------------------------------------------
-- Goals (hierarchy via parent_goal_id) and milestones
-- ---------------------------------------------------------------------------
create type public.goal_type as enum ('long_term','annual','quarterly','monthly','weekly','daily');
create type public.goal_status as enum ('not_started','active','paused','completed','abandoned');
create type public.goal_priority as enum ('low','medium','high');
create type public.measurement_type as enum ('percentage','numeric','currency','time','frequency','milestones');

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_goal_id uuid references public.goals(id) on delete set null,
  pillar_id uuid references public.life_pillars(id) on delete set null,
  life_area_id uuid references public.life_areas(id) on delete set null,
  goal_type public.goal_type not null,
  title text not null,
  description text,
  success_criteria text,
  notes text,
  priority public.goal_priority not null default 'medium',
  status public.goal_status not null default 'not_started',
  start_date date,
  target_date date,
  measurement_type public.measurement_type not null default 'percentage',
  target_value numeric,
  current_value numeric not null default 0,
  unit text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_goal_id is null or parent_goal_id <> id)
);
create index goals_user_idx on public.goals (user_id, goal_type, status);
create index goals_parent_idx on public.goals (parent_goal_id);
create trigger goals_updated before update on public.goals
  for each row execute function public.set_updated_at();

create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  due_date date,
  completed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index goal_milestones_goal_idx on public.goal_milestones (goal_id);

-- ---------------------------------------------------------------------------
-- Tasks and habits. A task or habit links to a goal and/or area; it is never
-- duplicated per module.
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  life_area_id uuid references public.life_areas(id) on delete set null,
  title text not null,
  notes text,
  priority public.goal_priority not null default 'medium',
  due_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  recurrence_rule text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_due_idx on public.tasks (user_id, due_date);
create trigger tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

create type public.habit_frequency as enum ('daily','weekdays','weekly','monthly','custom');

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  life_area_id uuid references public.life_areas(id) on delete set null,
  name text not null,
  description text,
  frequency public.habit_frequency not null default 'daily',
  days_of_week smallint[] check (days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]),
  target_per_period int not null default 1,
  preferred_time time,
  start_date date not null default current_date,
  reminder_enabled boolean not null default false,
  paused_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index habits_user_idx on public.habits (user_id);
create trigger habits_updated before update on public.habits
  for each row execute function public.set_updated_at();

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_on date not null,
  note text,
  created_at timestamptz not null default now(),
  unique (habit_id, completed_on)
);
create index habit_completions_user_date_idx on public.habit_completions (user_id, completed_on);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.life_visions enable row level security;
alter table public.life_pillars enable row level security;
alter table public.life_areas enable row level security;
alter table public.life_area_pillars enable row level security;
alter table public.user_life_areas enable row level security;
alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;

create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Taxonomy: everyone signed in reads system rows (user_id null) and their own custom rows
create policy pillars_read on public.life_pillars for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy pillars_write on public.life_pillars for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy areas_read on public.life_areas for select to authenticated
  using (user_id is null or user_id = auth.uid());
create policy areas_write on public.life_areas for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy area_pillars_read on public.life_area_pillars for select to authenticated using (true);
create policy area_pillars_write on public.life_area_pillars for all to authenticated
  using (exists (select 1 from public.life_areas a where a.id = life_area_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.life_areas a where a.id = life_area_id and a.user_id = auth.uid()));

-- Owner-only policies for user data
do $$
declare t text;
begin
  foreach t in array array['life_visions','user_life_areas','goals','goal_milestones','tasks','habits','habit_completions']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner', t);
  end loop;
end $$;
