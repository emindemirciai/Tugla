import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Gizlilik' };

export default function PrivacyPage() {
  return (
    <main className="legal">
      <a className="brand" href="/">
        <span className="brand-mark" /> TUĞLA
      </a>
      <h1>Gizlilik bildirimi</h1>
      <p>Son güncelleme: 27 Temmuz 2026</p>
      <h2>Toplanan veriler</h2>
      <p>
        Hesap bilgileri, oyun ilerlemesi, güvenlik kayıtları, cihaz türü ve oyuncunun açıkça
        gönderdiği destek içerikleri hizmeti çalıştırmak için işlenir. Konum, rehber veya serbest
        profil fotoğrafı toplanmaz.
      </p>
      <h2>Amaç ve saklama</h2>
      <p>
        Veriler hesap eşitleme, hile önleme, ligler, destek ve güvenlik için kullanılır. Normal
        tekrarlar 7 gün; paylaşılan tekrarlar 90 gün; lig tekrarları 30 gün saklanır.
      </p>
      <h2>Haklarınız</h2>
      <p>
        Hesap ekranından verilerinizi dışa aktarabilir veya hesabınızı silebilirsiniz. KVKK ve GDPR
        kapsamındaki talepler destek formundan iletilebilir.
      </p>
    </main>
  );
}
