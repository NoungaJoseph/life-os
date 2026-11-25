-- Add target day goals, personal rewards, and milestone completion tracking to transformation behaviors.
alter table public.transformation_behaviors
  add column if not exists target_days int check (target_days is null or target_days between 1 and 3650),
  add column if not exists reward_text text not null default '' check (length(reward_text) <= 300),
  add column if not exists completed_at timestamptz;
