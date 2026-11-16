import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { v1Router } from './routes/v1.routes';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-Device-Name', 'X-Platform'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (r) => ({ method: r.method, url: r.url }),
        res: (r) => ({ statusCode: r.statusCode }),
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  app.use('/api/v1/public/auth', authRouter);

  app.use(
    '/api/v1',
    rateLimit({ windowMs: 60_000, limit: Number(process.env.API_RATE_LIMIT ?? 120), standardHeaders: true, legacyHeaders: false }),
    v1Router,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
