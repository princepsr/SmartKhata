import { SettingsService } from './settings-service';
import { ReportService } from './report-service';
import { WhatsAppService } from './whatsapp-service';
import { connectivityService } from './connectivity-service';
import { logger } from '../utils/logger';

const autoReportLogger = logger.forModule('WHATSAPP-AUTO');

/**
 * WhatsApp Auto-Report Service
 *
 * Manages scheduling and background delivery of automated daily reports.
 * Handles offline scenarios by retrying when connectivity is restored.
 */
export class WhatsAppAutoReportService {
  private static instance: WhatsAppAutoReportService;
  private checkInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private settingsService: SettingsService;
  private reportService: ReportService;

  private constructor() {
    this.settingsService = SettingsService.getInstance();
    this.reportService = new ReportService();
  }

  public static getInstance(): WhatsAppAutoReportService {
    if (!WhatsAppAutoReportService.instance) {
      WhatsAppAutoReportService.instance = new WhatsAppAutoReportService();
    }
    return WhatsAppAutoReportService.instance;
  }

  /**
   * Start the auto-report monitor
   */
  public start(): void {
    autoReportLogger.info('Starting WhatsApp Auto-Report monitor');

    // Subscribe to connectivity changes
    connectivityService.on('change', (online: boolean) => {
      if (online) {
        autoReportLogger.info('Connectivity restored, checking for pending reports');
        this.checkAndSendReport();
      }
    });

    // Initial check on startup
    setTimeout(() => {
      this.checkAndSendReport();
    }, 10000); // 10s delay for services to stabilize

    // Periodic check every 30 minutes
    this.checkInterval = setInterval(
      () => {
        this.checkAndSendReport();
      },
      30 * 60 * 1000
    );
  }

  /**
   * Stop the monitor
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Main logic to check time and send report
   */
  public async checkAndSendReport(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    try {
      this.isProcessing = true;
      const config = this.settingsService.getConfig();

      if (!config.whatsappAutoReportEnabled) {
        return;
      }

      if (!config.whatsappRecipientNumber) {
        autoReportLogger.warn('Auto-report enabled but recipient number missing');
        return;
      }

      if (!connectivityService.getIsOnline()) {
        autoReportLogger.debug('Skipping auto-report check: Offline');
        return;
      }

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // If we already sent today's report, skip
      if (config.lastWhatsappReportDate === todayStr) {
        return;
      }

      // Check if it's past the report time
      const [reportHour, reportMin] = (config.whatsappReportTime || '20:00').split(':').map(Number);
      const reportTimeTarget = new Date();
      reportTimeTarget.setHours(reportHour || 20, reportMin || 0, 0, 0);

      if (now < reportTimeTarget) {
        // Not yet time for today's report
        // But what if we missed yesterday's report due to offline?
        // Let's check if the last report was from a previous date.
        // If last report date is not today, it means we haven't sent today's report yet.
        // We only send it AFTER the target time.
        return;
      }

      autoReportLogger.info('Report time reached, generating summary...');

      const summaryText = await this.reportService.generateWhatsAppSummary(todayStr, todayStr);

      const result = await WhatsAppService.sendMessage(config.whatsappRecipientNumber, summaryText);

      if (result.success) {
        autoReportLogger.info('Automated daily report sent successfully');
        this.settingsService.updateConfig({
          lastWhatsappReportDate: todayStr,
        });
      } else {
        autoReportLogger.error('Failed to send automated report', { error: result.error });
      }
    } catch (error) {
      autoReportLogger.error('Error during auto-report check', { error });
    } finally {
      this.isProcessing = false;
    }
  }
}

export const whatsappAutoReportService = WhatsAppAutoReportService.getInstance();
