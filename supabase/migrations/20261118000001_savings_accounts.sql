-- Personal savings use ledger accounts; goals are allocations of the savings balance.
alter table public.ledger_accounts drop constraint if exists ledger_accounts_kind_check;
alter table public.ledger_accounts add constraint ledger_accounts_kind_check check (kind in ('wallet','provider_clearing','vault','vault_goal','group_share','hold','fee','savings','savings_goal'));
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check check (kind in ('deposit','withdrawal','vault_transfer','vault_release','group_contribution','group_release','reversal','adjustment','savings_deposit','savings_allocate','savings_release'));

create table public.personal_savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 100),
  target_amount bigint not null check (target_amount > 0),
  contribution_amount bigint not null check (contribution_amount > 0),
  frequency text not null check (frequency in ('daily','weekly','monthly')),
  target_date date,
  locked_until date,
  account_id uuid not null unique references public.ledger_accounts(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index personal_savings_goals_user_idx on public.personal_savings_goals(user_id,created_at);
alter table public.personal_savings_goals enable row level security;
create policy personal_savings_goals_read on public.personal_savings_goals for select to authenticated using(user_id=auth.uid());
revoke all on public.personal_savings_goals from anon,authenticated;
grant select on public.personal_savings_goals to authenticated;

create or replace function public.move_personal_savings(p_user uuid,p_goal uuid,p_action text,p_amount bigint,p_key text) returns public.transactions
language plpgsql security definer set search_path=public as $$
declare source_id uuid; destination_id uuid; savings_id uuid; wallet_id uuid; goal public.personal_savings_goals; tx public.transactions;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  if p_amount<=0 or p_action not in ('deposit','allocate','release','withdraw') then raise exception 'Invalid savings movement'; end if;
  select * into tx from public.transactions where user_id=p_user and idempotency_key=p_key;
  if found then return tx; end if;
  perform public.ensure_wallet(p_user,'XAF');
  insert into public.ledger_accounts(user_id,wallet_id,code,kind,currency) values(p_user,(select id from public.wallets where user_id=p_user),'savings','savings','XAF') on conflict(user_id,code,currency) do nothing;
  select id into wallet_id from public.ledger_accounts where user_id=p_user and code='wallet' for update;
  select id into savings_id from public.ledger_accounts where user_id=p_user and code='savings' for update;
  if p_action in ('allocate','release') then
    select * into goal from public.personal_savings_goals where id=p_goal and user_id=p_user;
    if not found then raise exception 'Savings goal not found'; end if;
    if p_action='release' and goal.locked_until is not null and goal.locked_until>current_date then raise exception 'Goal is locked until %',goal.locked_until; end if;
  end if;
  source_id:=case p_action when 'deposit' then wallet_id when 'allocate' then savings_id when 'release' then goal.account_id else savings_id end;
  destination_id:=case p_action when 'deposit' then savings_id when 'allocate' then goal.account_id when 'release' then savings_id else wallet_id end;
  if (select balance from public.ledger_accounts where id=source_id for update)<p_amount then raise exception 'Insufficient savings or wallet balance'; end if;
  return public.post_ledger_transaction(p_user,p_key,case p_action when 'deposit' then 'savings_deposit' when 'allocate' then 'savings_allocate' else 'savings_release' end,p_amount,
    jsonb_build_array(jsonb_build_object('account_id',source_id,'amount',-p_amount),jsonb_build_object('account_id',destination_id,'amount',p_amount)),
    null,jsonb_build_object('action',p_action,'goal_id',p_goal));
end; $$;
revoke all on function public.move_personal_savings(uuid,uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.move_personal_savings(uuid,uuid,text,bigint,text) to service_role;
