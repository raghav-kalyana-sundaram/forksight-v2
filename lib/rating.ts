export function ratingDelta(user: number, puzzle: number, success: boolean): number {
  const expected = 1 / (1 + 10 ** ((puzzle - user) / 400));
  const score = success ? 1 : 0;
  let delta = Math.round(28 * (score - expected));
  if (success && delta < 1) delta = 1;
  if (!success && delta > -1) delta = -1;
  return delta;
}

export function pickPuzzle<T extends { id: string; rating: number }>(
  puzzles: T[],
  rating: number,
  seen: Set<string>,
  avoidId?: string,
): T {
  let pool = puzzles.filter((puzzle) => !seen.has(puzzle.id));
  if (pool.length === 0) pool = puzzles;
  let candidates = pool.filter((puzzle) => Math.abs(puzzle.rating - rating) <= 250);
  if (candidates.length === 0) candidates = pool;
  if (avoidId && candidates.length > 1) {
    const filtered = candidates.filter((puzzle) => puzzle.id !== avoidId);
    if (filtered.length > 0) candidates = filtered;
  }

  let total = 0;
  const weights = candidates.map((puzzle) => {
    const weight = 1 / (1 + Math.abs(puzzle.rating - rating));
    total += weight;
    return weight;
  });
  let roll = Math.random() * total;
  for (let index = 0; index < candidates.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return candidates[index];
  }
  return candidates[candidates.length - 1];
}
