import { Chess, type PieceSymbol, type Square } from "chess.js";
import type { Puzzle } from "./types";

function play(chess: Chess, uci: string) {
  return chess.move({
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
  });
}

export function tryMove(fen: string, uci: string): { fen: string; san: string } | null {
  try {
    const chess = new Chess(fen);
    const move = play(chess, uci);
    return { fen: chess.fen(), san: move.san };
  } catch {
    return null;
  }
}

export function fenAfter(puzzle: Puzzle, ucis: string[]): string {
  const chess = new Chess(puzzle.fen);
  play(chess, puzzle.setup);
  for (const uci of ucis) play(chess, uci);
  return chess.fen();
}

export function setupSan(puzzle: Puzzle): string {
  const chess = new Chess(puzzle.fen);
  return play(chess, puzzle.setup).san;
}

export function sanOnLine(puzzle: Puzzle, line: string[], index: number): string | null {
  if (index < 0 || index >= line.length) return null;
  try {
    const chess = new Chess(puzzle.fen);
    play(chess, puzzle.setup);
    let san = "";
    for (let i = 0; i <= index; i += 1) san = play(chess, line[i]).san;
    return san;
  } catch {
    return null;
  }
}

export function solverOrientation(puzzle: Puzzle): "white" | "black" {
  const chess = new Chess(fenAfter(puzzle, []));
  return chess.turn() === "w" ? "white" : "black";
}

export function uciSquares(uci: string): [string, string] {
  return [uci.slice(0, 2), uci.slice(2, 4)];
}
