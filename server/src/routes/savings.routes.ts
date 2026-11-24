import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { adminClient } from '../config/supabase';
import { validate } from '../middleware/validate';
import { walletContext } from '../services/wallet-ledger';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, badRequest } from '../utils/errors';
import { created, ok } from '../utils/response';
import { isoDate } from '../validators/schemas';

export const savingsRouter = Router();
const goalBody = z.object({ name: z.string().trim().min(2).max(100), target_amount: z.number().int().positive().max(100_000_000),
  contribution_amount: z.number().int().positive().max(10_000_000), frequency: z.enum(['daily','weekly','monthly']),
  target_date: isoDate.optional(), locked_until: isoDate.optional() }).strict();
const moveBody = z.object({ amount: z.number().int().positive().max(10_000_000), goal_id: z.string().uuid().optional() }).strict();
const moneyKey = (req: any) => { const value = req.get('Idempotency-Key')?.trim(); if (!value || value.length < 8 || value.length > 128) throw badRequest('A valid Idempotency-Key header is required'); return value; };

savingsRouter.get('/savings', asyncHandler(async (req,res) => {
  const uid=req.userId!; const { own }=await walletContext(uid,'sandbox');
  const [account,goals]=await Promise.all([
    adminClient.from('ledger_accounts').select('id,balance').eq('user_id',uid).eq('code','savings').maybeSingle(),
    adminClient.from('personal_savings_goals').select('*,ledger_accounts(balance)').eq('user_id',uid).order('created_at',{ascending:false}),
  ]);
  if(account.error||goals.error)throw new AppError(500,'SAVINGS_ERROR',account.error?.message??goals.error?.message??'Could not load savings');
  const items=(goals.data??[]).map((goal:any)=>{
    const balance=Number(goal.ledger_accounts?.balance??0);
    const remaining=Math.max(0,Number(goal.target_amount)-balance);
    const installments=Math.ceil(remaining/Number(goal.contribution_amount));
    const days=goal.frequency==='daily'?installments:goal.frequency==='weekly'?installments*7:installments*30;
    const projected=new Date(Date.now()+days*86_400_000).toISOString().slice(0,10);
    const {ledger_accounts,...rest}=goal;
    return {...rest,balance,installments_remaining:installments,projected_completion:projected};
  });
  ok(res,{wallet_balance:Number(own.balance),available_balance:Number(account.data?.balance??0),total_balance:Number(account.data?.balance??0)+items.reduce((n:number,g:any)=>n+g.balance,0),goals:items});
}));

savingsRouter.post('/savings/goals',validate(goalBody),asyncHandler(async(req,res)=>{
  const uid=req.userId!;const {wallet}=await walletContext(uid,'sandbox');
  const goalId=randomUUID();
  const account=await adminClient.from('ledger_accounts').insert({user_id:uid,wallet_id:wallet.id,code:`savings-goal:${goalId}`,kind:'savings_goal',currency:'XAF',locked:!!req.body.locked_until,metadata:{goal_id:goalId}}).select('id').single();
  if(account.error)throw new AppError(500,'SAVINGS_ERROR',account.error.message);
  const goal=await adminClient.from('personal_savings_goals').insert({...req.body,id:goalId,user_id:uid,account_id:account.data.id}).select().single();
  if(goal.error)throw new AppError(500,'SAVINGS_ERROR',goal.error.message);
  created(res,goal.data);
}));

for(const action of ['deposit','allocate','release','withdraw'] as const){
  savingsRouter.post(`/savings/${action}`,validate(moveBody),asyncHandler(async(req,res)=>{
    if((action==='allocate'||action==='release')&&!req.body.goal_id)throw badRequest('Choose a savings goal');
    const {data,error}=await adminClient.rpc('move_personal_savings',{p_user:req.userId!,p_goal:req.body.goal_id??null,p_action:action,p_amount:req.body.amount,p_key:moneyKey(req)});
    if(error)throw new AppError(/insufficient|locked/i.test(error.message)?409:400,'SAVINGS_ERROR',error.message);
    created(res,data);
  }));
}
