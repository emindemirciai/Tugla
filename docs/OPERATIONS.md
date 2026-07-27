# Operations runbook

## Routine checks

- API: `GET /api/health` should report PostgreSQL and Redis.
- Disk alert at 80%; investigate MinIO, container images and logs.
- Review flagged game sessions and moderation reports daily.
- Review level completion and abandonment rates after content changes.
- Run a backup restore test at least quarterly.

## Incident priorities

1. Protect user and credential data.
2. Disable affected integrations with feature flags.
3. Preserve audit and application logs.
4. Roll back to the last healthy Dokploy release.
5. Communicate status without exposing security-sensitive detail.

## Capacity

Run `pnpm test:load` against staging after infrastructure changes. Raise the arrival rate gradually.
Scale PostgreSQL and API before CPU remains above 70%, p95 latency exceeds 300 ms or error rate
exceeds 1%.

## External services still requiring owner accounts

- Hostinger domain/DNS
- Google OAuth and SMTP/Workspace
- Apple Developer and Sign in with Apple
- Google Play Console
- AdMob
- Stripe (if web purchases are enabled)
- External S3/R2/B2 backup storage
- Optional Sentry
