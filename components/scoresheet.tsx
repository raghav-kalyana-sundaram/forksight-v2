"use client";

import { useEffect, useRef, type RefObject } from "react";
import { buildSheet, type Cell as SheetCell } from "@/lib/sheet";
import type { PlayStatus, Variation } from "@/lib/types";

export function Scoresheet({
  history,
  fenPly,
  setupSan,
  attempt,
  status,
  wrongIndex,
  revealed,
  allowNext,
  variations,
  canSubmit,
  canNext,
  checking,
  onSubmit,
  onGiveUp,
  onNext,
}: {
  history: string[];
  fenPly: number;
  setupSan: string;
  attempt: { san: string; strike?: string }[];
  status: PlayStatus;
  wrongIndex: number | null;
  revealed: string | null;
  allowNext: boolean;
  variations: Variation[];
  canSubmit: boolean;
  canNext: boolean;
  checking: boolean;
  onSubmit: () => void;
  onGiveUp: () => void;
  onNext: () => void;
}) {
  const focusRef = useRef<HTMLDivElement | null>(null);
  const blocks = buildSheet({
    history,
    fenPly,
    setupSan,
    attempt,
    status,
    wrongIndex,
    revealed,
    allowNext,
    variations,
  });
  const finished = status === "solved" || status === "gave-up";
  const showSubmit = status === "playing" || status === "checking" || status === "wrong";
  const showGiveUp = status === "playing" || status === "wrong";
  const showNext = canNext || finished;
  const corrected = status === "playing" && attempt.some((move) => move.strike);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "nearest" });
  }, [blocks.length, status, attempt.length, wrongIndex]);

  return (
    <section className="sheet-panel">
      <div className="sheet-scroll">
        <div className="sheet">
          {blocks.map((block, index) => {
            if (block.type === "variation") {
              return (
                <div key={`v-${index}`} className={`variation${block.faded ? " faded" : ""}`}>
                  {block.text}
                </div>
              );
            }
            return (
              <div className="sheet-row" key={`r-${block.number}-${index}`}>
                <div className="num">{block.number}</div>
                <Cell cell={block.white} focusRef={focusRef} />
                <Cell cell={block.black} focusRef={focusRef} />
              </div>
            );
          })}
        </div>
      </div>
      {status === "wrong" ? <p className="again">Try again</p> : null}
      {corrected ? <p className="instead">What if your opponent played this instead?</p> : null}
      {showSubmit ? (
        <button className="submit" type="button" disabled={!canSubmit || checking} onClick={onSubmit}>
          {checking ? "Checking" : "Submit"}
        </button>
      ) : null}
      {finished ? (
        <button className="submit" type="button" onClick={onNext}>
          Next puzzle
        </button>
      ) : null}
      {showGiveUp || (showNext && !finished) ? (
        <div className="actions">
          {showGiveUp ? (
            <button type="button" onClick={onGiveUp}>
              Give up
            </button>
          ) : null}
          {showNext && !finished ? (
            <button type="button" onClick={onNext}>
              Next puzzle
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Cell({
  cell,
  focusRef,
}: {
  cell: SheetCell | null;
  focusRef: RefObject<HTMLDivElement | null>;
}) {
  if (!cell) return <div className="cell empty" />;
  const focus = cell.mark === "current" || cell.mark === "next" || cell.mark === "wrong" || cell.latest;
  return (
    <div className={`cell ${cell.mark}${cell.latest ? " latest" : ""}`} ref={focus ? focusRef : undefined}>
      {cell.strike ? (
        <>
          <s>{cell.strike}</s> ({cell.san})
        </>
      ) : (
        cell.san
      )}
    </div>
  );
}
