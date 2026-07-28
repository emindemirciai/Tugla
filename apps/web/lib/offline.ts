'use client';

/**
 * Limited offline play support.
 *
 * A signed-in player keeps a small cache of recently fetched levels and a queue
 * of offline completions. Offline runs cannot be verified, so on reconnect they
 * sync as unranked progress only — the API records them with maximum risk and
 * they never touch leaderboards. That is the honest version of "offline play".
 */
import type { SessionStart } from './api';
import { platformApi } from './api';

const LEVEL_CACHE_KEY = 'tugla.level-cache.v1';
const QUEUE_KEY = 'tugla.offline-queue.v1';
const MAX_CACHED_LEVELS = 12;

interface CachedLevel {
  level: SessionStart['level'];
  cachedAt: number;
}

interface OfflineRun {
  levelId: string;
  score: number;
  completed: boolean;
  playedAt: string;
}

const read = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode: offline support degrades gracefully */
  }
};

export const cacheLevel = (level: SessionStart['level']) => {
  const cache = read<CachedLevel[]>(LEVEL_CACHE_KEY, []).filter(
    (entry) => entry.level.id !== level.id,
  );
  cache.unshift({ level, cachedAt: Date.now() });
  write(LEVEL_CACHE_KEY, cache.slice(0, MAX_CACHED_LEVELS));
};

export const cachedLevels = () =>
  read<CachedLevel[]>(LEVEL_CACHE_KEY, []).map((entry) => entry.level);

export const queueOfflineRun = (run: OfflineRun) => {
  const queue = read<OfflineRun[]>(QUEUE_KEY, []);
  queue.push(run);
  write(QUEUE_KEY, queue.slice(-50));
};

export const pendingOfflineRuns = () => read<OfflineRun[]>(QUEUE_KEY, []).length;

/** Pushes queued offline runs to the server; keeps the queue on failure. */
export const flushOfflineRuns = async (progressVersion: number) => {
  const queue = read<OfflineRun[]>(QUEUE_KEY, []);
  if (!queue.length) return 0;
  try {
    const result = await platformApi.sync({ version: progressVersion, offlineSessions: queue });
    write(QUEUE_KEY, []);
    return result.offlineSessionsRecorded;
  } catch {
    return 0;
  }
};
