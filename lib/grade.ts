export type Grade =
  | { type: "solved" }
  | { type: "short"; index: number }
  | { type: "opponent"; index: number }
  | { type: "solver"; index: number };

export function gradeAttempt(attempt: string[], solution: string[]): Grade {
  for (let index = 0; index < solution.length; index += 1) {
    if (index >= attempt.length) return { type: "short", index };
    if (attempt[index].toLowerCase() !== solution[index].toLowerCase()) {
      return index % 2 === 0
        ? { type: "solver", index }
        : { type: "opponent", index };
    }
  }
  return { type: "solved" };
}
