# Architecture

Tuğla is a browser-first 2.5D arcade game. Rendering is three-dimensional; gameplay remains on a
deterministic two-dimensional plane.

```text
Web / PWA / Capacitor
        │ HTTPS + JWT
        ▼
NestJS API ── Redis (locks, cache, rate coordination)
        │
        ├── PostgreSQL (source of truth)
        ├── S3/MinIO (replays, support attachments)
        └── SMTP / identity / payment providers (optional adapters)
```

## Workspace boundaries

- `apps/web`: public landing page, PWA shell and Three.js game client.
- `apps/admin`: role-restricted control center and visual level editor.
- `apps/api`: account, game session, social, progression and administration API.
- `apps/mobile`: Capacitor configuration for Android and iOS.
- `packages/game-engine`: fixed-step physics and deterministic rules.
- `packages/shared`: Zod contracts, types and product constants.
- `packages/database`: Prisma schema, client and 500-level seed.

## Game loop

Physics advances at 120 Hz in fixed steps independent of rendering FPS. The renderer uses
`InstancedMesh` for blocks and up to 500 balls. A device may reduce shadows and trails, but not
simulation behavior. The server signs sessions and validates result plausibility; league and high
score sessions can be replay-audited.

## Scaling

The KVM 2 deployment is budgeted for a validated target of 250 concurrent active sessions. Game
physics runs on the client, so the API handles short-lived account and result operations. The API
is stateless except for PostgreSQL and Redis and can be replicated behind Dokploy when capacity
requires it.
