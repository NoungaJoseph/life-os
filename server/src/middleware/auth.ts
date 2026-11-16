import { NextFunction, Request, Response } from 'express';
import { anonClient, createUserClient } from '../config/supabase';
import { unauthorized } from '../utils/errors';

/** The token was already verified by Supabase above, so we only read a claim from it. */
export function sessionIdFromJwt(token: string): string | undefined {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof claims.session_id === 'string' ? claims.session_id : undefined;
  } catch { return undefined; }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    const token = header.slice(7).trim();

    const { data, error } = await anonClient.auth.getUser(token);
    if (error || !data.user) throw unauthorized('Invalid or expired token');

    req.userId = data.user.id;
    req.accessToken = token;
    req.sessionId = sessionIdFromJwt(token);
    req.db = createUserClient(token);
    req.isAdmin = data.user.app_metadata?.role === 'admin' || data.user.app_metadata?.role === 'support';
    next();
  } catch (err) {
    next(err);
  }
}
