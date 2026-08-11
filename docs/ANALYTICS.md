# Site analitiği / Site analytics

Trafik istatistikleri, üçüncü taraf bir servisle değil, projenin kendi panosuyla toplanır:
<https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et->

Üretimde bu pano **ayrı bir Dokploy uygulaması** olarak çalışır (`analiz.tugla.fun`). Bu depodaki
compose dosyasında da bir `analytics` servisi vardır ama artık `analytics` profili arkasındadır ve
varsayılan olarak **çalışmaz** — iki dağıtımın aynı alan adı için yarışmaması için.

## Dokploy'da doğru ortam değişkenleri

Uygulama şu adları okur. Ekran görüntüsündeki `ANALYTICS_*` adları **yanlıştır**; hiçbiri
uygulamaya ulaşmaz ve veri, bağlanan birime değil varsayılan yola yazılır:

| Yanlış (etkisiz)           | Doğru                    |
| -------------------------- | ------------------------ |
| `ANALYTICS_DATA_DIR`       | `ANALYZE_DATA_DIR`       |
| `ANALYTICS_MAX_EVENTS`     | `ANALYZE_MAX_EVENTS`     |
| `ANALYTICS_ALLOWED_ORIGIN` | `ANALYZE_ALLOWED_ORIGIN` |
| `ANALYTICS_GEO_LOOKUP`     | `ANALYZE_GEO_LOOKUP`     |

`analiz.tugla.fun` uygulaması için:

```env
NODE_ENV=production
ANALYZE_DATA_DIR=/app/data
ANALYZE_MAX_EVENTS=200000
ANALYZE_ALLOWED_ORIGIN=https://tugla.fun
ANALYZE_GEO_LOOKUP=true
KONFERANS_API_URL=https://api.tugla.fun
```

## Neden Konferans sayfası açılıyor

Panonun `main` dalı artık **Konferans'a özel** parçalar içeriyor: oturum çerezi
`konferans_analytics_session`, sağlık ucu `{"name":"Konferans Analiz"}` döndürüyor ve giriş,
`KONFERANS_API_URL` ile belirlenen API'ye gidiyor — varsayılanı `https://api.konferans.io`.

Bu yüzden aynı dalı iki farklı marka için dağıtmak iki sorun üretir:

1. `analiz.tugla.fun` Konferans kimliğiyle açılır ve girişi Konferans API'sine sorar.
2. `analiz.yillikizin.com` aynı dala bakıyorsa, bir sonraki dağıtımda o da Konferans sürümüne
   döner — "bozuldu" denen şey büyük olasılıkla budur.

**Kalıcı çözüm:** her marka için ayrı bir dal (`deploy/tugla`, `deploy/yillikizin`) tutup Dokploy'da
Branch alanını ona sabitlemek; marka adları ve varsayılan API adresi ortam değişkenine taşınana kadar
tek dal birden çok markayı taşıyamaz.

**Hızlı çözüm:** `KONFERANS_API_URL` değerini kendi API adresinle doldur; giriş akışı en azından
kendi sunucuna gider.

## Başlatma komutu uyarısı

Pano `output: 'standalone'` ile derleniyor ama başlatma komutu `next start`. Loglardaki uyarı bunu
söylüyor:

```
"next start" does not work with "output: standalone" configuration.
Use "node .next/standalone/server.js" instead.
```

Dokploy → General → Start Command alanına `node .next/standalone/server.js` yaz.

## tugla.fun tarafındaki izleyici

Oyuncu uygulaması izleme betiğini yalnızca `NEXT_PUBLIC_ANALYTICS_URL` doluysa ekler. Değer derleme
sırasında gömüldüğü için **web imajı yeniden derlenmelidir**:

```env
NEXT_PUBLIC_ANALYTICS_URL=https://analiz.tugla.fun
NEXT_PUBLIC_ANALYTICS_SITE=tugla.fun
```

Betiğin kendisi `https://analiz.tugla.fun/api/tracker` adresinden yüklenir ve olayları
`/api/track` ucuna gönderir; pano tarafında `ANALYZE_ALLOWED_ORIGIN=https://tugla.fun` olduğu için
başka bir siteden gelen olay kabul edilmez.

---

## English summary

The dashboard runs as its own Dokploy application; the bundled compose service is behind the
`analytics` profile so the two cannot fight over one domain. The environment variables in the
screenshot are misspelled — the app reads `ANALYZE_*`, not `ANALYTICS_*`, so none of them took
effect and events were not written to the mounted volume. The dashboard's `main` branch now carries
Konferans-specific pieces (session cookie name, health payload, and a login that calls
`KONFERANS_API_URL`, defaulting to `api.konferans.io`), which is why the Tuğla deployment shows
Konferans and why redeploying the same branch changes the yillikizin site as well. Keep a branch per
brand, or move those names into environment variables. Finally, the app builds standalone but starts
with `next start`; set the start command to `node .next/standalone/server.js`. On the game side, set
`NEXT_PUBLIC_ANALYTICS_URL` and rebuild the web image, because public variables are baked at build
time.
