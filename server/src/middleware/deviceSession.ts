import { NextFunction, Request, Response } from 'express';
import { adminClient } from '../config/supabase';
import { AppError } from '../utils/errors';

const TOUCH_EVERY_MS = 5 * 60_000;
const CACHE_MS = 15_000;
const cache = new Map<string, { revoked: boolean; at: number; touched: number; unnamed?: boolean }>();
export const forgetSession = (sid: string) => cache.delete(sid);

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} ._'()-]/gu, '').slice(0, max) : '');

/** Registers each login as a device session and rejects sessions the user has signed out from another device. */
export async function deviceSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const sid = req.sessionId;
    if (!sid) return next();
    const hit = cache.get(sid);
    const now = Date.now();
    const hdrName = clean(req.headers['x-device-name'], 60);
    if (hit && now - hit.at < CACHE_MS && !(hit.unnamed && hdrName)) {
      if (hit.revoked) throw new AppError(401, 'SESSION_REVOKED', 'This device was signed out.');
      return next();
    }
    const { data: row, error } = await adminClient.from('device_sessions').select('id,revoked_at,last_active_at,device_name').eq('auth_session_id', sid).maybeSingle();
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01' || /device_sessions/i.test(error.message)) return next();
      throw new AppError(500, 'DB_ERROR', 'Database error');
    }
    if (row?.revoked_at) { cache.set(sid, { revoked: true, at: now, touched: now }); throw new AppError(401, 'SESSION_REVOKED', 'This device was signed out.'); }
    if (!row) {
      await adminClient.from('device_sessions').insert({
        user_id: req.userId, auth_session_id: sid, device_id: clean(req.headers['x-device-id'], 64) || null,
        device_name: clean(req.headers['x-device-name'], 60) || 'Unknown device', platform: clean(req.headers['x-platform'], 12) || null,
      });
    } else {
      const name = hdrName;
      const learnName = row.device_name === 'Unknown device' && !!name;   // first request may have come without device headers
      if (learnName || !hit || now - hit.touched > TOUCH_EVERY_MS) {
        await adminClient.from('device_sessions').update({ last_active_at: new Date().toISOString(), ...(learnName ? { device_name: name, platform: clean(req.headers['x-platform'], 12) || null } : {}) }).eq('id', row.id);
      }
    }
    cache.set(sid, { revoked: false, at: now, touched: hit && now - hit.touched <= TOUCH_EVERY_MS ? hit.touched : now, unnamed: !hdrName && (!row || row.device_name === 'Unknown device') });
    next();
  } catch (e) { next(e); }
}
