-- Private transformation plans, behavior events and weekly reflections.
create table if not exists public.transformation_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('relationships','addictions','health','finance','character')),
  title text not null check (length(trim(title)) between 2 and 100),
  current_self text not null default '', target_self text not null default '',
  reason text not null default '', goal_id uuid references public.goals(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists transformation_areas_user_idx on public.transformation_areas(user_id);

create table if not exists public.transformation_behaviors (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.transformation_areas(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 100),
  direction text not null check (direction in ('build','quit')),
  habit_id uuid references public.habits(id) on delete set null,
  started_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists transformation_behaviors_area_idx on public.transformation_behaviors(area_id);

create table if not exists public.transformation_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  behavior_id uuid not null references public.transformation_behaviors(id) on delete cascade,
  kind text not null check (kind in ('urge','relapse','success')),
  trigger_note text not null default '' check (length(trigger_note) <= 1000),
  occurred_at timestamptz not null default now()
);
create index if not exists transformation_events_behavior_idx on public.transformation_events(behavior_id,occurred_at desc);

create table if not exists public.transformation_checkins (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.transformation_areas(id) on delete cascade,
  week_start date not null, current_score smallint not null check (current_score between 1 and 10),
  target_score smallint not null check (target_score between 1 and 10),
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  unique(user_id,area_id,week_start)
);
create index if not exists transformation_checkins_area_idx on public.transformation_checkins(area_id,week_start desc);

alter table public.transformation_areas enable row level security;
alter table public.transformation_behaviors enable row level security;
alter table public.transformation_events enable row level security;
alter table public.transformation_checkins enable row level security;
drop policy if exists transformation_areas_own on public.transformation_areas;
create policy transformation_areas_own on public.transformation_areas to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and (goal_id is null or exists(select 1 from public.goals g where g.id=goal_id and g.user_id=auth.uid())));
drop policy if exists transformation_behaviors_own on public.transformation_behaviors;
create policy transformation_behaviors_own on public.transformation_behaviors to authenticated using (user_id=auth.uid() and exists(select 1 from public.transformation_areas a where a.id=area_id and a.user_id=auth.uid())) with check (user_id=auth.uid() and exists(select 1 from public.transformation_areas a where a.id=area_id and a.user_id=auth.uid()) and (habit_id is null or exists(select 1 from public.habits h where h.id=habit_id and h.user_id=auth.uid())));
drop policy if exists transformation_events_own on public.transformation_events;
create policy transformation_events_own on public.transformation_events to authenticated using (user_id=auth.uid() and exists(select 1 from public.transformation_behaviors b where b.id=behavior_id and b.user_id=auth.uid())) with check (user_id=auth.uid() and exists(select 1 from public.transformation_behaviors b where b.id=behavior_id and b.user_id=auth.uid()));
drop policy if exists transformation_checkins_own on public.transformation_checkins;
create policy transformation_checkins_own on public.transformation_checkins to authenticated using (user_id=auth.uid() and exists(select 1 from public.transformation_areas a where a.id=area_id and a.user_id=auth.uid())) with check (user_id=auth.uid() and exists(select 1 from public.transformation_areas a where a.id=area_id and a.user_id=auth.uid()));
grant select,insert,update,delete on public.transformation_areas,public.transformation_behaviors,public.transformation_events,public.transformation_checkins to authenticated;
