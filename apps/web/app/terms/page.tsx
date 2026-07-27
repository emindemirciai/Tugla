import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Kullanım Koşulları' };

export default function TermsPage() {
  return (
    <main className="legal">
      <a className="brand" href="/">
        <span className="brand-mark" /> TUĞLA
      </a>
      <h1>Kullanım koşulları</h1>
      <p>Son güncelleme: 27 Temmuz 2026</p>
      <h2>Hesap ve uygun kullanım</h2>
      <p>
        Hizmet 13 yaş ve üzeri oyuncular içindir. Otomasyon, hile, skor manipülasyonu, taciz,
        kimliğe bürünme ve zararlı kullanıcı bölümleri yasaktır.
      </p>
      <h2>Dijital ürünler</h2>
      <p>
        Satın alma özellikleri gerçek sağlayıcı anahtarları bağlanana kadar kapalıdır. Etkin
        olduğunda iadeler kullanılan mağazanın kurallarına göre işlenir. Rekabet modlarında satın
        alınabilir güç avantajı bulunmaz.
      </p>
      <h2>Hizmet değişiklikleri</h2>
      <p>
        Güvenlik, denge ve mevzuat gerekleri için sistemler güncellenebilir. Ana ilerleme verisi
        sunucu kaydı üzerinden korunur.
      </p>
    </main>
  );
}
