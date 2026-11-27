create table if not exists public.calendar_event_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  offset_days int not null check (offset_days in (7, 2, 1)),
  sent_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (event_id, offset_days)
);

alter table public.calendar_event_reminder_deliveries enable row level security;

drop policy if exists "own_event_reminder_deliveries" on public.calendar_event_reminder_deliveries;
create policy "own_event_reminder_deliveries" on public.calendar_event_reminder_deliveries
  for select using (auth.uid() = user_id);
