import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminClient } from '../config/supabase';
import { validate } from '../middleware/validate';
import { buildContributionSchedule, contributionDates } from '../services/group-savings';
import { walletContext } from '../services/wallet-ledger';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, badRequest, forbidden, notFound } from '../utils/errors';
import { created, ok } from '../utils/response';
import { createSavingsGroupSchema, groupContributionSchema, groupNudgeSchema, joinSavingsGroupSchema, uuidParam } from '../validators/schemas';

export const groupsRouter = Router();
groupsRouter.use('/groups', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
const inviteCode = () => randomBytes(6).toString('base64url').toUpperCase();
const moneyKey = (req: any) => { const value=req.get('Idempotency-Key')?.trim(); if(!value||value.length<8||value.length>128) throw badRequest('A valid Idempotency-Key header is required'); return value; };

async function membership(userId:string,groupId:string){
  const {data}=await adminClient.from('savings_group_members').select('*').eq('group_id',groupId).eq('user_id',userId).is('left_at',null).maybeSingle();
  if(!data) throw forbidden('You are not an active member of this group'); return data;
}
async function makeMember(group:any,userId:string){
  const {wallet}=await walletContext(userId,'sandbox');
  const account=await adminClient.from('ledger_accounts').upsert({user_id:userId,wallet_id:wallet.id,code:`group:${group.id}`,kind:'group_share',currency:'XAF',locked:true,metadata:{group_id:group.id}},{onConflict:'user_id,code,currency'}).select().single();
  if(account.error) throw new AppError(500,'GROUP_ERROR',account.error.message);
  const member=await adminClient.from('savings_group_members').insert({group_id:group.id,user_id:userId,share_account_id:account.data.id,lock_accepted_at:new Date().toISOString()}).select().single();
  if(member.error) throw new AppError(500,'GROUP_ERROR',member.error.message); return member.data;
}

groupsRouter.get('/groups',asyncHandler(async(req,res)=>{
  const members=await adminClient.from('savings_group_members').select('group_id').eq('user_id',req.userId!).is('left_at',null); const ids=(members.data??[]).map((m:any)=>m.group_id);
  if(!ids.length)return ok(res,[]);const groups=await adminClient.from('savings_groups').select('*').in('id',ids).order('created_at',{ascending:false});if(groups.error)throw new AppError(500,'GROUP_ERROR',groups.error.message);ok(res,groups.data??[]);
}));
groupsRouter.post('/groups',validate(createSavingsGroupSchema),asyncHandler(async(req,res)=>{
  const {lock_accepted,...body}=req.body; contributionDates(body.start_date,body.end_date,body.frequency);
  const inserted=await adminClient.from('savings_groups').insert({...body,creator_id:req.userId!,invite_code:inviteCode()}).select().single();if(inserted.error)throw new AppError(500,'GROUP_ERROR',inserted.error.message);
  const member=await makeMember(inserted.data,req.userId!);created(res,{...inserted.data,membership:member});
}));
groupsRouter.get('/groups/preview/:code',asyncHandler(async(req,res)=>{
  const code=req.params.code.trim().toUpperCase();
  if(!/^[A-Z0-9_-]{8,16}$/.test(code))throw badRequest('Invalid invite code');
  const found=await adminClient.from('savings_groups').select('name,contribution_amount,frequency,start_date,end_date,hide_amounts,status').eq('invite_code',code).eq('status','active').maybeSingle();
  if(found.error)throw new AppError(500,'GROUP_ERROR',found.error.message);
  if(!found.data||found.data.end_date<new Date().toISOString().slice(0,10))throw notFound('Invite code not found');
  ok(res,found.data);
}));
groupsRouter.post('/groups/join',validate(joinSavingsGroupSchema),asyncHandler(async(req,res)=>{
  const found=await adminClient.from('savings_groups').select('*').eq('invite_code',req.body.invite_code.toUpperCase()).eq('status','active').maybeSingle();if(!found.data)throw notFound('Invite code not found');if(found.data.end_date<new Date().toISOString().slice(0,10))throw badRequest('This group has ended');
  const prior=await adminClient.from('savings_group_members').select('*').eq('group_id',found.data.id).eq('user_id',req.userId!).maybeSingle();if(prior.data&&!prior.data.left_at)return ok(res,{...found.data,membership:prior.data});if(prior.data)throw badRequest('A former member cannot rejoin this group');
  created(res,{...found.data,membership:await makeMember(found.data,req.userId!)});
}));
groupsRouter.get('/groups/:id',validate(uuidParam,'params'),asyncHandler(async(req,res)=>{
  const mine=await membership(req.userId!,req.params.id);const group=(await adminClient.from('savings_groups').select('*').eq('id',req.params.id).single()).data;if(!group)throw notFound();
  const members=(await adminClient.from('savings_group_members').select('*').eq('group_id',group.id).is('left_at',null)).data??[];const userIds=members.map((m:any)=>m.user_id);const profiles=userIds.length?(await adminClient.from('profiles').select('id,display_name,first_name,last_name').in('id',userIds)).data??[]:[];
  const all=(await adminClient.from('savings_group_contributions').select('*').eq('group_id',group.id)).data??[];const slots=contributionDates(group.start_date,group.end_date,group.frequency).length;const progress=members.map((m:any)=>{const paid=all.filter((c:any)=>c.member_id===m.id).length;const profile=profiles.find((p:any)=>p.id===m.user_id);return{id:m.id,user_id:m.user_id,name:profile?.display_name??profile?.first_name??'Member',percentage:slots?Math.round(paid/slots*100):0,...(!group.hide_amounts||m.user_id===req.userId!?{saved:paid*group.contribution_amount}:{}),is_creator:m.user_id===group.creator_id};});
  const ownPayments=all.filter((c:any)=>c.member_id===mine.id);ok(res,{...group,invite_code:group.creator_id===req.userId!?group.invite_code:undefined,members:progress,schedule:buildContributionSchedule(group.start_date,group.end_date,group.frequency,ownPayments.map((c:any)=>({due_on:c.due_on,paid_at:c.paid_at}))),my_saved:ownPayments.length*group.contribution_amount});
}));
groupsRouter.post('/groups/:id/contributions',validate(uuidParam,'params'),validate(groupContributionSchema),asyncHandler(async(req,res)=>{
  await membership(req.userId!,req.params.id);const group=(await adminClient.from('savings_groups').select('*').eq('id',req.params.id).single()).data;if(!group||!contributionDates(group.start_date,group.end_date,group.frequency).includes(req.body.due_on))throw badRequest('That date is not in the contribution schedule');const result=await adminClient.rpc('contribute_group',{p_user:req.userId!,p_group:req.params.id,p_due:req.body.due_on,p_key:moneyKey(req)});if(result.error)throw new AppError(/insufficient/i.test(result.error.message)?409:400,/insufficient/i.test(result.error.message)?'INSUFFICIENT_FUNDS':'GROUP_ERROR',result.error.message);created(res,result.data);
}));
groupsRouter.post('/groups/:id/nudges',validate(uuidParam,'params'),validate(groupNudgeSchema),asyncHandler(async(req,res)=>{
  await membership(req.userId!,req.params.id);if(req.body.recipient_id===req.userId)throw badRequest('You cannot nudge yourself');await membership(req.body.recipient_id,req.params.id);
  const since=new Date(Date.now()-86400000).toISOString();const recent=await adminClient.from('savings_group_nudges').select('id').eq('group_id',req.params.id).eq('sender_id',req.userId!).eq('recipient_id',req.body.recipient_id).gte('sent_at',since).maybeSingle();if(recent.data)throw new AppError(429,'NUDGE_LIMIT','You already sent a reminder today');
  const row=await adminClient.from('savings_group_nudges').insert({group_id:req.params.id,sender_id:req.userId!,recipient_id:req.body.recipient_id}).select().single();if(row.error)throw new AppError(500,'GROUP_ERROR',row.error.message);created(res,row.data);
}));
groupsRouter.post('/groups/:id/leave',validate(uuidParam,'params'),asyncHandler(async(req,res)=>{
  const mine=await membership(req.userId!,req.params.id);const group=(await adminClient.from('savings_groups').select('*').eq('id',req.params.id).single()).data;if(group?.creator_id===req.userId)throw badRequest('The creator cannot leave the group');const paid=await adminClient.from('savings_group_contributions').select('id').eq('member_id',mine.id).limit(1);if(paid.data?.length)throw badRequest('You cannot leave after your first contribution');await adminClient.from('savings_group_members').update({left_at:new Date().toISOString()}).eq('id',mine.id);ok(res,{left:true});
}));
groupsRouter.delete('/groups/:id',validate(uuidParam,'params'),asyncHandler(async(req,res)=>{
  const group=(await adminClient.from('savings_groups').select('*').eq('id',req.params.id).eq('creator_id',req.userId!).maybeSingle()).data;if(!group)throw notFound();const paid=await adminClient.from('savings_group_contributions').select('id').eq('group_id',group.id).limit(1);if(paid.data?.length)throw badRequest('A group holding money cannot be deleted');await adminClient.from('savings_group_members').delete().eq('group_id',group.id);await adminClient.from('savings_groups').delete().eq('id',group.id);ok(res,{deleted:true});
}));
