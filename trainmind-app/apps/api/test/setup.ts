/**
 * Vitest global setup. Loads .env.test if present, else .env.
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const testEnv = resolve(process.cwd(), '.env.test');
const devEnv = resolve(process.cwd(), '.env');
if (existsSync(testEnv)) {
  config({ path: testEnv });
} else if (existsSync(devEnv)) {
  config({ path: devEnv });
}

// Ensure test NODE_ENV
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-min-32-chars-long-abc123';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
