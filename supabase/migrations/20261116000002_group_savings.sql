-- Group savings: every member owns a locked share and receives only their own savings at the end date.
create table if not exists public.savings_groups (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (length(trim(name)) between 2 and 80), invite_code text not null unique check (length(invite_code) between 8 and 16),
  contribution_amount bigint not null check (contribution_amount > 0), frequency text not null check (frequency in ('daily','weekly','monthly')),
  start_date date not null, end_date date not null check (end_date >= start_date), hide_amounts boolean not null default false,
  status text not null default 'active' check (status in ('active','completed')), created_at timestamptz not null default now()
);
create table if not exists public.savings_group_members (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.savings_groups(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict, share_account_id uuid references public.ledger_accounts(id) on delete restrict,
  lock_accepted_at timestamptz not null, joined_at timestamptz not null default now(), left_at timestamptz, released_at timestamptz,
  unique(group_id,user_id)
);
create table if not exists public.savings_group_contributions (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.savings_groups(id) on delete restrict,
  member_id uuid not null references public.savings_group_members(id) on delete restrict, user_id uuid not null references public.profiles(id) on delete restrict,
  due_on date not null, amount bigint not null check(amount > 0), transaction_id uuid not null references public.transactions(id) on delete restrict,
  paid_at timestamptz not null default now(), created_at timestamptz not null default now(), unique(member_id,due_on)
);
create table if not exists public.savings_group_nudges (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.savings_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade, recipient_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now(), check(sender_id <> recipient_id)
);
create table if not exists public.savings_group_reminder_deliveries (
  member_id uuid not null references public.savings_group_members(id) on delete cascade, due_on date not null,
  sent_at timestamptz not null default now(), primary key(member_id,due_on)
);
create index if not exists savings_group_members_user_idx on public.savings_group_members(user_id) where left_at is null;
create index if not exists savings_group_contributions_member_idx on public.savings_group_contributions(member_id,due_on);

alter table public.savings_groups enable row level security; alter table public.savings_group_members enable row level security;
alter table public.savings_group_contributions enable row level security; alter table public.savings_group_nudges enable row level security;
alter table public.savings_group_reminder_deliveries enable row level security;
create or replace function public.is_savings_group_member(p_group uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.savings_group_members where group_id=p_group and user_id=auth.uid() and left_at is null)$$;
revoke all on function public.is_savings_group_member(uuid) from public,anon;
grant execute on function public.is_savings_group_member(uuid) to authenticated,service_role;
drop policy if exists group_member_read on public.savings_groups;
create policy group_member_read on public.savings_groups for select to authenticated using(public.is_savings_group_member(id));
drop policy if exists group_members_read on public.savings_group_members;
create policy group_members_read on public.savings_group_members for select to authenticated using(public.is_savings_group_member(group_id));
drop policy if exists group_own_contributions on public.savings_group_contributions;
create policy group_own_contributions on public.savings_group_contributions for select to authenticated using(user_id=auth.uid());
drop policy if exists group_own_nudges on public.savings_group_nudges;
create policy group_own_nudges on public.savings_group_nudges for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
revoke all on public.savings_groups, public.savings_group_members, public.savings_group_contributions, public.savings_group_nudges from anon,authenticated;
revoke all on public.savings_group_reminder_deliveries from anon,authenticated;
grant select on public.savings_groups, public.savings_group_members, public.savings_group_contributions, public.savings_group_nudges to authenticated;

-- A group cannot be deleted once any contribution exists. This also protects ledger history.
create or replace function public.protect_funded_group() returns trigger language plpgsql as $$
begin if exists(select 1 from public.savings_group_contributions where group_id=old.id) then raise exception 'A funded group cannot be deleted'; end if; return old; end; $$;
drop trigger if exists savings_group_no_delete_when_funded on public.savings_groups;
create trigger savings_group_no_delete_when_funded before delete on public.savings_groups for each row execute function public.protect_funded_group();

create or replace function public.contribute_group(p_user uuid,p_group uuid,p_due date,p_key text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare g public.savings_groups; m public.savings_group_members; wallet_account uuid; tx public.transactions; existing public.savings_group_contributions;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  select * into existing from public.savings_group_contributions where user_id=p_user and group_id=p_group and due_on=p_due;
  if found then return jsonb_build_object('contribution',to_jsonb(existing),'transaction',(select to_jsonb(t) from public.transactions t where t.id=existing.transaction_id)); end if;
  select * into g from public.savings_groups where id=p_group and status='active' for update; if not found then raise exception 'Group not found'; end if;
  select * into m from public.savings_group_members where group_id=p_group and user_id=p_user and left_at is null for update; if not found then raise exception 'Not a group member'; end if;
  if p_due<g.start_date or p_due>g.end_date or p_due>current_date or current_date>g.end_date then raise exception 'Invalid due date'; end if;
  if g.frequency='weekly' and mod(p_due-g.start_date,7)<>0 then raise exception 'Invalid due date'; end if;
  if g.frequency='monthly' and extract(day from p_due)::int<>least(extract(day from g.start_date)::int,extract(day from (date_trunc('month',p_due)+interval '1 month'-interval '1 day'))::int) then raise exception 'Invalid due date'; end if;
  select id into wallet_account from public.ledger_accounts where user_id=p_user and kind='wallet' for update;
  tx:=public.post_ledger_transaction(p_user,p_key,'group_contribution',g.contribution_amount,
    jsonb_build_array(jsonb_build_object('account_id',wallet_account,'amount',-g.contribution_amount),jsonb_build_object('account_id',m.share_account_id,'amount',g.contribution_amount)),
    null,jsonb_build_object('group_id',p_group,'due_on',p_due));
  insert into public.savings_group_contributions(group_id,member_id,user_id,due_on,amount,transaction_id) values(p_group,m.id,p_user,p_due,g.contribution_amount,tx.id) returning * into existing;
  return jsonb_build_object('contribution',to_jsonb(existing),'transaction',to_jsonb(tx));
end; $$;
revoke all on function public.contribute_group(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.contribute_group(uuid,uuid,date,text) to service_role;

create or replace function public.release_due_group_savings() returns integer
language plpgsql security definer set search_path=public as $$
declare m record; wallet_account uuid; released integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  for m in select gm.*,a.balance,g.end_date from public.savings_group_members gm join public.savings_groups g on g.id=gm.group_id join public.ledger_accounts a on a.id=gm.share_account_id where gm.left_at is null and gm.released_at is null and g.end_date<current_date and a.balance>0 for update of gm,a loop
    select id into wallet_account from public.ledger_accounts where user_id=m.user_id and kind='wallet';
    perform public.post_ledger_transaction(m.user_id,'group-release:'||m.group_id||':'||m.id,'group_release',m.balance,
      jsonb_build_array(jsonb_build_object('account_id',m.share_account_id,'amount',-m.balance),jsonb_build_object('account_id',wallet_account,'amount',m.balance)),null,jsonb_build_object('group_id',m.group_id));
    update public.savings_group_members set released_at=now() where id=m.id; released:=released+1;
  end loop;
  update public.savings_groups g set status='completed' where end_date<current_date and not exists(select 1 from public.savings_group_members m where m.group_id=g.id and m.left_at is null and m.released_at is null and m.share_account_id in (select id from public.ledger_accounts where balance>0));
  return released;
end; $$;
revoke all on function public.release_due_group_savings() from public,anon,authenticated;
grant execute on function public.release_due_group_savings() to service_role;
