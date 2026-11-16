-- Run with the Supabase database test command after applying migrations.
begin;

do $$
declare tx uuid := gen_random_uuid(); account_a uuid := gen_random_uuid(); account_b uuid := gen_random_uuid(); test_user uuid := gen_random_uuid(); wallet uuid := gen_random_uuid();
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
  values(test_user,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',test_user||'@test.local','x',now(),now());
  insert into public.wallets(id,user_id,currency) values(wallet,test_user,'XAF');
  insert into public.ledger_accounts(id,user_id,wallet_id,code,kind,currency) values
    (account_a,test_user,wallet,'test-wallet','wallet','XAF'),(account_b,test_user,wallet,'test-hold','hold','XAF');
  insert into public.transactions(id,user_id,wallet_id,idempotency_key,kind,status,amount,currency)
  values(tx,test_user,wallet,'database-test-0001','adjustment','succeeded',500,'XAF');
  insert into public.ledger_entries(transaction_id,account_id,amount) values(tx,account_a,500),(tx,account_b,-500);
  set constraints ledger_transaction_balanced immediate;
  if (select balance from public.ledger_accounts where id=account_a) <> 500 then raise exception 'cached balance was not updated'; end if;
  begin update public.ledger_entries set amount=400 where transaction_id=tx and account_id=account_a; raise exception 'append-only update unexpectedly succeeded';
  exception when others then if sqlerrm like 'append-only update unexpectedly%' then raise; end if; end;
  begin
    insert into public.transactions(user_id,wallet_id,idempotency_key,kind,status,amount,currency) values(test_user,wallet,'database-test-0002','adjustment','succeeded',1,'XAF') returning id into tx;
    insert into public.ledger_entries(transaction_id,account_id,amount) values(tx,account_a,1);
    set constraints ledger_transaction_balanced immediate;
    raise exception 'unbalanced transaction unexpectedly succeeded';
  exception when others then if sqlerrm like 'unbalanced transaction unexpectedly%' then raise; end if; end;
end $$;

-- RLS smoke test: a different authenticated user cannot see the first user's wallet.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin if exists(select 1 from public.wallets) then raise exception 'wallet RLS leaked another user'; end if; end $$;

rollback;
