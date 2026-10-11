import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { Chess } from "chess.js";

const input = process.argv[2] ?? "/tmp/forksight-dl/sample.ndjson";
const output = process.argv[3] ?? "data/puzzles.json";

function fenPly(fen) {
  const parts = fen.split(" ");
  const fullmove = Number(parts[5]);
  const turn = parts[1];
  return (fullmove - 1) * 2 + (turn === "b" ? 1 : 0);
}

function sameSpot(a, b) {
  const [ab, at, ac] = a.split(" ");
  const [bb, bt, bc] = b.split(" ");
  return ab === bb && at === bt && ac === bc;
}

function playUci(chess, uci) {
  return chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4],
  });
}

function clockLabel(clock, perf) {
  const speed = perf ? perf.charAt(0).toUpperCase() + perf.slice(1) : "";
  if (!clock || typeof clock.initial !== "number") return speed;
  const mins = clock.initial / 60;
  const label = Number.isInteger(mins) ? String(mins) : mins.toFixed(1);
  return `${label}+${clock.increment ?? 0} ${speed}`.trim();
}

function playerName(side) {
  return side?.user?.name || side?.user?.id || "Anonymous";
}

const puzzles = [];
let skipped = 0;

const rl = createInterface({ input: createReadStream(input), crlfDelay: Infinity });

for await (const line of rl) {
  if (!line.trim()) continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    skipped += 1;
    continue;
  }

  const puzzle = row.puzzle;
  const game = row.game;
  if (!puzzle?.FEN || !puzzle?.Moves || game?.variant && game.variant !== "standard") {
    skipped += 1;
    continue;
  }

  const uciMoves = puzzle.Moves.split(/\s+/).filter(Boolean);
  if (uciMoves.length < 2) {
    skipped += 1;
    continue;
  }

  const chess = new Chess(puzzle.FEN);
  let legal = true;
  for (const uci of uciMoves) {
    if (!playUci(chess, uci)) {
      legal = false;
      break;
    }
  }
  if (!legal) {
    skipped += 1;
    continue;
  }

  const setupChess = new Chess(puzzle.FEN);
  const setupMove = playUci(setupChess, uciMoves[0]);
  if (!setupMove) {
    skipped += 1;
    continue;
  }

  let history = [];
  let matched = false;
  if (typeof game?.moves === "string" && game.moves.trim()) {
    const replay = new Chess();
    const sans = game.moves.split(/\s+/).filter(Boolean);
    for (const san of sans) {
      if (sameSpot(replay.fen(), puzzle.FEN)) {
        matched = true;
        break;
      }
      const played = replay.move(san);
      if (!played) break;
      history.push(played.san);
    }
    if (!matched && sameSpot(replay.fen(), puzzle.FEN)) matched = true;
  }
  if (!matched) history = [];

  const origin = matched ? history.length : fenPly(puzzle.FEN);
  const themes = String(puzzle.Themes ?? "")
    .split(/\s+/)
    .map((theme) => theme.trim())
    .filter(Boolean);

  puzzles.push({
    id: puzzle.PuzzleId,
    fen: puzzle.FEN,
    setup: uciMoves[0],
    solution: uciMoves.slice(1),
    rating: Number(puzzle.Rating),
    themes,
    plays: Number(puzzle.NbPlays) || 0,
    white: playerName(game?.players?.white),
    whiteRating: Number(game?.players?.white?.rating) || 0,
    black: playerName(game?.players?.black),
    blackRating: Number(game?.players?.black?.rating) || 0,
    event: clockLabel(game?.clock, game?.perf || game?.speed),
    gameUrl: puzzle.GameUrl || (game?.id ? `https://lichess.org/${game.id}` : ""),
    history,
    fenPly: origin,
  });
}

puzzles.sort((a, b) => a.rating - b.rating);
await writeFile(output, JSON.stringify(puzzles));
console.log(`wrote ${puzzles.length} puzzles, skipped ${skipped}, to ${output}`);
