# CLAUDE.md

> Bu depo araç bağımsız **[AGENTS.md](./AGENTS.md)** dosyasını kullanır; kurallar, komutlar,
> tuzaklar ve commit biçimi orada. Claude Code bu dosyayı okuduğunda AGENTS.md'yi de okumalıdır.
> This repository keeps its instructions in tool-agnostic **AGENTS.md**.

> Bu dosya Claude Code tarafından otomatik okunur. / This file is read automatically by Claude Code.

## Push handoff (ilk iş / do this first)

Depo temiz ve commit'lenmiş durumda teslim edilir; uzak depo bağlı **değildir**.
The repository is delivered clean and fully committed, with **no** remote configured.

```bash
bash scripts/first-push.sh git@github.com:<owner>/<repo>.git   # veya https://...
```

Betik; çalışma ağacının temiz olduğunu doğrular, `origin`'i ekler (varsa günceller) ve
`main` dalını yükler. Force push yapmaz, geçmişi yeniden yazmaz.
The script verifies a clean tree, adds/updates `origin` and pushes `main`. It never force-pushes.

## Commit kimliği / Commit identity

Depodaki tüm commit'ler `Emin DEMİRCİ <289519189+emindemirciai@users.noreply.github.com>`
kimliğiyle yazılır (GitHub bu adresi hesaba bağlar). Yeni bir ortamda çalışmaya başlarken:

```bash
git config user.name "Emin DEMİRCİ"
git config user.email "289519189+emindemirciai@users.noreply.github.com"
```

## Ne olduğu / What this is

Tuğla: mobil öncelikli, dikey ekran brick-breaker. Three.js ile 3B görünüm, **sabit 120 Hz
deterministik 2B fizik**, sunucuda yeniden simülasyonla doğrulanan skorlar. pnpm monorepo:

| Yol                    | İçerik                                                         |
| ---------------------- | -------------------------------------------------------------- |
| `apps/web`             | Oyuncu uygulaması (Next.js 15, PWA, TR/EN)                     |
| `apps/admin`           | Yönetim paneli (15 modül + görsel bölüm editörü)               |
| `apps/api`             | NestJS 11 API (auth, oyun, doğrulama, ilerleme, sosyal, admin) |
| `apps/mobile`          | Capacitor 7 kabuğu                                             |
| `packages/game-engine` | Deterministik fizik + replay (istemci ve sunucuda aynı kod)    |
| `packages/shared`      | Zod şemaları, sabitler, checksum                               |
| `packages/database`    | Prisma şeması, migration, seed (500 bölüm)                     |

## Komutlar / Commands

```bash
pnpm install
pnpm db:generate            # binaries.prisma.sh erişimi gerekir
pnpm build:packages         # apps, @tugla/* paketlerini dist üzerinden tüketir
pnpm db:migrate && pnpm db:seed
pnpm --filter @tugla/api build && node apps/api/dist/main.js   # :4000
pnpm --filter @tugla/web dev        # :3000
pnpm --filter @tugla/admin dev      # :3001

# Kapı / gate — hepsi yeşil olmadan iş bitmiş sayılmaz
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e:api           # 58 kontrol, gerçek PostgreSQL + Redis ister
pnpm build:preview          # preview/ui-preview.html (pnpm build sonrası)
```

## Tuzaklar / Gotchas

- **API yalnızca derlenmiş çıktıdan çalışır** (`apps/api/dist`). `tsx`/esbuild NestJS DI
  metadata'sını (`emitDecoratorMetadata`) üretmez ve uygulama açılmaz.
- **`apps/api/**`içinde`import type`kullanma.** Servis importları runtime import olmalı, aksi
halde DI metadata'sı silinir. ESLint bu klasörde`consistent-type-imports` kuralını kapatır.
- `apps/web` ve `apps/admin`, `@tugla/*` paketlerini **dist**'ten okur → paket değişiminden sonra
  `pnpm build:packages`.
- Prisma migration'ları `prisma migrate deploy` ile uygulanır (`db push` değil).
- **`NODE_ENV` ile build alma.** `next build` zaten production'a ayarlar; farklı bir değer
  `/404` dışa aktarımını `<Html> should not be imported outside of pages/_document` hatasıyla
  kırar. `scripts/assert-build-env.mjs` bunu tek satırlık anlaşılır bir hatayla durdurur.
- Metadata build sırasında gömülür: `WEB_URL`, `APP_NAME`, `APP_TAGLINE`, `DEFAULT_LOCALE`
  Docker **build argümanıdır** (bkz. `infrastructure/docker/Dockerfile.web`).

## Kurallar / Rules

1. TODO, placeholder sayfa, çalışmayan buton, sahte sonuç bırakma. Bir özellik çalışmıyorsa
   arayüz bunu dürüstçe söyler ("sağlayıcı yapılandırılmadı" gibi).
2. **Her metin TR ve EN olmalı.** Oyuncu uygulaması `apps/web/lib/i18n.tsx`, panel
   `apps/admin/lib/i18n.ts`, e-postalar `apps/api/src/services/mail.ts`. Sözlük eşliği birim testiyle
   korunur.
3. Gizli anahtar repoya yazılmaz; her şey `.env` üzerinden (`.env.example` tek referans).
4. Küçük ve anlamlı commit'ler. Kapı yeşil olmadan commit yok.
   **Commit mesajı biçimi (Türkçe, tek satır başlık):**

   ```
   <tip>: <kısa konu> — <ayrıntı> (<dokunulan alanlar>) · v<sürüm>
   ```

   Örnek: `feat: topluluk bölümleri — oyuncu editörü ve inceleme akışı (API, web, smoke) · v1.4`
   Tipler: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Sürüm numarası kökteki
   `package.json` ile aynıdır (`pnpm release:version 1.5.0` ile yükseltilir).
   / Commit subject in Turkish, same shape, version suffix must match package.json.

5. Marka/isim tek komutla değişir: `pnpm rename-project "New Name" newslug` (`--dry-run` destekler).

## Doğrulanmış durum / Verified state

`pnpm lint`, `pnpm typecheck`, 52 birim test, tam production build ve 58 kontrollü API E2E smoke
bu depoda yeşil geçti. Docker imaj derlemesi ve tarayıcı tabanlı E2E bu ortamda çalıştırılamadı
(Docker daemon ve tarayıcı indirmesi yok) — CI ve sunucuda çalıştırılmalıdır.
