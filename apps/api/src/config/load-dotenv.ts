import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * Loads local `.env` files before any module reads configuration.
 *
 * Must be imported first in the process entrypoint: the environment schema is
 * evaluated at import time, so waiting for Nest's ConfigModule is too late.
 * Existing process variables always win, which keeps Docker/Dokploy in control
 * in deployed environments where no .env file exists.
 */
const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
  resolve(__dirname, '../../../../.env'),
  resolve(__dirname, '../../../../../../.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    loadDotenv({ path, override: false });
    break;
  }
}
