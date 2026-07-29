'use client';

import { LegalPage, type LegalCopy } from '../../components/LegalPage';

const copy: Record<'tr' | 'en', LegalCopy> = {
  tr: {
    title: 'Gizlilik bildirimi',
    updated: 'Son güncelleme: 27 Temmuz 2026',
    sections: [
      {
        heading: 'Toplanan veriler',
        body: 'Hesap bilgileri, oyun ilerlemesi, güvenlik kayıtları, cihaz türü ve oyuncunun açıkça gönderdiği destek içerikleri hizmeti çalıştırmak için işlenir. Konum, rehber veya serbest profil fotoğrafı toplanmaz.',
      },
      {
        heading: 'Amaç ve saklama',
        body: 'Veriler hesap eşitleme, hile önleme, ligler, destek ve güvenlik için kullanılır. Normal tekrarlar 7 gün, paylaşılan tekrarlar 90 gün, lig tekrarları 30 gün saklanır.',
      },
      {
        heading: 'Haklarınız',
        body: 'Hesap ekranından tüm verilerinizi JSON olarak dışa aktarabilir veya hesabınızı kalıcı olarak silebilirsiniz. KVKK ve GDPR kapsamındaki talepler destek formundan iletilebilir.',
      },
    ],
  },
  en: {
    title: 'Privacy notice',
    updated: 'Last updated: 27 July 2026',
    sections: [
      {
        heading: 'Data we process',
        body: 'Account details, gameplay progress, security logs, device type and any support content you send are processed to operate the service. We do not collect location, contacts or free-form profile photos.',
      },
      {
        heading: 'Purpose and retention',
        body: 'Data is used for account sync, anti-cheat, leagues, support and security. Ordinary replays are kept for 7 days, shared replays for 90 days and league replays for 30 days.',
      },
      {
        heading: 'Your rights',
        body: 'You can export all of your data as JSON or permanently delete your account from the account screen. GDPR and KVKK requests can be submitted through the support form.',
      },
    ],
  },
};

export default function PrivacyPage() {
  return <LegalPage copy={copy} />;
}
