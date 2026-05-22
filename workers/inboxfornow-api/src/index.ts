import { handleHttp } from './api';
import { handleScheduled } from './cron';
import { handleEmail } from './email';
import type { Env } from './types';

export default {
  fetch(request, env) {
    return handleHttp(request, env);
  },
  async email(message, env) {
    await handleEmail(message, env);
  },
  async scheduled(_controller, env) {
    await handleScheduled(env);
  },
} satisfies ExportedHandler<Env>;
