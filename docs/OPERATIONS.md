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

## Load testing

`tests/load/smoke.js` is a k6 script. k6 is not a workspace dependency — install the binary once:

```bash
curl -sL https://github.com/grafana/k6/releases/download/v0.54.0/k6-v0.54.0-linux-amd64.tar.gz \
  | tar xz && sudo mv k6-v0.54.0-linux-amd64/k6 /usr/local/bin/
pnpm test:load                      # defaults: 20 iterations/s for 30s
RATE=50 DURATION=2m API_URL=https://api.example.com/api pnpm test:load
```

The traffic mix is one health probe, the world catalogue, a level list and an authenticated session
start per iteration (four requests). Result submission is excluded on purpose: verifying a run means
re-simulating the deterministic engine, which belongs in `pnpm test:e2e:api`.

### Measured baseline

Single container (Node 24) with PostgreSQL and Redis on the same host, throttling raised for the
measurement:

| Metric      | Value                                         |
| ----------- | --------------------------------------------- |
| Throughput  | 78.6 requests/s sustained (19.6 iterations/s) |
| Failures    | 0 of 2407 requests                            |
| Latency p95 | 22 ms                                         |
| Latency p99 | 47 ms                                         |
| Latency max | 329 ms                                        |
| Checks      | 4207 / 4207 passed                            |

Re-run this on the target VPS before launch; the numbers above come from a development container and
should be treated as a floor, not a promise.

### Throttling and load tests

The API throttles **per client IP** (`RATE_LIMIT_BURST` requests per `RATE_LIMIT_BURST_SECONDS`, and
`RATE_LIMIT_SUSTAINED` per `RATE_LIMIT_SUSTAINED_SECONDS`; defaults 30/s and 1200/min). A single load
generator shares one address, so a capacity run must either stay under those limits or raise them on
the target:

```bash
RATE_LIMIT_BURST=2000 RATE_LIMIT_SUSTAINED=100000 node apps/api/dist/main.js
```

The script counts refused requests in `rate_limited_requests` and fails the run above 50 of them, so
a limiter-bound run can never be mistaken for a capacity result. `GET /api/health` is exempt from
throttling: monitoring must not consume a player's budget, and a limiter must never hide an outage.
