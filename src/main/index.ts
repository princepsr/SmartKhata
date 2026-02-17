import { app, BrowserWindow, dialog, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { configManager } from './config/app-config';
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import { logger } from './utils/logger';
import { shutdownManager, registerShutdownHooks } from './utils/shutdown-manager';
import { registerGlobalErrorHandlers } from './utils/error-handler';
import { registerIPCHandlers } from './ipc';
import { databaseManager } from './database';
import { migrationRunner } from './database/migrations';
import { LicenseService } from './services/license-service';
import { SettingsService } from './services/settings-service';
import { StabilityService } from './services/stability-service';
import { PrintService } from './services/print-service';

/**
 * Main Electron Process Entry Point
 */

let mainWindow: BrowserWindow | null = null;

// Simple .env loader (since npm install dotenv failed)
function loadEnv(): void {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
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
          }
        }
      });
      logger.info('.env file loaded successfully');
    }
  } catch (error) {
    logger.error('Failed to load .env file', { error });
  }
}

loadEnv();

// Register global error handlers FIRST (before any other code)
registerGlobalErrorHandlers();

// Single-instance lock (Windows best practice)
// Prevents multiple instances of the app from running
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one
  logger.info('Another instance is already running, quitting...');
  app.quit();
} else {
  // This is the first instance, handle second-instance attempts
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    logger.info('Second instance attempted to start', { commandLine, workingDirectory });

    // Focus the existing window if it exists
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  const config = configManager.getConfig();

  logger.info('Creating main window');

  mainWindow = new BrowserWindow({
    width: APP_CONSTANTS.WINDOW.DEFAULT_WIDTH,
    height: APP_CONSTANTS.WINDOW.DEFAULT_HEIGHT,
    minWidth: APP_CONSTANTS.WINDOW.MIN_WIDTH,
    minHeight: APP_CONSTANTS.WINDOW.MIN_HEIGHT,
    center: true, // Center window on screen
    show: false, // Don't show until ready (prevents flash)
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false, // Disable Node.js in renderer
      contextIsolation: true, // Isolate preload context
      sandbox: false, // Disable sandbox to allow require('../shared/...')
      webSecurity: true, // Enable web security (default, but explicit)
      allowRunningInsecureContent: false, // Block mixed content
      experimentalFeatures: false, // Disable experimental features
      devTools: config.isDevelopment, // Disable DevTools in production
    },
    title: APP_CONSTANTS.APP_NAME,
    autoHideMenuBar: true, // Hide menu bar (File, Edit, etc.)
  });

  // Remove the menu bar completely (optional: keep if you want Alt access, but 'removeMenu' clears it)
  mainWindow.removeMenu();

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
    logger.info('Main window shown (maximized)');
  });

  // Prevent right-click context menu (Inspect Element) in production
  if (!config.isDevelopment) {
    mainWindow.webContents.on('context-menu', (e) => {
      e.preventDefault();
    });
  }

  // Load the app
  if (config.isDevelopment) {
    // Development: load from Vite dev server
    logger.debug('Loading from Vite dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load from built files
    const indexPath = path.join(__dirname, '../renderer/index.html');
    logger.info('Loading from built files', { path: indexPath });
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    logger.info('Main window closed');
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  const bootStart = performance.now();
  const timings: Record<string, number> = {};

  const config = configManager.getConfig();

  logger.info('=== SmartKhata Starting ===');

  // Register shutdown hooks
  registerShutdownHooks();

  // Initialize database
  const dbInitStart = performance.now();
  try {
    const markerPath = path.join(config.userDataPath, 'clean.exit');
    const dbFileExists = fs.existsSync(config.databasePath);
    const markerExists = fs.existsSync(markerPath);
    let wasCrashDetected = false;

    if (dbFileExists && !markerExists) {
      wasCrashDetected = true;
      logger.warn('CLEAN EXIT MARKER MISSING - Application probably crashed on last run');
    }

    if (markerExists) {
      try {
        fs.unlinkSync(markerPath);
      } catch (e) {
        logger.error('Failed to remove clean exit marker', e);
      }
    }

    databaseManager.initialize(wasCrashDetected);
  } catch (error) {
    logger.error('Failed to initialize database', { error });
    dialog.showErrorBox('Database Initialization Failed', 'The application will now close.');
    app.quit();
    return;
  }
  timings.databaseInit = performance.now() - dbInitStart;

  // Run database migrations
  const migrationStart = performance.now();
  try {
    await migrationRunner.runPendingMigrations();
  } catch (error) {
    logger.error('Failed to run migrations', { error });
    dialog.showErrorBox('Database Migration Failed', 'The application will now close.');
    app.quit();
    return;
  }
  timings.migrations = performance.now() - migrationStart;

  // Initialize non-critical systems concurrently
  const servicesStart = performance.now();
  const initPromises = [
    (async () => {
      try {
        new LicenseService().initializeTrial();
      } catch (e) {
        logger.error('License init failed', e);
      }
    })(),
    (async () => {
      try {
        SettingsService.getInstance().initialize();
      } catch (e) {
        logger.error('Settings init failed', e);
      }
    })(),
    (async () => {
      try {
        StabilityService.getInstance().startMonitoring();
      } catch (e) {
        logger.error('Stability monitor failed to start', e);
      }
    })(),
    (async () => {
      try {
        await new PrintService().initialize();
      } catch (e) {
        logger.error('Print service init failed', e);
      }
    })(),
    (async () => {
      registerIPCHandlers();
    })(),
  ];

  await Promise.all(initPromises);
  timings.services = performance.now() - servicesStart;

  const windowStart = performance.now();
  createWindow();
  timings.windowCreation = performance.now() - windowStart;

  const totalTime = performance.now() - bootStart;
  logger.info('=== Startup Profile ===', {
    ...timings,
    total: `${totalTime.toFixed(2)}ms`,
  });

  // Register Zoom Shortcuts

  // Ctrl + = (Zoom In)
  globalShortcut.register('CommandOrControl+=', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      const currentZoom = win.webContents.getZoomFactor();
      win.webContents.setZoomFactor(currentZoom + 0.1);
    }
  });

  // Ctrl + - (Zoom Out)
  globalShortcut.register('CommandOrControl+-', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      const currentZoom = win.webContents.getZoomFactor();
      // Prevent zooming out too much (e.g., < 50%)
      if (currentZoom > 0.5) {
        win.webContents.setZoomFactor(currentZoom - 0.1);
      }
    }
  });

  // Ctrl + 0 (Reset Zoom)
  globalShortcut.register('CommandOrControl+0', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.setZoomFactor(1.0);
    }
  });

  // Register Debug Shortcuts (ONLY in Development)
  if (config.isDevelopment) {
    // Ctrl + Shift + I (Toggle DevTools)
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.toggleDevTools();
      }
    });
  }

  // F11 (Toggle Fullscreen)
  globalShortcut.register('F11', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  if (config.isDevelopment) {
    // Ctrl + R / F5 (Reload)
    const reloadApp = () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.reload();
      }
    };
    globalShortcut.register('CommandOrControl+R', reloadApp);
    globalShortcut.register('F5', reloadApp);

    // Ctrl + Shift + R (Hard Reload)
    globalShortcut.register('CommandOrControl+Shift+R', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.reloadIgnoringCache();
      }
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      logger.info('Reactivating app (macOS)');
      createWindow();
    }
  });
});

// Unregister shortcuts on quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Graceful shutdown handling
app.on('before-quit', async (event) => {
  if (!shutdownManager.isShutdownInProgress()) {
    // Prevent immediate quit and start graceful shutdown
    event.preventDefault();
    logger.info('App quit requested, starting graceful shutdown');

    try {
      await shutdownManager.shutdown();
    } catch (error) {
      logger.error('Graceful shutdown failed', error);
    } finally {
      // Force exit after shutdown hooks are done
      logger.info('Exiting application');
      app.quit();
    }
  }
});

app.on('window-all-closed', () => {
  // On Windows, quit when all windows are closed
  if (process.platform !== 'darwin') {
    logger.info('All windows closed, quitting app');
    app.quit();
  }
});
