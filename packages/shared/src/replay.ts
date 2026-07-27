import { z } from 'zod';

/**
 * Replays store *input*, not state: the engine is deterministic, so a seed plus
 * the ordered list of player inputs reproduces the run exactly. This keeps
 * replays tiny (a few KB) and makes them usable for server-side verification.
 */
export const replayInputSchema = z.object({
  /** Physics tick at which the input was applied. */
  t: z.number().int().nonnegative().max(100000000),
  /** `m` = paddle move target, `l` = launch, `b` = bonus collected. */
  k: z.enum(['m', 'l', 'b']),
  /** Payload: paddle X for `m`, bonus ordinal for `b`, unused for `l`. */
  v: z.number().finite(),
});

export const replayDocumentSchema = z.object({
  version: z.literal(1),
  seed: z.number().int().nonnegative(),
  levelId: z.string().max(64),
  width: z.number().positive(),
  height: z.number().positive(),
  fixedStep: z.number().positive(),
  maxBalls: z.number().int().positive(),
  lives: z.number().int().positive(),
  inputs: z.array(replayInputSchema).max(20000),
  finalTick: z.number().int().nonnegative(),
  score: z.number().int().nonnegative(),
});

export type ReplayInput = z.infer<typeof replayInputSchema>;
export type ReplayDocument = z.infer<typeof replayDocumentSchema>;

/** Compact wire format: avoids per-object key overhead in JSON. */
export const encodeReplay = (document: ReplayDocument): string =>
  JSON.stringify({
    ...document,
    inputs: document.inputs.map((input) => [input.t, input.k, input.v]),
  });

export const decodeReplay = (raw: string): ReplayDocument => {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const inputs = Array.isArray(parsed.inputs) ? parsed.inputs : [];
  return replayDocumentSchema.parse({
    ...parsed,
    inputs: inputs.map((entry) => {
      const [t, k, v] = entry as [number, string, number];
      return { t, k, v };
    }),
  });
};
