-- Journal / reflections, with an optional stored AI reflection
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  life_area_id uuid references public.life_areas(id) on delete set null,
  entry_date date not null default current_date,
  mood smallint check (mood between 1 and 5),
  title text,
  content text not null,
  ai_reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc);
create trigger journal_entries_updated before update on public.journal_entries
  for each row execute function public.set_updated_at();

alter table public.journal_entries enable row level security;
create policy journal_entries_owner on public.journal_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
