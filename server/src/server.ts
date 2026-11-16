import { env } from './config/env';
import { createApp } from './app';
import { startScheduler } from './services/push';
import { logger } from './utils/logger';

createApp().listen(env.PORT, () => {
  logger.info(`MY LIFE OS API listening on port ${env.PORT}`);
  if (env.ENABLE_SCHEDULER) { startScheduler(); logger.info('Reminder scheduler started'); }
});
