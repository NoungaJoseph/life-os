import { adminClient } from '../src/config/supabase';
import { ledgerMismatches } from '../src/services/ledger';

const accounts = await adminClient.from('ledger_accounts').select('id,balance');
const entries = await adminClient.from('ledger_entries').select('account_id,amount');
if (accounts.error || entries.error) throw new Error(accounts.error?.message ?? entries.error?.message);
const mismatches = ledgerMismatches((accounts.data ?? []).map((a) => ({ id: a.id, balance: Number(a.balance) })), (entries.data ?? []).map((e) => ({ account_id: e.account_id, amount: Number(e.amount) })));
if (mismatches.length) {
  console.error(JSON.stringify({ ok: false, mismatches }, null, 2));
  process.exitCode = 1;
} else console.log(JSON.stringify({ ok: true, accounts: accounts.data?.length ?? 0 }));
