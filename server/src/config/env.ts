import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  // Optional: enables the AI coach. Predictions and insights work without it.
  ANTHROPIC_API_KEY: z.string().optional(),
  ENABLE_SCHEDULER: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  AI_MODEL: z.string().default('claude-sonnet-5-5'),
  PAYMENTS_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  PAYMENTS_WEBHOOK_SECRET: z.string().min(16).default('development-only-change-me'),
  SANDBOX_PAYMENT_DELAY_MS: z.coerce.number().int().min(0).max(60000).default(800),
  SANDBOX_PAYMENT_SUCCESS_RATE: z.coerce.number().min(0).max(1).default(1),
  MTN_MOMO_API_KEY: z.string().optional(),
  ORANGE_MONEY_API_KEY: z.string().optional(),
  NKWA_PAY_API_KEY: z.string().optional(),
  NKWA_PAY_BASE_URL: z.string().url().optional().or(z.literal('')),
  NKWA_PAY_WEBHOOK_SECRET: z.string().optional(),
  NKWA_PAY_DEPOSIT_PAYLINK_URL: z.string().url().optional().or(z.literal('')),
  NKWA_PAY_WITHDRAWAL_PAYLINK_URL: z.string().url().optional().or(z.literal('')),
  PUBLIC_API_URL: z.string().url().optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && value.PAYMENTS_WEBHOOK_SECRET === 'development-only-change-me') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PAYMENTS_WEBHOOK_SECRET'], message: 'Set a strong production webhook secret' });
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  nkwaPayBaseUrl:
    parsed.data.NKWA_PAY_BASE_URL ||
    (parsed.data.PAYMENTS_MODE === 'live' ? 'https://api.pay.mynkwa.com' : 'https://api.pay.staging.mynkwa.com'),
};
