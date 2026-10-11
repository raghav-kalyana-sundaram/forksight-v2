import { themeLabel } from "@/lib/sheet";
import type { Puzzle } from "@/lib/types";
import type { ReactNode } from "react";

export function MetaPanel({
  puzzle,
  rating,
  delta,
  streak,
  time,
}: {
  puzzle: Puzzle | null;
  rating: number | null;
  delta: number | null;
  streak: number | null;
  time: ReactNode;
}) {
  return (
    <aside className="meta">
      <div className="rating-block">
        {rating != null ? (
          <>
            <div className="rating-line">
              <span className="rating-num">{rating}</span>
              {delta != null && delta !== 0 ? (
                <span className={delta > 0 ? "up" : "down"}>{delta > 0 ? `+${delta}` : delta}</span>
              ) : null}
            </div>
            <p className="streak">Streak {streak ?? 0}</p>
          </>
        ) : null}
      </div>
      <p className="time-line">
        <svg className="clock" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 4.6 V8.2 L10.4 9.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Time {time}
      </p>
      {puzzle ? (
        <div className="puzzle-facts">
          <p>Puzzle rating {puzzle.rating}</p>
          <p className="themes">{puzzle.themes.map(themeLabel).join(" ")}</p>
        </div>
      ) : null}
      {puzzle?.gameUrl ? (
        <a className="game" href={puzzle.gameUrl} target="_blank" rel="noreferrer">
          <p>
            {puzzle.white} {puzzle.whiteRating || ""}
          </p>
          <p>
            {puzzle.black} {puzzle.blackRating || ""}
          </p>
          <p className="game-event">{puzzle.event}</p>
        </a>
      ) : null}
    </aside>
  );
}
