'use client';

import { LegalPage, type LegalCopy } from '../../components/LegalPage';

const copy: Record<'tr' | 'en', LegalCopy> = {
  tr: {
    title: 'Kullanım koşulları',
    updated: 'Son güncelleme: 27 Temmuz 2026',
    sections: [
      {
        heading: 'Hesap ve uygun kullanım',
        body: 'Hizmet 13 yaş ve üzeri oyuncular içindir. Otomasyon, hile, skor manipülasyonu, taciz, kimliğe bürünme ve zararlı kullanıcı bölümleri yasaktır. Skorlar sunucuda yeniden simüle edilerek doğrulanır; doğrulanamayan sonuçlar hiçbir tabloya yazılmaz.',
      },
      {
        heading: 'Dijital ürünler',
        body: 'Gerçek para ile satın alma, ödeme sağlayıcısı anahtarları bağlanana kadar kapalıdır. Etkin olduğunda iadeler kullanılan mağazanın kurallarına göre işlenir. Rekabet modlarında satın alınabilir güç avantajı bulunmaz.',
      },
      {
        heading: 'Hizmet değişiklikleri',
        body: 'Güvenlik, denge ve mevzuat gerekleri için sistemler güncellenebilir. Ana ilerleme verisi sunucu kaydı üzerinde tutulur ve tüm cihazlarınla eşitlenir.',
      },
    ],
  },
  en: {
    title: 'Terms of service',
    updated: 'Last updated: 27 July 2026',
    sections: [
      {
        heading: 'Accounts and acceptable use',
        body: 'The service is for players aged 13 and over. Automation, cheating, score manipulation, harassment, impersonation and harmful user-made levels are prohibited. Scores are verified by re-simulating the run on the server; results that cannot be verified never reach any leaderboard.',
      },
      {
        heading: 'Digital goods',
        body: 'Real-money purchases stay disabled until payment provider keys are connected. Once enabled, refunds follow the rules of the store used for the purchase. Competitive modes never sell power advantages.',
      },
      {
        heading: 'Changes to the service',
        body: 'Systems may change for security, balance and regulatory reasons. Core progression is stored server-side and synchronised across all of your devices.',
      },
    ],
  },
};

export default function TermsPage() {
  return <LegalPage copy={copy} />;
}
