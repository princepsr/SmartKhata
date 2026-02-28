# Electron Main Process Lifecycle (Boot & Shutdown)

The Electron Main process serves as the "Operating System" for SmartKhata, orchestrating hardware access, database transactions, and the application's overall lifecycle.

---

## 1. The Startup Sequence (The Bootstrapper)

SmartKhata follows a strict, timed initialization sequence to ensure that the UI never outpaces the availability of its data services.

### Phase 1: Pre-Ready (Atomic Sync)
Executed immediately on process launch:
- **Error Trapping**: `registerGlobalErrorHandlers()` hooks into `uncaughtException` and `unhandledRejection` before any other local logic executes.
- **Protocol Definition**: `registerSchemesAsPrivileged()` defines the `smartkhata://` scheme to allow secure, CORS-free loading of ES modules from the ASAR package.
- **Single-Instance Lock**: Ensures only one instance of the POS runs at a time using `app.requestSingleInstanceLock()`.

### Phase 2: System Boot (The `whenReady` Promise)
Once the Electron kernel is ready, the system follows this sequential wait-chain:
1.  **Custom Protocol Handler**: Implements the `smartkhata://app/` asset routing with automatic fallback to `index.html` for React Router support.
2.  **Database Initializer**:
    - **Crash Detection**: Checks for the existence of `clean.exit`. If missing, it flags the startup as "Recovery Mode" to verify SQLite journal integrity.
    - **Migration Runner**: Runs all pending `.sql` scripts in `src/main/database/migrations/`.
3.  **Parallel Service Boot**: Uses `Promise.all()` to initialize non-dependent services concurrently:
    - `LicenseService`: Markers check and trial validation.
    - `SettingsService`: Loads key-value config into hot cache.
    - `PrintService`: Window pooling and driver discovery.
    - `UpdateService`: Checks for new releases in the background.
    - `AutoBackup`: Starts the interval-based snapshot timer.
    - `IPCHandlers`: Opens the communication gate to the renderer.

### Phase 3: UI Hydration
- **Window Realization**: `createWindow()` creates the browser instance with `show: false`.
- **Maximize & Show**: Once the `ready-to-show` event fires, the window is maximized and displayed, preventing the "White Flash" typical of Electron apps.

---

## 2. Process Hardening & Shortcuts

### Production Shortcuts
SmartKhata disables standard DevTools in production for security but maintains "Hidden Engineering Portals":
- **Standard**: `F11` (Fullscreen), `Ctrl + / - / 0` (Zoom management).
- **Secret DevTools**: `Ctrl + Shift + Alt + I` (Production-only escape hatch).

### Protocol Isolation
The `smartkhata://` protocol acts as a security boundary:
- It maps `smartkhata://app/assets/...` to the physical disk.
- It prevents the renderer from knowing the real file paths on the user's machine, mitigating directory traversal attacks.

---

## 3. Graceful Shutdown Management

SmartKhata prioritizes data integrity over fast exit.

1.  **Trigger**: User closes the window or `Ctrl+Q`.
2.  **Intercept**: `before-quit` event is caught, and `event.preventDefault()` is called to pause termination.
3.  **Cleanup Hooks**: The `shutdownManager` executes registered hooks:
    - **Database**: Performs `VACUUM` or `CHECKPOINT` and closes the connection.
    - **Markers**: Writes the `clean.exit` file to disk to acknowledge a safe shutdown.
    - **Backups**: If a "Backup on Quit" is configured, a final snapshot is taken.
4.  **Failsafe**: A global **5,000ms (5s)** timeout is set. If hooks hang, the process is forced to exit via `process.exit(0)` to prevent a "Zombie Process."

---

## Technical Reference
- **Entry Point**: `src/main/index.ts`
- **Shutdown Controller**: `src/main/utils/shutdown-manager.ts`
- **Protocol Implementation**: `src/main/index.ts#L150`
