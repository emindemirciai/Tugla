# AGENTS.md — Tuğla

> Bu dosya araç bağımsızdır: Antigravity, Cursor, Claude Code, Codex ve benzeri
> ajanlar aynı kuralları buradan okur. / Tool-agnostic instructions for any coding agent.

## Depo / Repository

Tuğla: mobil öncelikli, dikey ekran brick-breaker. Three.js ile 3B görünüm, **sabit 120 Hz
deterministik 2B fizik**, sunucuda yeniden simülasyonla doğrulanan skorlar. pnpm monorepo:
`apps/web` (oyuncu), `apps/admin` (yönetim), `apps/api` (NestJS), `apps/mobile` (Capacitor),
`packages/game-engine` · `packages/shared` · `packages/database`.

Uzak depo: <https://github.com/emindemirciai/Tugla> — alan adı **tugla.fun**.

## Kurulum ve komutlar

```bash
pnpm install
pnpm db:generate            # binaries.prisma.sh erişimi gerekir
pnpm build:packages         # apps, @tugla/* paketlerini dist üzerinden tüketir
pnpm db:migrate && pnpm db:seed
pnpm --filter @tugla/api build && node apps/api/dist/main.js   # :4000
pnpm --filter @tugla/web dev     # :3000
pnpm --filter @tugla/admin dev   # :3001

# Kapı — hepsi yeşil olmadan iş bitmiş sayılmaz
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e:api           # 89 kontrol, gerçek PostgreSQL + Redis ister
pnpm test:load              # k6 yük testi (docs/OPERATIONS.md)
pnpm build:preview          # preview/ui-preview.html
```

## Tuzaklar / Gotchas

- **API yalnızca derlenmiş çıktıdan çalışır** (`apps/api/dist`). `tsx`/esbuild NestJS DI
  metadata'sını üretmez.
- **`apps/api/**`içinde`import type` kullanma\*\* — servis importları runtime olmalı.
- `apps/web` ve `apps/admin`, `@tugla/*` paketlerini **dist**'ten okur → paket değişiminden sonra
  `pnpm build:packages`.
- **Build sırasında `NODE_ENV` ayarlama.** `next build` zaten production kullanır; farklı bir değer
  `/404` üretimini kırar. `scripts/assert-build-env.mjs` bunu erken durdurur.
- Migration'lar `prisma migrate deploy` ile uygulanır (`db push` değil).
- **Bir build script'i `../../scripts/...` çağırıyorsa ilgili Dockerfile o klasörü `COPY` etmeli.**
  Yerelde görünmez, yalnızca imaj derlemesinde patlar; `pnpm check:docker` bunu CI'da yakalar.
- **`COPY --from=...` kaynağı var olmak zorundadır.** Depo dışı bir kaynak ağacından (klonlanan
  proje) kopyalanan yol, derleme aşamasında `RUN mkdir -p` ile garanti edilmeli; yoksa tüm compose
  derlemesi düşer. Aynı kontrol `pnpm check:docker` içinde.
- `WEB_URL`, `APP_NAME`, `APP_TAGLINE`, `DEFAULT_LOCALE`, `NEXT_PUBLIC_ANALYZE_URL` metadata'ya
  build sırasında gömülür → Docker **build argümanıdır**.

## Kurallar / Rules

1. TODO, placeholder sayfa, çalışmayan buton, sahte sonuç bırakma. Çalışmayan bir özellik arayüzde
   dürüstçe "kapalı" der.
2. **Her metin TR ve EN olmalı** (`apps/web/lib/i18n.tsx`, `apps/admin/lib/i18n.ts`,
   `apps/api/src/services/mail.ts`). Sözlük eşliği birim testiyle korunur.
3. Gizli anahtar repoya yazılmaz; her şey `.env` üzerinden (`.env.example` tek referans).
   **Demo/örnek veride gerçek kişi izlenimi veren ad kullanılmaz**: tarafsız İngilizce yer tutucular
   (`Player One`, `Smoke Player`) ve `example.com` adresleri kullanılır — KVKK/GDPR açısından
   ekran görüntüsü ve önizlemeler kişisel veri gibi görünmemelidir.
4. Küçük ve anlamlı commit'ler; **kapı yeşil olmadan commit yok** — komutu çalıştırmak yetmez,
   çıktısı okunmalı. (Bir kez `pnpm test:e2e:api` çıktısı okunmadan commit atıldı ve kırmızıydı.)
   Uçtan uca smoke kendi sürecinde hız sınırını yükseltir; bu kasıtlıdır, sınırı ölçen yer
   `tests/load/smoke.js`'tir.
5. Marka tek komutla değişir: `pnpm rename-project "Yeni Ad" yeniad` (`--dry-run` destekler).

## Commit ve push

Commit başlığı Türkçe, tek satır:

```
<tip>: <kısa konu> — <ayrıntı> (<alanlar>) · v<sürüm>
```

Örnek: `feat: günün bölümü — deterministik günlük seçim ve tablo (API, web, smoke) · v2.1`
Tipler: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Sürüm kökteki `package.json` ile aynıdır
(`pnpm release:version 2.2.0`).

Commit kimliği (geçmişteki tüm commit'ler bu kimlikle imzalı):

```bash
git config user.name "Emin DEMİRCİ"
git config user.email "289519189+emindemirciai@users.noreply.github.com"
```

Push: `git push origin main`. Geçmiş bir kez yeniden yazıldıysa (marka temizliği gibi)
`git push --force-with-lease origin main` gerekir; bunu yalnızca bilinçli olarak yap.

### Oturum sonu teslim bloğu (zorunlu biçim)

Depoyu Antigravity IDE gönderiyor. IDE'nin commit mesajını kendi başına yeniden yazmaması veya
dosyalara dokunmaması için, her oturumun raporu tam olarak şu üç parçayla bitmelidir:

1. **"hiçbir şeyi değiştirmeden commitleyip pushla"** cümlesi — birebir, tırnak içinde. IDE'ye
   verilecek talimat budur; eksik bırakılırsa IDE kendi düzenlemesini yapabilir.
2. Önerilen commit mesajı (yukarıdaki biçimde, tek satır başlık).
3. `git push origin main` komutu.

Örnek:

> **"hiçbir şeyi değiştirmeden commitleyip pushla"** — öneri:
>
> ```
> feat: konu — ayrıntı (alanlar) · v3.8
> ```
>
> ```bash
> git push origin main
> ```
