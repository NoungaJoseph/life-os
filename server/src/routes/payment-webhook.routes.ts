import { Router } from 'express';
import { adminClient } from '../config/supabase';
import { paymentProvider } from '../services/payment-provider';
import { PaymentOperator } from '../services/payments';
import { settlePayment } from '../services/wallet-ledger';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { ok } from '../utils/response';

export const paymentWebhookRouter=Router();
paymentWebhookRouter.post('/:provider',asyncHandler(async(req,res)=>{
  const providerName=req.params.provider as PaymentOperator; if(!['sandbox','mtn','orange'].includes(providerName)) throw notFound();
  const signature=req.get('X-Payment-Signature')??''; const raw=(req as any).rawBody??JSON.stringify(req.body);
  if(!paymentProvider(providerName).verifyWebhook(raw,signature)) throw forbidden('Invalid webhook signature');
  const { event_id,reference,status }=req.body??{}; if(typeof event_id!=='string'||typeof reference!=='string'||!['succeeded','failed'].includes(status)) throw badRequest('Invalid webhook payload');
  const event=await adminClient.from('payment_webhook_events').insert({provider:providerName,event_id,provider_reference:reference,status,payload:req.body}).select().maybeSingle();
  if(event.error?.code==='23505') return ok(res,{duplicate:true}); if(event.error) throw badRequest(event.error.message);
  const request=await adminClient.from('payment_requests').select('*').eq('provider',providerName).eq('provider_reference',reference).maybeSingle(); if(!request.data) return ok(res,{accepted:true,unmatched:true});
  await settlePayment(request.data,status); return ok(res,{accepted:true});
}));
