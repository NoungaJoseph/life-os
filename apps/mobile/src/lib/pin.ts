import * as Crypto from 'expo-crypto';
import { secureDel, secureGet, secureSet } from './storage';

/** The PIN only unlocks the Supabase session stored securely on this device. */
const MAX_TRIES = 5;
const ROUNDS = 1500;

async function derive(pin: string, salt: string) {
  let h = salt + pin;
  for (let i = 0; i < ROUNDS; i++) h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h + salt);
  return h;
}
const key = (uid: string) => `pin:${uid}`;
const triesKey = (uid: string) => `pin-tries:${uid}`;

export async function hasLocalPin(uid: string) { return !!(await secureGet(key(uid))); }
export async function setLocalPin(uid: string, pin: string) {
  const salt = Array.from(await Crypto.getRandomBytesAsync(16)).map((b) => b.toString(16).padStart(2, '0')).join('');
  await secureSet(key(uid), `${salt}:${await derive(pin, salt)}`);
  await secureDel(triesKey(uid));
}
export async function clearLocalPin(uid: string) { await secureDel(key(uid)); await secureDel(triesKey(uid)); }

export type PinResult = { ok: true } | { ok: false; triesLeft: number; locked: boolean };
export async function verifyLocalPin(uid: string, pin: string): Promise<PinResult> {
  const stored = await secureGet(key(uid));
  if (!stored) return { ok: false, triesLeft: 0, locked: true };
  const [salt, hash] = stored.split(':');
  if ((await derive(pin, salt)) === hash) { await secureDel(triesKey(uid)); return { ok: true }; }
  const used = Number((await secureGet(triesKey(uid))) ?? 0) + 1;
  await secureSet(triesKey(uid), String(used));
  return { ok: false, triesLeft: Math.max(0, MAX_TRIES - used), locked: used >= MAX_TRIES };
}
export const isWeakPin = (p: string) => /^(\d)\1{3}$/.test(p) || ['1234', '4321', '2345', '3456', '0123', '9876', '1212', '2580'].includes(p);
