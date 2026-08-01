# Marka varlıkları / Brand assets

Tümü `apps/web/public/brand/` altındadır ve site yayındayken doğrudan erişilebilir:

| Dosya / File                              | Boyut            | Kullanım / Use                                      |
| ----------------------------------------- | ---------------- | --------------------------------------------------- |
| `logo.svg`                                | vektör           | Uygulama ikonu, favicon, PWA manifesti              |
| `logo-512.png`                            | 512×512          | Kare ikon isteyen listeler, mağaza görselleri       |
| `logo-wordmark.svg` · `logo-wordmark.png` | vektör · 720×192 | Yatay logo + isim kilidi (başlıklar, basın)         |
| `cover-1200x630.svg` · `.png`             | 1200×630         | Open Graph / Twitter kartı, oyun listeleme siteleri |
| `cover-1280x720.svg` · `.png`             | 1280×720         | 16:9 küçük resim, mağaza ekran görüntüsü alanı      |

Canlı adresler (production URLs):

- https://tugla.fun/brand/logo.svg
- https://tugla.fun/brand/logo-512.png
- https://tugla.fun/brand/logo-wordmark.png
- https://tugla.fun/brand/cover-400x300.png (4:3 listeleme)
- https://tugla.fun/brand/cover-800x600.png (4:3, 2× ekranlar)
- https://tugla.fun/brand/cover-1200x630.png
- https://tugla.fun/brand/cover-1280x720.png

Renkler tasarım jetonlarıyla aynıdır: indigo `#5b4be1`, mercan `#ff7a45`, sarı `#ffd166`,
mürekkep `#1b1533`, sahne `#2a2154 → #171034`.

İşaret, oyunun kendisidir: üç sıra tuğla, ortadaki sıra kırılmış ve top aradan geçiyor.
The mark is the game itself — three courses of brick, the middle one broken open, ball punching through.

4:3 görsel geniş kapaktan türetilmedi: 400 pikselde geniş yerleşim okunmaz hâle geldiği için ayrı
kurgulandı — kırık duvar kahraman, metin ikiye indi, rozet genişlikleri etiketten hesaplanıyor.

SVG sürümlerdeki metin sistem yazı tipi yığınını kullanır; sabit sonuç gereken yerlerde PNG'yi tercih edin.
