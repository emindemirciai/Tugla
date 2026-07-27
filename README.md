# Tuğla

Tuğla is a production-oriented 2.5D brick-breaker monorepo for web, PWA, Android and iOS. It uses
Three.js for premium 3D rendering and a custom deterministic 2D physics engine for predictable,
high-volume multiball gameplay.

## Included

- Playable Three.js game with touch, mouse and keyboard controls
- Fixed 120 Hz custom physics, paddle-directed launch, lives, combo and catchable bonuses
- Instanced rendering for up to 500 active balls
- 500 generated campaign levels across 10 worlds
- NestJS API, PostgreSQL/Prisma and Redis
- Password, Google and Apple authentication adapters
- Cloud progress, signed sessions, anti-cheat checks and leaderboards
- Follow/friend flows, tasks, achievements, two-currency economy and catalog schema
- Admin control center with a visual, versioned level editor
- PWA service worker and Capacitor Android/iOS shell
- Docker, Dokploy, CI, automatic deployment webhook and encrypted backup scripts
- k6 load test, unit tests and product/architecture/security/operations documentation
- One-command project rename utility

Real advertising, purchases, Apple/Google store publishing, SMTP delivery and external backups stay
disabled until their owner-managed accounts and secrets are supplied.

## Quick start

Prerequisites: Node 22+, pnpm 10+ and Docker.

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm --filter @tugla/database exec prisma db push
pnpm db:seed
pnpm dev
```

- Game and site: `http://localhost:3000`
- Admin: `http://localhost:3001`
- API: `http://localhost:4000/api`
- OpenAPI: `http://localhost:4000/api/docs`
- MinIO console: `http://localhost:9001`

Create a local super admin by setting `ADMIN_BOOTSTRAP_EMAIL` and
`ADMIN_BOOTSTRAP_PASSWORD` before `pnpm db:seed`.

## Validation

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

With k6 installed:

```bash
API_URL=http://localhost:4000/api pnpm test:load
```

## Rename

The code name is centralized and replaceable:

```bash
pnpm rename-project "New Name" new-slug
pnpm install
pnpm typecheck && pnpm test && pnpm build
```

Review mobile identifiers, domains and third-party dashboards after renaming.

## Documentation

- [Product](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Dokploy deployment](docs/DEPLOYMENT.md)
- [Operations](docs/OPERATIONS.md)

## License

Private/proprietary. No license is granted until the owner chooses one.
