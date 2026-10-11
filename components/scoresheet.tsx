"use client";

import { useEffect, useRef, type RefObject } from "react";
import { buildSheet, type Mark } from "@/lib/sheet";
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
  checking,
  canGiveUp,
  canContinue,
  onSubmit,
  onGiveUp,
  onNext,
  onContinue,
}: {
  history: string[];
  fenPly: number;
  setupSan: string;
  attempt: string[];
  status: PlayStatus;
  wrongIndex: number | null;
  revealed: string | null;
  allowNext: boolean;
  variations: Variation[];
  canSubmit: boolean;
  checking: boolean;
  canGiveUp: boolean;
  canContinue: boolean;
  onSubmit: () => void;
  onGiveUp: () => void;
  onNext: () => void;
  onContinue: () => void;
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
      <button className="submit" type="button" disabled={!canSubmit} onClick={onSubmit}>
        {checking ? "Checking" : "Submit"}
      </button>
      <div className="actions">
        <button type="button" disabled={!canGiveUp} onClick={onGiveUp}>
          Give up
        </button>
        <button type="button" disabled={checking} onClick={onNext}>
          Next puzzle
        </button>
        <button type="button" disabled={!canContinue} onClick={onContinue}>
          Continue
        </button>
      </div>
    </section>
  );
}

function Cell({
  cell,
  focusRef,
}: {
  cell: { san: string | null; mark: Mark } | null;
  focusRef: RefObject<HTMLDivElement | null>;
}) {
  if (!cell) return <div className="cell empty" />;
  const focus = cell.mark === "current" || cell.mark === "next" || cell.mark === "wrong";
  return (
    <div
      className={`cell ${cell.mark}`}
      ref={focus ? focusRef : undefined}
    >
      {cell.san}
    </div>
  );
}
