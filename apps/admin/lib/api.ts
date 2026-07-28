'use client';

/** Admin API client: in-memory access token + httpOnly refresh cookie. */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
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
      if (!response.ok) return false;
      const data = (await response.json()) as { accessToken?: string };
      accessToken = data.accessToken ?? null;
      return Boolean(accessToken);
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function adminApi<T = unknown>(
  path: string,
  options: Omit<RequestInit, 'body'> & { body?: unknown; retry?: boolean } = {},
): Promise<T> {
  const { body, retry = true, ...rest } = options;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(rest.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401 && retry && (await refreshSession())) {
    return adminApi<T>(path, { ...options, retry: false });
  }
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : ((payload?.message as string) ?? `Request failed (${response.status})`);
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

export const restoreAdminSession = () => refreshSession();

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export const STAFF_ROLES = ['SUPPORT', 'ANALYST', 'CONTENT_EDITOR', 'GAME_ADMIN', 'SUPER_ADMIN'];
