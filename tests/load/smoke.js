/**
 * Load smoke test (k6).
 *
 *   k6 run tests/load/smoke.js
 *   RATE=50 DURATION=2m API_URL=https://api.example.com/api k6 run tests/load/smoke.js
 *
 * Traffic mix mirrors real usage: mostly anonymous catalogue reads, a steady
 * stream of authenticated session starts (which write to PostgreSQL), and a
 * health probe. Result submission is deliberately excluded — verifying a run
 * means re-simulating the deterministic engine, which needs a real replay and
 * belongs in the end-to-end suite (`pnpm test:e2e:api`), not in a rate test.
 */
import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter } from 'k6/metrics';

/**
 * Requests refused by the per-IP throttler. A single load generator shares one
 * address, so this is expected above RATE_LIMIT_BURST/RATE_LIMIT_SUSTAINED —
 * raise those on the target (or drive traffic from several sources) before
 * reading the latency numbers as capacity.
 */
const rateLimited = new Counter('rate_limited_requests');

const baseUrl = __ENV.API_URL || 'http://localhost:4000/api';
const rate = Number(__ENV.RATE || 20);
const duration = __ENV.DURATION || '30s';

export const options = {
  scenarios: {
    traffic: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    // 429 is a correct answer, so failures are measured on unexpected statuses.
    'http_req_failed{expected_response:true}': ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    checks: ['rate>0.99'],
    // A limiter-bound run measures the limiter, not the service. Fail loudly
    // instead of reporting muddled numbers.
    rate_limited_requests: ['count<50'],
  },
};

/** Registers one throwaway player and picks a level to start sessions against. */
export function setup() {
  const health = http.get(`${baseUrl}/health`);
  if (health.status !== 200) fail(`API is not reachable at ${baseUrl} (status ${health.status})`);

  const email = `load-${Date.now()}@example.com`;
  const registration = http.post(
    `${baseUrl}/auth/register`,
    JSON.stringify({
      email,
      password: 'load-test-password-1',
      displayName: 'Load Test',
      acceptedTerms: true,
    }),
    { headers: { 'content-type': 'application/json' } },
  );
  if (registration.status !== 201 && registration.status !== 200) {
    fail(`could not register a load-test player (status ${registration.status})`);
  }

  const token = registration.json('accessToken');
  const levels = http.get(`${baseUrl}/game/levels?limit=5`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const levelId = levels.json('items.0.id');
  if (!levelId) fail('no published levels found — run `pnpm db:seed` first');

  console.log(
    `Load target ${baseUrl} — ${rate} iterations/s (~${rate * 4} requests/s). If the run trips ` +
      'rate_limited_requests, raise RATE_LIMIT_BURST / RATE_LIMIT_SUSTAINED on the API or drive ' +
      'traffic from several sources: the throttler is per client IP.',
  );
  return { token, levelId };
}

const accept = (response) => {
  if (response.status === 429) {
    rateLimited.add(1);
    return true;
  }
  return false;
};

export default function (data) {
  const authorized = { headers: { authorization: `Bearer ${data.token}` } };

  const health = http.get(`${baseUrl}/health`, { tags: { name: 'health' } });
  check(health, {
    'health responds': (response) => response.status === 200,
    'database is up': (response) => response.json('database') === 'up',
  });
  // The health probe is exempt from throttling on purpose: monitoring must not
  // consume a player's budget, and a limiter must never hide an outage.

  const worlds = http.get(`${baseUrl}/game/worlds`, { tags: { name: 'worlds' } });
  check(worlds, {
    'world catalogue responds': (response) => accept(response) || response.status === 200,
    'campaign worlds are published': (response) =>
      response.status !== 200 || (response.json('items') || []).length >= 10,
  });

  const world = 1 + Math.floor(Math.random() * 10);
  const levels = http.get(`${baseUrl}/game/levels?world=${world}&limit=25`, {
    ...authorized,
    tags: { name: 'levels' },
  });
  check(levels, {
    'level list responds': (response) => accept(response) || response.status === 200,
  });

  const session = http.post(`${baseUrl}/game/sessions`, JSON.stringify({ levelId: data.levelId }), {
    headers: { ...authorized.headers, 'content-type': 'application/json' },
    tags: { name: 'session-start' },
  });
  check(session, {
    'session starts': (response) =>
      accept(response) || response.status === 201 || response.status === 200,
    'session is signed': (response) => response.status >= 400 || Boolean(response.json('nonce')),
  });

  sleep(0.2);
}
