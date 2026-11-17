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
import { paymentWebhookRouter } from './routes/payment-webhook.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (
          !origin ||
          env.corsOrigins.includes('*') ||
          env.corsOrigins.includes(origin) ||
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return cb(null, true);
        }
        return cb(null, false);
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Payment-Signature', 'X-Device-Id', 'X-Device-Name', 'X-Platform', 'Accept-Language'],
    }),
  );
  app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as any).rawBody = buf.toString('utf8'); } }));
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
  app.use('/webhooks/payments', paymentWebhookRouter);

  app.use(
    '/api/v1',
    rateLimit({ windowMs: 60_000, limit: Number(process.env.API_RATE_LIMIT ?? 120), standardHeaders: true, legacyHeaders: false }),
    v1Router,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
