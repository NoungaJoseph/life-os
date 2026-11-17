-- MY LIFE OS: integer-only double-entry wallet ledger, payment requests and locked goal vault.
-- Amounts are whole XAF francs. Ledger entries are immutable; corrections use reversing transactions.

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  currency char(3) not null default 'XAF' check (currency = upper(currency)),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  daily_limit bigint not null default 500000 check (daily_limit > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete cascade,
  code text not null,
  kind text not null check (kind in ('wallet','provider_clearing','vault','vault_goal','group_share','hold','fee')),
  currency char(3) not null default 'XAF',
  balance bigint not null default 0,
  locked boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, code, currency)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid references public.wallets(id) on delete restrict,
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  kind text not null check (kind in ('deposit','withdrawal','vault_transfer','vault_release','group_contribution','group_release','reversal','adjustment')),
  status text not null default 'succeeded' check (status in ('pending','succeeded','failed','reversed')),
  amount bigint not null check (amount > 0),
  currency char(3) not null default 'XAF',
  description text,
  reversal_of uuid references public.transactions(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete restrict,
  account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  amount bigint not null check (amount <> 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, account_id)
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  idempotency_key text not null,
  transaction_id uuid references public.transactions(id) on delete restrict,
  provider text not null check (provider in ('sandbox','mtn','orange')),
  direction text not null check (direction in ('deposit','withdrawal')),
  amount bigint not null check (amount > 0),
  currency char(3) not null default 'XAF', phone text not null,
  provider_reference text, status text not null default 'pending' check (status in ('pending','processing','succeeded','failed','cancelled')),
  failure_code text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
  unique (provider, provider_reference), unique(user_id,direction,idempotency_key)
);
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(), provider text not null, event_id text not null,
  provider_reference text not null, status text not null, payload jsonb not null, received_at timestamptz not null default now(),
  unique(provider,event_id)
);

create table if not exists public.vault_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  emergency_share smallint not null default 20 check (emergency_share between 10 and 40),
  lock_accepted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.goals add column if not exists vault_enabled boolean not null default false,
  add column if not exists vault_emergency boolean not null default false,
  add column if not exists vault_priority smallint not null default 3 check (vault_priority between 1 and 5),
  add column if not exists vault_target bigint check (vault_target is null or vault_target > 0),
  add column if not exists vault_account_id uuid references public.ledger_accounts(id) on delete set null;

create table if not exists public.release_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete restrict, amount bigint not null check (amount > 0), reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','completed')),
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.money_audit_log (
  id bigint generated always as identity primary key, user_id uuid references public.profiles(id) on delete set null,
  action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ledger_entries_account_idx on public.ledger_entries(account_id, created_at);
create index if not exists transactions_user_created_idx on public.transactions(user_id, created_at desc);
create index if not exists payment_requests_user_created_idx on public.payment_requests(user_id, created_at desc);
insert into public.ledger_accounts(user_id,wallet_id,code,kind,currency) values
  (null,null,'provider:sandbox','provider_clearing','XAF'), (null,null,'provider:mtn','provider_clearing','XAF'), (null,null,'provider:orange','provider_clearing','XAF')
on conflict do nothing;

create or replace function public.reject_ledger_mutation() returns trigger language plpgsql as $$
begin raise exception 'Ledger entries are append-only; create a reversal transaction'; end; $$;
drop trigger if exists ledger_entries_no_update on public.ledger_entries;
create trigger ledger_entries_no_update before update or delete on public.ledger_entries for each row execute function public.reject_ledger_mutation();

create or replace function public.apply_ledger_entry() returns trigger language plpgsql as $$
declare next_balance bigint; account_kind text;
begin
  select kind, balance + new.amount into account_kind, next_balance from public.ledger_accounts where id = new.account_id for update;
  if not found then raise exception 'Ledger account not found'; end if;
  if account_kind = 'wallet' and next_balance < 0 then raise exception 'Insufficient wallet balance' using errcode = 'P0001'; end if;
  update public.ledger_accounts set balance = next_balance where id = new.account_id;
  return new;
end; $$;
drop trigger if exists ledger_entry_apply on public.ledger_entries;
create trigger ledger_entry_apply before insert on public.ledger_entries for each row execute function public.apply_ledger_entry();

create or replace function public.assert_transaction_balanced() returns trigger language plpgsql as $$
declare total bigint;
begin
  select coalesce(sum(amount),0) into total from public.ledger_entries where transaction_id = new.transaction_id;
  if total <> 0 then raise exception 'Unbalanced transaction % (sum %)', new.transaction_id, total; end if;
  return null;
end; $$;
drop trigger if exists ledger_transaction_balanced on public.ledger_entries;
create constraint trigger ledger_transaction_balanced after insert on public.ledger_entries deferrable initially deferred for each row execute function public.assert_transaction_balanced();

create or replace function public.ensure_wallet(p_user uuid, p_currency char(3) default 'XAF') returns public.wallets
language plpgsql security definer set search_path = public as $$
declare result public.wallets;
begin
  if auth.uid() is distinct from p_user and auth.role() <> 'service_role' then raise exception 'Forbidden'; end if;
  insert into public.wallets(user_id,currency) values(p_user,p_currency) on conflict(user_id) do nothing;
  select * into result from public.wallets where user_id=p_user;
  insert into public.ledger_accounts(user_id,wallet_id,code,kind,currency) values(p_user,result.id,'wallet','wallet',p_currency) on conflict(user_id,code,currency) do nothing;
  return result;
end; $$;

create or replace function public.post_ledger_transaction(
  p_user uuid, p_idempotency_key text, p_kind text, p_amount bigint, p_entries jsonb,
  p_description text default null, p_metadata jsonb default '{}'::jsonb, p_reversal_of uuid default null
) returns public.transactions
language plpgsql security definer set search_path = public as $$
declare result public.transactions; item jsonb; entry_total bigint := 0; entry_count int := 0; account_owner uuid; account_kind text; wallet public.wallets; spent_today bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if length(p_idempotency_key) not between 8 and 128 or p_amount <= 0 then raise exception 'Invalid ledger request'; end if;
  select * into result from public.transactions where user_id=p_user and idempotency_key=p_idempotency_key;
  if found then return result; end if;
  wallet := public.ensure_wallet(p_user, 'XAF');
  if p_kind in ('withdrawal','vault_transfer','group_contribution') then
    select coalesce(sum(amount),0) into spent_today from public.transactions where user_id=p_user and kind in ('withdrawal','vault_transfer','group_contribution') and status='succeeded' and created_at >= date_trunc('day',now());
    if spent_today + p_amount > wallet.daily_limit then
      insert into public.money_audit_log(user_id,action,entity_type,metadata) values(p_user,'velocity_block','wallet',jsonb_build_object('amount',p_amount,'spent_today',spent_today,'limit',wallet.daily_limit));
      raise exception 'Daily money movement limit exceeded' using errcode='P0001';
    end if;
  end if;
  insert into public.transactions(user_id,wallet_id,idempotency_key,kind,status,amount,currency,description,reversal_of,metadata,completed_at)
  values(p_user,wallet.id,p_idempotency_key,p_kind,'succeeded',p_amount,wallet.currency,p_description,p_reversal_of,p_metadata,now())
  on conflict(user_id,idempotency_key) do nothing returning * into result;
  if result.id is null then select * into result from public.transactions where user_id=p_user and idempotency_key=p_idempotency_key; return result; end if;
  for item in select * from jsonb_array_elements(p_entries) loop
    select user_id,kind into account_owner,account_kind from public.ledger_accounts where id=(item->>'account_id')::uuid for update;
    if not found or (account_owner is distinct from p_user and not (account_owner is null and account_kind='provider_clearing')) then raise exception 'Ledger account does not belong to user'; end if;
    entry_total := entry_total + (item->>'amount')::bigint; entry_count := entry_count + 1;
    insert into public.ledger_entries(transaction_id,account_id,amount) values(result.id,(item->>'account_id')::uuid,(item->>'amount')::bigint);
  end loop;
  if entry_count < 2 or entry_total <> 0 then raise exception 'Transaction entries must balance'; end if;
  insert into public.money_audit_log(user_id,action,entity_type,entity_id,metadata) values(p_user,'ledger_posted','transaction',result.id,jsonb_build_object('kind',p_kind,'amount',p_amount));
  return result;
end; $$;

alter table public.wallets enable row level security; alter table public.ledger_accounts enable row level security;
alter table public.transactions enable row level security; alter table public.ledger_entries enable row level security;
alter table public.payment_requests enable row level security; alter table public.vault_settings enable row level security;
alter table public.release_requests enable row level security; alter table public.money_audit_log enable row level security;
alter table public.payment_webhook_events enable row level security;
drop policy if exists wallets_owner on public.wallets;
create policy wallets_owner on public.wallets for select to authenticated using(user_id=auth.uid());
drop policy if exists ledger_accounts_owner on public.ledger_accounts;
create policy ledger_accounts_owner on public.ledger_accounts for select to authenticated using(user_id=auth.uid());
drop policy if exists transactions_owner on public.transactions;
create policy transactions_owner on public.transactions for select to authenticated using(user_id=auth.uid());
drop policy if exists ledger_entries_owner on public.ledger_entries;
create policy ledger_entries_owner on public.ledger_entries for select to authenticated using(exists(select 1 from public.transactions t where t.id=transaction_id and t.user_id=auth.uid()));
drop policy if exists payment_requests_owner on public.payment_requests;
create policy payment_requests_owner on public.payment_requests for select to authenticated using(user_id=auth.uid());
drop policy if exists vault_settings_owner on public.vault_settings;
create policy vault_settings_owner on public.vault_settings for select to authenticated using(user_id=auth.uid());
drop policy if exists release_requests_owner on public.release_requests;
create policy release_requests_owner on public.release_requests for select to authenticated using(user_id=auth.uid());
drop policy if exists money_audit_owner on public.money_audit_log;
create policy money_audit_owner on public.money_audit_log for select to authenticated using(user_id=auth.uid());

revoke all on public.wallets, public.ledger_accounts, public.transactions, public.ledger_entries, public.payment_requests, public.release_requests, public.money_audit_log from anon, authenticated;
revoke all on public.vault_settings from anon, authenticated;
grant select on public.wallets, public.ledger_accounts, public.transactions, public.ledger_entries, public.payment_requests, public.release_requests, public.money_audit_log to authenticated;
grant select on public.vault_settings to authenticated;
grant execute on function public.ensure_wallet(uuid,char) to authenticated, service_role;
revoke all on function public.post_ledger_transaction(uuid,text,text,bigint,jsonb,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.post_ledger_transaction(uuid,text,text,bigint,jsonb,text,jsonb,uuid) to service_role;
