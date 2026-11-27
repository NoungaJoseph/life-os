import type { TFunction } from 'i18next';
import { ApiError } from './api';

/** Turns an API error into a message in the user's language. Never shows raw server text. */
export function errorMessage(e: unknown, t: TFunction): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'NETWORK': return t('common.errors.network');
      case 'INVALID_CREDENTIALS': return t('auth.errors.invalidCredentials');
      case 'PHONE_IN_USE': return t('auth.errors.phoneInUse');
      case 'BAD_OTP': return t('auth.errors.badOtp');
      case 'TOO_MANY_REQUESTS': return t('auth.errors.tooMany');
      case 'SESSION_REVOKED': return t('auth.errors.sessionRevoked');
      case 'WEAK_PIN': return t('auth.pin.weak');
      case 'REGISTER_FAILED': return t('auth.errors.emailInUse');
      case 'NOT_FOUND': return t('common.errors.notFound');
      case 'VALIDATION_ERROR': case 'BAD_REQUEST': return t('common.errors.validation');
      case 'CONFLICT': return t('common.errors.conflict');
      case 'RATE_LIMITED': return t('common.errors.rateLimited');
      case 'UNAUTHORIZED': return t('common.errors.unauthorized');
      case 'AI_NOT_CONFIGURED': return t('common.errors.aiOff');
      case 'GOAL_LOCKED': return t('savings.lockedError');
      case 'INSUFFICIENT_FUNDS': return t('savings.notEnoughWallet');
    }
  }
  if (e instanceof Error) {
    if (/rate|too many|seconds/i.test(e.message)) return t('auth.errors.tooMany');
    if (/invalid login|invalid credentials/i.test(e.message)) return t('auth.errors.invalidCredentials');
    if (/already registered|already exists/i.test(e.message)) return t('auth.errors.emailInUse');
    if (/token|otp|expired|invalid/i.test(e.message)) return t('auth.errors.badOtp');
  }
  return t('common.errors.generic');
}
