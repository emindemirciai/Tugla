'use client';

/**
 * Browser API client.
 *
 * Holds the short-lived access token in memory only (never localStorage, so an
 * XSS cannot exfiltrate a long-lived credential) and relies on the httpOnly
 * refresh cookie for session continuity. A single in-flight refresh is shared
 * by all concurrent callers so a burst of 401s cannot stampede the endpoint.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
const listeners = new Set<(token: string | null) => void>();

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  for (const listener of listeners) listener(token);
};

export const getAccessToken = () => accessToken;

export const onTokenChange = (listener: (token: string | null) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

async function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        setAccessToken(null);
        return false;
      }
      const data = (await response.json()) as { accessToken?: string };
      if (!data.accessToken) return false;
      setAccessToken(data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, retryOnUnauthorized = true, ...rest } = options;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(auth && accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(rest.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && auth && retryOnUnauthorized) {
    if (await refreshSession()) {
      return api<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : null;

  if (!response.ok) {
    const message =
      (Array.isArray(payload?.message)
        ? payload.message.join(', ')
        : (payload?.message as string)) ?? 'Request failed';
    throw new ApiError(
      response.status,
      message,
      payload?.errors as { path: string; message: string }[] | undefined,
    );
  }
  return payload as T;
}

export const restoreSession = () => refreshSession();

// ----- typed helpers ---------------------------------------------------------

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  locale: string;
  emailVerified: boolean;
  searchVisible: boolean;
  marketingConsent: boolean;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
  verificationEmailSent?: boolean;
}

export const authApi = {
  async register(input: {
    email: string;
    password: string;
    displayName: string;
    acceptedTerms: true;
    locale?: 'tr' | 'en';
    marketingConsent?: boolean;
  }) {
    const result = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
      auth: false,
    });
    setAccessToken(result.accessToken);
    return result;
  },
  async login(input: { email: string; password: string }) {
    const result = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: input,
      auth: false,
    });
    setAccessToken(result.accessToken);
    return result;
  },
  async logout() {
    await api('/auth/logout', { method: 'POST', auth: false }).catch(() => undefined);
    setAccessToken(null);
  },
  me: () => api<PublicUser & { progress: unknown; balances: unknown[] }>('/auth/me'),
  requestVerification: (email: string) =>
    api<{ sent: boolean }>('/auth/email/verify/request', {
      method: 'POST',
      body: { email },
      auth: false,
    }),
  confirmVerification: (token: string) =>
    api<{ verified: boolean }>('/auth/email/verify/confirm', {
      method: 'POST',
      body: { token },
      auth: false,
    }),
  requestReset: (email: string) =>
    api<{ sent: boolean }>('/auth/password/reset/request', {
      method: 'POST',
      body: { email },
      auth: false,
    }),
  confirmReset: (token: string, password: string) =>
    api<{ reset: boolean }>('/auth/password/reset/confirm', {
      method: 'POST',
      body: { token, password },
      auth: false,
    }),
  oauth: async (provider: 'google' | 'apple', identityToken: string) => {
    const result = await api<AuthResponse>('/auth/oauth', {
      method: 'POST',
      body: { provider, identityToken },
      auth: false,
    });
    setAccessToken(result.accessToken);
    return result;
  },
  updateProfile: (input: Record<string, unknown>) =>
    api<PublicUser>('/auth/me', { method: 'PATCH', body: input }),
  sessions: () => api<{ items: Record<string, unknown>[] }>('/auth/sessions'),
  revokeSession: (id: string) => api(`/auth/sessions/${id}`, { method: 'DELETE' }),
  exportData: () => api<Record<string, unknown>>('/auth/export'),
  deleteAccount: () => api<{ deleted: boolean }>('/auth/me', { method: 'DELETE' }),
};

export interface RemoteConfig {
  brand: { name: string; slug: string; webUrl: string; supportEmail: string };
  limits: { maxBalls: number; livesPerLevel: number; worlds: number; levelsPerWorld: number };
  providers: {
    googleAuth: boolean;
    appleAuth: boolean;
    mail: boolean;
    objectStorage: boolean;
    ads: boolean;
    payments: boolean;
  };
  flags: Record<string, { enabled: boolean; config: unknown }>;
}

export interface LevelSummary {
  id: string;
  slug: string;
  name: string;
  world: number;
  index: number;
  type: string;
  theme: string;
  difficulty: number;
  estimatedSeconds: number;
}

export interface SessionStart {
  sessionId: string;
  seed: number;
  nonce: string;
  level: {
    id: string;
    name: string;
    world: number;
    index: number;
    type: string;
    theme: string;
    definition: unknown;
  };
  lives: number;
  maxBalls: number;
  serverTime: number;
}

export const gameApi = {
  config: () => api<RemoteConfig>('/config', { auth: false }),
  worlds: () =>
    api<{ items: { world: number; theme: string; levels: number }[] }>('/game/worlds', {
      auth: false,
    }),
  levels: (world?: number, limit = 50) =>
    api<{ items: LevelSummary[]; nextCursor: string | null }>(
      `/game/levels?limit=${limit}${world ? `&world=${world}` : ''}`,
    ),
  level: (id: string) =>
    api<{ id: string; name: string; definition: unknown }>(`/game/levels/${id}`),
  startSession: (levelId: string, mode = 'CAMPAIGN') =>
    api<SessionStart>('/game/sessions', { method: 'POST', body: { levelId, mode } }),
  completeSession: (result: Record<string, unknown>) =>
    api<{
      accepted: boolean;
      status: string;
      riskScore: number;
      reasons: string[];
      rewards: {
        credits: number;
        crystals: number;
        experience: number;
        playerLevel: number;
        unlockedLevel: number;
        tasksCompleted: string[];
        achievementsUnlocked: string[];
        personalBest: boolean;
      } | null;
    }>('/game/sessions/complete', { method: 'POST', body: result }),
  replays: () => api<{ items: Record<string, unknown>[] }>('/game/replays'),
  replay: (sessionId: string) => api<Record<string, unknown>>(`/game/replays/${sessionId}`),
  shareReplay: (sessionId: string, shared: boolean) =>
    api(`/game/replays/${sessionId}/share`, { method: 'POST', body: { shared } }),
};

export const progressionApi = {
  tasks: () =>
    api<{
      items: {
        id: string;
        key: string;
        name: string;
        description: string;
        cadence: string;
        target: number;
        progress: number;
        completed: boolean;
        claimed: boolean;
        rewards: Record<string, number>;
      }[];
    }>('/progression/tasks'),
  claimTask: (id: string) => api(`/progression/tasks/${id}/claim`, { method: 'POST' }),
  achievements: () =>
    api<{
      items: {
        id: string;
        key: string;
        name: string;
        description: string;
        category: string;
        target: number;
        progress: number;
        unlocked: boolean;
        claimed: boolean;
      }[];
    }>('/progression/achievements'),
  claimAchievement: (id: string) =>
    api(`/progression/achievements/${id}/claim`, { method: 'POST' }),
  league: () =>
    api<{
      league: { key: string; tier: string; endsAt: string };
      groupNumber: number;
      standings: {
        rank: number;
        userId: string;
        username: string;
        displayName: string;
        score: number;
        isSelf: boolean;
      }[];
    }>('/progression/league'),
  wallet: () =>
    api<{
      balances: { currency: string; amount: number }[];
      transactions: {
        id: string;
        currency: string;
        amount: number;
        reason: string;
        createdAt: string;
      }[];
    }>('/progression/wallet'),
};

export const socialApi = {
  search: (query: string) =>
    api<{ items: { id: string; username: string; displayName: string }[] }>(
      `/social/players?q=${encodeURIComponent(query)}`,
    ),
  follow: (userId: string) => api('/social/follow', { method: 'POST', body: { userId } }),
  unfollow: (userId: string) => api(`/social/follow/${userId}`, { method: 'DELETE' }),
  requestFriend: (userId: string) => api('/social/friends', { method: 'POST', body: { userId } }),
  acceptFriend: (id: string) => api(`/social/friends/${id}/accept`, { method: 'POST' }),
  friends: () => api<{ items: Record<string, unknown>[] }>('/social/friends'),
  leaderboard: (boardKey: string) =>
    api<{
      items: { score: number; user: { id: string; username: string; displayName: string } }[];
    }>(`/social/leaderboards/${encodeURIComponent(boardKey)}`),
};

export const platformApi = {
  announcements: () =>
    api<{ items: { id: string; title: string; body: string; publishedAt: string }[] }>(
      '/announcements',
      { auth: false },
    ),
  notifications: () =>
    api<{
      items: {
        id: string;
        title: string;
        body: string;
        readAt: string | null;
        createdAt: string;
      }[];
      unread: number;
    }>('/notifications'),
  readNotification: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
  registerDevice: (input: { fingerprint: string; name: string; platform: string }) =>
    api('/devices', { method: 'POST', body: input }),
  sync: (input: { version: number; offlineSessions?: unknown[] }) =>
    api<{ stale: boolean; progress: Record<string, unknown>; offlineSessionsRecorded: number }>(
      '/sync',
      {
        method: 'POST',
        body: input,
      },
    ),
  support: (input: Record<string, unknown>) =>
    api('/support', { method: 'POST', body: input, auth: false }),
  shop: () => api<{ items: Record<string, unknown>[]; paymentsEnabled: boolean }>('/shop'),
};
