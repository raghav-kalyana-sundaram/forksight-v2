import { PuzzleScreen } from "@/components/puzzle-screen";
import type { Puzzle } from "@/lib/types";
import puzzles from "@/data/puzzles.json";

export default function Page() {
  return <PuzzleScreen puzzles={puzzles as Puzzle[]} />;
}
