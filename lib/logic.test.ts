import assert from "node:assert/strict";
import test from "node:test";
import { fenAfter, sanOnLine, setupSan } from "./chess.ts";
import { gradeAttempt } from "./grade.ts";
import { ratingDelta } from "./rating.ts";
import { buildSheet, themeLabel } from "./sheet.ts";
import type { Puzzle } from "./types.ts";

const puzzle: Puzzle = {
  id: "test",
  fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
  setup: "e2e4",
  solution: ["e8e7", "e4e5"],
  rating: 1500,
  themes: ["mateIn2", "endgame"],
  plays: 3,
  white: "a",
  whiteRating: 1500,
  black: "b",
  blackRating: 1500,
  event: "3+0 Blitz",
  gameUrl: "https://lichess.org/example",
  history: [],
  fenPly: 0,
};

test("grades the stored line and ignores moves after it", () => {
  assert.deepEqual(gradeAttempt(["e8e7", "e4e5", "e7e8"], ["e8e7", "e4e5"]), { type: "solved" });
  assert.deepEqual(gradeAttempt(["e8e7"], ["e8e7", "e4e5"]), { type: "short", index: 1 });
  assert.deepEqual(gradeAttempt(["e8d7", "e4e5"], ["e8e7", "e4e5"]), { type: "solver", index: 0 });
  assert.deepEqual(gradeAttempt(["e8e7", "e1e2"], ["e8e7", "e4e5"]), { type: "opponent", index: 1 });
});

test("rating moves up on a harder puzzle and down on a miss", () => {
  assert.ok(ratingDelta(1500, 1800, true) > 10);
  assert.ok(ratingDelta(1500, 1200, false) < 0);
});

test("theme labels stay readable", () => {
  assert.equal(themeLabel("mateIn2"), "mate in 2");
  assert.equal(themeLabel("kingsideAttack"), "kingside attack");
});

test("setup move is visible and the next cell is empty", () => {
  const blocks = buildSheet({
    history: [],
    fenPly: 0,
    setupSan: setupSan(puzzle),
    attempt: [],
    status: "playing",
    wrongIndex: null,
    revealed: null,
    allowNext: true,
    variations: [],
  });
  assert.equal(blocks[0].type, "row");
  if (blocks[0].type !== "row") return;
  assert.equal(blocks[0].white?.san, "e4");
  assert.equal(blocks[0].white?.mark, "current");
  assert.equal(blocks[0].black?.mark, "next");
  assert.equal(fenAfter(puzzle, []).split(" ")[1], "b");
});

test("older game moves stay quiet and entered moves stay on their own line", () => {
  const blocks = buildSheet({
    history: ["e4"],
    fenPly: 1,
    setupSan: "e5",
    attempt: [{ san: "Nf3" }],
    status: "playing",
    wrongIndex: null,
    revealed: null,
    allowNext: true,
    variations: [{ san: "Nc3", ply: 2 }],
  });
  const first = blocks[0];
  assert.equal(first.type, "row");
  if (first.type !== "row") return;
  assert.equal(first.white?.mark, "past");
  assert.equal(first.black?.mark, "past");
  const second = blocks[1];
  assert.equal(second.type, "variation");
  const third = blocks[2];
  assert.equal(third.type, "row");
  if (third.type !== "row") return;
  assert.equal(third.white?.san, "Nf3");
  assert.equal(third.white?.mark, "line");
});

test("a solved line is marked green", () => {
  const blocks = buildSheet({
    history: [],
    fenPly: 0,
    setupSan: "e4",
    attempt: [{ san: "Ke7" }, { san: "e5" }],
    status: "solved",
    wrongIndex: null,
    revealed: null,
    allowNext: false,
    variations: [],
  });
  const row = blocks[0];
  assert.equal(row.type, "row");
  if (row.type !== "row") return;
  assert.equal(row.black?.mark, "good");
  const next = blocks[1];
  assert.equal(next.type, "row");
  if (next.type !== "row") return;
  assert.equal(next.white?.mark, "good");
});

test("a wrong opponent reply is crossed out beside the stored move", () => {
  const blocks = buildSheet({
    history: [],
    fenPly: 0,
    setupSan: "e4",
    attempt: [{ san: "Ke7" }, { san: "e5", strike: "Ke2" }],
    status: "playing",
    wrongIndex: null,
    revealed: null,
    allowNext: true,
    variations: [],
  });
  const row = blocks[1];
  assert.equal(row.type, "row");
  if (row.type !== "row") return;
  assert.equal(row.white?.mark, "corrected");
  assert.equal(row.white?.strike, "Ke2");
  assert.equal(row.white?.san, "e5");
  assert.equal(row.black?.mark, "next");
});

test("a wrong ply is marked and the rest fades", () => {
  const blocks = buildSheet({
    history: [],
    fenPly: 0,
    setupSan: "e4",
    attempt: [{ san: "Ke7" }, { san: "e5" }],
    status: "wrong",
    wrongIndex: 0,
    revealed: null,
    allowNext: false,
    variations: [],
  });
  const row = blocks[0];
  assert.equal(row.type, "row");
  if (row.type !== "row") return;
  assert.equal(row.white?.mark, "faded");
  assert.equal(row.black?.mark, "wrong");
  assert.equal(row.black?.san, "Ke7");
});

test("give up reveals one move", () => {
  assert.equal(sanOnLine(puzzle, puzzle.solution, 0), "Ke7");
});
