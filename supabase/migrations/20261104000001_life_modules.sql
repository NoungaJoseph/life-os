-- MY LIFE OS: remaining life modules (reviews, finance, projects, social, food, fitness, reading, relationships, reminders).
-- Every user-owned table is scoped by user_id and protected by Row Level Security.

-- ---------------------------------------------------------------------------
-- Projects first (finance rows can link to a project)
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  name text not null,
  description text,
  kind text not null default 'project' check (kind in ('project','business','app','other')),
  status text not null default 'active' check (status in ('idea','active','paused','completed','archived')),
  target_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  kind text not null default 'task' check (kind in ('task','follow_up','customer','improvement','milestone')),
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create table public.project_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  metric text not null,
  value numeric not null,
  unit text,
  recorded_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
create table public.income_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  amount numeric(16,2) not null check (amount >= 0),
  currency char(3) not null default 'XAF',
  source text,
  category text,
  received_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create table public.expense_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  amount numeric(16,2) not null check (amount >= 0),
  currency char(3) not null default 'XAF',
  category text not null default 'other',
  description text,
  spent_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  month date not null,                       -- first day of the month
  amount numeric(16,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category, month)
);
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null default 'short_term' check (kind in ('emergency','short_term','long_term','locked','other')),
  target_amount numeric(16,2) not null check (target_amount > 0),
  currency char(3) not null default 'XAF',
  target_date date,
  notes text,
  created_at timestamptz not null default now()
);
-- Balance of a goal = sum of its transactions (deposits positive, withdrawals negative)
create table public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  savings_goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric(16,2) not null check (amount <> 0),
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
-- Manual record of savings kept with an outside provider. The app never connects to or stores credentials for these.
create table public.external_savings_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  name text,
  amount numeric(16,2) not null default 0 check (amount >= 0),
  currency char(3) not null default 'XAF',
  is_locked boolean not null default false,
  lock_start date,
  maturity_date date,
  withdrawal_available_on date,
  interest_rate numeric(6,3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reviews and planning
-- ---------------------------------------------------------------------------
create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_date date not null,
  wins text, lessons text, tomorrow_priorities text,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, review_date)
);
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  answers jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  next_priorities text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create table public.monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month date not null,
  answers jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  next_priorities text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);
create table public.daily_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  schedule_date date not null,
  main_priority text,
  support_priorities text[] not null default '{}',
  end_of_day_report text,
  created_at timestamptz not null default now(),
  unique (user_id, schedule_date)
);
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  life_area_id uuid references public.life_areas(id) on delete set null,
  title text not null,
  kind text not null default 'event' check (kind in ('event','meeting','follow_up','reminder')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  created_at timestamptz not null default now()
);
create table public.work_responsibilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  frequency text not null default 'daily' check (frequency in ('daily','weekly','monthly','ad_hoc')),
  status text not null default 'active' check (status in ('active','paused','done')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------
create table public.social_platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  handle text,
  url text,
  daily_limit_minutes int check (daily_limit_minutes >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create table public.social_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform_id uuid references public.social_platforms(id) on delete set null,
  title text not null,
  content_pillar text,
  format text,
  draft text,
  scheduled_for date,
  status text not null default 'idea' check (status in ('idea','draft','scheduled','published')),
  published_on date,
  performance_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Food and nutrition
-- ---------------------------------------------------------------------------
create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null default 'weekly' check (kind in ('monthly','weekly')),
  budget numeric(16,2) check (budget >= 0),
  starts_on date,
  created_at timestamptz not null default now()
);
create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  list_id uuid not null references public.grocery_lists(id) on delete cascade,
  name text not null,
  quantity text,
  category text,
  perishable boolean not null default false,
  estimated_price numeric(16,2) check (estimated_price >= 0),
  actual_price numeric(16,2) check (actual_price >= 0),
  purchased boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.food_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  quantity text,
  category text,
  purchased_on date,
  expires_on date,
  notes text,
  created_at timestamptz not null default now()
);
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  meal_type text not null default 'lunch' check (meal_type in ('breakfast','lunch','dinner','snack')),
  ingredients text,
  notes text,
  created_at timestamptz not null default now()
);
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_id uuid references public.meals(id) on delete set null,
  plan_date date not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  custom_name text,
  prep_notes text,
  created_at timestamptz not null default now()
);
create table public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_on date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  description text not null,
  food_groups text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);
create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_on date not null default current_date,
  amount_ml int not null check (amount_ml > 0 and amount_ml <= 5000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fitness. user_id null = built-in routine visible to everyone.
-- ---------------------------------------------------------------------------
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null default 'home' check (kind in ('home','walking','running','football','mobility','strength','recovery','other')),
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  equipment text not null default 'none',
  duration_min int check (duration_min > 0),
  instructions text,
  created_at timestamptz not null default now()
);
create unique index workouts_builtin_name_idx on public.workouts (name) where user_id is null;
create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  name text not null,
  kind text not null default 'home',
  logged_on date not null default current_date,
  duration_min int check (duration_min >= 0),
  intensity text check (intensity in ('easy','moderate','hard')),
  is_rest_day boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reading, study, reflection
-- ---------------------------------------------------------------------------
create table public.reading_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  author text,
  category text,
  status text not null default 'want' check (status in ('want','reading','done')),
  start_date date,
  completed_on date,
  total_pages int check (total_pages > 0),
  current_page int not null default 0 check (current_page >= 0),
  notes text,
  lessons text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reading_item_id uuid references public.reading_items(id) on delete set null,
  kind text not null default 'reading' check (kind in ('reading','study','meditation','speaking','listening')),
  session_on date not null default current_date,
  minutes int not null check (minutes > 0 and minutes <= 1440),
  pages int check (pages >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create table public.learning_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reading_item_id uuid references public.reading_items(id) on delete set null,
  title text not null,
  content text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Relationships and reminders
-- ---------------------------------------------------------------------------
create table public.relationship_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  person text,
  kind text not null default 'reflection' check (kind in ('important_date','reflection','follow_up','activity','boundary','value')),
  title text not null,
  content text,
  note_date date,
  repeats_yearly boolean not null default false,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('daily_tasks','habit','reading','workout','finance_review','weekly_review','monthly_review','custom')),
  title text not null,
  remind_time time not null,
  days_of_week smallint[] not null default '{0,1,2,3,4,5,6}',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  quiet_start time not null default '21:30',
  quiet_end time not null default '07:00',
  max_per_day int not null default 6 check (max_per_day between 0 and 20),
  push_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['projects','external_savings_accounts','weekly_reviews','monthly_reviews','social_content','reading_items','notification_preferences']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index on public.income_records (user_id, received_on);
create index on public.expense_records (user_id, spent_on);
create index on public.savings_transactions (savings_goal_id);
create index on public.project_tasks (project_id, status);
create index on public.project_metrics (project_id, recorded_on);
create index on public.food_logs (user_id, logged_on);
create index on public.water_logs (user_id, logged_on);
create index on public.workout_logs (user_id, logged_on);
create index on public.reading_sessions (user_id, session_on);
create index on public.social_content (user_id, status, scheduled_for);
create index on public.relationship_notes (user_id, note_date);
create index on public.grocery_items (list_id);
create index on public.calendar_events (user_id, starts_at);

-- ---------------------------------------------------------------------------
-- Row Level Security: every table is owner-only (workouts also exposes built-in rows read-only)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_tasks','project_metrics','income_records','expense_records','budgets','savings_goals','savings_transactions',
    'external_savings_accounts','daily_reviews','weekly_reviews','monthly_reviews','daily_schedules','calendar_events','work_responsibilities',
    'social_platforms','social_content','grocery_lists','grocery_items','food_inventory','meals','meal_plans','food_logs','water_logs',
    'workout_logs','reading_items','reading_sessions','learning_notes','relationship_notes','reminders','notification_preferences']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner', t);
  end loop;
end $$;

alter table public.workouts enable row level security;
create policy workouts_read on public.workouts for select to authenticated using (user_id is null or user_id = auth.uid());
create policy workouts_write on public.workouts for insert to authenticated with check (user_id = auth.uid());
create policy workouts_update on public.workouts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workouts_delete on public.workouts for delete to authenticated using (user_id = auth.uid());
