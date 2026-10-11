"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Board } from "@/components/board";
import { MetaPanel } from "@/components/meta-panel";
import { Scoresheet } from "@/components/scoresheet";
import { fenAfter, sanOnLine, setupSan, solverOrientation, tryMove, uciSquares } from "@/lib/chess";
import { gradeAttempt } from "@/lib/grade";
import { pickPuzzle, ratingDelta } from "@/lib/rating";
import { formatClock } from "@/lib/sheet";
import type { AttemptMove, PlayStatus, Puzzle, Variation } from "@/lib/types";

type Result = {
  id: string;
  rating: number;
  delta: number;
};

type Progress = {
  rating: number;
  streak: number;
  seen: string[];
  history: Result[];
};

type Play = {
  puzzle: Puzzle;
  solution: string[];
  attempt: AttemptMove[];
  variations: Variation[];
  status: PlayStatus;
  wrongIndex: number | null;
  revealed: string | null;
  tried: boolean;
};

const PROGRESS_KEY = "forksight-progress";

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { rating: 1500, streak: 0, seen: [], history: [] };
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const history = Array.isArray(parsed.history)
      ? parsed.history.filter(
          (item): item is Result =>
            !!item &&
            typeof item.id === "string" &&
            typeof item.rating === "number" &&
            typeof item.delta === "number",
        )
      : [];
    return {
      rating: typeof parsed.rating === "number" ? parsed.rating : 1500,
      streak: typeof parsed.streak === "number" ? parsed.streak : 0,
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((id) => typeof id === "string") : [],
      history,
    };
  } catch {
    return { rating: 1500, streak: 0, seen: [], history: [] };
  }
}

function saveProgress(progress: Progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function freshPlay(puzzle: Puzzle): Play {
  return {
    puzzle,
    solution: puzzle.solution.slice(),
    attempt: [],
    variations: [],
    status: "playing",
    wrongIndex: null,
    revealed: null,
    tried: false,
  };
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function Timer({ clockKey }: { clockKey: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [clockKey]);
  return formatClock(elapsed);
}

function initialSession(puzzles: Puzzle[]) {
  const loaded = loadProgress();
  const puzzle = pickPuzzle(puzzles, loaded.rating, new Set(loaded.seen));
  const seen = loaded.seen.includes(puzzle.id) ? loaded.seen : [...loaded.seen, puzzle.id];
  const progress = { ...loaded, seen: seen.slice(-400) };
  saveProgress(progress);
  const stored = document.documentElement.dataset.theme;
  const theme: "dark" | "light" = stored === "light" ? "light" : "dark";
  return { progress, play: freshPlay(puzzle), theme };
}

function PuzzleHistory({ results }: { results: Result[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ inline: "end", block: "nearest" });
  }, [results.length]);
  if (results.length === 0) return null;
  return (
    <div className="history">
      {results.map((result, index) => (
        <div key={`${result.id}-${index}`} className={`result ${result.delta >= 0 ? "up" : "down"}`}>
          <span>{result.rating}</span>
          <span>{result.delta > 0 ? `+${result.delta}` : result.delta}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

function Shell({
  theme,
  onTheme,
  puzzle,
  progress,
  delta,
  time,
  children,
}: {
  theme: "dark" | "light";
  onTheme: () => void;
  puzzle: Puzzle | null;
  progress: Progress | null;
  delta: number | null;
  time: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">Forksight</div>
        <button type="button" className="theme" onClick={onTheme}>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>
      <main className="main">
        <MetaPanel
          puzzle={puzzle}
          rating={progress?.rating ?? null}
          delta={delta}
          streak={progress?.streak ?? null}
          time={time}
        />
        {children}
      </main>
    </div>
  );
}

export function PuzzleScreen({ puzzles }: { puzzles: Puzzle[] }) {
  const client = useIsClient();
  if (!client) return <Shell theme="dark" onTheme={() => {}} puzzle={null} progress={null} delta={null} time="0:00" />;
  return <LoadedScreen puzzles={puzzles} />;
}

function LoadedScreen({ puzzles }: { puzzles: Puzzle[] }) {
  const [session] = useState(() => initialSession(puzzles));
  const [progress, setProgress] = useState<Progress>(session.progress);
  const [play, setPlay] = useState<Play>(session.play);
  const [delta, setDelta] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(session.theme);
  const scored = useRef(false);
  const requestId = useRef(0);
  const playRef = useRef<Play>(session.play);
  const progressRef = useRef<Progress>(session.progress);

  useEffect(() => {
    playRef.current = play;
    progressRef.current = progress;
  }, [play, progress]);

  const san = useMemo(() => setupSan(play.puzzle), [play]);

  function award(success: boolean) {
    const current = playRef.current;
    const prog = progressRef.current;
    if (!current || !prog || scored.current) return;
    scored.current = true;
    const change = ratingDelta(prog.rating, current.puzzle.rating, success);
    const next = {
      ...prog,
      rating: prog.rating + change,
      streak: success ? prog.streak + 1 : 0,
      history: [...prog.history, { id: current.puzzle.id, rating: current.puzzle.rating, delta: change }].slice(-24),
    };
    progressRef.current = next;
    saveProgress(next);
    setDelta(change);
    setProgress(next);
  }

  function openPuzzle(puzzle: Puzzle) {
    const prog = progressRef.current;
    if (!prog) return;
    const seen = prog.seen.includes(puzzle.id) ? prog.seen : [...prog.seen, puzzle.id];
    const next = { ...prog, seen: seen.slice(-400) };
    progressRef.current = next;
    saveProgress(next);
    setProgress(next);
    scored.current = false;
    requestId.current += 1;
    setNonce((value) => value + 1);
    const nextPlay = freshPlay(puzzle);
    playRef.current = nextPlay;
    setPlay(nextPlay);
  }

  function playMove(uci: string) {
    setPlay((prev) => {
      if (!prev) return prev;
      if (prev.status === "checking" || prev.status === "gave-up" || prev.status === "solved") return prev;
      const base = prev.status === "wrong" ? [] : prev.attempt;
      if (base.length >= prev.solution.length) return prev;
      const fen = fenAfter(prev.puzzle, base.map((move) => move.uci));
      const applied = tryMove(fen, uci);
      if (!applied) return prev;
      return {
        ...prev,
        status: "playing",
        wrongIndex: null,
        revealed: null,
        attempt: [...base, { uci, san: applied.san }],
      };
    });
  }

  async function submit() {
    const current = playRef.current;
    if (!current || current.status !== "playing" || current.attempt.length < current.solution.length) return;
    const attempt = current.attempt.map((move) => move.uci);
    const grade = gradeAttempt(attempt, current.solution);
    if (grade.type === "solved") {
      award(true);
      setPlay((prev) =>
        prev
          ? {
              ...prev,
              attempt: prev.attempt.map(({ uci, san }) => ({ uci, san })),
              status: "solved",
              wrongIndex: null,
              revealed: null,
            }
          : prev,
      );
      return;
    }
    if (grade.type === "opponent") {
      const rightUci = current.solution[grade.index];
      const rightSan = sanOnLine(current.puzzle, current.solution, grade.index);
      if (!rightSan) {
        setPlay((prev) =>
          prev ? { ...prev, status: "wrong", wrongIndex: grade.index, revealed: null, tried: true } : prev,
        );
        return;
      }
      const nextPlay: Play = {
        ...current,
        attempt: [
          ...current.attempt.slice(0, grade.index),
          { uci: rightUci, san: rightSan, strike: current.attempt[grade.index].san },
        ],
        status: "playing",
        wrongIndex: null,
        revealed: null,
      };
      playRef.current = nextPlay;
      setPlay(nextPlay);
      return;
    }
    if (grade.type !== "solver") {
      setPlay((prev) =>
        prev ? { ...prev, status: "wrong", wrongIndex: grade.index, revealed: null, tried: true } : prev,
      );
      return;
    }

    const id = requestId.current + 1;
    requestId.current = id;
    setPlay((prev) => (prev ? { ...prev, status: "checking" } : prev));
    try {
      const fen = fenAfter(current.puzzle, attempt.slice(0, grade.index));
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fen,
          candidate: attempt[grade.index],
          book: current.solution[grade.index],
        }),
      });
      if (id !== requestId.current) return;
      if (!response.ok) throw new Error("analyze failed");
      const body = (await response.json()) as { accept?: boolean; continuation?: string[] };
      const continuation = body.continuation ?? [];
      if (!body.accept || continuation[0] !== attempt[grade.index]) {
        setPlay((prev) =>
          prev ? { ...prev, status: "wrong", wrongIndex: grade.index, revealed: null, tried: true } : prev,
        );
        return;
      }
      const solution = [...current.solution.slice(0, grade.index), ...continuation];
      const again = gradeAttempt(attempt, solution);
      if (again.type === "solved") {
        award(true);
        setPlay((prev) =>
          prev
            ? {
                ...prev,
                solution,
                attempt: prev.attempt.map(({ uci, san }) => ({ uci, san })),
                status: "solved",
                wrongIndex: null,
                revealed: null,
              }
            : prev,
        );
        return;
      }
      const variation = {
        san: current.attempt[grade.index].san,
        ply: current.puzzle.fenPly + 1 + grade.index,
      };
      setPlay((prev) => {
        if (!prev) return prev;
        const exists = prev.variations.some(
          (item) => item.ply === variation.ply && item.san === variation.san,
        );
        return {
          ...prev,
          solution,
          attempt: [],
          status: "playing",
          wrongIndex: null,
          revealed: null,
          variations: exists ? prev.variations : [...prev.variations, variation],
        };
      });
    } catch (error) {
      console.error(error);
      if (id !== requestId.current) return;
      setPlay((prev) =>
        prev ? { ...prev, status: "wrong", wrongIndex: grade.index, revealed: null, tried: true } : prev,
      );
    }
  }

  function giveUp() {
    const current = playRef.current;
    if (!current || current.status === "checking" || current.status === "solved" || current.status === "gave-up") {
      return;
    }
    const attempt = current.attempt.map((move) => move.uci);
    const grade = gradeAttempt(attempt, current.solution);
    if (grade.type === "solved") {
      award(true);
      setPlay((prev) => (prev ? { ...prev, status: "solved", wrongIndex: null, revealed: null } : prev));
      return;
    }
    const revealed = sanOnLine(current.puzzle, current.solution, grade.index);
    award(false);
    setPlay((prev) =>
      prev
        ? { ...prev, status: "gave-up", wrongIndex: grade.index, revealed }
        : prev,
    );
  }

  function nextPuzzle() {
    const current = playRef.current;
    const prog = progressRef.current;
    if (!current || !prog || current.status === "checking") return;
    const started = current.attempt.length > 0 || current.status === "wrong" || current.status === "gave-up";
    if (current.status !== "solved" && started) award(false);
    const seen = new Set(progressRef.current?.seen ?? prog.seen);
    seen.add(current.puzzle.id);
    openPuzzle(pickPuzzle(puzzles, progressRef.current?.rating ?? prog.rating, seen, current.puzzle.id));
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("forksight-theme", next);
    setTheme(next);
  }

  const visualFen = play ? fenAfter(play.puzzle, []) : null;
  const hiddenFen = play
    ? fenAfter(
        play.puzzle,
        play.status === "playing" || play.status === "checking" ? play.attempt.map((move) => move.uci) : [],
      )
    : null;
  const interactive = Boolean(play && hiddenFen && (play.status === "playing" || play.status === "wrong"));

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">Forksight</div>
        <button type="button" className="theme" onClick={toggleTheme}>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>
      <main className="main">
        <div className="desk">
          <div className="play">
            <MetaPanel
              puzzle={play?.puzzle ?? null}
              rating={progress?.rating ?? null}
              delta={delta}
              streak={progress?.streak ?? null}
              time={<Timer key={`${play.puzzle.id}:${nonce}`} clockKey={`${play.puzzle.id}:${nonce}`} />}
            />
            <div className="stage">
              <div className="board-wrap">
                {play && visualFen && hiddenFen ? (
                  <Board
                    key={`${play.puzzle.id}:${nonce}`}
                    visualFen={visualFen}
                    hiddenFen={hiddenFen}
                    orientation={solverOrientation(play.puzzle)}
                    lastMove={uciSquares(play.puzzle.setup)}
                    interactive={interactive}
                    onMove={playMove}
                  />
                ) : (
                  <div className="board" />
                )}
              </div>
            </div>
            <div className="sheet-col">
              {play ? (
                <Scoresheet
                  history={play.puzzle.history}
                  fenPly={play.puzzle.fenPly}
                  setupSan={san}
                  attempt={play.attempt.map((move) => ({ san: move.san, strike: move.strike }))}
                  status={play.status}
                  wrongIndex={play.wrongIndex}
                  revealed={play.revealed}
                  allowNext={play.status === "playing" && play.attempt.length < play.solution.length}
                  variations={play.variations}
                  canSubmit={play.status === "playing" && play.attempt.length >= play.solution.length}
                  canNext={play.tried && (play.status === "playing" || play.status === "wrong")}
                  checking={play.status === "checking"}
                  onSubmit={submit}
                  onGiveUp={giveUp}
                  onNext={nextPuzzle}
                />
              ) : (
                <section className="sheet-panel" />
              )}
            </div>
          </div>
          <PuzzleHistory results={progress?.history ?? []} />
        </div>
      </main>
    </div>
  );
}
