# Architecture

## Shape

```
apps/web      Next.js 15 player app (PWA, TR/EN)      →  apps/api  (REST, JWT)
apps/admin    Next.js 15 control centre               →  apps/api
apps/mobile   Capacitor 7 shell → loads the PWA
apps/api      NestJS 11  →  PostgreSQL (Prisma) + Redis + object storage
packages/game-engine   deterministic 2D physics, shared by browser and server
packages/shared        Zod contracts, checksums, constants
packages/database      Prisma schema, migrations, 500-level seed
```

The engine package is the reason the architecture works: **the exact same
simulation code runs in the browser and inside the API**. The client plays it at
120 Hz; the server replays the recorded inputs and compares the outcome.

## Request lifecycle of a played level

1. `POST /game/sessions` — the API creates a session row and returns a signed
   `seed` + `nonce`. The seed drives every random decision in the engine.
2. The client runs the engine locally, recording `(tick, paddleX)` inputs and a
   rolling checksum.
3. `POST /game/sessions/:id/result` — client sends score, stats, checksum and the
   input log.
4. The API re-simulates the run with the same seed and input log, then compares
   score, blocks destroyed, duration and checksum. Mismatch ⇒ `REJECTED`: no
   leaderboard write, no rewards, and the session surfaces in the moderation
   screen. Wall-clock duration is checked separately so a replay cannot claim
   more play time than actually elapsed.
5. On success, rewards, tasks, achievements, league and season standings are
   updated in one transaction.

## Data flow around progression

- **Tasks / achievements** are event-driven: the result handler emits
  `LEVEL_COMPLETED`, `BLOCK_DESTROYED`, `SCORE_EARNED`, `MAX_BALLS`,
  `BOSS_DEFEATED` and progress rows are incremented against definitions stored in
  the database (editable from the admin panel, no deploy needed).
- **Leaderboards** are rows in `LeaderboardEntry` keyed by board:
  `level:<id>` (personal best), `global:<ISO week>` (weekly) and
  `season:<key>` (accumulating season standing).
- **Leagues** open per ISO week, place players in groups of 30 on their first
  verified score, and settle every Monday 00:05 UTC (ranking, promotion,
  relegation, rewards).
- **Seasons** accumulate the `season:<key>` board and settle hourly once
  `endsAt` passes: reward tiers declared on the season (`top1`, `top10`, …) are
  paid, winners are notified, the season is deactivated and the next scheduled
  season is activated.

## Community content

Player-made levels live in the reserved world 1000. Flow: `DRAFT` → author test
play → `REVIEW` → moderator publishes or rejects (author is notified either way).
Published levels take ratings; three distinct reports pull a level back into
`REVIEW` automatically and write `LEVEL_AUTO_REVIEW` to the audit log. Levels that
have been played are archived rather than deleted so replay verification keeps
working.

## State and caching

- PostgreSQL is the source of truth for everything durable.
- Redis holds the feature-flag/remote-config cache (30 s), throttling counters and
  short-lived locks. The API boots and serves reads if Redis is down; `/api/health`
  reports it as degraded rather than pretending.
- Replays are stored through a storage adapter: `database` (default, no external
  account) or any S3-compatible endpoint.

## Client rendering

Three.js draws a 3D presentation of a strictly 2D physics plane. Instanced meshes
carry blocks, balls and bonuses so a 500-ball Overcharge stays one draw call per
category. Quality tiers (low/medium/high/auto) scale shadows, particle budget and
trail length; `AUTO` picks a tier from device memory, core count and pixel count.
