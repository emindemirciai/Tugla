# Security

## Authentication

- Email + password (Argon2id), optional Google and Apple sign-in through provider
  adapters that stay disabled until their keys exist. **No guest accounts.**
- Access tokens are short-lived JWTs kept in memory only; refresh tokens live in
  an httpOnly, SameSite cookie and are rotated on every use. A refresh token that
  is presented twice invalidates the session family.
- Password changes and account deletion revoke every other device session.
- Email verification and password reset use single-use, expiring action tokens
  (24 h / 1 h).

## Authorisation

Roles: `PLAYER`, `SUPPORT`, `ANALYST`, `CONTENT_EDITOR`, `GAME_ADMIN`,
`SUPER_ADMIN`. The admin app refuses anyone without a staff role, and each admin
route re-checks the role server-side — the UI gate is convenience, not security.
Every staff write is appended to an immutable audit log with actor, IP and target.

## Score integrity

Scores are never trusted. The server re-simulates each submitted run with the
issued seed (see `docs/ARCHITECTURE.md`) and rejects mismatches, replay inflation
and impossible durations. Rejected sessions never reach a leaderboard and are
listed for moderators together with a per-user risk score.

## Abuse and rate limiting

- Per-IP throttling with env-tunable burst and sustained windows
  (`RATE_LIMIT_BURST`, `RATE_LIMIT_SUSTAINED`). `GET /api/health` is exempt so
  monitoring cannot be starved and outages cannot hide behind a 429.
- One open moderation report per reporter per target; three distinct reports
  auto-hide a published community level.
- Community levels are capped per author and validated against the shared Zod
  schema on every write.

## Data protection

- Players can export everything they own as JSON and delete their account from the
  account screen; deletion wipes personal data immediately and anonymises scores.
- Replay retention is bounded (7 days ordinary, 30 days league, 90 days shared).
- Secrets come only from the environment. The API refuses to boot in production
  with missing or development-grade JWT/session secrets.
- Transport hardening via helmet, strict CORS to the configured web/admin origins,
  and `X-Robots-Tag: noindex` on every API response.

## Reporting

Security issues should go to the address configured in `SUPPORT_EMAIL`. Please
include reproduction steps; do not open public issues for exploitable findings.
