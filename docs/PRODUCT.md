# Ürün / Product

## Ne olduğu

Tuğla.fun, tarayıcıda oynanan modern bir tuğla kırma oyunudur. Mobil öncelikli ve dikey ekrandır; tek
elle oynanır. Görünüm Three.js ile üç boyutludur, fizik ise sabit 120 Hz'de çalışan deterministik bir
2B düzlemdedir — bu ayrım skorların sunucuda yeniden simüle edilerek doğrulanabilmesini sağlar.

## Kim için

- **Kısa oturumlarda oynayan oyuncu.** Bir bölüm bir–üç dakikadır; günün bölümü ve günlük görevler
  günde birkaç dakikalık bir sebep verir.
- **Tabloyu önemseyen oyuncu.** Haftalık lig, sezon sıralaması ve günlük tablo; hepsi doğrulanmış
  skorlarla.
- **Kendi bölümünü kuran oyuncu.** Izgara editörü, test oynayışı ve moderasyondan geçen yayın.

## Oyun döngüsü

1. Bölüm seçilir (kampanya sıralı açılır) veya günün bölümü oynanır.
2. Platform hareketiyle ilk atış yapılır; çarpma noktası açıyı belirler.
3. Bonuslar topu çoğaltır, güvenlik ağı serer, platformu büyütür; 500 top sınırında fazla enerji
   Overcharge çarpanına döner.
4. Bölüm biterse skor sunucuda doğrulanır, ödüller ve ilerleme yazılır, sonraki bölüm açılır.

## İçerik

| Katman       | Kapsam                                                                               |
| ------------ | ------------------------------------------------------------------------------------ |
| Kampanya     | 10 dünya × 50 bölüm = 500 bölüm; her 10. bölüm mini boss, her 50. bölüm dünya boss'u |
| Günün bölümü | Tarihten türetilen tek seçim; yalnızca kendi bölümünü açar                           |
| Topluluk     | Oyuncuların ızgara editörüyle kurduğu, moderasyondan geçen bölümler                  |
| İlerleme     | Günlük/haftalık görevler, başarımlar, oyuncu seviyesi, cüzdan                        |
| Sosyal       | Arkadaşlık, oyuncu profili, özel mesaj, lig ve tablo sıralamaları                    |

## Hesap

Misafir hesap yoktur: ilerleme, skor ve topluluk içeriği bir kimliğe bağlı olmalıdır. E-posta ve
parola ya da Google ile kayıt olunur; e-posta kaydında 6 haneli doğrulama kodu gönderilir. Görünen ad,
kullanıcı adı ve profil fotoğrafı hesap ekranından değiştirilebilir; e-posta adresi değiştirilemez.
Veri dışa aktarma ve hesap silme aynı ekrandadır.

## Ürün ilkeleri

- **Skor iddiası değil, kanıt.** İstemcinin bildirdiği hiçbir skor doğrudan kabul edilmez.
- **Kapalı özellik dürüstçe kapalıdır.** Sağlayıcı anahtarı yoksa arayüz bunu söyler, çalışıyormuş
  gibi yapmaz.
- **Moderasyon temas bilgisi görür, içerik değil.** Mesaj kayıtları kimin kime yazdığını gösterir;
  mesajların kendisi hiçbir yerde saklanmaz.
- **İki dil eşittir.** TR ve EN her ekranda ve her e-postada; eksiklik testle yakalanır.

---

## English

Tuğla.fun is a browser brick breaker: mobile-first, portrait, one-handed. Three.js draws a 3D view of
a strictly 2D physics plane running at a fixed 120 Hz, which is what makes every score reproducible —
the server re-simulates each run before accepting it.

The loop is short: pick a level (the campaign unlocks in order) or play the daily challenge, launch
by moving the paddle, chase bonuses that multiply balls up to a 500-ball cap where the surplus becomes
an Overcharge multiplier, and finish for verified rewards. Content spans ten worlds of fifty levels
with mini bosses every tenth and world bosses every fiftieth, plus community levels, daily and weekly
tasks, achievements, leagues, seasons and a social layer with profiles and private messages.

There are no guest accounts, because progress, scores and community content have to belong to
someone. Sign up with an email and password — a six digit code verifies the address — or with Google.
Display name, username and picture are editable; the email address is not.

Principles: a score is proof rather than a claim; a feature without credentials says so instead of
pretending; moderation sees who contacted whom but never the message; and Turkish and English are
equal everywhere, enforced by tests.
