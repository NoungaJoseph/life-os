import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytesAsync } from 'expo-crypto';
import { createPinService, isWeakPin, MAX_PIN_TRIES, PinResult } from './pinLogic';
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

export const { hasLocalPin, setLocalPin, clearLocalPin, verifyLocalPin } = service;
export { isWeakPin, MAX_PIN_TRIES };
export type { PinResult };
