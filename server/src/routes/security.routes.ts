import { Router } from 'express';
import { adminClient } from '../config/supabase';
import { forgetSession } from '../middleware/deviceSession';
import { validate } from '../middleware/validate';
import { hashPin, isValidPinFormat, isWeakPin, LOCK_MINUTES, MAX_PIN_TRIES, verifyPinHash } from '../services/pin';
import { asyncHandler } from '../utils/asyncHandler';
import { dbFail } from '../utils/dbError';
import { AppError, badRequest, notFound } from '../utils/errors';
import { ok } from '../utils/response';
import { pinSchema, setPinSchema } from '../validators/auth';
import { uuidParam } from '../validators/schemas';

export const securityRouter = Router();

// ---- Devices and sessions
securityRouter.get('/sessions', asyncHandler(async (req, res) => {
  const { data, error } = await req.db!.from('device_sessions').select('id,auth_session_id,device_name,platform,created_at,last_active_at').eq('user_id', req.userId!).is('revoked_at', null).order('last_active_at', { ascending: false });
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01' || /device_sessions/i.test(error.message)) return ok(res, []);
    throw dbFail(error);
  }
  ok(res, (data ?? []).map(({ auth_session_id, ...d }: any) => ({ ...d, current: auth_session_id === req.sessionId })));
}));

securityRouter.delete('/sessions/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const { data, error } = await req.db!.from('device_sessions').select('id,auth_session_id').eq('id', req.params.id).eq('user_id', req.userId!).is('revoked_at', null).maybeSingle();
  if (error) throw dbFail(error);
  if (!data) throw notFound('Session not found');
  if (data.auth_session_id === req.sessionId) throw badRequest('Use sign out for this device.');
  await adminClient.from('device_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', data.id);
  await adminClient.rpc('revoke_auth_session', { p_user: req.userId, p_session: data.auth_session_id });
  forgetSession(data.auth_session_id);
  ok(res, { revoked: true });
}));

securityRouter.post('/sessions/revoke-others', asyncHandler(async (req, res) => {
  const { data } = await req.db!.from('device_sessions').select('id,auth_session_id').eq('user_id', req.userId!).is('revoked_at', null);
  const others = (data ?? []).filter((d: any) => d.auth_session_id !== req.sessionId);
  for (const o of others) { await adminClient.from('device_sessions').update({ revoked_at: new Date().toISOString() }).eq('id', o.id); forgetSession(o.auth_session_id); }
  if (req.sessionId) await adminClient.rpc('revoke_other_auth_sessions', { p_user: req.userId, p_keep: req.sessionId });
  ok(res, { revoked: others.length });
}));

// ---- PIN (server copy, used to confirm money actions; the app also keeps a local copy to unlock the screen)
securityRouter.get('/security/pin', asyncHandler(async (req, res) => {
  const { data } = await adminClient.from('user_security').select('pin_set_at').eq('user_id', req.userId!).maybeSingle();
  ok(res, { has_pin: !!data?.pin_set_at });
}));

securityRouter.put('/security/pin', validate(setPinSchema), asyncHandler(async (req, res) => {
  const { pin, current_pin } = req.body as { pin: string; current_pin?: string };
  if (isWeakPin(pin)) throw new AppError(400, 'WEAK_PIN', 'Choose a PIN that is harder to guess.');
  const { data: cur } = await adminClient.from('user_security').select('*').eq('user_id', req.userId!).maybeSingle();
  if (cur?.pin_hash) {
    // Changing an existing PIN requires the old one, so a stolen unlocked phone cannot silently replace it.
    if (!current_pin || !verifyPinHash(current_pin, cur.pin_salt, cur.pin_hash)) throw new AppError(403, 'WRONG_PIN', 'Current PIN is wrong.');
  }
  const { salt, hash } = hashPin(pin);
  const { error } = await adminClient.from('user_security').upsert({ user_id: req.userId!, pin_hash: hash, pin_salt: salt, pin_failed: 0, pin_locked_until: null, pin_set_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw dbFail(error);
  ok(res, { has_pin: true });
}));

securityRouter.post('/security/pin/verify', validate(pinSchema), asyncHandler(async (req, res) => {
  const { data: s } = await adminClient.from('user_security').select('*').eq('user_id', req.userId!).maybeSingle();
  if (!s?.pin_hash) throw new AppError(400, 'NO_PIN', 'No PIN set.');
  if (s.pin_locked_until && new Date(s.pin_locked_until) > new Date()) throw new AppError(423, 'PIN_LOCKED', 'Too many wrong tries. Try again later.');
  if (!isValidPinFormat(req.body.pin) || !verifyPinHash(req.body.pin, s.pin_salt, s.pin_hash)) {
    const failed = (s.pin_failed ?? 0) + 1;
    const lock = failed >= MAX_PIN_TRIES;
    await adminClient.from('user_security').update({ pin_failed: lock ? 0 : failed, pin_locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null }).eq('user_id', req.userId!);
    throw new AppError(403, 'WRONG_PIN', 'Wrong PIN.', { triesLeft: lock ? 0 : MAX_PIN_TRIES - failed });
  }
  await adminClient.from('user_security').update({ pin_failed: 0, pin_locked_until: null }).eq('user_id', req.userId!);
  ok(res, { verified: true });
}));
