# Search Console uyarıları / Search Console notices

Google "sayfa içeriklerinizin dizine eklenmesini engelleyen yeni nedenler" başlıklı bir e-posta
gönderdiğinde dört başlık sayar. Üçü **beklenen davranıştır**, biri gerçek bir kusurdu.

## 1. "Doğru standart etikete sahip alternatif sayfa" — gerçek kusurdu, düzeltildi

Site haritası her sayfa için `?lang=tr` ve `?lang=en` adreslerini **hreflang alternatifi** olarak
bildiriyordu. Ama bu projede dil bir URL değil, istemci tercihidir: `?lang=tr` ile `?lang=en` **aynı
HTML'i** döndürür. Yani Google'dan her sayfanın iki kopyasını daha taramasını istiyorduk; o da her
kopyayı doğru şekilde "asıl sayfanın alternatifi" diye raporluyordu.

Alternatifler kaldırıldı. Gerçek hreflang, dile göre **farklı içerik sunan** adresler gerektirir;
öyle bir yapı kurulmadan bunu iddia etmek Google'a yanlış bilgi vermektir.

## 2. "Robots.txt tarafından engellendi" — beklenen

`/play`, `/inbox`, `/account`, `/shop` gibi rotalar oyuncu verisidir ve `robots.txt` bunları bilerek
engeller. Açılış sayfasında "Hemen oyna" bağlantısı olduğu için Google `/play` adresini keşfeder,
tarayamaz ve bunu rapor eder. Bu bir hata değil, kuralın çalıştığının kanıtıdır.

## 3. "Yönlendirmeli sayfa" — beklenen

`www.tugla.fun` → `tugla.fun` gibi yönlendirmeler taranırken bu başlıkta listelenir. Yönlendirmenin
hedefi dizine girdiği sürece yapılacak bir şey yoktur.

## 4. "Bulunamadı (404)" — raporu açıp bakmak gerekir

Site haritasındaki her adresin gerçekten yanıt verdiği artık otomatik kontrol ediliyor (aşağıya
bakın), dolayısıyla 404'ün kaynağı büyük olasılıkla **dışarıdan gelen eski bir bağlantı**: silinmiş
bir sayfa, yanlış yazılmış bir adres ya da tarayıcının denediği bir varyant. Search Console'da
**Dizine ekleme raporunu aç → Bulunamadı (404)** listesindeki adresleri gör; gerçekten bize ait
olmayan adresler için yapılacak bir şey yoktur, bize aitse ya sayfayı geri getirmek ya da kalıcı
yönlendirme eklemek gerekir.

## Kendi kendini kontrol

```bash
SITE_URL=https://tugla.fun pnpm check:seo
```

Bu komut sitenin kendisi hakkında saniyeler içinde doğrulayabileceği çelişkileri arar:

- `robots.txt` yanıt veriyor ve bir site haritası gösteriyor mu
- site haritasındaki her adres **200** dönüyor mu (404 üreten bir site haritası, dizine eklenmemenin
  en sık sebebidir)
- site haritasındaki hiçbir adres kendi `robots.txt`'imiz tarafından **yasaklanmamış** mı — "bunu
  dizine ekle" ile "bunu okuma"yı aynı anda söylemek, tarayıcının sayfayı düşürmesiyle sonuçlanır
- her sayfa **kendini** canonical gösteriyor mu

Doğrulandı: site haritasına var olmayan bir rota eklendiğinde komut kırmızıya döndü ve adresi adıyla
bildirdi.

---

## English

Of the four reasons Google lists, three are expected and one was a real defect.

**Alternate page with proper canonical tag** was ours: the sitemap declared `?lang=tr` and `?lang=en`
as hreflang alternates, but language here is a client preference and both URLs serve identical HTML.
We were asking Google to crawl two extra copies of every page and it was correctly filing each as an
alternate. The alternates are gone; real hreflang needs URLs that actually differ.

**Blocked by robots.txt** is the rule working: player routes are deliberately disallowed and the
landing page links to `/play`, so Google discovers and reports it. **Page with redirect** is normal
for `www` → apex. **Not found (404)** needs the report itself — open it and look at the URLs; if they
were never ours, there is nothing to fix.

`pnpm check:seo` now verifies what a site can check about itself: robots responds and points at a
sitemap, every sitemap URL returns 200, no sitemap URL is disallowed by our own robots rules, and
each page is self-canonical. Verified by adding a non-existent route to the sitemap — the check went
red and named it.
