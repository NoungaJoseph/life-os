-- Direct Wallet <-> Goal savings locked until target_amount is reached.
alter table public.ledger_accounts drop constraint if exists ledger_accounts_kind_check;
alter table public.ledger_accounts add constraint ledger_accounts_kind_check
  check (kind in ('wallet','provider_clearing','vault','vault_goal','group_share','hold','fee','savings','savings_goal'));

alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('deposit','withdrawal','vault_transfer','vault_release','group_contribution','group_release','reversal','adjustment','savings_deposit','savings_allocate','savings_release'));

create table if not exists public.personal_savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 100),
  target_amount bigint not null check (target_amount > 0),
  contribution_amount bigint not null default 1000 check (contribution_amount > 0),
  frequency text not null default 'weekly' check (frequency in ('daily','weekly','monthly')),
  target_date date,
  locked_until date,
  unlocked_at timestamptz,
  account_id uuid not null unique references public.ledger_accounts(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.personal_savings_goals add column if not exists unlocked_at timestamptz;

create index if not exists personal_savings_goals_user_idx on public.personal_savings_goals(user_id, created_at);
alter table public.personal_savings_goals enable row level security;
drop policy if exists personal_savings_goals_read on public.personal_savings_goals;
create policy personal_savings_goals_read on public.personal_savings_goals for select to authenticated using (user_id = auth.uid());
revoke all on public.personal_savings_goals from anon, authenticated;
grant select on public.personal_savings_goals to authenticated;

-- Backfill goals that have already reached their target.
update public.personal_savings_goals g
set unlocked_at = coalesce(unlocked_at, now())
from public.ledger_accounts a
where g.account_id = a.id
  and g.unlocked_at is null
  and a.balance >= g.target_amount;

create or replace function public.move_personal_savings(
  p_user uuid,
  p_goal uuid,
  p_action text,
  p_amount bigint,
  p_key text
) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  source_id uuid;
  destination_id uuid;
  savings_id uuid;
  wallet_id uuid;
  goal public.personal_savings_goals;
  goal_balance bigint;
  tx public.transactions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_amount <= 0 or p_action not in ('contribute','withdraw_goal','deposit','allocate','release','withdraw') then
    raise exception 'Invalid savings movement';
  end if;

  select * into tx from public.transactions where user_id = p_user and idempotency_key = p_key;
  if found then
    return tx;
  end if;

  perform public.ensure_wallet(p_user, 'XAF');
  insert into public.ledger_accounts(user_id, wallet_id, code, kind, currency)
    values (p_user, (select id from public.wallets where user_id = p_user), 'savings', 'savings', 'XAF')
    on conflict (user_id, code, currency) do nothing;

  select id into wallet_id from public.ledger_accounts where user_id = p_user and code = 'wallet' for update;
  select id into savings_id from public.ledger_accounts where user_id = p_user and code = 'savings' for update;

  if p_action in ('contribute','withdraw_goal','allocate','release') then
    select * into goal from public.personal_savings_goals where id = p_goal and user_id = p_user;
    if not found then
      raise exception 'Savings goal not found';
    end if;
    select balance into goal_balance from public.ledger_accounts where id = goal.account_id for update;
    if p_action in ('withdraw_goal','release') then
      if goal.unlocked_at is null and goal_balance < goal.target_amount then
        raise exception 'Goal is locked until you reach your target of % FCFA', goal.target_amount;
      end if;
      if goal.unlocked_at is null and goal.locked_until is not null and goal.locked_until > current_date then
        raise exception 'Goal is locked until %', goal.locked_until;
      end if;
    end if;
  end if;

  source_id := case p_action
    when 'contribute' then wallet_id
    when 'withdraw_goal' then goal.account_id
    when 'deposit' then wallet_id
    when 'allocate' then savings_id
    when 'release' then goal.account_id
    else savings_id
  end;

  destination_id := case p_action
    when 'contribute' then goal.account_id
    when 'withdraw_goal' then wallet_id
    when 'deposit' then savings_id
    when 'allocate' then goal.account_id
    when 'release' then savings_id
    else wallet_id
  end;

  if (select balance from public.ledger_accounts where id = source_id for update) < p_amount then
    if p_action in ('contribute','deposit') then
      raise exception 'Insufficient wallet balance';
    elsif p_action in ('withdraw_goal','release') then
      raise exception 'Insufficient goal balance';
    else
      raise exception 'Insufficient savings balance';
    end if;
  end if;

  tx := public.post_ledger_transaction(
    p_user,
    p_key,
    case p_action
      when 'contribute' then 'savings_allocate'
      when 'withdraw_goal' then 'savings_release'
      when 'deposit' then 'savings_deposit'
      when 'allocate' then 'savings_allocate'
      else 'savings_release'
    end,
    p_amount,
    jsonb_build_array(
      jsonb_build_object('account_id', source_id, 'amount', -p_amount),
      jsonb_build_object('account_id', destination_id, 'amount', p_amount)
    ),
    null,
    jsonb_build_object('action', p_action, 'goal_id', p_goal)
  );

  if p_action in ('contribute','allocate') and (coalesce(goal_balance, 0) + p_amount) >= goal.target_amount then
    update public.personal_savings_goals
      set unlocked_at = coalesce(unlocked_at, now())
      where id = goal.id;
    update public.ledger_accounts
      set locked = false
      where id = goal.account_id;
  end if;

  return tx;
end; $$;

revoke all on function public.move_personal_savings(uuid, uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.move_personal_savings(uuid, uuid, text, bigint, text) to service_role;
