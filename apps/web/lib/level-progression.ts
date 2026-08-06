import type { LevelSummary } from './api';

interface CompletionOutcome {
  accepted: boolean;
  status: string;
}

/** A completion only advances the campaign after authoritative server acceptance. */
export const isAcceptedCompletion = (
  outcome: CompletionOutcome | null,
): outcome is CompletionOutcome => outcome?.accepted === true && outcome.status === 'COMPLETED';

/**
 * Makes the newly cleared and unlocked cards responsive immediately. The
 * caller still refreshes from the API, which remains authoritative.
 */
export const applyAcceptedCompletion = (
  levels: LevelSummary[],
  completedIndex: number,
  outcome: CompletionOutcome | null,
) => {
  if (!isAcceptedCompletion(outcome)) return levels;

  return levels.map((level) => {
    if (level.index === completedIndex) return { ...level, completed: true, unlocked: true };
    if (level.index === completedIndex + 1) return { ...level, unlocked: true };
    return level;
  });
};
