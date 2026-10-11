import type { PlayStatus, Variation } from "./types";

export type Mark = "plain" | "current" | "next" | "wrong" | "faded";

export type Cell = {
  san: string | null;
  mark: Mark;
};

export type SheetBlock =
  | { type: "row"; number: number; white: Cell | null; black: Cell | null }
  | { type: "variation"; text: string; faded: boolean };

type Draft = {
  san: string | null;
  ply: number;
};

export function themeLabel(theme: string): string {
  return theme
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .toLowerCase();
}

export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}

function variationText(san: string, ply: number): string {
  const moveNo = Math.floor(ply / 2) + 1;
  return ply % 2 === 0 ? `(${moveNo}. ${san})` : `(${moveNo}... ${san})`;
}

export function buildSheet(args: {
  history: string[];
  fenPly: number;
  setupSan: string;
  attempt: string[];
  status: PlayStatus;
  wrongIndex: number | null;
  revealed: string | null;
  allowNext: boolean;
  variations: Variation[];
}): SheetBlock[] {
  const prefix = [...args.history, args.setupSan];
  const startPly = args.fenPly - args.history.length;
  const cells = new Map<number, Draft>();

  prefix.forEach((san, index) => {
    cells.set(startPly + index, { san, ply: startPly + index });
  });

  args.attempt.forEach((san, index) => {
    const ply = args.fenPly + 1 + index;
    cells.set(ply, { san, ply });
  });

  const failed = args.status === "wrong" || args.status === "gave-up";
  const target =
    failed && args.wrongIndex != null ? args.fenPly + 1 + args.wrongIndex : null;

  if (target != null && args.status === "gave-up" && args.revealed) {
    cells.set(target, { san: args.revealed, ply: target });
    for (const ply of [...cells.keys()]) {
      if (ply > target) cells.delete(ply);
    }
  }

  if (target != null && args.status === "wrong" && !cells.has(target)) {
    cells.set(target, { san: null, ply: target });
  }

  if (args.allowNext && !failed) {
    const last = Math.max(...cells.keys());
    cells.set(last + 1, { san: null, ply: last + 1 });
  }

  const plies = [...cells.keys()];
  if (plies.length === 0) return [];
  const lastFilled = Math.max(
    ...[...cells.entries()].filter(([, cell]) => cell.san).map(([ply]) => ply),
  );

  function mark(ply: number, san: string | null): Mark {
    if (target != null && ply === target) return "wrong";
    if (failed) return "faded";
    if (san == null) return "next";
    if (ply === lastFilled) return "current";
    return "plain";
  }

  const firstRow = Math.floor(Math.min(...plies) / 2);
  const lastRow = Math.floor(Math.max(...plies) / 2);
  const variationsAt = new Map<number, Variation[]>();
  for (const variation of args.variations) {
    const after = variation.ply - 1;
    const list = variationsAt.get(after) ?? [];
    list.push(variation);
    variationsAt.set(after, list);
  }

  const blocks: SheetBlock[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    const whitePly = row * 2;
    const blackPly = whitePly + 1;
    const white = cells.get(whitePly);
    const black = cells.get(blackPly);
    if (!white && !black) continue;
    blocks.push({
      type: "row",
      number: row + 1,
      white: white ? { san: white.san, mark: mark(whitePly, white.san) } : null,
      black: black ? { san: black.san, mark: mark(blackPly, black.san) } : null,
    });
    for (const ply of [whitePly, blackPly]) {
      for (const variation of variationsAt.get(ply) ?? []) {
        blocks.push({
          type: "variation",
          text: variationText(variation.san, variation.ply),
          faded: failed,
        });
      }
    }
  }
  return blocks;
}
