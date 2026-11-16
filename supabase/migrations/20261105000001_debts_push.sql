-- Debts (manual tracking), push tokens and reminder delivery log

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  creditor text,
  direction text not null default 'owed_by_me' check (direction in ('owed_by_me','owed_to_me')),
  principal numeric not null check (principal >= 0),
  currency char(3) not null default 'XAF',
  interest_rate numeric check (interest_rate between 0 and 1000),
  due_date date,
  min_payment numeric check (min_payment >= 0),
  status text not null default 'active' check (status in ('active','paid','written_off')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric not null check (amount > 0),
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index debt_payments_debt_idx on public.debt_payments (debt_id);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

-- One row per reminder per local day, so a reminder is never sent twice
create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  sent_on date not null,
  created_at timestamptz not null default now(),
  unique (reminder_id, sent_on)
);
create index reminder_deliveries_user_day_idx on public.reminder_deliveries (user_id, sent_on);

create trigger debts_updated before update on public.debts for each row execute function public.set_updated_at();

alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.push_tokens enable row level security;
alter table public.reminder_deliveries enable row level security;
do $$
declare t text;
begin
  foreach t in array array['debts','debt_payments','push_tokens','reminder_deliveries']
  loop
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner', t);
  end loop;
end $$;
