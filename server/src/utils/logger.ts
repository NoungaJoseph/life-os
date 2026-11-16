import pino from 'pino';
import { env } from '../config/env';

// Request bodies are never logged: they may contain journal or financial content.
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});
