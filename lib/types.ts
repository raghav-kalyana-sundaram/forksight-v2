export type Puzzle = {
  id: string;
  fen: string;
  setup: string;
  solution: string[];
  rating: number;
  themes: string[];
  plays: number;
  white: string;
  whiteRating: number;
  black: string;
  blackRating: number;
  event: string;
  gameUrl: string;
  history: string[];
  fenPly: number;
};

export type AttemptMove = {
  uci: string;
  san: string;
  strike?: string;
};

export type Variation = {
  san: string;
  ply: number;
};

export type PlayStatus = "playing" | "checking" | "wrong" | "solved" | "gave-up";
