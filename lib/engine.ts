import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

export type EngineScore = {
  cp?: number;
  mate?: number;
  pv: string[];
};

type Waiter = {
  resolve: (score: EngineScore) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  best: EngineScore;
  bestDepth: number;
};

let enginePromise: Promise<Engine> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function engineScript(): string {
  const src = path.join(process.cwd(), "node_modules", "stockfish", "src");
  const file = readdirSync(src).find(
    (name) => name.includes("lite-single") && name.endsWith(".js"),
  );
  if (!file) throw new Error("Stockfish lite engine is missing");
  return path.join(src, file);
}

class Engine {
  private child: ChildProcessWithoutNullStreams;
  private buffer = "";
  private waiter: Waiter | null = null;
  private ready: Promise<void>;
  private markReady!: () => void;

  constructor() {
    this.child = spawn(process.execPath, [engineScript()], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.ready = new Promise((resolve) => {
      this.markReady = resolve;
    });
    this.child.stdout.on("data", (chunk) => this.ingest(chunk.toString()));
    this.child.stderr.on("data", (chunk) => this.ingest(chunk.toString()));
    this.child.on("exit", () => {
      this.waiter?.reject(new Error("Stockfish exited"));
      this.waiter = null;
      enginePromise = null;
    });
    this.child.stdin.write("uci\n");
  }

  private ingest(text: string) {
    this.buffer += text;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? "";
    for (const line of lines) this.onLine(line.trim());
  }

  private onLine(line: string) {
    if (!line) return;
    if (line === "uciok") {
      this.markReady();
      return;
    }
    const waiter = this.waiter;
    if (!waiter) return;
    const info = parseInfo(line);
    if (info && info.depth >= waiter.bestDepth) {
      waiter.best = { cp: info.cp, mate: info.mate, pv: info.pv };
      waiter.bestDepth = info.depth;
    }
    if (line.startsWith("bestmove")) {
      const move = line.split(/\s+/)[1];
      if (move && move !== "(none)" && waiter.best.pv.length === 0) {
        waiter.best.pv = [move];
      }
      clearTimeout(waiter.timer);
      this.waiter = null;
      waiter.resolve(waiter.best);
    }
  }

  async search(fen: string, depth: number): Promise<EngineScore> {
    await this.ready;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        this.child.stdin.write("stop\n");
        reject(new Error("Stockfish timed out"));
      }, 10000);
      this.waiter = { resolve, reject, timer, best: { pv: [] }, bestDepth: -1 };
      this.child.stdin.write(`position fen ${fen}\n`);
      this.child.stdin.write(`go depth ${depth}\n`);
    });
  }
}

function parseInfo(line: string): { depth: number; cp?: number; mate?: number; pv: string[] } | null {
  if (!line.startsWith("info ") || !line.includes(" score ")) return null;
  const parts = line.split(/\s+/);
  const depthAt = parts.indexOf("depth");
  const scoreAt = parts.indexOf("score");
  const pvAt = parts.indexOf("pv");
  if (depthAt < 0 || scoreAt < 0) return null;
  const kind = parts[scoreAt + 1];
  const value = Number(parts[scoreAt + 2]);
  if (!Number.isFinite(value)) return null;
  const pv = pvAt >= 0 ? parts.slice(pvAt + 1).filter((token) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token)) : [];
  const depth = Number(parts[depthAt + 1]);
  if (kind === "cp") return { depth, cp: value, pv };
  if (kind === "mate") return { depth, mate: value, pv };
  return null;
}

async function getEngine(): Promise<Engine> {
  if (!enginePromise) enginePromise = Promise.resolve(new Engine());
  return enginePromise;
}

export function searchFen(fen: string, depth = 12): Promise<EngineScore> {
  const run = queue.then(() => getEngine().then((engine) => engine.search(fen, depth)));
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function solverScore(score: EngineScore): number {
  if (score.mate != null) {
    return score.mate > 0 ? -100000 + score.mate : 100000 + score.mate;
  }
  return -(score.cp ?? 0);
}
