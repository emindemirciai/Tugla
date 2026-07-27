# Dokploy deployment

## 1. Prepare DNS

Point the following records at the VPS:

- `example.com` → web
- `api.example.com` → API
- `admin.example.com` → admin
- `analytics.example.com` → Umami (optional)

Replace `example.com` with `ROOT_DOMAIN`.

## 2. Create the Dokploy compose application

Use `infrastructure/dokploy/compose.production.yml`. Assign public domains only to `web`, `api`,
`admin` and optionally `umami`. PostgreSQL, Redis and MinIO stay on the internal network.

## 3. Configure secrets

Copy `.env.example` into Dokploy environment variables. Generate first-party secrets:

```bash
node scripts/generate-secrets.mjs
```

Set strong values for `POSTGRES_PASSWORD`, `MINIO_ROOT_*` and `UMAMI_APP_SECRET`. Leave Google,
Apple, SMTP, AdMob, Stripe and store keys empty until the accounts exist. Keep
`ADS_ENABLED=false` and `PAYMENTS_ENABLED=false`.

## 4. Initialize

Deploy once, run the `migrate` service and then:

```bash
pnpm db:seed
```

The seed creates 500 campaign levels, tasks and achievements. It creates the first super admin only
when `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` are set. Remove the bootstrap password
afterward.

## 5. Automatic deployment

Add these GitHub secrets:

- `DOKPLOY_STAGING_WEBHOOK`
- `DOKPLOY_PRODUCTION_WEBHOOK`

`develop` deploys to staging after CI; `main` deploys production after CI. Configure Dokploy health
checks and retain the previous healthy deployment for rollback.

## 6. Backups

Mount a backup directory and run `infrastructure/backups/backup.sh` daily. A backup on the same VPS
is not disaster recovery. Configure a second S3/R2/B2 destination before launch, encrypt every
archive and perform a quarterly restore drill.
