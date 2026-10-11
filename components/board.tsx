"use client";

/* eslint-disable @next/next/no-img-element */

import { Chess, type PieceSymbol, type Square } from "chess.js";
import { useMemo, useRef, useState } from "react";

type Orientation = "white" | "black";
type Piece = { color: "w" | "b"; type: string; square: string };

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

function pieceSrc(color: string, type: string) {
  return `/pieces/${color}${type.toUpperCase()}.svg`;
}

function squareCoords(square: string, orientation: Orientation) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const x = orientation === "white" ? file : 7 - file;
  const y = orientation === "white" ? 7 - rank : rank;
  return { x, y };
}

function squareFromPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  orientation: Orientation,
): string | null {
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  if (px < 0 || py < 0 || px >= rect.width || py >= rect.height) return null;
  const file = Math.min(7, Math.floor((px / rect.width) * 8));
  const rankFromTop = Math.min(7, Math.floor((py / rect.height) * 8));
  if (orientation === "white") return `${FILES[file]}${8 - rankFromTop}`;
  return `${FILES[7 - file]}${rankFromTop + 1}`;
}

function piecesFromFen(fen: string): Piece[] {
  const chess = new Chess(fen);
  const board = chess.board();
  const pieces: Piece[] = [];
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file];
      if (!piece) continue;
      pieces.push({
        color: piece.color,
        type: piece.type,
        square: `${FILES[file]}${8 - rank}`,
      });
    }
  }
  return pieces;
}

export function Board({
  visualFen,
  hiddenFen,
  orientation,
  lastMove,
  interactive,
  onMove,
}: {
  visualFen: string;
  hiddenFen: string;
  orientation: Orientation;
  lastMove: [string, string] | null;
  interactive: boolean;
  onMove: (uci: string) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLImageElement>(null);
  const animRef = useRef<Animation | null>(null);
  const dragRef = useRef<{
    from: string;
    type: string;
    color: "w" | "b";
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [trackedFen, setTrackedFen] = useState(hiddenFen);
  const [grabbing, setGrabbing] = useState(false);
  const [lifted, setLifted] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ type: string; color: "w" | "b"; from: string } | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string; color: "w" | "b" } | null>(null);

  const hidden = useMemo(() => new Chess(hiddenFen), [hiddenFen]);
  const pieces = useMemo(() => piecesFromFen(visualFen), [visualFen]);
  const turn = hidden.turn();

  if (trackedFen !== hiddenFen) {
    setTrackedFen(hiddenFen);
    setSelected(null);
    setPromo(null);
  }

  function hideMatching(square: string, color: "w" | "b", type: string) {
    const visual = pieces.find((piece) => piece.square === square);
    setLifted(visual && visual.color === color && visual.type === type ? square : null);
  }

  function placeGhost(clientX: number, clientY: number) {
    const board = boardRef.current;
    const ghostEl = ghostRef.current;
    if (!board || !ghostEl) return;
    const rect = board.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    ghostEl.style.left = `${x}%`;
    ghostEl.style.top = `${y}%`;
  }

  function snapBack(from: string) {
    const ghostEl = ghostRef.current;
    const board = boardRef.current;
    if (!ghostEl || !board) {
      setGhost(null);
      setLifted(null);
      setGrabbing(false);
      return;
    }
    const { x, y } = squareCoords(from, orientation);
    const anim = ghostEl.animate(
      [
        {
          left: ghostEl.style.left,
          top: ghostEl.style.top,
          transform: "translate(-50%, -50%) scale(1.18)",
        },
        {
          left: `${(x + 0.5) * 12.5}%`,
          top: `${(y + 0.5) * 12.5}%`,
          transform: "translate(-50%, -50%) scale(1)",
        },
      ],
      { duration: 160, easing: "cubic-bezier(.22,.7,.3,1)" },
    );
    animRef.current = anim;
    anim.onfinish = () => {
      if (animRef.current !== anim) return;
      animRef.current = null;
      setGhost(null);
      setLifted(null);
      setGrabbing(false);
    };
  }

  function beginDrag(square: string, piece: { color: "w" | "b"; type: string }, event: React.PointerEvent) {
    const previous = animRef.current;
    animRef.current = null;
    previous?.cancel();
    dragRef.current = {
      from: square,
      type: piece.type,
      color: piece.color,
      moved: false,
      pointerId: event.pointerId,
    };
    setGhost({ type: piece.type, color: piece.color, from: square });
    setGrabbing(true);
    hideMatching(square, piece.color, piece.type);
    boardRef.current?.setPointerCapture(event.pointerId);
    requestAnimationFrame(() => placeGhost(event.clientX, event.clientY));
  }

  function finishMove(from: string, to: string) {
    const options = hidden
      .moves({ square: from as Square, verbose: true })
      .filter((move) => move.to === to);
    if (options.length === 0) {
      snapBack(from);
      setSelected(null);
      return;
    }
    if (options.some((move) => move.promotion)) {
      const piece = hidden.get(from as Square);
      snapBack(from);
      setSelected(null);
      if (piece) setPromo({ from, to, color: piece.color });
      return;
    }
    onMove(`${from}${to}`);
    snapBack(from);
    setSelected(null);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".promo")) return;
    if (promo) {
      setPromo(null);
      return;
    }
    if (!interactive) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const square = squareFromPoint(event.clientX, event.clientY, rect, orientation);
    if (!square) return;
    const piece = hidden.get(square as Square);
    if (piece && piece.color === turn) {
      beginDrag(square, piece, event);
      return;
    }
    if (selected) finishMove(selected, square);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.moved = true;
    placeGhost(event.clientX, event.clientY);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const rect = boardRef.current?.getBoundingClientRect();
    const square = rect ? squareFromPoint(event.clientX, event.clientY, rect, orientation) : null;
    if (!drag.moved) {
      setSelected((current) => (current === drag.from ? null : drag.from));
      snapBack(drag.from);
      return;
    }
    if (!square || square === drag.from) {
      snapBack(drag.from);
      return;
    }
    finishMove(drag.from, square);
  }

  const squares = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    for (const file of FILES) {
      const square = `${file}${rank}`;
      const { x, y } = squareCoords(square, orientation);
      const light = (file.charCodeAt(0) + rank) % 2 === 1;
      const marked = lastMove?.includes(square);
      const isSelected = selected === square;
      const showRank = orientation === "white" ? file === "a" : file === "h";
      const showFile = orientation === "white" ? rank === 1 : rank === 8;
      squares.push(
        <div
          key={square}
          className={`sq ${light ? "light" : "dark"}${marked ? " last" : ""}${isSelected ? " selected" : ""}`}
          style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%` }}
        >
          {showRank ? <span className="coord rank">{rank}</span> : null}
          {showFile ? <span className="coord file">{file}</span> : null}
        </div>,
      );
    }
  }

  return (
    <div
      className={`board${grabbing ? " grabbing" : ""}`}
      ref={boardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(event) => event.preventDefault()}
      aria-label="Chess board"
    >
      {squares}
      {pieces.map((piece) => {
        const { x, y } = squareCoords(piece.square, orientation);
        return (
          <img
            key={`${piece.square}${piece.color}${piece.type}`}
            className={`piece${lifted === piece.square ? " lifted" : ""}`}
            src={pieceSrc(piece.color, piece.type)}
            alt=""
            draggable={false}
            style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%` }}
          />
        );
      })}
      {ghost ? (
        <img
          ref={ghostRef}
          className="ghost"
          src={pieceSrc(ghost.color, ghost.type)}
          alt=""
          draggable={false}
          style={ghostOrigin(ghost.from, orientation)}
        />
      ) : null}
      {promo ? (
        <div
          className="promo"
          style={promoStyle(promo.to, orientation)}
        >
          {(["q", "r", "b", "n"] as PieceSymbol[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onMove(`${promo.from}${promo.to}${type}`);
                setPromo(null);
              }}
            >
              <img src={pieceSrc(promo.color, type)} alt="" draggable={false} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ghostOrigin(square: string, orientation: Orientation): { left: string; top: string } {
  const { x, y } = squareCoords(square, orientation);
  return { left: `${(x + 0.5) * 12.5}%`, top: `${(y + 0.5) * 12.5}%` };
}

function promoStyle(square: string, orientation: Orientation): { left: string; top: string } {
  const { x, y } = squareCoords(square, orientation);
  const top = y < 4 ? y * 12.5 : (y - 3) * 12.5;
  return { left: `${x * 12.5}%`, top: `${top}%` };
}
