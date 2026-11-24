import { randomBytes, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { adminClient } from '../config/supabase';
import { validate } from '../middleware/validate';
import { walletContext } from '../services/wallet-ledger';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, badRequest, forbidden, notFound } from '../utils/errors';
import { created, ok } from '../utils/response';
import { uuidParam } from '../validators/schemas';

export const familySavingsRouter = Router();
const key = (req: any) => { const value=req.get('Idempotency-Key')?.trim(); if(!value||value.length<8||value.length>128)throw badRequest('A valid Idempotency-Key header is required'); return value; };
const createBody=z.object({name:z.string().trim().min(2).max(80),adult_confirmed:z.literal(true)}).strict();
const joinBody=z.object({invite_code:z.string().trim().min(8).max(16),adult_confirmed:z.literal(true)}).strict();
const amountBody=z.object({amount:z.number().int().positive().max(10_000_000)}).strict();
const requestBody=amountBody.extend({reason:z.string().trim().min(8).max(500)});
async function member(uid:string,id:string){const result=await adminClient.from('family_savings_members').select('user_id').eq('group_id',id).eq('user_id',uid).maybeSingle();if(!result.data)throw forbidden('You are not a family member');}

familySavingsRouter.get('/family-savings',asyncHandler(async(req,res)=>{
  const members=await adminClient.from('family_savings_members').select('group_id').eq('user_id',req.userId!);
  if(members.error)throw new AppError(500,'FAMILY_ERROR',members.error.message);
  const ids=(members.data??[]).map((x:any)=>x.group_id);
  if(!ids.length)return ok(res,[]);
  const groups=await adminClient.from('family_savings_groups').select('id,name,creator_id,invite_code,created_at,pool_account_id').in('id',ids);
  if(groups.error)throw new AppError(500,'FAMILY_ERROR',groups.error.message);
  const balances=await adminClient.from('ledger_accounts').select('id,balance').in('id',(groups.data??[]).map((g:any)=>g.pool_account_id));
  const map=new Map((balances.data??[]).map((a:any)=>[a.id,Number(a.balance)]));
  ok(res,(groups.data??[]).map((g:any)=>({id:g.id,name:g.name,balance:map.get(g.pool_account_id)??0,created_at:g.created_at})));
}));
familySavingsRouter.post('/family-savings',validate(createBody),asyncHandler(async(req,res)=>{
  const uid=req.userId!,id=randomUUID(),{wallet}=await walletContext(uid,'sandbox');
  const account=await adminClient.from('ledger_accounts').insert({user_id:uid,wallet_id:wallet.id,code:`family:${id}`,kind:'group_share',currency:'XAF',locked:true,metadata:{family_group_id:id}}).select('id').single();
  if(account.error)throw new AppError(500,'FAMILY_ERROR',account.error.message);
  const group=await adminClient.from('family_savings_groups').insert({id,name:req.body.name,creator_id:uid,invite_code:randomBytes(6).toString('base64url').toUpperCase(),pool_account_id:account.data.id}).select().single();
  if(group.error)throw new AppError(500,'FAMILY_ERROR',group.error.message);
  const member=await adminClient.from('family_savings_members').insert({group_id:id,user_id:uid,adult_confirmed_at:new Date().toISOString()});
  if(member.error)throw new AppError(500,'FAMILY_ERROR',member.error.message);
  created(res,{id,name:group.data.name});
}));
familySavingsRouter.get('/family-savings/preview/:code',asyncHandler(async(req,res)=>{
  const code=req.params.code.trim().toUpperCase();if(!/^[A-Z0-9_-]{8,16}$/.test(code))throw badRequest('Invalid invite code');
  const found=await adminClient.from('family_savings_groups').select('name').eq('invite_code',code).maybeSingle();
  if(!found.data)throw notFound('Invite code not found');ok(res,found.data);
}));
familySavingsRouter.post('/family-savings/join',validate(joinBody),asyncHandler(async(req,res)=>{
  const group=await adminClient.from('family_savings_groups').select('id,name').eq('invite_code',req.body.invite_code.toUpperCase()).maybeSingle();
  if(!group.data)throw notFound('Invite code not found');
  const membership=await adminClient.from('family_savings_members').upsert({group_id:group.data.id,user_id:req.userId!,adult_confirmed_at:new Date().toISOString()},{onConflict:'group_id,user_id'});
  if(membership.error)throw new AppError(500,'FAMILY_ERROR',membership.error.message);
  created(res,group.data);
}));
familySavingsRouter.get('/family-savings/:id',validate(uuidParam,'params'),asyncHandler(async(req,res)=>{
  await member(req.userId!,req.params.id);
  const group=await adminClient.from('family_savings_groups').select('*').eq('id',req.params.id).single();
  if(!group.data)throw notFound();
  const [balance,members,contributions,requests]=await Promise.all([
    adminClient.from('ledger_accounts').select('balance').eq('id',group.data.pool_account_id).single(),
    adminClient.from('family_savings_members').select('user_id,joined_at').eq('group_id',group.data.id),
    adminClient.from('family_savings_contributions').select('user_id,amount,created_at').eq('group_id',group.data.id).order('created_at',{ascending:false}).limit(50),
    adminClient.from('family_savings_requests').select('*').eq('group_id',group.data.id).order('created_at',{ascending:false}).limit(50),
  ]);
  if(balance.error||members.error||contributions.error||requests.error)throw new AppError(500,'FAMILY_ERROR','Could not load family savings');
  ok(res,{id:group.data.id,name:group.data.name,invite_code:group.data.invite_code,balance:Number(balance.data.balance),members:members.data??[],contributions:contributions.data??[],requests:requests.data??[]});
}));
familySavingsRouter.post('/family-savings/:id/contributions',validate(uuidParam,'params'),validate(amountBody),asyncHandler(async(req,res)=>{
  const {data,error}=await adminClient.rpc('contribute_family_savings',{p_user:req.userId!,p_group:req.params.id,p_amount:req.body.amount,p_key:key(req)});
  if(error)throw new AppError(/insufficient/i.test(error.message)?409:400,'FAMILY_ERROR',error.message);created(res,data);
}));
familySavingsRouter.post('/family-savings/:id/requests',validate(uuidParam,'params'),validate(requestBody),asyncHandler(async(req,res)=>{
  await member(req.userId!,req.params.id);
  const {data,error}=await adminClient.from('family_savings_requests').insert({group_id:req.params.id,requester_id:req.userId!,amount:req.body.amount,reason:req.body.reason}).select().single();
  if(error)throw new AppError(500,'FAMILY_ERROR',error.message);created(res,data);
}));
familySavingsRouter.post('/family-savings/:id/requests/:requestId/approve',asyncHandler(async(req,res)=>{
  await member(req.userId!,req.params.id);
  const existing=await adminClient.from('family_savings_requests').select('group_id').eq('id',req.params.requestId).single();
  if(existing.data?.group_id!==req.params.id)throw notFound();
  const {data,error}=await adminClient.rpc('approve_family_savings_request',{p_approver:req.userId!,p_request:req.params.requestId});
  if(error)throw new AppError(/insufficient/i.test(error.message)?409:400,'FAMILY_ERROR',error.message);ok(res,data);
}));
