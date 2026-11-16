import { adminClient } from '../config/supabase';
import { AppError } from '../utils/errors';
export { ledgerMismatches } from './ledger';

export async function walletContext(userId: string, provider: string) {
  const { data: wallet, error: walletError } = await adminClient.rpc('ensure_wallet', { p_user: userId, p_currency: 'XAF' });
  if (walletError || !wallet) throw new AppError(500, 'WALLET_ERROR', walletError?.message ?? 'Could not create wallet');
  const { data: accounts, error } = await adminClient.from('ledger_accounts').select('id,kind,code,balance').or(`user_id.eq.${userId},code.eq.provider:${provider}`);
  if (error) throw new AppError(500, 'WALLET_ERROR', error.message);
  const own = accounts?.find((a: any) => a.kind === 'wallet');
  const clearing = accounts?.find((a: any) => a.code === `provider:${provider}`);
  if (!own || !clearing) throw new AppError(500, 'WALLET_ERROR', 'Ledger accounts are missing');
  return { wallet, own, clearing };
}

export async function postMoney(userId: string, key: string, kind: string, amount: number, entries: { account_id: string; amount: number }[], metadata: Record<string, unknown> = {}) {
  const { data, error } = await adminClient.rpc('post_ledger_transaction', { p_user: userId, p_idempotency_key: key, p_kind: kind, p_amount: amount, p_entries: entries, p_metadata: metadata });
  if (error) {
    const insufficient = /insufficient/i.test(error.message); const limit = /limit/i.test(error.message);
    await adminClient.from('money_audit_log').insert({ user_id: userId, action: limit ? 'velocity_block' : insufficient ? 'insufficient_funds' : 'ledger_error', entity_type: 'transaction', metadata: { kind, amount, message: error.message } });
    throw new AppError(insufficient ? 409 : limit ? 429 : 500, insufficient ? 'INSUFFICIENT_FUNDS' : limit ? 'DAILY_LIMIT' : 'LEDGER_ERROR', error.message);
  }
  return data;
}


export async function settlePayment(request: any, status: 'succeeded' | 'failed') {
  if (request.status === 'succeeded' || request.status === 'failed') return request;
  const { own, clearing } = await walletContext(request.user_id, request.provider);
  if (request.direction === 'deposit' && status === 'succeeded') {
    const tx = await postMoney(request.user_id, `${request.idempotency_key}:credit`, 'deposit', request.amount, [{ account_id: own.id, amount: request.amount }, { account_id: clearing.id, amount: -request.amount }], { payment_request_id: request.id });
    request.transaction_id = tx.id;
  }
  if (request.direction === 'withdrawal') {
    const { data: hold } = await adminClient.from('ledger_accounts').select('id').eq('user_id', request.user_id).eq('code', 'withdrawal_hold').single();
    if (!hold) throw new AppError(500, 'WALLET_ERROR', 'Withdrawal hold account is missing');
    if (status === 'succeeded') await postMoney(request.user_id, `${request.idempotency_key}:settle`, 'adjustment', request.amount, [{ account_id: hold.id, amount: -request.amount }, { account_id: clearing.id, amount: request.amount }], { payment_request_id: request.id });
    else await postMoney(request.user_id, `${request.idempotency_key}:reverse`, 'reversal', request.amount, [{ account_id: hold.id, amount: -request.amount }, { account_id: own.id, amount: request.amount }], { payment_request_id: request.id });
  }
  const { data, error } = await adminClient.from('payment_requests').update({ status, transaction_id: request.transaction_id, completed_at: new Date().toISOString() }).eq('id', request.id).select().single();
  if (error) throw new AppError(500, 'WALLET_ERROR', error.message);
  return data;
}
