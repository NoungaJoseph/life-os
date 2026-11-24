import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminClient } from '../config/supabase';
import { validate } from '../middleware/validate';
import { paymentProvider, nkwaPayConfig } from '../services/payment-provider';
import { postMoney, settlePayment, walletContext } from '../services/wallet-ledger';
import { resolvePaylinkUrl, syncPaymentRequest } from './paylink.routes';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, AppError, forbidden, notFound } from '../utils/errors';
import { created, ok } from '../utils/response';
import { paymentRequestSchema, transactionListQuery, uuidParam, vaultAmountSchema, vaultGoalSchema } from '../validators/schemas';
import { allocateVault } from '../services/vault';

export const walletRouter = Router();
walletRouter.use('/wallet', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
const key = (req: any) => { const value = req.get('Idempotency-Key')?.trim(); if (!value || value.length < 8 || value.length > 128) throw badRequest('A valid Idempotency-Key header is required'); return value; };

walletRouter.get('/wallet', asyncHandler(async (req, res) => {
  try {
    const { wallet, own } = await walletContext(req.userId!, 'sandbox');
    ok(res, { ...wallet, balance: own.balance });
  } catch (e: any) {
    if (/wallet_accounts|ledger_accounts|PGRST205/i.test(String(e?.message ?? ''))) {
      return ok(res, { id: 'default', user_id: req.userId!, currency: 'XAF', balance: 0, status: 'active' });
    }
    throw e;
  }
}));
walletRouter.get('/wallet/transactions', validate(transactionListQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize, status, kind } = req.query as any; let query = adminClient.from('transactions').select('*',{ count:'exact' }).eq('user_id',req.userId!).order('created_at',{ ascending:false }).range((page-1)*pageSize,page*pageSize-1);
  if(status) query=query.eq('status',status); if(kind) query=query.eq('kind',kind); const { data,error,count }=await query;
  if(error) {
    if (error.code === 'PGRST205' || /transactions/i.test(error.message)) return ok(res, [], { page, pageSize, total: 0 });
    throw new AppError(500,'WALLET_ERROR',error.message);
  }
  const ids=(data??[]).map((row:any)=>row.id);const requests=ids.length?await adminClient.from('payment_requests').select('transaction_id,status').in('transaction_id',ids):{data:[]};const paymentStatus=new Map((requests.data??[]).map((row:any)=>[row.transaction_id,row.status]));ok(res,(data??[]).map((row:any)=>({...row,status:paymentStatus.get(row.id)??row.status})),{page,pageSize,total:count??0});
}));

walletRouter.get('/wallet/paylink-config', asyncHandler(async (_req, res) => {
  const cfg = nkwaPayConfig();
  ok(res, {
    nkwa_api_enabled: cfg.apiEnabled,
    deposit_paylink_configured: Boolean(cfg.depositPaylinkUrl),
    withdrawal_paylink_configured: Boolean(cfg.withdrawalPaylinkUrl),
    mode: cfg.mode,
  });
}));

walletRouter.get('/wallet/payments', asyncHandler(async (req, res) => {
  const { data, error } = await adminClient
    .from('payment_requests')
    .select('*')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    if (error.code === 'PGRST205' || /payment_requests/i.test(error.message)) return ok(res, []);
    throw new AppError(500, 'WALLET_ERROR', error.message);
  }
  ok(res, (data ?? []).map((row: any) => ({ ...row, paylink_url: resolvePaylinkUrl(req, row) })));
}));

walletRouter.post('/wallet/payments/:id/sync', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const { data, error } = await adminClient
    .from('payment_requests')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .maybeSingle();
  if (error) throw new AppError(500, 'WALLET_ERROR', error.message);
  if (!data) throw notFound('Payment request not found');
  const updated = await syncPaymentRequest(data);
  ok(res, { ...updated, paylink_url: resolvePaylinkUrl(req, updated) });
}));

async function startPayment(req: any, direction: 'deposit'|'withdrawal') {
  const idempotencyKey=key(req); const body=paymentRequestSchema.parse(req.body); const userId=req.userId!;
  const existing=await adminClient.from('payment_requests').select('*').eq('user_id',userId).eq('direction',direction).eq('idempotency_key',idempotencyKey).maybeSingle();
  if(existing.data) return { ...existing.data, paylink_url: resolvePaylinkUrl(req, existing.data) };
  const { wallet, own }=await walletContext(userId,body.provider);
  const inserted=await adminClient.from('payment_requests').insert({user_id:userId,wallet_id:wallet.id,idempotency_key:idempotencyKey,provider:body.provider,direction,amount:body.amount,currency:'XAF',phone:body.phone}).select().single(); if(inserted.error) throw new AppError(500,'PAYMENT_ERROR',inserted.error.message);
  let hold: any=null;
  if(direction==='withdrawal'){
    const up=await adminClient.from('ledger_accounts').upsert({user_id:userId,wallet_id:wallet.id,code:'withdrawal_hold',kind:'hold',currency:'XAF',locked:true},{onConflict:'user_id,code,currency'}).select().single(); if(up.error) throw new AppError(500,'WALLET_ERROR',up.error.message); hold=up.data;
    try { const tx=await postMoney(userId,`${idempotencyKey}:hold`,'withdrawal',body.amount,[{account_id:own.id,amount:-body.amount},{account_id:hold.id,amount:body.amount}],{stage:'hold',payment_request_id:inserted.data.id}); await adminClient.from('payment_requests').update({transaction_id:tx.id}).eq('id',inserted.data.id); inserted.data.transaction_id=tx.id; }
    catch(e){ await adminClient.from('payment_requests').update({status:'failed',failure_code:'HOLD_FAILED',completed_at:new Date().toISOString()}).eq('id',inserted.data.id); throw e; }
  }
  const provider=paymentProvider(body.provider); let result;
  try { result=direction==='deposit'?await provider.requestDeposit({requestId:inserted.data.id,amount:body.amount,currency:'XAF',phone:body.phone,direction}):await provider.requestWithdrawal({requestId:inserted.data.id,amount:body.amount,currency:'XAF',phone:body.phone,direction}); }
  catch(e){ if(direction==='withdrawal') await settlePayment(inserted.data,'failed'); throw new AppError(503,'PROVIDER_UNAVAILABLE',(e as Error).message); }
  await adminClient.from('payment_requests').update({provider_reference:result.reference,status:result.status}).eq('id',inserted.data.id);
  const finalRow = result.status==='succeeded'||result.status==='failed'? await settlePayment({...inserted.data,provider_reference:result.reference,status:'processing'},result.status):{...inserted.data,provider_reference:result.reference,status:result.status};
  return { ...finalRow, paylink_url: result.paylinkUrl ?? resolvePaylinkUrl(req, finalRow) };
}
walletRouter.post('/wallet/deposits', validate(paymentRequestSchema), asyncHandler(async(req,res)=>created(res,await startPayment(req,'deposit'))));
walletRouter.post('/wallet/withdrawals', validate(paymentRequestSchema), asyncHandler(async(req,res)=>created(res,await startPayment(req,'withdrawal'))));

async function vaultState(userId:string){
  const {wallet}=await walletContext(userId,'sandbox');
  let settings=await adminClient.from('vault_settings').select('*').eq('user_id',userId).maybeSingle();
  if(!settings.data){settings=await adminClient.from('vault_settings').insert({user_id:userId}).select().single();}
  if(settings.error)throw new AppError(500,'VAULT_ERROR',settings.error.message);
  const goals=await adminClient.from('goals').select('id,title,vault_enabled,vault_emergency,vault_priority,vault_target,vault_account_id').eq('user_id',userId).neq('status','abandoned').order('created_at');
  if(goals.error)throw new AppError(500,'VAULT_ERROR',goals.error.message);
  const ids=(goals.data??[]).map((g:any)=>g.vault_account_id).filter(Boolean); const accounts=ids.length?await adminClient.from('ledger_accounts').select('id,balance').in('id',ids):{data:[]};
  const balances=new Map((accounts.data??[]).map((a:any)=>[a.id,a.balance]));
  return {wallet,settings:settings.data,goals:(goals.data??[]).map((g:any)=>({...g,balance:Number(balances.get(g.vault_account_id)??0)}))};
}
walletRouter.get('/vault',asyncHandler(async(req,res)=>{
  try {
    const state=await vaultState(req.userId!);
    ok(res,{accepted:!!state.settings.lock_accepted_at,emergency_share:state.settings.emergency_share,total_locked:state.goals.filter((g:any)=>g.vault_enabled).reduce((n:number,g:any)=>n+g.balance,0),goals:state.goals.filter((g:any)=>g.vault_enabled),available_goals:state.goals});
  } catch (e: any) {
    if (/vault_settings|wallet_accounts|vault_enabled|PGRST205/i.test(String(e?.message ?? ''))) {
      return ok(res, { accepted: false, emergency_share: 20, total_locked: 0, goals: [], available_goals: [] });
    }
    throw e;
  }
}));
walletRouter.put('/vault/consent',asyncHandler(async(req,res)=>{const {data,error}=await adminClient.from('vault_settings').upsert({user_id:req.userId!,lock_accepted_at:new Date().toISOString()},{onConflict:'user_id'}).select().single();if(error)throw new AppError(500,'VAULT_ERROR',error.message);ok(res,data);}));
walletRouter.put('/vault/goals/:id',validate(uuidParam,'params'),validate(vaultGoalSchema),asyncHandler(async(req,res)=>{const b=req.body;const {data,error}=await adminClient.from('goals').update({vault_enabled:b.enabled,vault_emergency:b.emergency,vault_priority:b.priority,vault_target:b.target}).eq('id',req.params.id).eq('user_id',req.userId!).select().maybeSingle();if(error)throw new AppError(500,'VAULT_ERROR',error.message);if(!data)throw new AppError(404,'NOT_FOUND','Goal not found');ok(res,data);}));
const allocation=async(userId:string,amount:number)=>{const state=await vaultState(userId);if(!state.settings.lock_accepted_at)throw new AppError(409,'VAULT_CONSENT_REQUIRED','Accept the Vault lock before depositing');const enabled=state.goals.filter((g:any)=>g.vault_enabled);if(!enabled.length)throw badRequest('Add at least one Vault goal');const parts=allocateVault(amount,enabled.map((g:any)=>({id:g.id,kind:g.vault_emergency?'emergency':undefined,priority:g.vault_priority,target:g.vault_target,balance:g.balance})),state.settings.emergency_share);return{state:{...state,goals:enabled},parts};};
walletRouter.post('/vault/preview',validate(vaultAmountSchema),asyncHandler(async(req,res)=>{const {state,parts}=await allocation(req.userId!,req.body.amount);ok(res,{amount:req.body.amount,parts:parts.map(p=>({...p,title:state.goals.find((g:any)=>g.id===p.goalId)?.title}))});}));
walletRouter.post('/vault/deposits',validate(vaultAmountSchema),asyncHandler(async(req,res)=>{
  const idempotencyKey=key(req);const userId=req.userId!;const {state,parts}=await allocation(userId,req.body.amount);const {own}=await walletContext(userId,'sandbox');const entries:any[]=[{account_id:own.id,amount:-req.body.amount}];const accountByGoal=new Map<string,string>();
  for(const part of parts){const goal=state.goals.find((g:any)=>g.id===part.goalId);let accountId=goal.vault_account_id;if(!accountId){const acc=await adminClient.from('ledger_accounts').upsert({user_id:userId,wallet_id:state.wallet.id,code:`vault-goal:${goal.id}`,kind:'vault_goal',currency:'XAF',locked:true,metadata:{goal_id:goal.id}},{onConflict:'user_id,code,currency'}).select().single();if(acc.error)throw new AppError(500,'VAULT_ERROR',acc.error.message);accountId=acc.data.id;await adminClient.from('goals').update({vault_account_id:accountId}).eq('id',goal.id).eq('user_id',userId);}accountByGoal.set(goal.id,accountId);entries.push({account_id:accountId,amount:part.amount});}
  const transaction=await postMoney(userId,idempotencyKey,'vault_transfer',req.body.amount,entries,{allocation:parts});
  for(const part of parts){const goal=state.goals.find((g:any)=>g.id===part.goalId);if(goal.balance+part.amount>=goal.vault_target){const releaseAmount=goal.balance+part.amount;await postMoney(userId,`${idempotencyKey}:release:${goal.id}`,'vault_release',releaseAmount,[{account_id:accountByGoal.get(goal.id)!,amount:-releaseAmount},{account_id:own.id,amount:releaseAmount}],{goal_id:goal.id,automatic:true});}}
  created(res,{transaction,parts});
}));
walletRouter.post('/admin/vault/releases/:id/approve',validate(uuidParam,'params'),asyncHandler(async(req,res)=>{
  if(!req.isAdmin)throw forbidden();const request=await adminClient.from('release_requests').select('*').eq('id',req.params.id).eq('status','pending').maybeSingle();if(request.error)throw new AppError(500,'VAULT_ERROR',request.error.message);if(!request.data)throw new AppError(404,'NOT_FOUND','Release request not found');
  const goal=await adminClient.from('goals').select('vault_account_id').eq('id',request.data.goal_id).eq('user_id',request.data.user_id).maybeSingle();if(!goal.data?.vault_account_id)throw badRequest('Goal has no locked Vault balance');const account=await adminClient.from('ledger_accounts').select('id,balance').eq('id',goal.data.vault_account_id).single();if(account.error||!account.data)throw badRequest('Goal has no locked Vault balance');const amount=Math.min(Number(account.data.balance),Number(request.data.amount));if(amount<=0)throw badRequest('No locked balance to release');const {own}=await walletContext(request.data.user_id,'sandbox');
  const transaction=await postMoney(request.data.user_id,`support-release:${request.data.id}`,'vault_release',amount,[{account_id:account.data.id,amount:-amount},{account_id:own.id,amount}],{release_request_id:request.data.id,approved_by:req.userId});await adminClient.from('release_requests').update({status:'completed',reviewed_by:req.userId,reviewed_at:new Date().toISOString()}).eq('id',request.data.id);ok(res,{transaction,amount});
}));
