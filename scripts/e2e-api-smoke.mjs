/**
 * End-to-end API smoke test.
 *
 * Boots the real API against the real database, then drives the complete player
 * journey with real HTTP calls: register, verify, start a session, simulate the
 * level with the shipped engine, submit the signed result and confirm the
 * server accepted it. It also asserts that a tampered score is rejected.
 *
 * Usage: node scripts/e2e-api-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = resolve(import.meta.dirname, '..');
const BASE = process.env.SMOKE_API_URL ?? 'http://localhost:4100/api';
const PORT = new URL(BASE).port || '4100';

let passed = 0;
let failed = 0;
const check = (name, condition, detail = '') => {
  if (condition) {
    passed += 1;
    console.log(`  \u2713 ${name}`);
  } else {
    failed += 1;
    console.log(`  \u2717 ${name} ${detail}`);
  }
};

const call = async (path, options = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
};

async function waitForHealth(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return await response.json();
    } catch {
      /* not up yet */
    }
    await sleep(750);
  }
  throw new Error('API did not become healthy in time');
}

// NestJS relies on emitDecoratorMetadata, which esbuild-based runners cannot
// produce, so the smoke test runs the tsc-compiled output the same way
// production does.
const api = spawn('node', ['dist/main.js'], {
  cwd: resolve(ROOT, 'apps/api'),
  env: {
    ...process.env,
    PORT,
    NODE_ENV: 'development',
    // The suite drives ~100 requests from one address as fast as it can, which
    // is exactly what the per-IP throttler is built to stop. Raise the limits
    // for this process so the run measures behaviour, not rate limiting; the
    // limiter itself is covered by tests/load/smoke.js.
    RATE_LIMIT_BURST: '5000',
    RATE_LIMIT_SUSTAINED: '200000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let apiLog = '';
api.stdout.on('data', (chunk) => (apiLog += chunk.toString()));
api.stderr.on('data', (chunk) => (apiLog += chunk.toString()));

const shutdown = () => {
  if (!api.killed) api.kill('SIGTERM');
};
process.on('exit', shutdown);

try {
  console.log('\nBooting API...');
  const health = await waitForHealth();
  console.log(`API healthy: database=${health.database} redis=${health.redis}\n`);

  console.log('Platform');
  check('health reports database up', health.database === 'up');
  const config = await call('/config');
  check('remote config exposes brand + limits', config.body?.limits?.maxBalls === 500);
  check(
    'remote config reports provider readiness honestly',
    config.body?.providers && config.body.providers.googleAuth === false,
    '(google should be off with no client id)',
  );
  const worlds = await call('/game/worlds');
  check(
    'campaign worlds are published',
    (worlds.body?.items?.length ?? 0) >= 10,
    `got ${worlds.body?.items?.length}`,
  );

  console.log('\nAccount lifecycle');
  const email = `smoke-${Date.now()}@example.com`;
  const password = 'smoke-password-1';
  const weak = await call('/auth/register', {
    method: 'POST',
    body: {
      email: `weak-${Date.now()}@example.com`,
      password: 'onlyletters',
      displayName: 'Weak',
      acceptedTerms: true,
    },
  });
  check('weak password rejected', weak.status === 400, `status ${weak.status}`);

  const noTerms = await call('/auth/register', {
    method: 'POST',
    body: {
      email: `nt-${Date.now()}@example.com`,
      password,
      displayName: 'NoTerms',
      acceptedTerms: false,
    },
  });
  check('registration without terms rejected', noTerms.status === 400, `status ${noTerms.status}`);

  const registered = await call('/auth/register', {
    method: 'POST',
    body: { email, password, displayName: 'Smoke Player', acceptedTerms: true, locale: 'tr' },
  });
  check(
    'registration succeeds',
    registered.status === 201 || registered.status === 200,
    `status ${registered.status}`,
  );
  const token = registered.body?.accessToken;
  check('access token issued', typeof token === 'string' && token.length > 20);
  check('email is not verified yet', registered.body?.user?.emailVerified === false);

  const duplicate = await call('/auth/register', {
    method: 'POST',
    body: { email, password, displayName: 'Dupe', acceptedTerms: true },
  });
  check('duplicate email rejected', duplicate.status === 400, `status ${duplicate.status}`);

  const unauthorised = await call('/auth/me');
  check(
    'protected route requires a token',
    unauthorised.status === 401,
    `status ${unauthorised.status}`,
  );

  const me = await call('/auth/me', { token });
  check(
    'authenticated profile returns balances',
    Array.isArray(me.body?.balances) && me.body.balances.length === 2,
  );

  const badLogin = await call('/auth/login', {
    method: 'POST',
    body: { email, password: 'wrong-password' },
  });
  check('wrong password rejected', badLogin.status === 401, `status ${badLogin.status}`);

  const login = await call('/auth/login', { method: 'POST', body: { email, password } });
  check('login succeeds', login.status === 200 || login.status === 201, `status ${login.status}`);

  const resetRequest = await call('/auth/password/reset/request', {
    method: 'POST',
    body: { email },
  });
  check(
    'password reset request accepted',
    resetRequest.status === 200 || resetRequest.status === 201,
  );
  const unknownReset = await call('/auth/password/reset/request', {
    method: 'POST',
    body: { email: 'nobody-here@example.com' },
  });
  check(
    'reset does not leak account existence',
    JSON.stringify(unknownReset.body) === JSON.stringify(resetRequest.body),
  );

  const exported = await call('/auth/export', { token });
  check('data export returns the account bundle', Boolean(exported.body?.account?.id));
  check(
    'export never contains the password hash',
    !JSON.stringify(exported.body).includes('passwordHash'),
  );

  console.log('\nGameplay and score verification');
  const levels = await call('/game/levels?limit=1', { token });
  check('level catalogue is reachable', Boolean(levels.body?.items?.[0]?.id));

  // Sign in as the bootstrap admin first: the gameplay checks need a small
  // purpose-built level so a full honest playthrough finishes in a few seconds
  // of simulated time. Fast-forwarding a full 60-block level would report more
  // game time than wall-clock time, which anti-cheat correctly rejects.
  const adminBootstrap = await call('/auth/login', {
    method: 'POST',
    body: {
      email: process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@example.com',
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD ?? 'local-admin-password-1',
    },
  });
  const adminToken = adminBootstrap.body?.accessToken;
  check('bootstrap admin can sign in', Boolean(adminToken), `status ${adminBootstrap.status}`);

  const testIndex = 900000 + (Date.now() % 90000);
  const created = await call('/admin/content/levels', {
    method: 'POST',
    token: adminToken,
    body: {
      definition: {
        version: 1,
        name: `Smoke Arena ${testIndex}`,
        type: 'NORMAL',
        world: 999,
        index: testIndex,
        theme: 'neon-grid',
        seed: 4242,
        metadata: {},
        blocks: [
          {
            id: 'smoke-1',
            kind: 'NORMAL',
            x: 0.5,
            y: 0.55,
            width: 0.6,
            height: 0.08,
            hitPoints: 1,
            rotation: 0,
            bonus: 'BALL_3',
            required: true,
          },
        ],
      },
    },
  });
  check('admin can create a level', Boolean(created.body?.id), `status ${created.status}`);
  const published = await call(`/admin/content/levels/${created.body?.id}/status`, {
    method: 'POST',
    token: adminToken,
    body: { status: 'PUBLISHED' },
  });
  check('admin can publish a level', published.body?.status === 'PUBLISHED');
  const level = { id: created.body?.id };

  const session = await call('/game/sessions', {
    method: 'POST',
    body: { levelId: level.id },
    token,
  });
  check(
    'session starts with a server seed and nonce',
    Boolean(session.body?.seed && session.body?.nonce),
  );

  const { TuğlaEngine } = await import(resolve(ROOT, 'packages/game-engine/dist/index.js'));
  const { levelDefinitionSchema } = await import(resolve(ROOT, 'packages/shared/dist/index.js'));
  const definition = levelDefinitionSchema.parse(session.body.level.definition);

  // Play the level to completion by clearing blocks through the engine's own
  // deterministic API, recording inputs so the server can re-simulate it.
  const engine = new TuğlaEngine(definition, { seed: session.body.seed, recordReplay: true });
  engine.setPaddleTarget(4.5);
  engine.launch();
  for (let tick = 0; tick < 1800; tick += 1) {
    const target = engine.snapshot.balls[0];
    if (target) engine.setPaddleTarget(target.position.x, { record: tick % 30 === 0 });
    engine.step();
    if (engine.snapshot.status === 'COMPLETED' || engine.snapshot.status === 'FAILED') break;
  }
  const result = engine.buildResult({
    sessionId: session.body.sessionId,
    nonce: session.body.nonce,
  });
  console.log(
    `  (simulated ${engine.snapshot.tick} ticks, status=${engine.snapshot.status}, score=${engine.snapshot.score})`,
  );

  const submitted = await call('/game/sessions/complete', { method: 'POST', body: result, token });
  check(
    'honest result is accepted',
    submitted.body?.accepted === true,
    `status ${submitted.status} reasons=${JSON.stringify(submitted.body?.reasons)}`,
  );
  check('rewards are granted on completion', (submitted.body?.rewards?.credits ?? 0) > 0);

  const replayList = await call('/game/replays', { token });
  check('replay was stored', (replayList.body?.items?.length ?? 0) > 0);

  const wallet = await call('/progression/wallet', { token });
  const credits = wallet.body?.balances?.find((entry) => entry.currency === 'CREDITS');
  check('wallet ledger recorded the reward', (credits?.amount ?? 0) > 0);
  check('wallet transaction written', (wallet.body?.transactions?.length ?? 0) > 0);

  console.log('\nAnti-cheat');
  const session2 = await call('/game/sessions', {
    method: 'POST',
    body: { levelId: level.id },
    token,
  });
  const tampered = {
    ...result,
    sessionId: session2.body.sessionId,
    score: 99_999_999,
  };
  const cheated = await call('/game/sessions/complete', { method: 'POST', body: tampered, token });
  check(
    'tampered score is rejected',
    cheated.body?.accepted === false,
    `accepted=${cheated.body?.accepted}`,
  );
  check(
    'rejection cites the checksum',
    JSON.stringify(cheated.body?.reasons ?? []).includes('checksum-mismatch'),
    JSON.stringify(cheated.body?.reasons),
  );

  const session3 = await call('/game/sessions', {
    method: 'POST',
    body: { levelId: level.id },
    token,
  });
  const engine3 = new TuğlaEngine(definition, { seed: session3.body.seed, recordReplay: true });
  engine3.launch();
  for (let tick = 0; tick < 600; tick += 1) engine3.step();
  const shortRun = engine3.buildResult({
    sessionId: session3.body.sessionId,
    nonce: session3.body.nonce,
  });
  // Claim completion the replay does not support.
  const lying = { ...shortRun, completed: true, score: shortRun.score + 250_000 };
  const lyingResponse = await call('/game/sessions/complete', {
    method: 'POST',
    body: lying,
    token,
  });
  check(
    'score inflated beyond the replay is rejected',
    lyingResponse.body?.accepted === false,
    `accepted=${lyingResponse.body?.accepted}`,
  );

  console.log('\nProgression');
  const tasks = await call('/progression/tasks', { token });
  check('daily tasks are listed', (tasks.body?.items?.length ?? 0) > 0);
  check(
    'task progress advanced from the completed level',
    tasks.body?.items?.some((task) => task.progress > 0),
  );
  const achievements = await call('/progression/achievements', { token });
  check('achievements are listed', (achievements.body?.items?.length ?? 0) > 0);
  check(
    'first-clear achievement unlocked',
    achievements.body?.items?.some((item) => item.key === 'first-clear' && item.unlocked),
  );
  const league = await call('/progression/league', { token });
  check('player was placed into the weekly league', Boolean(league.body?.league?.key));
  check(
    'league standings include the player',
    league.body?.standings?.some((row) => row.isSelf),
  );

  console.log('\nPlayer hub: shop, inventory, notifications, replays, social');
  const shop = await call('/shop', { token });
  check('shop catalogue loads', Array.isArray(shop.body?.items));
  check(
    'real-money items stay hidden while payments are disabled',
    shop.body?.paymentsEnabled === false &&
      (shop.body?.items ?? []).every((item) => item.currency !== null),
  );

  const affordable = (shop.body?.items ?? [])
    .filter((item) => item.currency === 'CREDITS' && typeof item.price === 'number')
    .sort((a, b) => a.price - b.price)[0];
  if (affordable) {
    const walletBefore = await call('/progression/wallet', { token });
    const creditsBefore =
      walletBefore.body?.balances?.find((balance) => balance.currency === 'CREDITS')?.amount ?? 0;
    const purchase = await call('/shop/purchase', {
      method: 'POST',
      token,
      body: { sku: affordable.sku },
    });
    const affordableNow = creditsBefore >= affordable.price;
    check(
      'shop purchase succeeds or is refused for lack of funds, never silently',
      affordableNow ? purchase.status === 201 || purchase.status === 200 : purchase.status === 400,
      `status ${purchase.status}, credits ${creditsBefore}, price ${affordable.price}`,
    );

    if (affordableNow) {
      const walletAfter = await call('/progression/wallet', { token });
      const creditsAfter =
        walletAfter.body?.balances?.find((balance) => balance.currency === 'CREDITS')?.amount ?? 0;
      check(
        'purchase debited the wallet by exactly the listed price',
        creditsAfter === creditsBefore - affordable.price,
        `${creditsBefore} -> ${creditsAfter}`,
      );
      const inventory = await call('/inventory', { token });
      check(
        'purchased item appears in the inventory',
        (inventory.body?.items ?? []).some((entry) => entry.item?.sku === affordable.sku),
      );
      const repeat = await call('/shop/purchase', {
        method: 'POST',
        token,
        body: { sku: affordable.sku },
      });
      check('buying an owned item is rejected', repeat.status === 400, `status ${repeat.status}`);
    }
  }

  const notifications = await call('/notifications', { token });
  check('notifications endpoint responds with a list', Array.isArray(notifications.body?.items));
  check(
    'unread counter matches the unread items',
    notifications.body?.unread ===
      (notifications.body?.items ?? []).filter((item) => !item.readAt).length,
  );

  const replays = await call('/game/replays', { token });
  check('verified run produced a stored replay', (replays.body?.items?.length ?? 0) > 0);
  const replayRow = replays.body?.items?.[0];
  if (replayRow) {
    const shared = await call(`/game/replays/${replayRow.sessionId}/share`, {
      method: 'POST',
      token,
      body: { shared: true },
    });
    check('replay sharing can be toggled on', shared.status === 200 || shared.status === 201);
    const afterShare = await call('/game/replays', { token });
    check(
      'sharing state is persisted',
      afterShare.body?.items?.some((item) => item.id === replayRow.id && item.shared === true),
    );
  }

  const profile = await call('/auth/me', { token });
  const selfSearch = await call(
    `/social/players?q=${encodeURIComponent(profile.body?.username ?? 'smoke')}`,
    { token },
  );
  check('player search returns results', Array.isArray(selfSearch.body?.items));
  const selfFollow = await call('/social/follow', {
    method: 'POST',
    token,
    body: { userId: profile.body?.id },
  });
  check('following yourself is rejected', selfFollow.status >= 400, `status ${selfFollow.status}`);
  const friends = await call('/social/friends', { token });
  check('friend list responds', Array.isArray(friends.body?.items));

  console.log('\nLevel progression gate');
  const gateList = await call('/game/levels?world=1&limit=5', { token });
  const firstLevel = gateList.body?.items?.[0];
  const secondLevel = gateList.body?.items?.[1];
  check('the first level of a world is open', firstLevel?.unlocked === true);
  check(
    'the next level starts locked',
    secondLevel?.unlocked === false,
    String(secondLevel?.unlocked),
  );

  if (secondLevel) {
    const blocked = await call('/game/sessions', {
      method: 'POST',
      token,
      body: { levelId: secondLevel.id },
    });
    check(
      'starting a locked level is refused by the server',
      blocked.status === 400,
      `status ${blocked.status}`,
    );
  }

  console.log('\nEmail verification code');
  const codeEmail = `verify-${Date.now()}@example.com`;
  const codeAccount = await call('/auth/register', {
    method: 'POST',
    body: {
      email: codeEmail,
      password: 'smoke-password-1',
      displayName: 'Code Tester',
      acceptedTerms: true,
      locale: 'tr',
    },
  });
  check('sign-up reports the verification email', codeAccount.body?.verificationEmailSent === true);
  check('new accounts start unverified', codeAccount.body?.user?.emailVerified === false);

  // The development mail provider logs the message, so the smoke run can read
  // the very code a player would receive.
  const mailed = apiLog.match(/(?:Doğrulama kodu|Verification code): (\d{6})/g) ?? [];
  const sentCode = mailed.at(-1)?.match(/(\d{6})/)?.[1];
  check('a six digit code reaches the mail provider', Boolean(sentCode), sentCode);

  const wrongCode = await call('/auth/email/verify/confirm', {
    method: 'POST',
    body: { email: codeEmail, code: '000000' },
  });
  check('a wrong code is rejected', wrongCode.status === 400, `status ${wrongCode.status}`);

  if (sentCode) {
    const confirmed = await call('/auth/email/verify/confirm', {
      method: 'POST',
      body: { email: codeEmail, code: sentCode },
    });
    check('the emailed code verifies the address', confirmed.body?.verified === true);

    const replay = await call('/auth/email/verify/confirm', {
      method: 'POST',
      body: { email: codeEmail, code: sentCode },
    });
    check('a used code cannot be replayed', replay.status === 400, `status ${replay.status}`);
  }

  const badFormat = await call('/auth/email/verify/confirm', {
    method: 'POST',
    body: { email: codeEmail, code: '12' },
  });
  check('malformed codes are rejected by the schema', badFormat.status === 400);

  const oauthOff = await call('/auth/oauth', {
    method: 'POST',
    body: { provider: 'google', identityToken: 'not-a-real-token' },
  });
  check(
    'Google sign-in refuses unverifiable tokens',
    oauthOff.status >= 400,
    `status ${oauthOff.status}`,
  );

  console.log('\nDaily challenge');
  const daily = await call('/game/daily', { token });
  check('daily challenge responds', daily.status === 200, `status ${daily.status}`);
  check('a level is scheduled for today', Boolean(daily.body?.level?.id));
  check(
    'the day key is the current UTC date',
    daily.body?.day === new Date().toISOString().slice(0, 10),
    daily.body?.day,
  );

  const dailyAgain = await call('/game/daily');
  check(
    'the pick is deterministic within the day',
    dailyAgain.body?.level?.id === daily.body?.level?.id,
  );
  check(
    'the daily challenge is public (no token needed)',
    dailyAgain.status === 200,
    `status ${dailyAgain.status}`,
  );

  if (daily.body?.level?.id) {
    const dailySession = await call('/game/sessions', {
      method: 'POST',
      token,
      body: { levelId: daily.body.level.id, mode: 'DAILY' },
    });
    check(
      'a daily-mode session can be started',
      dailySession.status === 201 || dailySession.status === 200,
      `status ${dailySession.status}`,
    );
  }

  console.log('\nCommunity levels');
  const communityDefinition = {
    version: 1,
    name: 'Smoke community level',
    type: 'COMMUNITY',
    world: 1000,
    index: 1,
    theme: 'neon-grid',
    seed: 1,
    blocks: Array.from({ length: 6 }, (_, index) => ({
      id: `c${index}`,
      kind: 'NORMAL',
      x: 0.1 + (index % 3) * 0.25,
      y: 0.15 + Math.floor(index / 3) * 0.08,
      width: 0.2,
      height: 0.05,
      hitPoints: 1,
      rotation: 0,
      required: true,
    })),
    metadata: {},
  };

  const authored = await call('/game/community/levels', {
    method: 'POST',
    token,
    body: { name: 'Smoke community level', definition: communityDefinition },
  });
  check(
    'player can create a community level',
    authored.status === 201 || authored.status === 200,
    `status ${authored.status}`,
  );
  const communityId = authored.body?.id;
  check('new community level starts as a draft', authored.body?.status === 'DRAFT');

  const invalid = await call('/game/community/levels', {
    method: 'POST',
    token,
    body: { name: 'x', definition: communityDefinition },
  });
  check('too short names are rejected', invalid.status === 400, `status ${invalid.status}`);

  const mine = await call('/game/community/levels/mine', { token });
  check(
    'author sees their own level',
    (mine.body?.items ?? []).some((item) => item.id === communityId),
  );

  const notPublic = await call('/game/community/levels');
  check(
    'drafts are not publicly listed',
    !(notPublic.body?.items ?? []).some((item) => item.id === communityId),
  );

  const campaign = await call('/game/levels?limit=50', { token });
  check(
    'community content stays out of the campaign catalogue',
    !(campaign.body?.items ?? []).some((item) => item.type === 'COMMUNITY'),
  );

  if (communityId) {
    const testSession = await call('/game/sessions', {
      method: 'POST',
      token,
      body: { levelId: communityId, mode: 'COMMUNITY' },
    });
    check(
      'author can test-play an unpublished draft',
      testSession.status === 201 || testSession.status === 200,
      `status ${testSession.status}`,
    );

    const submitted = await call(`/game/community/levels/${communityId}/submit`, {
      method: 'POST',
      token,
    });
    check('draft can be submitted for review', submitted.body?.status === 'REVIEW');

    const lockedEdit = await call(`/game/community/levels/${communityId}`, {
      method: 'PATCH',
      token,
      body: { name: 'Renamed while in review', definition: communityDefinition },
    });
    check(
      'levels in review cannot be edited',
      lockedEdit.status === 400,
      `status ${lockedEdit.status}`,
    );

    const stranger = await call(`/game/community/levels/${communityId}`, { token: adminToken });
    check(
      'another account cannot open the level',
      stranger.status === 404,
      `status ${stranger.status}`,
    );

    // Publish it as a moderator so the rating and report flows can be exercised.
    const publish = await call(`/admin/content/levels/${communityId}/status`, {
      method: 'POST',
      token: adminToken,
      body: { status: 'PUBLISHED' },
    });
    check('moderator can publish a submission', publish.status === 200 || publish.status === 201);

    const publicList = await call('/game/community/levels', { token: adminToken });
    check(
      'published community level is publicly listed',
      (publicList.body?.items ?? []).some((item) => item.id === communityId),
    );

    const ownRating = await call(`/game/community/levels/${communityId}/rate`, {
      method: 'POST',
      token,
      body: { liked: true },
    });
    check(
      'authors cannot rate their own level',
      ownRating.status === 400,
      `status ${ownRating.status}`,
    );

    const liked = await call(`/game/community/levels/${communityId}/rate`, {
      method: 'POST',
      token: adminToken,
      body: { liked: true },
    });
    check('another player can like the level', liked.body?.likes === 1, JSON.stringify(liked.body));

    const switched = await call(`/game/community/levels/${communityId}/rate`, {
      method: 'POST',
      token: adminToken,
      body: { liked: false },
    });
    check(
      'changing the rating replaces it instead of stacking',
      switched.body?.likes === 0 && switched.body?.dislikes === 1,
      JSON.stringify(switched.body),
    );

    const firstReport = await call('/reports', {
      method: 'POST',
      token: adminToken,
      body: { targetType: 'LEVEL', targetId: communityId, reason: 'SPAM' },
    });
    check('a level can be reported', Boolean(firstReport.body?.id));
    const duplicateReport = await call('/reports', {
      method: 'POST',
      token: adminToken,
      body: { targetType: 'LEVEL', targetId: communityId, reason: 'SPAM' },
    });
    check('the same reporter cannot pile on', duplicateReport.body?.duplicate === true);

    // Two more distinct reporters reach the auto-review threshold.
    const extraTokens = [];
    for (const index of [1, 2]) {
      const extra = await call('/auth/register', {
        method: 'POST',
        body: {
          email: `reporter-${index}-${Date.now()}@example.com`,
          password: 'smoke-password-1',
          displayName: `Reporter ${index}`,
          acceptedTerms: true,
        },
      });
      extraTokens.push(extra.body?.accessToken);
    }
    let autoHidden = false;
    for (const extraToken of extraTokens) {
      const extraReport = await call('/reports', {
        method: 'POST',
        token: extraToken,
        body: { targetType: 'LEVEL', targetId: communityId, reason: 'INAPPROPRIATE' },
      });
      autoHidden = autoHidden || extraReport.body?.autoHidden === true;
    }
    check('three distinct reports pull the level back into review', autoHidden);

    const afterReports = await call('/game/community/levels', { token: adminToken });
    check(
      'auto-hidden level disappears from the public list',
      !(afterReports.body?.items ?? []).some((item) => item.id === communityId),
    );

    const auditTrail = await call('/admin/system/audit?limit=20&action=LEVEL_AUTO_REVIEW', {
      token: adminToken,
    });
    check(
      'auto-review is written to the audit log',
      (auditTrail.body?.items ?? []).some((entry) => entry.targetId === communityId),
    );

    const removed = await call(`/game/community/levels/${communityId}`, {
      method: 'DELETE',
      token,
    });
    check(
      'author can withdraw their own submission',
      removed.body?.deleted === true,
      `status ${removed.status}`,
    );
    const afterRemoval = await call('/game/community/levels/mine', { token });
    const remaining = (afterRemoval.body?.items ?? []).find((item) => item.id === communityId);
    check(
      'withdrawn level is gone or archived, never left in review',
      !remaining || remaining.status === 'ARCHIVED',
      remaining?.status,
    );
  }

  console.log('\nInbox is fed by real events');
  const beforeInbox = await call('/notifications', { token });
  const beforeCount = (beforeInbox.body?.items ?? []).length;

  const friendRequest = await call('/social/friends', {
    method: 'POST',
    token: adminToken,
    body: { userId: profile.body?.id },
  });
  check(
    'friend request is accepted by the API',
    friendRequest.status < 400,
    `status ${friendRequest.status}`,
  );

  const afterInbox = await call('/notifications', { token });
  const requestNotice = (afterInbox.body?.items ?? []).find(
    (item) => item.type === 'FRIEND_REQUEST',
  );
  check('friend request lands in the addressee inbox', Boolean(requestNotice));
  check(
    'inbox grew by the new notification',
    (afterInbox.body?.items ?? []).length > beforeCount,
    `${beforeCount} -> ${(afterInbox.body?.items ?? []).length}`,
  );

  console.log('\nAdmin authorisation');
  const forbidden = await call('/admin/system/overview', { token });
  check(
    'players cannot reach admin endpoints',
    forbidden.status === 403,
    `status ${forbidden.status}`,
  );

  if (adminToken) {
    const overview = await call('/admin/system/overview', { token: adminToken });
    check('admin overview returns metrics', typeof overview.body?.users === 'number');
    const adminLevels = await call('/admin/content/levels?limit=5', { token: adminToken });
    check(
      'admin level list is paginated',
      adminLevels.body?.total >= 500,
      `total ${adminLevels.body?.total}`,
    );
    const generated = await call('/admin/content/levels/generate/7', { token: adminToken });
    check('editor can scaffold a generated level', (generated.body?.blocks?.length ?? 0) > 0);
    const adminHealth = await call('/admin/system/health', { token: adminToken });
    check('system health reports provider status', Boolean(adminHealth.body?.providers));
    const audit = await call('/admin/system/audit?limit=5', { token: adminToken });
    check('audit log is queryable', Array.isArray(audit.body?.items));
    const flag = await call('/admin/content/flags', {
      method: 'POST',
      token: adminToken,
      body: { key: 'smoke-flag', description: 'Smoke test flag', enabled: true, config: null },
    });
    check('feature flag can be written', flag.body?.key === 'smoke-flag', `status ${flag.status}`);
    const configAfter = await call('/config');
    check(
      'flag surfaces in remote config',
      configAfter.body?.flags?.['smoke-flag']?.enabled === true,
    );
    const analytics = await call('/admin/system/analytics?days=7', { token: adminToken });
    check('analytics aggregates return rows', Array.isArray(analytics.body?.signups));
  }

  console.log('\nAccount deletion');
  const deleted = await call('/auth/me', { method: 'DELETE', token });
  check('account deletion succeeds', deleted.body?.deleted === true);
  const afterDelete = await call('/auth/login', { method: 'POST', body: { email, password } });
  check(
    'deleted account can no longer sign in',
    afterDelete.status === 401,
    `status ${afterDelete.status}`,
  );
} catch (error) {
  failed += 1;
  console.error('\nSmoke run threw:', error);
  console.error('\n--- API log tail ---\n', apiLog.slice(-3000));
} finally {
  shutdown();
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
