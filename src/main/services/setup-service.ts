import { BaseService } from './base-service';
import { SettingsService, AppConfig } from './settings-service';
import { logger } from '../utils/logger';

export type AppMode = 'GENERAL' | 'KIRANA' | 'MEDICAL';

/**
 * Setup and Onboarding Service
 */
export class SetupService extends BaseService {
  /**
   * Check if the app has been configured (first-time detection)
   */
  public isFirstTimeSetup(): boolean {
    const config = SettingsService.getInstance().getConfig();
    // If shop name is default and app mode is general, it's likely first time
    return config.shopName === 'SmartKhata Shop' && !config.ownerName;
  }

  /**
   * Initialize app with mode-specific defaults
   */
  public initializeMode(mode: AppMode): void {
    const settings = SettingsService.getInstance();

    const newConfig: Partial<AppConfig> = {
      appMode: mode,
      privacyPolicyAccepted: true, // Assuming this is done during setup
    };

    switch (mode) {
      case 'MEDICAL':
        logger.info('Configuring for Medical mode');
        newConfig.gstEnabled = true;
        newConfig.gstPercentage = 12; // Pharma common default
        newConfig.footerMessage = 'Wish you a speedy recovery!';
        break;

      case 'KIRANA':
        logger.info('Configuring for Kirana mode');
        newConfig.gstEnabled = true;
        newConfig.gstPercentage = 5; // Grocery common default
        newConfig.paperSize = '58mm'; // Kirana often uses smaller thermal printers
        break;

      case 'GENERAL':
        logger.info('Configuring for General mode');
        newConfig.gstEnabled = true;
        newConfig.gstPercentage = 18;
        break;
    }

    // Save configuration
    settings.updateConfig(newConfig);

    logger.info(`App mode set to ${mode}`);
  }

  /**
   * Get default UOMs based on mode
   */
  public getDefaultUOMs(mode: AppMode): string[] {
    switch (mode) {
      case 'MEDICAL':
        return ['Strip', 'Tablet', 'Bottle', 'Injection', 'Pcs'];
      case 'KIRANA':
        return ['Kg', 'Gm', 'Ltr', 'Ml', 'Packet', 'Pcs'];
      default:
        return ['Pcs', 'Box', 'Packet', 'Dozen'];
    }
  }
}
