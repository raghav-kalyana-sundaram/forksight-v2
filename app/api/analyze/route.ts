import { Chess, type PieceSymbol, type Square } from "chess.js";
import { searchFen, solverScore, type EngineScore } from "@/lib/engine";

type Body = {
  fen?: string;
  candidate?: string;
  book?: string;
};

function cleanFen(fen: string): string | null {
  try {
    return new Chess(fen).fen();
  } catch {
    return null;
  }
}

function isUci(move: string): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move);
}

function afterMove(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen);
    chess.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
    });
    return chess.fen();
  } catch {
    return null;
  }
}

function legalPrefix(fen: string, moves: string[]): string[] {
  const chess = new Chess(fen);
  const kept: string[] = [];
  for (const uci of moves) {
    try {
      chess.move({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: uci.length > 4 ? (uci[4] as PieceSymbol) : undefined,
      });
      kept.push(uci);
    } catch {
      break;
    }
  }
  return kept;
}

function lineLength(score: EngineScore): number {
  if (score.mate != null && score.mate !== 0) return Math.min(8, Math.abs(score.mate));
  return Math.min(5, score.pv.length);
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ accept: false, continuation: [] }, { status: 400 });
  }

  const fen = body.fen ? cleanFen(body.fen) : null;
  const candidate = body.candidate ?? "";
  const book = body.book ?? "";
  if (!fen || !isUci(candidate) || !isUci(book)) {
    return Response.json({ accept: false, continuation: [] }, { status: 400 });
  }

  const afterCandidate = afterMove(fen, candidate);
  const afterBook = afterMove(fen, book);
  if (!afterCandidate || !afterBook) {
    return Response.json({ accept: false, continuation: [] });
  }

  try {
    const candidateScore = await searchFen(afterCandidate, 12);
    const candidateEval = solverScore(candidateScore);
    let accept = candidateEval >= 200 || candidateEval > 50000;
    if (!accept && candidateEval >= 0) {
      const bookScore = await searchFen(afterBook, 12);
      const bookEval = solverScore(bookScore);
      accept = candidateEval >= bookEval - 70 && candidateEval > -40;
    }
    if (!accept) return Response.json({ accept: false, continuation: [] });

    const rest = legalPrefix(afterCandidate, candidateScore.pv).slice(0, lineLength(candidateScore));
    return Response.json({ accept: true, continuation: [candidate, ...rest] });
  } catch (error) {
    console.error("analyze failed", error);
    return Response.json({ accept: false, continuation: [] }, { status: 500 });
  }
}
