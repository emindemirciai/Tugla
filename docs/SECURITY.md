# Security model

## Authentication

- Access tokens last 15 minutes.
- Refresh tokens are random, hashed in PostgreSQL and rotated on every use.
- Refresh tokens use `HttpOnly`, `SameSite=Lax`, secure cookies in production.
- Google and Apple identity tokens are verified against provider JWKS and audience.
- Passwords use bcrypt cost 12.
- Admin roles are enforced in the API; hiding UI controls is not authorization.

## Game integrity

Every game begins with a server session, nonce and seed. Completion checks duration, ball count,
score density, event count and a deterministic checksum. Flagged results never enter leaderboards.
Competition replays should be uploaded to object storage and sampled for audit.

## Operations

- Keep Dokploy, database and MinIO off public ports.
- Generate secrets with `node scripts/generate-secrets.mjs`; never commit the resulting values.
- Require admin 2FA before production launch.
- Enable external encrypted backups before accepting real users.
- Review audit logs for all publishing and moderation operations.
- Rotate provider keys and database passwords at least annually and after suspected exposure.

## Reporting

Do not open a public issue for a security vulnerability. Use the private contact configured for the
deployment.
