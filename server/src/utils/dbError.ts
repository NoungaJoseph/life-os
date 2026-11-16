import { AppError, badRequest } from './errors';
import { logger } from './logger';

/** Client-caused constraint failures become 4xx; anything else is logged and returned generically (no SQL details leak). */
export function dbFail(e: { message: string; code?: string }): AppError {
  const c = e.code ?? '';
  if (c === '23505') return new AppError(409, 'CONFLICT', 'That record already exists.');
  if (['23503', '23514', '23502', '22P02', '22007', '22008', '22003'].includes(c)) return badRequest('Some of the values are not valid.');
  logger.error({ code: c }, 'Database error');
  return new AppError(500, 'DB_ERROR', 'Database error');
}
