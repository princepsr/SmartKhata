import { UpdateService } from '../../services/update-service';
import { IPCHandler } from '../ipc-handler';
import { IPC_CHANNELS } from '@shared/ipc/channels';

/**
 * Register Update Handlers
 */
export function registerUpdateHandlers(): void {
  const updateService = UpdateService.getInstance();

  // Check for updates
  IPCHandler.handle<void, void>(IPC_CHANNELS.UPDATE_CHECK, async () => {
    await updateService.checkForUpdates();
  });

  // Download update
  IPCHandler.handle<void, void>(IPC_CHANNELS.UPDATE_DOWNLOAD, async () => {
    await updateService.downloadUpdate();
  });

  // Install and restart
  IPCHandler.handle<void, void>(IPC_CHANNELS.UPDATE_INSTALL, async () => {
    await updateService.installUpdate();
  });

  // Get current status
  IPCHandler.handle<void, any>(IPC_CHANNELS.UPDATE_STATUS, () => {
    return updateService.getStatusInfo();
  });
}
