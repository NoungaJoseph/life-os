-- Family emergency savings is a shared pool, separate from each member's locked regular group share.
create table public.family_savings_groups (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check(length(trim(name)) between 2 and 80), invite_code text not null unique,
  pool_account_id uuid not null unique references public.ledger_accounts(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.family_savings_members (
  group_id uuid not null references public.family_savings_groups(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  adult_confirmed_at timestamptz not null,
  joined_at timestamptz not null default now(), primary key(group_id,user_id)
);
create table public.family_savings_contributions (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.family_savings_groups(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check(amount>0), transaction_id uuid not null references public.transactions(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.family_savings_requests (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.family_savings_groups(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  approver_id uuid references public.profiles(id) on delete restrict,
  reason text not null check(length(trim(reason)) between 8 and 500), amount bigint not null check(amount>0),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), reviewed_at timestamptz,
  check(approver_id is null or approver_id<>requester_id)
);
create index family_savings_members_user_idx on public.family_savings_members(user_id);
create index family_savings_requests_group_idx on public.family_savings_requests(group_id,created_at desc);
alter table public.family_savings_groups enable row level security;
alter table public.family_savings_members enable row level security;
alter table public.family_savings_contributions enable row level security;
alter table public.family_savings_requests enable row level security;
create or replace function public.is_family_savings_member(p_group uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.family_savings_members where group_id=p_group and user_id=auth.uid())
$$;
revoke all on function public.is_family_savings_member(uuid) from public,anon;
grant execute on function public.is_family_savings_member(uuid) to authenticated,service_role;
create policy family_groups_read on public.family_savings_groups for select to authenticated using(public.is_family_savings_member(id));
create policy family_members_read on public.family_savings_members for select to authenticated using(public.is_family_savings_member(group_id));
create policy family_contributions_read on public.family_savings_contributions for select to authenticated using(public.is_family_savings_member(group_id));
create policy family_requests_read on public.family_savings_requests for select to authenticated using(public.is_family_savings_member(group_id));
revoke all on public.family_savings_groups,public.family_savings_members,public.family_savings_contributions,public.family_savings_requests from anon,authenticated;
grant select on public.family_savings_groups,public.family_savings_members,public.family_savings_contributions,public.family_savings_requests to authenticated;

create or replace function public.contribute_family_savings(p_user uuid,p_group uuid,p_amount bigint,p_key text) returns public.transactions
language plpgsql security definer set search_path=public as $$
declare g public.family_savings_groups; wallet_account uuid; clearing_account uuid; tx public.transactions;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  if p_amount<=0 then raise exception 'Invalid contribution'; end if;
  select * into tx from public.transactions where user_id=p_user and idempotency_key=p_key;
  if found then return tx; end if;
  select * into g from public.family_savings_groups where id=p_group for update;
  if not found or not exists(select 1 from public.family_savings_members where group_id=p_group and user_id=p_user) then raise exception 'Not a family member'; end if;
  perform public.ensure_wallet(p_user,'XAF');
  select id into wallet_account from public.ledger_accounts where user_id=p_user and code='wallet' for update;
  if (select balance from public.ledger_accounts where id=wallet_account)<p_amount then raise exception 'Insufficient wallet balance'; end if;
  insert into public.ledger_accounts(code,kind,currency) values('family:clearing','provider_clearing','XAF') on conflict(user_id,code,currency) do nothing;
  select id into clearing_account from public.ledger_accounts where user_id is null and code='family:clearing';
  tx:=public.post_ledger_transaction(p_user,p_key,'group_contribution',p_amount,
    jsonb_build_array(jsonb_build_object('account_id',wallet_account,'amount',-p_amount),jsonb_build_object('account_id',clearing_account,'amount',p_amount)),null,jsonb_build_object('family_group_id',p_group));
  perform public.post_ledger_transaction(g.creator_id,'family-in:'||tx.id,'group_contribution',p_amount,
    jsonb_build_array(jsonb_build_object('account_id',clearing_account,'amount',-p_amount),jsonb_build_object('account_id',g.pool_account_id,'amount',p_amount)),null,jsonb_build_object('family_group_id',p_group,'source_transaction',tx.id));
  insert into public.family_savings_contributions(group_id,user_id,amount,transaction_id) values(p_group,p_user,p_amount,tx.id);
  return tx;
end; $$;
revoke all on function public.contribute_family_savings(uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.contribute_family_savings(uuid,uuid,bigint,text) to service_role;

create or replace function public.approve_family_savings_request(p_approver uuid,p_request uuid) returns public.family_savings_requests
language plpgsql security definer set search_path=public as $$
declare request public.family_savings_requests; g public.family_savings_groups; clearing_account uuid; recipient_account uuid;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  select * into request from public.family_savings_requests where id=p_request and status='pending' for update;
  if not found then raise exception 'Pending request not found'; end if;
  if request.requester_id=p_approver or not exists(select 1 from public.family_savings_members where group_id=request.group_id and user_id=p_approver and adult_confirmed_at is not null) then raise exception 'A different adult family member must approve'; end if;
  select * into g from public.family_savings_groups where id=request.group_id for update;
  if (select balance from public.ledger_accounts where id=g.pool_account_id for update)<request.amount then raise exception 'Insufficient family balance'; end if;
  insert into public.ledger_accounts(code,kind,currency) values('family:clearing','provider_clearing','XAF') on conflict(user_id,code,currency) do nothing;
  select id into clearing_account from public.ledger_accounts where user_id is null and code='family:clearing';
  perform public.ensure_wallet(request.requester_id,'XAF');
  select id into recipient_account from public.ledger_accounts where user_id=request.requester_id and code='wallet';
  perform public.post_ledger_transaction(g.creator_id,'family-out:'||request.id,'group_release',request.amount,
    jsonb_build_array(jsonb_build_object('account_id',g.pool_account_id,'amount',-request.amount),jsonb_build_object('account_id',clearing_account,'amount',request.amount)),null,jsonb_build_object('family_request_id',request.id));
  perform public.post_ledger_transaction(request.requester_id,'family-receive:'||request.id,'group_release',request.amount,
    jsonb_build_array(jsonb_build_object('account_id',clearing_account,'amount',-request.amount),jsonb_build_object('account_id',recipient_account,'amount',request.amount)),null,jsonb_build_object('family_request_id',request.id));
  update public.family_savings_requests set status='approved',approver_id=p_approver,reviewed_at=now() where id=request.id returning * into request;
  return request;
end; $$;
revoke all on function public.approve_family_savings_request(uuid,uuid) from public,anon,authenticated;
grant execute on function public.approve_family_savings_request(uuid,uuid) to service_role;
