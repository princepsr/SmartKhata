import { app, BrowserWindow } from 'electron';
import path from 'path';
import { configManager } from './config/app-config';
import { APP_CONSTANTS } from '@shared/constants/app-constants';
import { logger } from './utils/logger';
import { shutdownManager, registerShutdownHooks } from './utils/shutdown-manager';
import { registerGlobalErrorHandlers } from './utils/error-handler';
import { registerIPCHandlers } from './ipc';
import { databaseManager } from './database';

/**
 * Main Electron Process Entry Point
 */

let mainWindow: BrowserWindow | null = null;

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
      nodeIntegration: false,        // Disable Node.js in renderer
      contextIsolation: true,        // Isolate preload context
      sandbox: false,                // Disable sandbox to allow require('../shared/...')
      webSecurity: true,             // Enable web security (default, but explicit)
      allowRunningInsecureContent: false,  // Block mixed content
      experimentalFeatures: false,   // Disable experimental features
    },
    title: APP_CONSTANTS.APP_NAME,
  });

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logger.info('Main window shown');
  });

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
app.whenReady().then(() => {
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
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Database Initialization Failed',
      `SmartKhata could not initialize the database.\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nThe application will now close.`
    );
    app.quit();
    return;
  }

  // Register IPC handlers
  registerIPCHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      logger.info('Reactivating app (macOS)');
      createWindow();
    }
  });
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
