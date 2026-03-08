import { logger } from '../utils/logger';

const whatsappLogger = logger.forModule('WHATSAPP');

/**
 * WhatsApp Service
 *
 * Handles sending messages via Meta WhatsApp Business API.
 * Uses secure credentials from process.env.
 */
export class WhatsAppService {
  private static readonly API_VERSION = 'v21.0';
  private static readonly BASE_URL = 'https://graph.facebook.com';

  /**
   * Send a free-text message to a recipient
   * Note: This requires an active 24h window or a special template.
   * For strictly automated reports, a template is recommended,
   * but we'll implement a general send for now.
   */
  public static async sendMessage(
    recipient: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    const token = process.env.WHATSAPP_META_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      whatsappLogger.error('Meta API credentials missing in environment');
      return { success: false, error: 'Meta API credentials missing' };
    }

    if (!recipient) {
      return { success: false, error: 'Recipient number missing' };
    }

    // Clean recipient number: remove +, spaces, etc.
    const cleanRecipient = recipient.replace(/\D/g, '');

    const url = `${this.BASE_URL}/${this.API_VERSION}/${phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanRecipient,
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        }),
      });

      const data = (await response.json()) as any;

      if (response.ok) {
        whatsappLogger.info(`Daily report sent successfully to ${cleanRecipient}`);
        return { success: true };
      } else {
        whatsappLogger.error('Meta API Error', { status: response.status, data });
        return {
          success: false,
          error: data.error?.message || `API error ${response.status}`,
        };
      }
    } catch (error) {
      whatsappLogger.error('Failed to send WhatsApp message', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown network error',
      };
    }
  }
}
