import { z } from 'zod';
import { normalizePhone } from '../utils/phone';

const name = z.string().trim().min(1).max(60);
const email = z.string().trim().toLowerCase().email().max(254);
export const password = z.string().min(8).max(128).regex(/[A-Za-z]/, 'letter').regex(/\d/, 'number');
const phone = z.string().trim().max(30).transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) { ctx.addIssue({ code: 'custom', message: 'Invalid phone number' }); return z.NEVER; }
  return p;
});
const otp = z.string().trim().regex(/^\d{6,8}$/, 'Invalid code');

export const registerSchema = z.object({ first_name: name, last_name: name, email, phone, password }).strict();
export const verifyOtpSchema = z.object({ email, token: otp }).strict();
export const resendSchema = z.object({ email }).strict();
export const loginSchema = z.object({ identifier: z.string().trim().min(3).max(254), password: z.string().min(1).max(128) }).strict();
export const forgotSchema = z.object({ email }).strict();
export const resetSchema = z.object({ email, token: otp, new_password: password }).strict();
export const pinSchema = z.object({ pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits') }).strict();
export const setPinSchema = z.object({ pin: z.string().regex(/^\d{4}$/), current_pin: z.string().regex(/^\d{4}$/).optional() }).strict();
