import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  createPinService,
  isValidSecureStoreKey,
  PIN_ROUNDS_LEGACY,
  pinStorageKey,
  pinTriesKey,
  verifyPinWithFallback,
} from './pinLogic';

function makeMemoryPinService() {
  const store = new Map<string, string>();
  const sha256 = async (input: string) => createHash('sha256').update(input).digest('hex');
  const service = createPinService({
    get: async (k) => {
      if (!isValidSecureStoreKey(k)) {
        throw new Error(`Invalid SecureStore key: ${k}`);
      }
      return store.get(k) ?? null;
    },
    set: async (k, v) => {
      if (!isValidSecureStoreKey(k)) {
        throw new Error(`Invalid SecureStore key: ${k}`);
      }
      store.set(k, v);
    },
    del: async (k) => {
      store.delete(k);
    },
    sha256,
    randomHex: async (len) => 'ab'.repeat(len),
  });
  return { store, service, sha256 };
}

test('pinStorageKey and pinTriesKey satisfy Expo SecureStore character rules', () => {
  const uid = '550e8400-e29b-41d4-a716-446655440000';
  const weirdUid = 'user:with/bad chars+123';
  assert.ok(isValidSecureStoreKey(pinStorageKey(uid)));
  assert.ok(isValidSecureStoreKey(pinTriesKey(uid)));
  assert.ok(isValidSecureStoreKey(pinStorageKey(weirdUid)));
  assert.ok(isValidSecureStoreKey(pinTriesKey(weirdUid)));
  assert.equal(pinStorageKey(uid).includes(':'), false);
});

test('setLocalPin persists across launches and verifyLocalPin accepts the exact PIN', async () => {
  const { service } = makeMemoryPinService();
  const uid = '550e8400-e29b-41d4-a716-446655440000';

  assert.equal(await service.hasLocalPin(uid), false);
  await service.setLocalPin(uid, '4927');
  assert.equal(await service.hasLocalPin(uid), true);

  assert.deepEqual(await service.verifyLocalPin(uid, '4927'), { ok: true });
});

test('wrong PINs count down 5 tries and only lock on the 5th attempt', async () => {
  const { service } = makeMemoryPinService();
  const uid = '550e8400-e29b-41d4-a716-446655440000';
  await service.setLocalPin(uid, '8391');

  assert.deepEqual(await service.verifyLocalPin(uid, '0001'), { ok: false, triesLeft: 4, locked: false });
  assert.deepEqual(await service.verifyLocalPin(uid, '0002'), { ok: false, triesLeft: 3, locked: false });
  assert.deepEqual(await service.verifyLocalPin(uid, '0003'), { ok: false, triesLeft: 2, locked: false });
  assert.deepEqual(await service.verifyLocalPin(uid, '0004'), { ok: false, triesLeft: 1, locked: false });
  assert.deepEqual(await service.verifyLocalPin(uid, '0005'), { ok: false, triesLeft: 0, locked: true });
});

test('correct PIN clears failed attempt counter back to 5 tries', async () => {
  const { service } = makeMemoryPinService();
  const uid = '550e8400-e29b-41d4-a716-446655440000';
  await service.setLocalPin(uid, '6429');

  await service.verifyLocalPin(uid, '1110');
  await service.verifyLocalPin(uid, '1119');
  assert.deepEqual(await service.verifyLocalPin(uid, '6429'), { ok: true });
  assert.deepEqual(await service.verifyLocalPin(uid, '9998'), { ok: false, triesLeft: 4, locked: false });
});

test('missing stored PIN does not trigger lockout or log the user out on 1st try', async () => {
  const { service } = makeMemoryPinService();
  const uid = '550e8400-e29b-41d4-a716-446655440000';

  const res = await service.verifyLocalPin(uid, '4927');
  assert.deepEqual(res, { ok: false, triesLeft: 0, locked: false, missing: true });
});

test('legacy salt:hash PIN format still verifies cleanly', async () => {
  const uid = '550e8400-e29b-41d4-a716-446655440000';
  const sha256 = async (input: string) => createHash('sha256').update(input).digest('hex');
  const salt = 'deadbeef';
  let h = salt + '7351';
  for (let i = 0; i < PIN_ROUNDS_LEGACY; i++) h = await sha256(h + salt);

  const store = new Map<string, string>([[`pin:${uid}`, `${salt}:${h}`]]);
  const service = createPinService({
    get: async (k) => store.get(k) ?? null,
    set: async (k, v) => { store.set(k, v); },
    del: async (k) => { store.delete(k); },
    sha256,
    randomHex: async (len) => 'cd'.repeat(len),
  });

  assert.equal(await service.hasLocalPin(uid), true);
  assert.deepEqual(await service.verifyLocalPin(uid, '7351'), { ok: true });
});

test('verifyPinWithFallback re-caches verified server PIN locally and preserves server error states', async () => {
  const { service } = makeMemoryPinService();
  const uid = '550e8400-e29b-41d4-a716-446655440000';

  const okRes = await verifyPinWithFallback({
    uid,
    pin: '7391',
    verifyLocal: service.verifyLocalPin,
    setLocal: service.setLocalPin,
    verifyRemote: async () => 'ok',
  });
  assert.deepEqual(okRes, { ok: true });
  assert.equal(await service.hasLocalPin(uid), true);

  const missingUid = '660e8400-e29b-41d4-a716-446655440001';
  assert.deepEqual(
    await verifyPinWithFallback({
      uid: missingUid,
      pin: '0000',
      verifyLocal: service.verifyLocalPin,
      setLocal: service.setLocalPin,
      verifyRemote: async () => ({ code: 'WRONG_PIN', triesLeft: 3 }),
    }),
    { ok: false, triesLeft: 3, locked: false },
  );
  assert.deepEqual(
    await verifyPinWithFallback({
      uid: missingUid,
      pin: '0000',
      verifyLocal: service.verifyLocalPin,
      setLocal: service.setLocalPin,
      verifyRemote: async () => ({ code: 'PIN_LOCKED' }),
    }),
    { ok: false, triesLeft: 0, locked: true },
  );
  assert.deepEqual(
    await verifyPinWithFallback({
      uid: missingUid,
      pin: '0000',
      verifyLocal: service.verifyLocalPin,
      setLocal: service.setLocalPin,
      verifyRemote: async () => ({ code: 'NO_PIN' }),
    }),
    { ok: false, triesLeft: 0, locked: false, missing: true },
  );
  assert.deepEqual(
    await verifyPinWithFallback({
      uid: missingUid,
      pin: '0000',
      verifyLocal: service.verifyLocalPin,
      setLocal: service.setLocalPin,
      verifyRemote: async () => ({ code: 'NETWORK_ERROR' }),
    }),
    { ok: false, triesLeft: 0, locked: false, networkError: true },
  );
});
