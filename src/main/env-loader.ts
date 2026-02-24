/**
 * Environment Loader
 *
 * This must be imported at the very top of index.ts to ensure
 * environment variables are available before any other services initialize.
 */

import path from 'path';
import fs from 'fs';

export function loadEnv(): void {
  try {
    // Look for .env in the current working directory (project root during dev)
    const envPath = path.join(process.cwd(), '.env');

    // Also check for .env in the same directory as the executable/app
    // This is often needed in production or specific Electron dev environments
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
      console.log(`[EARLY_ENV] Loaded ${keys.length} keys from ${finalPath}`);
    } else {
      console.error('[EARLY_ENV] No .env file found at:', envPath, 'or', appPath);
    }
  } catch (error) {
    console.error('[EARLY_ENV] Failed to load .env file', error);
  }
}

// Execute immediately upon import
loadEnv();
