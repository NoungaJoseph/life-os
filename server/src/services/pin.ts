import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const MAX_PIN_TRIES = 5;
export const LOCK_MINUTES = 15;
const WEAK = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '2345', '3456', '0123', '9876', '1212', '2580']);

export const isValidPinFormat = (pin: string) => /^\d{4}$/.test(pin);
export const isWeakPin = (pin: string) => WEAK.has(pin);

export function hashPin(pin: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(pin, salt, 32).toString('hex') };
}
export function verifyPinHash(pin: string, salt: string, hash: string) {
  const a = Buffer.from(scryptSync(pin, salt, 32).toString('hex')), b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
