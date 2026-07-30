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

Önemli: `apps/*` paketleri `@tugla/*` paketlerini **derlenmiş `dist`** üzerinden tüketir; paketlerde
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
pnpm test            # 52 birim test (engine, shared, api, web, admin)
pnpm build           # packages + api + web + admin (production)
pnpm test:e2e:api    # 80 kontrollü uçtan uca API smoke (gerçek DB/Redis ister)
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

### Depoyu uzak sunucuya bağlama (Claude Code)

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

`pnpm lint` · `pnpm typecheck` · `pnpm test` (52 unit tests) · `pnpm build` · `pnpm build:preview` ·
`pnpm test:e2e:api` (80-check end-to-end journey against a real database). CI runs the identical gate
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
