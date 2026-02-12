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
  const config = configManager.getConfig();

  logger.info('=== SmartKhata Starting ===');
  logger.info('Environment', { isDevelopment: config.isDevelopment });
  logger.info('Version', { version: config.appVersion });
  logger.info('User Data Path', { path: config.userDataPath });
  logger.info('Database Path', { path: config.databasePath });
  logger.info('Logs Path', { path: config.logsPath });

  // Register shutdown hooks
  registerShutdownHooks();

  // Initialize database
  try {
    logger.info('Initializing database...');
    databaseManager.initialize();
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database', { error });
    // Show error dialog and quit
    dialog.showErrorBox(
      'Database Initialization Failed',
      `SmartKhata could not initialize the database.\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nThe application will now close.`
    );
    app.quit();
    return;
  }

  // Run database migrations
  try {
    logger.info('Running database migrations...');
    await migrationRunner.runPendingMigrations();
    logger.info('Database migrations completed');
  } catch (error) {
    logger.error('Failed to run migrations', { error });
    dialog.showErrorBox(
      'Database Migration Failed',
      `SmartKhata could not apply database migrations.\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nThe application will now close.`
    );
    app.quit();
    return;
  }

  // Initialize Licensing/Trial
  try {
    new LicenseService().initializeTrial();
    logger.info('Licensing/Trial system initialized');
  } catch (error) {
    logger.error('Failed to initialize license system', { error });
    // Not critical enough to quit, but worth logging
  }

  // Register IPC handlers
  registerIPCHandlers();

  createWindow();

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
    // Prevent immediate quit, run shutdown hooks first
    event.preventDefault();

    logger.info('App quit requested, starting graceful shutdown');

    // Close database connection
    try {
      databaseManager.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database', { error });
    }

    await shutdownManager.shutdown();

    // Now allow the app to quit
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On Windows, quit when all windows are closed
  if (process.platform !== 'darwin') {
    logger.info('All windows closed, quitting app');
    app.quit();
  }
});
