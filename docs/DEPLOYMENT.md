# Dokploy deployment

## 1. Prepare DNS

Point the following records at the VPS:

- `tugla.fun` → web
- `api.tugla.fun` → API
- `admin.tugla.fun` → admin
- `analiz.tugla.fun` → site analytics (optional)

The domain is never hardcoded: everything follows `ROOT_DOMAIN` and the URL variables.

## 2. Create the Dokploy compose application

Use `infrastructure/dokploy/compose.production.yml`. Assign public domains to `web`
(`tugla.fun`), `api` (`api.tugla.fun`), `admin` (`admin.tugla.fun`) and, if you want site traffic
statistics, `analytics` (`analiz.tugla.fun`). PostgreSQL, Redis and MinIO stay on the internal
network.

### Build arguments matter

Next.js bakes metadata (canonical URLs, hreflang, JSON-LD, the Open Graph image) while it builds the
static pages, so branding is passed as **build arguments** as well as runtime environment. The
compose file already forwards them:

| Build arg                          | Source                           |
| ---------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_API_URL`              | `https://api.${ROOT_DOMAIN}/api` |
| `NEXT_PUBLIC_APP_NAME`, `APP_NAME` | `APP_NAME`                       |
| `APP_TAGLINE`                      | `APP_TAGLINE`                    |
| `WEB_URL`                          | `https://${ROOT_DOMAIN}`         |
| `DEFAULT_LOCALE`                   | `DEFAULT_LOCALE` (tr/en)         |

If a domain changes later, rebuild the web image — a restart alone will not update baked metadata.
`/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` and `/llms.txt` are rendered per request and
follow the runtime environment immediately.

## 3. Configure secrets

Copy `.env.example` into Dokploy environment variables — it is the single reference and includes the
discoverability block (`SEO_INDEXABLE`, `AI_CRAWLERS_ALLOWED`, `DEFAULT_LOCALE`, verification
tokens). Staging should keep `SEO_INDEXABLE=false` so it never competes with production. Generate first-party secrets:

```bash
node scripts/generate-secrets.mjs
```

Set strong values for `POSTGRES_PASSWORD`, `MINIO_ROOT_*` and `UMAMI_APP_SECRET`. Leave Google,
Apple, SMTP, AdMob, Stripe and store keys empty until the accounts exist. Keep
`ADS_ENABLED=false` and `PAYMENTS_ENABLED=false`.

## 4. Initialize

Deploy once. The `migrate` service runs `prisma migrate deploy` (never `db push`) before `api`,
`web` and `admin` start. Then seed:

```bash
pnpm db:seed
```

`prisma generate` downloads engines from `binaries.prisma.sh`; allow that host on locked-down
builders or pre-bake the engines into the image.

The seed creates 500 campaign levels, tasks and achievements. It creates the first super admin only
when `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are set. Remove the bootstrap password
afterward.

## 5. Health checks

| Service | Check                                                                |
| ------- | -------------------------------------------------------------------- |
| api     | `GET /api/health` → `status: ok`, plus `database` and `redis` states |
| web     | `GET /` (200)                                                        |
| admin   | `GET /login` (200)                                                   |

`GET /api/health` reports every provider (mail, storage, OAuth, payments) so an unconfigured
integration is visible instead of silently failing.

## 6. Automatic deployment

Add these GitHub secrets:

- `DOKPLOY_STAGING_WEBHOOK`
- `DOKPLOY_PRODUCTION_WEBHOOK`

`develop` deploys to staging after CI; `main` deploys production after CI. Configure Dokploy health
checks and retain the previous healthy deployment for rollback.

## 7. Backups

Mount a backup directory and run `infrastructure/backups/backup.sh` daily. A backup on the same VPS
is not disaster recovery. Configure a second S3/R2/B2 destination before launch, encrypt every
archive and perform a quarterly restore drill.

## 8. Site analytics (Analyze.Your.Site)

Traffic statistics come from the project's own dashboard rather than a third-party service:
<https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et->

- The `analytics` service builds that repository from `ANALYTICS_REPO` at `ANALYTICS_REF` using
  `infrastructure/docker/Dockerfile.analytics` (the upstream repo ships no Dockerfile).
- Events are stored as JSON on the `analytics_data` volume (`ANALYZE_DATA_DIR=/data`,
  capped by `ANALYTICS_MAX_EVENTS`). There is no database dependency.
- `ANALYZE_ALLOWED_ORIGIN` is set to `WEB_URL`, so only the player site may post events.
- The player app injects the tracker **only** when `NEXT_PUBLIC_ANALYTICS_URL` is set. Because Next.js
  bakes public variables at build time, it is passed as a build argument as well — after changing it,
  rebuild the web image.
- The admin panel's Analytics screen links to the dashboard when configured and says plainly that it
  is off when it is not.

Pin `ANALYTICS_REF` to a tag or commit for reproducible deployments; `main` follows upstream.
