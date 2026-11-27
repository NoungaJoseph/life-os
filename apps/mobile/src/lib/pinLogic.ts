export const MAX_PIN_TRIES = 5;
export const PIN_ROUNDS_V2 = 250;
export const PIN_ROUNDS_LEGACY = 1500;

const WEAK_PINS = new Set(['1234', '4321', '2345', '3456', '0123', '9876', '1212', '2580']);

export const isWeakPin = (p: string): boolean => /^(\d)\1{3}$/.test(p) || WEAK_PINS.has(p);

export function isValidSecureStoreKey(k: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(k);
}

export function pinStorageKey(uid: string): string {
  return `pin_${uid.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export function pinTriesKey(uid: string): string {
  return `pin_tries_${uid.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export function parseStoredPin(raw: string | null | undefined): { version: 2 | 1; salt: string; hash: string } | null {
  if (!raw) return null;
  const parts = raw.split(':');
  if (parts.length === 3 && parts[0] === 'v2' && parts[1] && parts[2]) {
    return { version: 2, salt: parts[1], hash: parts[2] };
  }
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { version: 1, salt: parts[0], hash: parts[1] };
  }
  return null;
}

export type PinResult =
  | { ok: true }
  | { ok: false; triesLeft: number; locked: boolean; missing?: boolean; networkError?: boolean };

export type RemotePinVerifyOutcome =
  | 'ok'
  | { code: 'WRONG_PIN'; triesLeft: number }
  | { code: 'PIN_LOCKED' }
  | { code: 'NO_PIN' }
  | { code: 'NETWORK_ERROR' };

/** Verify locally first; if this device has no cached PIN, fall back to the server and re-cache on success. */
export async function verifyPinWithFallback(opts: {
  uid: string;
  pin: string;
  verifyLocal: (uid: string, pin: string) => Promise<PinResult>;
  setLocal: (uid: string, pin: string) => Promise<void>;
  verifyRemote: (pin: string) => Promise<RemotePinVerifyOutcome>;
}): Promise<PinResult> {
  const local = await opts.verifyLocal(opts.uid, opts.pin);
  if (local.ok || !local.missing) {
    return local;
  }
  const remote = await opts.verifyRemote(opts.pin);
  if (remote === 'ok') {
    await opts.setLocal(opts.uid, opts.pin).catch(() => undefined);
    return { ok: true };
  }
  if (remote.code === 'WRONG_PIN') {
    const left = Math.max(0, remote.triesLeft);
    return { ok: false, triesLeft: left, locked: left <= 0 };
  }
  if (remote.code === 'PIN_LOCKED') {
    return { ok: false, triesLeft: 0, locked: true };
  }
  if (remote.code === 'NO_PIN') {
    return { ok: false, triesLeft: 0, locked: false, missing: true };
  }
  return { ok: false, triesLeft: 0, locked: false, networkError: true };
}

export interface PinServiceDeps {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<void>;
  sha256: (input: string) => Promise<string>;
  randomHex: (byteLength: number) => Promise<string>;
}

async function deriveHash(sha256: (input: string) => Promise<string>, pin: string, salt: string, rounds: number): Promise<string> {
  let h = salt + pin;
  for (let i = 0; i < rounds; i++) {
    h = await sha256(h + salt);
  }
  return h;
}

export function createPinService(deps: PinServiceDeps) {
  const legacyKey = (uid: string) => `pin:${uid}`;
  const legacyTriesKey = (uid: string) => `pin-tries:${uid}`;

  async function readStoredPin(uid: string): Promise<string | null> {
    const current = await deps.get(pinStorageKey(uid));
    if (current !== null) return current;
    try {
      return await deps.get(legacyKey(uid));
    } catch {
      return null;
    }
  }

  async function safeDel(key: string): Promise<void> {
    try {
      await deps.del(key);
    } catch { /* ignore legacy key cleanup errors */ }
  }

  return {
    async hasLocalPin(uid: string): Promise<boolean> {
      return parseStoredPin(await readStoredPin(uid)) !== null;
    },

    async setLocalPin(uid: string, pin: string): Promise<void> {
      const salt = await deps.randomHex(16);
      const hash = await deriveHash(deps.sha256, pin, salt, PIN_ROUNDS_V2);
      const key = pinStorageKey(uid);
      await deps.set(key, `v2:${salt}:${hash}`);
      const check = await deps.get(key);
      if (!parseStoredPin(check)) {
        throw new Error('Could not persist PIN on this device.');
      }
      await safeDel(pinTriesKey(uid));
      await safeDel(legacyTriesKey(uid));
    },

    async clearLocalPin(uid: string): Promise<void> {
      await safeDel(pinStorageKey(uid));
      await safeDel(pinTriesKey(uid));
      await safeDel(legacyKey(uid));
      await safeDel(legacyTriesKey(uid));
    },

    async verifyLocalPin(uid: string, pin: string): Promise<PinResult> {
      const parsed = parseStoredPin(await readStoredPin(uid));
      if (!parsed) {
        return { ok: false, triesLeft: 0, locked: false, missing: true };
      }
      const rounds = parsed.version === 2 ? PIN_ROUNDS_V2 : PIN_ROUNDS_LEGACY;
      const computed = await deriveHash(deps.sha256, pin, parsed.salt, rounds);
      if (computed === parsed.hash) {
        await safeDel(pinTriesKey(uid));
        await safeDel(legacyTriesKey(uid));
        return { ok: true };
      }
      const tKey = pinTriesKey(uid);
      const prevRaw = await deps.get(tKey);
      const prev = Number.isFinite(Number(prevRaw)) && Number(prevRaw) > 0 ? Math.floor(Number(prevRaw)) : 0;
      const used = prev + 1;
      await deps.set(tKey, String(used));
      return {
        ok: false,
        triesLeft: Math.max(0, MAX_PIN_TRIES - used),
        locked: used >= MAX_PIN_TRIES,
      };
    },
  };
}
