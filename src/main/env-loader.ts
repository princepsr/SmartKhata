/**
 * Environment Loader
 *
 * This must be imported at the very top of index.ts to ensure
 * environment variables are available before any other services initialize.
 */

import path from 'path';
import fs from 'fs';

import { bundledEnv } from './config/env-bundle';

export function loadEnv(): void {
  try {
    // 1. Try to load from local .env (Development)
    const envPath = path.join(process.cwd(), '.env');
    const appPath = path.join(__dirname, '..', '..', '.env');

    const finalPath = fs.existsSync(envPath) ? envPath : fs.existsSync(appPath) ? appPath : null;

    if (finalPath) {
      const content = fs.readFileSync(finalPath, 'utf8');
      const keys = [];
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts
              .join('=')
              .trim()
              .replace(/^["']|["']$/g, '');
            process.env[key.trim()] = value;
            keys.push(key.trim());
          }
        }
      });
      console.warn(`[EARLY_ENV] Loaded ${keys.length} keys from ${finalPath}`);
      return;
    }

    // 2. FALLBACK: Use baked-in bundle (Production/ASAR)
    // secrets are baked into this import and obfuscated during build
    if (Object.keys(bundledEnv).length > 0) {
      Object.entries(bundledEnv).forEach(([key, value]) => {
        process.env[key] = value;
      });
      console.warn(
        `[EARLY_ENV] Loaded ${Object.keys(bundledEnv).length} keys from baked-in bundle`
      );
    } else {
      console.error('[EARLY_ENV] No .env or baked-in secrets found!');
    }
  } catch (error) {
    console.error('[EARLY_ENV] Failed to load environment', error);
  }
}

// Execute immediately upon import
loadEnv();
