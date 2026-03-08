import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import './ContactDeveloper.css';

interface ContactDeveloperProps {
  compact?: boolean;
}

const ContactDeveloper: React.FC<ContactDeveloperProps> = ({ compact = false }) => {
  const { t } = useTranslation();
  const developerNumber = '+919044612070';
  const whatsappUrl = `https://wa.me/${developerNumber}`;
  const message = encodeURIComponent("Namaste! I'm using SmartKhata and have a query/feedback.");
  const finalUrl = `${whatsappUrl}?text=${message}`;

  return (
    <div className={`contact-developer-container ${compact ? 'compact' : ''}`}>
      <div className="contact-card animate-pure-fade">
        <div className="contact-info">
          <h3>{t('help.topics.contact_dev.title')}</h3>
          <p>{t('help.topics.contact_dev.description')}</p>
        </div>

        <div className="qr-section">
          <div className="qr-wrapper">
            <QRCodeSVG
              value={finalUrl}
              size={compact ? 120 : 180}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
                x: undefined,
                y: undefined,
                height: compact ? 24 : 36,
                width: compact ? 24 : 36,
                excavate: true,
              }}
            />
          </div>
          <p className="qr-hint">{t('help.topics.contact_dev.scan_hint')}</p>
        </div>

        <div className="action-section">
          <a href={finalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              style={{ marginRight: '8px' }}
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .004 5.412.001 12.048c0 2.12.54 4.189 1.57 6.048L0 24l6.09-1.597a11.946 11.946 0 005.954 1.595h.004c6.637 0 12.047-5.412 12.05-12.049 0-3.218-1.251-6.243-3.522-8.514V1.1L20.463 3.488z" />
            </svg>
            {t('help.topics.contact_dev.btn_text')}
          </a>
        </div>
      </div>
    </div>
  );
};

export default ContactDeveloper;
