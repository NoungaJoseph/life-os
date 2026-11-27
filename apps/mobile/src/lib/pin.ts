import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytesAsync } from 'expo-crypto';
import { api, ApiError } from './api';
import { createPinService, isWeakPin, MAX_PIN_TRIES, PinResult, RemotePinVerifyOutcome, verifyPinWithFallback } from './pinLogic';
import { secureDel, secureGet, secureSet } from './storage';

const service = createPinService({
  get: secureGet,
  set: secureSet,
  del: secureDel,
  sha256: (input) => digestStringAsync(CryptoDigestAlgorithm.SHA256, input),
  randomHex: async (byteLength) =>
    Array.from(await getRandomBytesAsync(byteLength))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
});

/** Verify PIN locally on this device, falling back to the backend copy if local storage was cleared. */
export function verifyAccountPin(uid: string, pin: string): Promise<PinResult> {
  return verifyPinWithFallback({
    uid,
    pin,
    verifyLocal: service.verifyLocalPin,
    setLocal: service.setLocalPin,
    verifyRemote: async (candidate): Promise<RemotePinVerifyOutcome> => {
      try {
        await api<{ verified: boolean }>('/security/pin/verify', { method: 'POST', body: { pin: candidate } });
        return 'ok';
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.code === 'WRONG_PIN') {
            return { code: 'WRONG_PIN', triesLeft: typeof e.details?.triesLeft === 'number' ? e.details.triesLeft : 1 };
          }
          if (e.code === 'PIN_LOCKED') return { code: 'PIN_LOCKED' };
          if (e.code === 'NO_PIN') return { code: 'NO_PIN' };
        }
        return { code: 'NETWORK_ERROR' };
      }
    },
  });
}

export const { hasLocalPin, setLocalPin, clearLocalPin, verifyLocalPin } = service;
export { isWeakPin, MAX_PIN_TRIES };
export type { PinResult };
