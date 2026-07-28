'use client';

import type { QualityLevel } from '@pulse/shared';

export interface GameSettings {
  quality: QualityLevel;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  showTrails: boolean;
}

const STORAGE_KEY = 'pulse.settings.v1';

export const defaultSettings: GameSettings = {
  quality: 'AUTO',
  soundEnabled: true,
  hapticsEnabled: true,
  reducedMotion: false,
  showTrails: true,
};

export const loadSettings = (): GameSettings => {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = (settings: GameSettings) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage may be unavailable in private mode; settings stay in memory */
  }
};

export interface ResolvedQuality {
  level: Exclude<QualityLevel, 'AUTO'>;
  pixelRatio: number;
  shadows: boolean;
  trailLength: number;
  maxParticles: number;
  antialias: boolean;
  bloom: boolean;
}

/**
 * Resolves the effective quality tier.
 *
 * AUTO inspects device memory, core count and screen size, because a mid-range
 * phone rendering 500 instanced balls with shadows will drop frames badly.
 */
export const resolveQuality = (setting: QualityLevel): ResolvedQuality => {
  let level: Exclude<QualityLevel, 'AUTO'> = 'MEDIUM';
  if (setting !== 'AUTO') {
    level = setting;
  } else if (typeof window !== 'undefined') {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    const pixels = window.screen.width * window.screen.height * (window.devicePixelRatio || 1);
    const score = memory * 1.5 + cores - pixels / 2_000_000;
    level = score >= 10 ? 'HIGH' : score >= 5 ? 'MEDIUM' : 'LOW';
  }

  const presets: Record<Exclude<QualityLevel, 'AUTO'>, ResolvedQuality> = {
    LOW: {
      level: 'LOW',
      pixelRatio: 1,
      shadows: false,
      trailLength: 0,
      maxParticles: 40,
      antialias: false,
      bloom: false,
    },
    MEDIUM: {
      level: 'MEDIUM',
      pixelRatio: 1.5,
      shadows: false,
      trailLength: 6,
      maxParticles: 140,
      antialias: true,
      bloom: false,
    },
    HIGH: {
      level: 'HIGH',
      pixelRatio: 2,
      shadows: true,
      trailLength: 12,
      maxParticles: 320,
      antialias: true,
      bloom: true,
    },
  };
  return presets[level];
};
