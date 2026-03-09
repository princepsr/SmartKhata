import './env-loader';
import { app, BrowserWindow, dialog, globalShortcut, protocol, powerMonitor } from 'electron';
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
import { UpdateService } from './services/update-service';
import { autoBackupService } from './services/auto-backup-service';
import { WhatsAppAutoReportService } from './services/whatsapp-auto-report-service';
import { connectivityService } from './services/connectivity-service';

/**
 * Main Electron Process Entry Point
 */

// Single-instance lock (Windows best practice)
// Prevents multiple instances of the app from running.
// Moved to the TOP to prevent heavy service initialization in duplicate instances.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit this one IMMEDIATELY
  // Using process.exit to avoid Electron's event loop entirely for duplicates
  process.exit(0);
}

// Register global error handlers FIRST (before any other logic in the MAIN instance)
registerGlobalErrorHandlers();

// Set AppUserModelId for Windows taskbar icons
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_CONSTANTS.APP_ID);
}

// Register privileges for custom protocol (must be done before app.ready)
// This allows ES modules to load correctly across origins
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'smartkhata',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;

app.on('second-instance', (_event, commandLine, workingDirectory) => {
  logger.info('Second instance attempted to start', { commandLine, workingDirectory });

  // Focus the existing window if it exists
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});

function createWindow(): void {
  const config = configManager.getConfig();

  logger.info('Creating main window');

  mainWindow = new BrowserWindow({
    width: APP_CONSTANTS.WINDOW.DEFAULT_WIDTH,
    height: APP_CONSTANTS.WINDOW.DEFAULT_HEIGHT,
    minWidth: APP_CONSTANTS.WINDOW.MIN_WIDTH,
    minHeight: APP_CONSTANTS.WINDOW.MIN_HEIGHT,
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // Keep devTools enabled for troubleshooting, but don't auto-open in production
      devTools: true,
    },
    title: APP_CONSTANTS.APP_NAME,
    icon: path.join(
      process.cwd(),
      app.isPackaged ? 'resources/icons/icon.ico' : 'resources/icons/icon.ico'
    ),
    autoHideMenuBar: true,
  });

  mainWindow.removeMenu();

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
    logger.info('Main window shown');
  });

  // Prevent right-click context menu in production
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
    // Production: load via custom protocol
    // Using hostname 'app' to ensure stable relative path resolution
    logger.info('Loading from custom protocol: smartkhata://app/index.html');
    mainWindow.loadURL('smartkhata://app/index.html');

    // Auto-open DevTools is removed for final production build
    // mainWindow.webContents.openDevTools();
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

  // Register custom protocol for production
  // This bypasses file:// CORS issues with ES modules and handles routing correctly
  if (!config.isDevelopment) {
    try {
      protocol.handle('smartkhata', async (request) => {
        // Strip protocol and hostname ('smartkhata://app/')
        let urlPath = request.url.replace('smartkhata://', '');
        if (urlPath.startsWith('app/')) {
          urlPath = urlPath.substring(4);
        }

        try {
          const decodedUrl = decodeURIComponent(urlPath);
          const relativePath = decodedUrl === '' || decodedUrl === '/' ? 'index.html' : decodedUrl;

          // Potential paths to search for assets inside the package
          const possibleRoots = [
            path.join(app.getAppPath(), 'dist/renderer'), // Primary ASAR path
            path.join(__dirname, '../../../renderer'), // Legacy structure
            path.join(__dirname, '../renderer'), // Flattened structure
            path.join(process.resourcesPath, 'app.asar/dist/renderer'), // Explicit external ASAR
          ];

          let foundPath: string | null = null;

          for (const root of possibleRoots) {
            const candidate = path.join(root, relativePath);
            const normalized = path.normalize(candidate);

            try {
              await fs.promises.access(normalized);
              foundPath = normalized;
              break;
            } catch {
              continue;
            }
          }

          if (!foundPath) {
            // If asset not found, it might be a React Router client-side route
            // Check if it's an asset (has extension)
            const ext = path.extname(relativePath).toLowerCase();
            if (!ext) {
              // Return index.html to allow React Router to handle the path
              const indexPath = path.join(app.getAppPath(), 'dist/renderer/index.html');
              try {
                const data = await fs.promises.readFile(indexPath);
                return new Response(data, { headers: { 'Content-Type': 'text/html' } });
              } catch (e) {
                logger.error('Failed to serve fallback index.html', {
                  path: relativePath,
                  error: e,
                });
                // Fall through to 404
              }
            }

            logger.warn('Resource not found', { path: relativePath });
            return new Response('Not Found', { status: 404 });
          }

          const data = await fs.promises.readFile(foundPath);
          const ext = path.extname(foundPath).toLowerCase();

          let mimeType = 'application/octet-stream';
          if (ext === '.html') {
            mimeType = 'text/html';
          } else if (ext === '.js') {
            mimeType = 'text/javascript';
          } else if (ext === '.css') {
            mimeType = 'text/css';
          } else if (ext === '.json') {
            mimeType = 'application/json';
          } else if (ext === '.png') {
            mimeType = 'image/png';
          } else if (ext === '.jpg' || ext === '.jpeg') {
            mimeType = 'image/jpeg';
          } else if (ext === '.svg') {
            mimeType = 'image/svg+xml';
          } else if (ext === '.ico') {
            mimeType = 'image/x-icon';
          } else if (ext === '.woff2') {
            mimeType = 'font/woff2';
          }

          return new Response(data, {
            headers: { 'Content-Type': mimeType },
          });
        } catch (error) {
          logger.error('Protocol handler error', { error, url: request.url });
          return new Response('Internal Server Error', { status: 500 });
        }
      });
      logger.info('Registered smartkhata:// protocol');
    } catch (error) {
      logger.error('Failed to register protocol', { error });
    }
  }

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
      logger.warn('Crash detected on startup');
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

  // Initialize services
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
        logger.error('Stability monitor failed', e);
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
      try {
        UpdateService.getInstance().initialize();
      } catch (e) {
        logger.error('Update service init failed', e);
      }
    })(),
    (async () => {
      try {
        registerIPCHandlers();
      } catch (e) {
        logger.error('IPC init failed', e);
      }
    })(),
    (async () => {
      try {
        autoBackupService.start();
      } catch (e) {
        logger.error('Auto-backup service start failed', e);
      }
    })(),
    (async () => {
      try {
        WhatsAppAutoReportService.getInstance().start();
      } catch (e) {
        logger.error('WhatsApp auto-report service start failed', e);
      }
    })(),
  ];

  await Promise.all(initPromises);
  timings.services = performance.now() - servicesStart;

  createWindow();

  const totalTime = performance.now() - bootStart;
  logger.info('=== Startup Profile ===', {
    ...timings,
    total: `${totalTime.toFixed(2)}ms`,
  });

  // Zoom Shortcuts
  globalShortcut.register('CommandOrControl+=', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.setZoomFactor(win.webContents.getZoomFactor() + 0.1);
    }
  });

  globalShortcut.register('CommandOrControl+-', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win && win.webContents.getZoomFactor() > 0.5) {
      win.webContents.setZoomFactor(win.webContents.getZoomFactor() - 0.1);
    }
  });

  globalShortcut.register('CommandOrControl+0', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.setZoomFactor(1.0);
    }
  });

  // DevTools Shortcuts
  if (config.isDevelopment) {
    // Standard Dev shortcut: Ctrl + Shift + I
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.toggleDevTools();
      }
    });
  } else {
    // Secret Production shortcut: Ctrl + Shift + Alt + I
    globalShortcut.register('CommandOrControl+Shift+Alt+I', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.toggleDevTools();
      }
    });
  }

  // Fullscreen Shortcut
  globalShortcut.register('F11', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  if (config.isDevelopment) {
    const reloadApp = () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.reload();
      }
    };
    globalShortcut.register('CommandOrControl+R', reloadApp);
    globalShortcut.register('F5', reloadApp);

    globalShortcut.register('CommandOrControl+Shift+R', () => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.webContents.reloadIgnoringCache();
      }
    });
  }

  // Power state monitoring

  powerMonitor.on('suspend', () => {
    logger.info('System going to sleep (suspend event)');
    try {
      StabilityService.getInstance().stopMonitoring();
    } catch (e) {
      logger.error('Error during suspend handling', e);
    }
  });

  powerMonitor.on('resume', () => {
    logger.info('System waking up (resume event)');
    try {
      StabilityService.getInstance().startMonitoring();
      // Allow some time for network to settle before re-checking connectivity
      setTimeout(() => {
        connectivityService.checkNow();
      }, 5000);
    } catch (e) {
      logger.error('Error during resume handling', e);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

let forceQuit = false;

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', async (event) => {
  if (forceQuit) {
    logger.debug('Force-quit flag set, allowing Electron to exit');
    return;
  }

  if (!shutdownManager.isShutdownInProgress()) {
    event.preventDefault();
    logger.info('App quit requested, starting graceful shutdown');

    try {
      // Add a failsafe global timeout for the entire shutdown process
      // If the app hasn't exited in 5 seconds, force it.
      setTimeout(() => {
        logger.warn('Graceful shutdown timed out (5s), forcing exit via process.exit(0)');
        process.exit(0);
      }, 5000);

      await shutdownManager.shutdown();
      logger.info('Hooks completed, triggering final quit');
    } catch (error) {
      logger.error('Graceful shutdown failed', error);
    } finally {
      forceQuit = true;
      app.quit();
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
