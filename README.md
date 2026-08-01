# Tuğla

> Kod adı **Tuğla** — tüm marka/isim ayarları tek merkezden (`.env` + `pnpm rename-project`) değiştirilebilir.
> Codename **Tuğla** — every brand/name setting is driven from one place (`.env` + `pnpm rename-project`).

Modern, mobil öncelikli 2.5D brick-breaker: Three.js ile 3B görünüm, sabit 120 Hz deterministik 2D fizik,
sunucuda yeniden simülasyonla doğrulanan skorlar, 10 dünya / 500 bölüm, boss savaşları, günlük görevler,
haftalık ligler, sezonlar, topluluk bölüm editörü ve tam kapsamlı yönetim paneli.

---

## 🇹🇷 Türkçe

### Depo düzeni

| Yol                    | İçerik                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `apps/web`             | Oyuncu uygulaması (Next.js 15, PWA, Three.js sahnesi, TR/EN)        |
| `apps/admin`           | Yönetim paneli (Next.js 15, 15 modül + görsel bölüm editörü, TR/EN) |
| `apps/api`             | NestJS 11 API — auth, oyun, doğrulama, ilerleme, sosyal, admin      |
| `apps/mobile`          | Capacitor 7 kabuğu (Android/iOS; canlı PWA'yı yükler)               |
| `packages/game-engine` | Deterministik 2D fizik + replay (tarayıcı ve sunucuda aynı kod)     |
| `packages/shared`      | Zod şemaları, sabitler, checksum, tip sözleşmeleri                  |
| `packages/database`    | Prisma şeması, migration'lar, seed (500 bölüm dahil)                |
| `infrastructure/`      | Dockerfile'lar + Dokploy compose dosyaları                          |
| `scripts/`             | `rename-project`, `generate-secrets`, `e2e-api-smoke`               |

### Hızlı başlangıç (geliştirme)

Gereksinimler: Node 24+, pnpm 10+, PostgreSQL 16+, Redis 7+ (veya `docker compose up -d` ile yerel altyapı).

```bash
cp .env.example .env                 # sırları doldur: node scripts/generate-secrets.mjs
pnpm install
pnpm db:generate                     # Prisma client
pnpm build:packages                  # shared + game-engine + database dist
pnpm db:migrate                      # prisma migrate deploy
pnpm db:seed                         # 10 dünya / 500 bölüm + katalog + admin hesabı
pnpm --filter @tugla/api build && node apps/api/dist/main.js   # API :4000
pnpm --filter @tugla/web dev         # oyuncu uygulaması :3000
pnpm --filter @tugla/admin dev       # yönetim paneli :3001
```

Önemli: Build adımlarında `NODE_ENV` ayarlama — `next build` zaten `production` kullanır ve farklı
bir değer `/404` üretimini kırar (`scripts/assert-build-env.mjs` bunu erkenden ve anlaşılır biçimde
durdurur). Ayrıca `apps/*` paketleri `@tugla/*` paketlerini **derlenmiş `dist`** üzerinden tüketir; paketlerde
değişiklik yaptıysan `pnpm build:packages` çalıştır. API, NestJS decorator metadata gereksinimi nedeniyle
yalnızca `tsc` çıktısından (`apps/api/dist`) çalıştırılır.

### Oyuncu uygulaması ekranları

`/` açılış · `/auth/*` kayıt, giriş, doğrulama, parola sıfırlama · `/play` dünya + bölüm seçimi ve
oyun · `/progress` görevler, başarımlar, cüzdan defteri · `/leagues` haftalık lig ve küresel tablo ·
`/social` oyuncu arama, takip, arkadaşlık · `/create` **kendi bölümünü tasarla, test et, incelemeye
gönder; topluluk bölümlerini beğen/bildir** · `/shop` katalog ve oyun içi para ile satın alma ·
`/inbox` bildirimler + duyurular · `/replays` doğrulanmış tekrarlar ve paylaşım · `/account` profil,
dil, oturumlar, veri dışa aktarma, hesap silme. Tüm ekranlar aynı sekme şeridinden erişilebilir ve
oturum yoksa girişe yönlendirir (misafir hesap yoktur).

### Hesap açma ve Google ile giriş

E-posta ile kayıtta adrese **6 haneli doğrulama kodu** gönderilir (30 dakika geçerli). Kod tek
kullanımlıktır, adres başına deneme sınırı vardır ve 5 hatalı denemeden sonra kod yakılır — oyuncu
yeni kod ister. Aynı e-postadaki bağlantı kodu önceden doldurur, yani tek tıkla da doğrulanır.

Google ile kayıt/giriş tek düğmededir: tarayıcı Google Identity Services'ten imzalı bir kimlik
belirteci alır, API bunu Google'ın JWKS'ine karşı doğrular ve e-posta zaten kayıtlıysa hesabı
birleştirir. Düğme yalnızca `NEXT_PUBLIC_GOOGLE_CLIENT_ID` **ve** sunucudaki `GOOGLE_CLIENT_ID`
doluyken görünür; aksi halde arayüz sağlayıcının kapalı olduğunu dürüstçe söyler.

### Marka varlıkları ve paylaşım görseli

Logo ve tanıtım görselleri `apps/web/public/brand/` altındadır ve yayındayken doğrudan servis edilir:
`logo.svg`, `logo-512.png`, `logo-wordmark.svg|png`, `cover-400x300.svg|png` (+ `cover-800x600.png`),
`cover-1200x630.svg|png`, `cover-1280x720.svg|png`. Open Graph, Twitter kartı, PWA manifesti ve
JSON-LD bu dosyaları kullanır. Oyun listeleme siteleri için **4:3** görsel:
`https://tugla.fun/brand/cover-400x300.png`; sosyal paylaşım için
`https://tugla.fun/brand/cover-1200x630.png`; kare ikon için
`https://tugla.fun/brand/logo-512.png`.
Ayrıntı: `apps/web/public/brand/README.md`.

### Skor doğrulama gerileme kaydı

Dürüst oyuncular bir süre `replay-score-mismatch` ile reddedildi. Sebep: platform hedefi tekrar
kaydında dört ondalıkla saklanıyor, canlı oyun ise tam çift duyarlıkla entegre ediyordu. Bu kadar
kaotik bir sistemde o küçük fark binlerce tikte tamamen farklı bir tahtaya dönüşüyor. Artık hedef
**uygulanmadan önce** yuvarlanıyor, yani canlı oyun ve doğrulama aynı sayıyı görüyor; ayrıca tekrar
istemcinin bildirdiği tikten ileriye simüle etmiyor. Beş bölümü gerçek kare süreleriyle oynayıp
sunucu gibi doğrulayan testler eklendi.

### Oynanış ve ilerleme

- **Kontrol:** Platform artık parmağın/farenin tam altında. Ekran koordinatı, kameranın kadrajına
  ışın izlemeyle platform düzlemine yansıtılıyor; eskiden tuval genişliği doğrudan tahtaya
  eşlendiği için kadraj mektup kutusu olduğunda platform parmağın gerisinde kalıyordu. Bu hata
  üretime çıkabildi çünkü hesap WebGL gerektiren sınıfın içindeydi: artık saf bir fonksiyon
  (`projectPointerToBoardX`) ve dar telefon kadrajında gerilemeyi yakalayan testleri var.
- **Can:** Bölüm başına 3.
- **Top hızı sabit değil:** Dünya ilerledikçe artar, boss odalarında daha yüksektir ve her yedinci
  bölüm bir hız bölümüdür. Değer bölüm tanımından türetildiği için sunucunun doğrulama simülasyonu
  aynı hızı kullanır.
- **Bölüm kilidi:** Tüm bölümler listelenir, ancak bir bölüm ancak öncekini tamamlayınca açılır.
  Kilitli kart üzerinde kilit simgesi vardır, tamamlananda onay işareti. Kural sunucuda uygulanır:
  kilitli bir bölüm için oturum açma isteği reddedilir.
- **Bonuslar:** Havuz ağırlıklandırıldı; tek top yaygın, büyük sürüler nadir, faydalı bonuslar
  çoğunlukta. Yeni **güvenlik ağı** bonusu 5 saniye boyunca tabana ışıklı bir zemin serer: toplar
  düşmez, geri sekerler ve can gitmez.
- **Ses:** Bloğa çarpma, kırılmayan bloğa çarpma ve blok patlaması ayrı seslerdir; güvenlik ağı ve
  kalkan da kendi sesine sahiptir. Ses, oyun içi ayar panelinden açılıp kapatılır.
- **Görsel çeşitlilik:** Bölümler artık rastgele doldurulmuş tek bir dikdörtgen değil; 10 farklı
  siluet (duvar, tuğla örgüsü, piramit, elmas, sütunlar, kale, dalga, dama, kapı, halkalar)
  kampanyaya eşit dağıtıldı. Zor blok türleri siluetin kenarını ve üst sıraları izler, böylece
  zorluk gözle okunur. Her dünyanın kendi paleti (blok, zemin, ızgara, ışık) ve her bölümün kendi
  platform rengi vardır.

### Günün bölümü

Her UTC gününde yayınlanmış kampanya bölümlerinden biri **tarihin hash'iyle** seçilir: herkes aynı
bölümü oynar, hiçbir yerde takvim tutulmaz ve seçim destek için tekrar üretilebilir. `DAILY` modunda
gönderilen doğrulanmış skorlar `daily:<tarih>` tablosuna yazılır (günün en iyisi), bölüm seçimi ve
tablo `/play` ekranının en üstünde görünür. Uç nokta herkese açıktır: `GET /api/game/daily`.

### Site analitiği

Ziyaretçi istatistikleri üçüncü taraf bir servisle değil, projenin kendi panosuyla toplanır:
[Analyze.Your.Site](https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-).
`analytics` servisi bu depoyu `ANALYTICS_REF` sürümünden derler, olayları kendi biriminde JSON olarak
saklar ve yalnızca `WEB_URL` kaynağından olay kabul eder. Oyuncu uygulaması izleme betiğini
**yalnızca `NEXT_PUBLIC_ANALYTICS_URL` doluysa** ekler; boşsa hiçbir sayfada hiçbir izleyici yoktur.
Yönetim panelindeki Analitik ekranı oyun verisini gösterir ve yapılandırılmışsa trafik panosuna
bağlantı verir. Ayrıntı: `docs/DEPLOYMENT.md`.

### Sezonlar ve bildirimler

Sezonlar artık gerçekten kapanıyor: her saat çalışan görev, süresi dolan aktif sezonun
`season:<key>` tablosunu sıralar, sezonda tanımlı ödül basamaklarını (`top1`, `top10`, …) dağıtır,
kazananlara bildirim bırakır, sezonu pasifleştirir ve sırada bekleyen sezonu devreye alır. Tüm işlem
tek transaction içinde olduğu için bir sezon iki kez ödenemez; sonuç audit log'a `SEASON_SETTLED`
olarak yazılır.

Bildirim kutusu de artık gerçek olaylarla besleniyor: arkadaşlık isteği ve kabulü, topluluk
bölümünün yayınlanması/reddedilmesi/arşivlenmesi, çok bildirim sonrası otomatik incelemeye alınması
ve sezon sonucu. Daha önce moderasyon kararı yazara hiçbir şekilde bildirilmiyordu.

### Kapasite ve hız sınırı

`pnpm test:load` gerçek bir k6 senaryosudur: sağlık probu + dünya kataloğu + bölüm listesi +
kimlikli oturum başlatma (yineleme başına dört istek). Bu depoda ölçülen taban değerler (geliştirme
konteyneri, sınırlar yükseltilmiş): **78,6 istek/sn, 0 hata, p95 22 ms, p99 47 ms**. Ayrıntı ve
kurulum: `docs/OPERATIONS.md`.

API **istemci IP'si başına** hız sınırı uygular (`RATE_LIMIT_BURST` 30/sn, `RATE_LIMIT_SUSTAINED`
1200/dk; hepsi environment'tan ayarlanır). Mobil operatörler çok sayıda oyuncuyu tek adresin arkasına
koyduğu için varsayılanlar cömerttir. `GET /api/health` sınırdan muaftır: izleme, oyuncunun hakkını
yemez ve sınırlayıcı bir kesintiyi gizleyemez. Yük testi sınıra takılırsa betik ölçümü geçerli
saymaz ve `rate_limited_requests` eşiğiyle çalışmayı düşürür.

### Tasarım sistemi — "gün ışığı arcade"

Arayüz tek bir jeton setinden beslenir (`apps/web/app/styles.css` ve `apps/admin/app/admin.css`
içindeki `:root`). Hiçbir bileşen kendi hex'ini yazmaz; renk değişimi tek yerden yapılır.

| Jeton                            | Değer                             | Kullanım                                     |
| -------------------------------- | --------------------------------- | -------------------------------------------- |
| `--paper`                        | `#f6f3ff`                         | Sayfa zemini (leylak kırığı gün ışığı)       |
| `--surface`                      | `#ffffff`                         | Kartlar, tablolar, paneller                  |
| `--ink` / `--ink-3`              | `#1b1533` / `#6a6390`             | Başlık ve ikincil metin                      |
| `--brand`                        | `#5b4be1`                         | Birincil eylem, aktif durum                  |
| `--coral`                        | `#ff7a45`                         | Enerji: platform, overcharge, boss rozeti    |
| `--mint` / `--amber` / `--rose`  | `#12b886` / `#f5a524` / `#e5484d` | Olumlu / uyarı / hata                        |
| `--stage-top` → `--stage-bottom` | `#2a2154` → `#171034`             | **Yalnızca oyun alanı**: aydınlatılmış sahne |

İki tema var: **Gündüz** (varsayılan), **Gece** ve **Cihaz** (sistem tercihini izler). Seçim hesap
ekranından ve oyun içi ayar panelinden yapılır, ilk boyamadan önce uygulanır (tema titremesi yok).
Gece modu siyah değil, oyun sahnesiyle aynı menekşe-erik tonlarını kullanır.

Ayrım bilinçli: **arayüz gün ışığı, oyun alanı sahne.** 3B blokların parlaması için koyu bir zemin
gerekir; menüler, hesap ekranı ve yönetim paneli için gerekmez. Her dünya kendi rengini taşır
(`--card-hue`), böylece bölüm seçimi tek renkli değil. Durum rozetleri "tugla chip": nefes alan bir
nokta + etiket. `prefers-reduced-motion` tüm animasyonları kapatır.

### Topluluk içeriği güvenliği

Oyuncu yapımı bölümler yayına girene kadar moderasyondan geçer ve yayına girdikten sonra da denetimsiz
kalmaz:

- Gönderim `DRAFT` → `REVIEW` akışıyla ilerler; yalnızca moderatör yayınlar.
- Yayınlanan bölümler beğeni/beğenmeme alır (kendi bölümünü değerlendiremezsin) ve liste beğeniye göre sıralanır.
- Aynı kişi bir bölümü yalnızca bir kez bildirebilir; **üç farklı oyuncu bildirdiğinde bölüm otomatik
  olarak yayından alınıp `REVIEW` durumuna döner** ve bu işlem audit log'a `LEVEL_AUTO_REVIEW` olarak yazılır.
- Oynanmış bir bölüm silinmez, arşivlenir: replay doğrulaması geçmişe dönük çalışmaya devam eder.

### Keşfedilebilirlik: SEO / GEO / AEO

Tüm değerler environment'tan gelir (`WEB_URL`, `APP_NAME`, `APP_TAGLINE`, `DEFAULT_LOCALE`,
`SEO_INDEXABLE`, `AI_CRAWLERS_ALLOWED`, `SOCIAL_TWITTER`, `GOOGLE_SITE_VERIFICATION`,
`BING_SITE_VERIFICATION`), yani alan adı ve marka değiştiğinde kod değişmez.

| Çıktı                | Adres                                           | Not                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| robots.txt           | `/robots.txt`                                   | Oyuncu ekranları ve `/api/` kapalı; GPTBot, ClaudeBot, PerplexityBot, Google-Extended gibi yapay zekâ tarayıcılarına açık ya da kapalı olduğu **açıkça** yazılır (`AI_CRAWLERS_ALLOWED`) |
| Site haritası        | `/sitemap.xml`                                  | Yalnızca herkese açık sayfalar, her biri için `tr` + `en` alternatifleriyle                                                                                                              |
| llms.txt             | `/llms.txt`, `/llms.txt?lang=en`                | Yanıt motorları için kısa ve doğru özet + 6 SSS; uydurma bilgi yerine alıntılanabilir kaynak                                                                                             |
| Yapılandırılmış veri | Ana sayfa `<script type="application/ld+json">` | `@graph`: Organization, WebSite, VideoGame + SoftwareApplication, FAQPage                                                                                                                |
| OG görseli           | `/opengraph-image`                              | 1200×630 PNG, marka değerlerinden üretilir (yeniden adlandırmada yeni görsel gerekmez)                                                                                                   |
| PWA manifesti        | `/manifest.webmanifest`                         | `app/manifest.ts` ile environment'tan üretilir, kısayollar dahil                                                                                                                         |
| hreflang             | Her herkese açık sayfa                          | `?lang=tr` / `?lang=en` gerçekten o dili açar (`x-default` dahil)                                                                                                                        |

Gizlilik tarafı: `/play`, `/progress`, `/leagues`, `/social`, `/shop`, `/inbox`, `/replays`,
`/account` ve tüm token akışları `noindex, nofollow, nocache` döner; yönetim paneli tamamen kapalıdır
(`apps/admin/app/robots.ts`), API ise her yanıtta `X-Robots-Tag: noindex` gönderir.
Üretim dışı ortamlar `SEO_INDEXABLE=false` ile varsayılan olarak tamamen kapalıdır.

### Arayüz önizlemesi

```bash
pnpm build          # önce üretim derlemesi (CSS paketleri gerekli)
pnpm build:preview  # preview/ui-preview.html üretir
```

Tek dosyalık, bağımsız bir HTML çıkar: üretim derlemesinden alınan **gerçek CSS paketleriyle**
on ekranı (açılış, giriş, bölüm seçimi, oyun HUD'u, ilerleme, lig, mağaza, admin genel bakış,
admin kullanıcılar, SEO/GEO çıktıları) TR/EN anahtarıyla gösterir. İçindeki veriler örnektir; hiçbir API çağrısı yapmaz.

### Doğrulama kapısı

```bash
pnpm lint            # prettier --check + eslint (tek düz konfig)
pnpm typecheck       # tüm workspace
pnpm test            # 82 birim test (engine, shared, api, web, admin)
pnpm build           # packages + api + web + admin (production)
pnpm test:e2e:api    # 100 kontrollü uçtan uca API smoke (gerçek DB/Redis ister)
pnpm test:load       # k6 yük testi (k6 kurulumu gerekir; docs/OPERATIONS.md)
```

CI (`.github/workflows/ci.yml`) aynı kapıyı Postgres+Redis servisleriyle çalıştırır; `main`'e başarılı
push sonrası `deploy.yml` Dokploy webhook'unu tetikler.

### Skor doğrulama (hile önleme)

1. Oturum başlangıcında sunucu imzalı `seed + nonce` verir.
2. İstemci deterministik motoru bu seed ile çalıştırır; girdiler (tick + platform X) kaydedilir.
3. Bitişte istemci `skor + checksum + replay` gönderir; sunucu **aynı motoru aynı seed ile yeniden
   simüle eder**. Checksum/skor/istatistik uyuşmazsa oturum `REJECTED` olur, hiçbir tabloya yazılmaz ve
   moderasyon ekranına düşer. Süre, tick sayısı ve duvar saati de ayrıca sınırlanır.

### TR/EN yerelleştirme

- Oyuncu uygulaması: `apps/web/lib/i18n.tsx` (LocaleProvider + `useI18n`, sözlük eşliği birim testli).
- Yönetim paneli: `apps/admin/lib/i18n.ts` (modül seviyesinde `t()`, dil değişiminde yeniden yükleme).
- İşlemsel e-postalar: `apps/api/src/services/mail.ts` kullanıcının `locale` alanına göre TR/EN gönderir.

### Dokploy ile dağıtım (Hostinger KVM)

1. Sunucuya Dokploy kur, bu depoyu **private** olarak bağla.
2. "Docker Compose" uygulaması oluştur → dosya: `infrastructure/dokploy/compose.production.yml`.
3. `.env.example`'daki tüm değişkenleri Dokploy environment ekranına gir (sırlar dahil).
4. İlk dağıtım: `migrate` servisi `prisma migrate deploy` çalıştırır; ardından `api`, `web`, `admin`
   sağlık kontrolleriyle ayağa kalkar. Alan adları Dokploy/Traefik ekranından bağlanır; kod tarafında
   domain sabitlenmemiştir (`WEB_URL`, `ADMIN_URL`, `API_URL`).
5. GitHub otomatik dağıtımı için repo secrets: `DOKPLOY_PRODUCTION_WEBHOOK` (ve istenirse staging).

### Mobil (Capacitor)

```bash
cd apps/mobile
npx cap add android && npx cap add ios   # yerel projeleri bir geliştirici makinesinde üret
CAPACITOR_SERVER_URL=https://oyun.alanadi.com npx cap sync
npx cap open android   # / ios
```

Kabuk çevrim dışıyken `apps/mobile/www` açılış ekranını gösterir; bağlantı gelince canlı PWA yüklenir.

### Sürüm ve commit biçimi

Tek sürüm kaynağı kökteki `package.json` (`pnpm release:version 1.5.0` tüm paketleri günceller).
Commit başlıkları Türkçe ve şu biçimdedir:

```
feat: topluluk bölümleri — oyuncu editörü ve inceleme akışı (API, web, smoke) · v1.4
```

### Ajanlar için talimatlar (Antigravity, Cursor, Claude Code…)

Kurallar, komutlar, tuzaklar ve commit biçimi araç bağımsız **`AGENTS.md`** dosyasındadır;
`CLAUDE.md` yalnızca oraya işaret eder. Yeni bir ajanla çalışmaya başlarken tek okuması gereken dosya
budur.

### Depoyu uzak sunucuya bağlama

Depo temiz ve tüm işler commit'lenmiş halde teslim edilir; uzak depo bağlı değildir. Bağlamak ve
`main` dalını yüklemek için:

```bash
bash scripts/first-push.sh git@github.com:<owner>/<repo>.git
```

Betik çalışma ağacının temiz olduğunu doğrular, `origin`'i ekler/günceller ve force push yapmadan
gönderir. Ayrıca kökteki **`CLAUDE.md`**, Claude Code'un depoyu bağlam kaybı olmadan devralması için
komutları, tuzakları (API yalnızca `dist`'ten çalışır, `apps/api` içinde `import type` kullanılmaz)
ve TR/EN kuralını özetler.

### Proje adını değiştirme

```bash
pnpm rename-project "Yeni Ad" yeniad --dry-run   # önce ne değişeceğini gör
pnpm rename-project "Yeni Ad" yeniad             # uygula (temiz çalışma ağacı ister)
```

Paket adlarını (`@tugla/*`), görünen adı, slug'ı (veritabanı kullanıcısı, çerez öneki, depolama
anahtarları, Capacitor app id), Dockerfile'ları ve yedek betiklerini tek seferde günceller.
**Doğrulandı:** temiz bir kopyada 76 dosya değişti, geriye tek bir `tugla` izi kalmadı ve
`pnpm install` sorunsuz tamamlandı. Sonrasında: `pnpm install && pnpm db:generate && pnpm build`.

---

## 🇬🇧 English

### Repository layout

Same table as above: `apps/web` (player app), `apps/admin` (staff panel), `apps/api` (NestJS),
`apps/mobile` (Capacitor shell), `packages/game-engine` (deterministic physics + replay),
`packages/shared` (Zod contracts + checksum), `packages/database` (Prisma + seed),
`infrastructure/` (Docker + Dokploy), `scripts/` (rename, secrets, smoke).

### Quick start (development)

Requirements: Node 24+, pnpm 10+, PostgreSQL 16+, Redis 7+ (or `docker compose up -d`).

```bash
cp .env.example .env                 # fill secrets: node scripts/generate-secrets.mjs
pnpm install
pnpm db:generate
pnpm build:packages                  # apps consume @tugla/* from built dist
pnpm db:migrate && pnpm db:seed      # 10 worlds / 500 levels + catalogue + admin user
pnpm --filter @tugla/api build && node apps/api/dist/main.js
pnpm --filter @tugla/web dev         # :3000
pnpm --filter @tugla/admin dev       # :3001
```

The API must run from compiled output (`apps/api/dist`) because NestJS dependency injection relies on
emitted decorator metadata.

### Verification gate

`pnpm lint` · `pnpm typecheck` · `pnpm test` (82 unit tests) · `pnpm build` · `pnpm build:preview` ·
`pnpm test:e2e:api` (100-check end-to-end journey against a real database). CI runs the identical gate
with Postgres+Redis services and triggers the Dokploy webhook on success.

### Score verification (anti-cheat)

The server issues a signed seed+nonce per session; the client records inputs; on completion the server
**re-simulates the deterministic engine** with the submitted replay. Any checksum/score/stat mismatch
rejects the session (never touching leaderboards) and surfaces it in the moderation screen.

### Player screens & UI preview

`/` landing · `/auth/*` sign-up, sign-in, verification, password reset · `/play` world + level
selection and the game itself · `/progress` tasks, achievements, wallet ledger · `/leagues` weekly
league and global board · `/social` player search, follow, friendships · `/create` design, test and submit your own levels ·
`/shop` catalogue and
in-game-currency purchases · `/inbox` notifications + announcements · `/replays` verified replays and
sharing · `/account` profile, language, sessions, data export, deletion.

`pnpm build && pnpm build:preview` writes `preview/ui-preview.html`: a single self-contained file that
renders ten screens with the **real compiled CSS** from the production build and a TR/EN switch. The
data inside is sample data and no API calls are made.

### Sign-up and Google sign-in

Email sign-up sends a **six digit verification code** (valid 30 minutes, single use, attempt-limited;
five wrong guesses burn the code and the player requests a new one). The emailed link prefills the
code, so one click also works. Google sign-in/sign-up is one button: the browser obtains a signed ID
token from Google Identity Services, the API verifies it against Google's JWKS and merges the account
when the verified address already exists. The button only appears when both `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
and the server-side `GOOGLE_CLIENT_ID` are configured.

### Brand assets

Logo and promotional artwork live in `apps/web/public/brand/` and are served straight from the site:
`logo.svg`, `logo-512.png`, `logo-wordmark.svg|png`, `cover-400x300.svg|png` (plus a 2× render),
`cover-1200x630.svg|png` and `cover-1280x720.svg|png`. Open Graph, the Twitter card, the PWA manifest
and the JSON-LD graph point at them. Game directories that ask for a 4:3 thumbnail can link
`https://tugla.fun/brand/cover-400x300.png` directly — it is a separate composition rather than a
downscale of the wide cover.

### Gameplay and progression

The paddle now sits exactly under the pointer (the screen position is ray-cast onto the paddle
plane instead of assuming the canvas equals the board). Lives are 3 per level. Ball speed is derived
from the level — rising per world, faster in boss rooms, with a sprint level every seventh — so the
server's verification run uses the identical value. Every level is listed but locked until the
previous one is cleared, enforced server-side. Boards are drawn from ten distinct silhouettes spread
evenly across the campaign, each world has its own palette and each level its own paddle colour.

### Daily challenge

One published campaign level is picked per UTC day from a hash of the date, so everyone plays the
same level, no schedule is stored anywhere and the pick is reproducible for support. Verified runs
submitted in `DAILY` mode land on the `daily:<date>` board (best score of the day). Public endpoint:
`GET /api/game/daily`.

### Site analytics

Traffic statistics come from the project's own dashboard
([Analyze.Your.Site](https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-)) instead of
a third-party service. The `analytics` compose service builds it from a pinned ref, stores events as
JSON on its own volume and accepts events only from `WEB_URL`. The player app injects the tracker
**only** when `NEXT_PUBLIC_ANALYTICS_URL` is set — otherwise no page carries any tracker at all.

### Seasons and notifications

Seasons now actually close: an hourly job ranks the `season:<key>` board of any expired active
season, pays the reward tiers declared on it, notifies the winners, deactivates it and activates the
next scheduled season — all in one transaction, recorded as `SEASON_SETTLED` in the audit log. The
inbox is fed by real events too: friend requests and acceptances, community level published /
rejected / archived / auto-hidden, and season results. Previously a moderation decision never
reached the author.

### Capacity and rate limiting

`pnpm test:load` runs a real k6 scenario (health probe, world catalogue, level list and an
authenticated session start per iteration). Baseline measured in this repository with limits raised:
**78.6 req/s, zero failures, p95 22 ms, p99 47 ms** — see `docs/OPERATIONS.md` for the k6 install and
the full table. Throttling is **per client IP** and fully env-driven (`RATE_LIMIT_BURST` 30/s,
`RATE_LIMIT_SUSTAINED` 1200/min); `GET /api/health` is exempt so monitoring never eats a player's
budget. A limiter-bound load run fails its own threshold instead of pretending to be a capacity
result.

### Design system — "daylight arcade"

One token set drives both apps (`:root` in `apps/web/app/styles.css` and `apps/admin/app/admin.css`);
no component hardcodes a colour. Paper `#f6f3ff`, ink `#1b1533`, one electric indigo `#5b4be1` for
action and a coral `#ff7a45` for energy, with mint/amber/rose for state. The playfield keeps a lit
violet stage (`#2a2154` → `#171034`) because 3D blocks need a dark room — the rest of the product
does not. Each world carries its own hue, status badges are "tugla chips" with a breathing dot, and
`prefers-reduced-motion` disables every animation. Three appearances ship — Day, Night and Device
(follows the system) — chosen from the account screen or the in-game settings panel and applied
before first paint, so there is no theme flash. Night is plum, not black.

### Community safety

Player-made levels go through moderation before publication and stay supervised afterwards: ratings
(never on your own level), one report per person per level, and **three distinct reports pull a
published level back into `REVIEW` automatically**, recorded in the audit log as `LEVEL_AUTO_REVIEW`.
Levels that have already been played are archived rather than deleted so replay verification keeps
working.

### Discoverability: SEO / GEO / AEO

Everything is environment-driven (`WEB_URL`, `APP_NAME`, `APP_TAGLINE`, `DEFAULT_LOCALE`,
`SEO_INDEXABLE`, `AI_CRAWLERS_ALLOWED`, `SOCIAL_TWITTER`, verification tokens), so a new domain or
brand needs no code change.

- `/robots.txt` — player screens and `/api/` disallowed; AI crawlers (GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended, Applebot-Extended…) answered **explicitly**, allowed or blocked via
  `AI_CRAWLERS_ALLOWED`.
- `/sitemap.xml` — public routes only, each declaring `tr` and `en` alternates.
- `/llms.txt` (and `?lang=en`) — a short, accurate summary plus six FAQ entries so answer engines
  quote real copy instead of guessing.
- JSON-LD `@graph` on the home page — Organization, WebSite, VideoGame + SoftwareApplication, FAQPage.
- `/opengraph-image` — 1200×630 PNG generated from the brand values.
- `/manifest.webmanifest` — generated by `app/manifest.ts`, including app shortcuts.
- hreflang on every public page; `?lang=tr` / `?lang=en` genuinely switch the language.

Private screens and every token flow return `noindex, nofollow, nocache`; the admin panel is fully
disallowed and the API sends `X-Robots-Tag: noindex`. Non-production environments stay unindexed
unless `SEO_INDEXABLE=true`.

### Localisation

Player app: `apps/web/lib/i18n.tsx` (provider + hook, dictionary parity unit-tested). Admin panel:
`apps/admin/lib/i18n.ts` (module-level `t()`, reload on switch). Transactional email follows each
user's stored `locale` (TR/EN).

### Deploying with Dokploy

Create a Docker-Compose app pointing at `infrastructure/dokploy/compose.production.yml`, paste the
variables from `.env.example`, deploy (the `migrate` service runs `prisma migrate deploy` first), then
attach domains in Traefik — nothing in the code hard-codes a domain. Add the
`DOKPLOY_PRODUCTION_WEBHOOK` repo secret for push-to-deploy.

### Handoff & renaming

The repo ships clean and fully committed with no remote. Connect and push with
`bash scripts/first-push.sh <remote-url>` (clean-tree check, no force push). **`CLAUDE.md`** captures
the commands, gotchas and rules for Claude Code.

`pnpm rename-project "New Name" newslug` rebrands everything in one command (`--dry-run` first);
verified on a pristine copy: 76 files rewritten, zero leftovers, `pnpm install` still succeeds.

### Mobile

`npx cap add android && npx cap add ios` on a dev machine, then `npx cap sync` with
`CAPACITOR_SERVER_URL` set. Rename everything with `pnpm rename-project -- --name "NewName" --slug newname`.
