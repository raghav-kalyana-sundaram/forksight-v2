import { themeLabel } from "@/lib/sheet";
import type { Puzzle } from "@/lib/types";

export function MetaPanel({
  puzzle,
  rating,
  delta,
  streak,
}: {
  puzzle: Puzzle | null;
  rating: number | null;
  delta: number | null;
  streak: number | null;
}) {
  return (
    <aside className="meta">
      <section className="panel-block">
        {puzzle ? (
          <>
            <p className="puzzle-id">Puzzle {puzzle.id}</p>
            <p>Rating {puzzle.rating}</p>
            <p className="dim">Played {puzzle.plays.toLocaleString()} times</p>
            <p className="from">From game</p>
            <p>{puzzle.event}</p>
            <p>
              {puzzle.white} {puzzle.whiteRating || ""}
            </p>
            <p>
              {puzzle.black} {puzzle.blackRating || ""}
            </p>
          </>
        ) : null}
      </section>
      <section className="panel-block rating-block">
        {rating != null ? (
          <>
            <div className="rating-line">
              <span className="rating-num">{rating}</span>
              {delta != null && delta !== 0 ? (
                <span className={delta > 0 ? "up" : "down"}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              ) : null}
            </div>
            <p className="streak">Streak {streak ?? 0}</p>
          </>
        ) : null}
      </section>
      <section className="panel-block">
        {puzzle ? <p className="themes">{puzzle.themes.map(themeLabel).join(" ")}</p> : null}
      </section>
    </aside>
  );
}
