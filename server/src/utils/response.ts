import { Response } from 'express';

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

export const created = <T>(res: Response, data: T) => ok(res, data, undefined, 201);
