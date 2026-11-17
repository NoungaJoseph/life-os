import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminClient, anonClient } from '../config/supabase';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { normalizePhone } from '../utils/phone';
import { created, ok } from '../utils/response';
import { forgotSchema, loginSchema, registerSchema, resendSchema, resetSchema, verifyOtpSchema } from '../validators/auth';

/** Public (no token) account routes. Strictly rate-limited; errors are deliberately generic so they cannot be used to find out who has an account. */
export const authRouter = Router();
authRouter.use(rateLimit({ windowMs: 60_000, limit: Number(process.env.AUTH_RATE_LIMIT ?? 15), standardHeaders: true, legacyHeaders: false,
  handler: (_req, res) => { res.status(429).json({ success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many tries. Please wait a moment.' } }); } }));

const sessionPayload = (s: { access_token: string; refresh_token: string; expires_in: number; expires_at?: number }, user: { id: string; email?: string | null }) =>
  ({ access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at, user: { id: user.id, email: user.email ?? null } });

authRouter.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const { first_name, last_name, email, phone, password } = req.body;
  const taken = await adminClient.from('profiles').select('id').eq('phone', phone).maybeSingle();
  if (taken.error) throw new AppError(500, 'DB_ERROR', 'Database error');
  if (taken.data) throw new AppError(409, 'PHONE_IN_USE', 'This phone number is already used.');
  const { data, error } = await anonClient.auth.signUp({ email, password, options: { data: { first_name, last_name, phone, display_name: first_name } } });
  if (error) {
    if (error.status === 429) throw new AppError(429, 'TOO_MANY_REQUESTS', 'Too many tries. Please wait a moment.');
    if (/database error/i.test(error.message)) throw new AppError(409, 'PHONE_IN_USE', 'This phone number is already used.');
    logger.warn({ status: error.status }, 'signup failed');
    throw new AppError(400, 'REGISTER_FAILED', 'Could not create the account.');
  }
  // Same answer whether or not the email already had an account, so this cannot be used to probe for accounts.
  created(res, { next: 'verify_otp', email, ...(data?.session && data?.user ? { session: sessionPayload(data.session, data.user) } : {}) });
}));

authRouter.post('/verify-otp', validate(verifyOtpSchema), asyncHandler(async (req, res) => {
  let { data, error } = await anonClient.auth.verifyOtp({ email: req.body.email, token: req.body.token, type: 'email' });
  if (error || !data.session || !data.user) {
    ({ data, error } = await anonClient.auth.verifyOtp({ email: req.body.email, token: req.body.token, type: 'signup' }));
  }
  if (error || !data.session || !data.user) throw new AppError(400, 'BAD_OTP', 'This code is wrong or has expired.');
  ok(res, sessionPayload(data.session, data.user));
}));

authRouter.post('/resend-otp', validate(resendSchema), asyncHandler(async (req, res) => {
  await anonClient.auth.resend({ type: 'signup', email: req.body.email });
  ok(res, { sent: true });
}));

authRouter.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const bad = new AppError(401, 'INVALID_CREDENTIALS', 'Wrong email, phone number or password.');
  const id: string = req.body.identifier;
  let email: string | null = null;
  if (id.includes('@')) email = id.toLowerCase();
  else {
    const phone = normalizePhone(id);
    if (!phone) throw bad;
    const p = await adminClient.from('profiles').select('id').eq('phone', phone).maybeSingle();
    if (p.data) { const u = await adminClient.auth.admin.getUserById(p.data.id); email = u.data.user?.email ?? null; }
  }
  if (!email) throw bad;
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password: req.body.password });
  if (error || !data.session) {
    if (error && /confirm/i.test(error.message)) throw new AppError(403, 'EMAIL_NOT_CONFIRMED', 'Please confirm your email.', { email });
    throw bad;
  }
  ok(res, sessionPayload(data.session, data.user));
}));

authRouter.post('/forgot-password', validate(forgotSchema), asyncHandler(async (req, res) => {
  await anonClient.auth.resetPasswordForEmail(req.body.email);
  ok(res, { sent: true });   // always the same answer
}));

authRouter.post('/reset-password', validate(resetSchema), asyncHandler(async (req, res) => {
  const { data, error } = await anonClient.auth.verifyOtp({ email: req.body.email, token: req.body.token, type: 'recovery' });
  if (error || !data.session || !data.user) throw new AppError(400, 'BAD_OTP', 'This code is wrong or has expired.');
  const up = await adminClient.auth.admin.updateUserById(data.user.id, { password: req.body.new_password });
  if (up.error) throw new AppError(500, 'RESET_FAILED', 'Could not change the password.');
  await adminClient.auth.admin.signOut(data.session.access_token, 'global').catch(() => undefined); // sign out everywhere after a reset
  ok(res, { reset: true });
}));
