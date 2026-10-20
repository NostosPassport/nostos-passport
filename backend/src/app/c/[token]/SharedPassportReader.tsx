"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, TransitionEvent as ReactTransitionEvent } from "react";

import {
  PASSPORT_PAGE_ASPECT,
  STAMP_BOX,
  motifPath,
  ringsFor,
  rosettePath,
  shapePath,
  slotPlacement,
  stampDesign,
  wavePaths,
} from "@/lib/passport-artwork";
import {
  DRAG_ZONE,
  castShade,
  dragPos,
  flipShade,
  settleTarget,
  stepTarget,
  zoneAt,
} from "@/lib/passport-motion";

import styles from "./SharedPassportReader.module.css";

export type SharedPassportStamp = {
  id: string;
  caption: string;
  visitedAt: string;
  verified: boolean;
  page: number;
  slot: number;
  photos: { id: string; url: string }[];
  song: { title: string; artist: string } | null;
  place: {
    id: string;
    name: string;
    neighborhood: string;
    neighborhoodId: string | null;
  };
};

type Props = {
  collectionName: string;
  ownerName: string;
  coverColor: string;
  stamps: SharedPassportStamp[];
};

type TurnDirection = "next" | "prev";
type TurnState = {
  direction: TurnDirection;
  progress: number;
  settling: boolean;
  target: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  lastX: number;
  lastTime: number;
  pageWidth: number;
  from: number;
  direction: TurnDirection;
};

const PAGE_WIDTH = 1000;
const PAGE_HEIGHT = PAGE_WIDTH * PASSPORT_PAGE_ASPECT;
const STAMP_STROKES = { ring: 3, hair: 1.2 } as const;
const STAMP_TEXT = { name: 11, area: 6.5, arcTrack: 1.2, bannerTrack: 1 } as const;

function wantsReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function visitDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function StampArtwork({ stamp }: { stamp: SharedPassportStamp }) {
  const input = {
    placeId: stamp.place.id,
    placeName: stamp.place.name,
    neighborhoodId: stamp.place.neighborhoodId,
    neighborhoodName: stamp.place.neighborhood,
  };
  const design = stampDesign(input);
  const arcId = `stamp-arc-${stamp.id.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const rings = ringsFor(design.border, STAMP_STROKES);
  const textSize = STAMP_TEXT.name * design.nameScale;

  return (
    <svg className={styles.stampSvg} viewBox={`0 0 ${STAMP_BOX} ${STAMP_BOX}`} aria-hidden="true">
      <defs>
        <path id={arcId} d="M 22 60 A 38 38 0 0 1 98 60" />
      </defs>
      <g opacity={design.ink}>
        {rings.map((ring, index) => (
          <path
            key={index}
            d={shapePath(design.shape, ring.inset)}
            fill="none"
            stroke="currentColor"
            strokeWidth={ring.width}
            strokeDasharray={ring.dash?.join(" ")}
            strokeLinecap={ring.round ? "round" : "butt"}
          />
        ))}
        <g transform={`translate(60 ${design.layout === "arc" ? 64 : 46})`}>
          <path d={motifPath(design.motif, design.layout === "arc" ? 15 : 12)} fill="currentColor" />
        </g>
        {design.layout === "arc" ? (
          <text
            fill="currentColor"
            fontFamily="var(--font-serif)"
            fontSize={textSize}
            letterSpacing={STAMP_TEXT.arcTrack}
          >
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
              {design.arcText}
            </textPath>
          </text>
        ) : (
          design.lines.map((line, index) => (
            <text
              key={index}
              x={60}
              y={72 + index * (textSize + 3)}
              fill="currentColor"
              fontFamily="var(--font-serif)"
              fontSize={textSize}
              textAnchor="middle"
              letterSpacing={STAMP_TEXT.bannerTrack}
            >
              {line}
            </text>
          ))
        )}
        <text
          x={60}
          y={design.layout === "arc" ? 100 : 72 + design.lines.length * (textSize + 3) + 3}
          fill="var(--color-muted)"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontSize={STAMP_TEXT.area}
          textAnchor="middle"
        >
          {design.area}
        </text>
      </g>
      {design.speckles.map((speckle, index) => (
        <circle key={index} cx={speckle.cx} cy={speckle.cy} r={speckle.r} fill="var(--color-panel)" opacity={0.9} />
      ))}
    </svg>
  );
}

function PassportPage({
  page,
  side,
  stamps,
  embedded = false,
  onStamp,
  onNavigate,
  emptyMessage,
}: {
  page: number;
  side: "left" | "right";
  stamps: SharedPassportStamp[];
  embedded?: boolean;
  onStamp: (stamp: SharedPassportStamp) => void;
  onNavigate?: () => void;
  emptyMessage?: string;
}) {
  const pattern = useMemo(() => {
    const inset = PAGE_WIDTH * 0.06;
    const band = PAGE_HEIGHT * 0.05;
    return {
      rosette: rosettePath(`page:${page}`, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, PAGE_WIDTH * 0.42),
      waves: wavePaths(`top:${page}`, PAGE_WIDTH - inset * 2, band),
      inset,
      band,
    };
  }, [page]);

  return (
    <div
      className={`${styles.page} ${side === "left" ? styles.pageLeft : styles.pageRight} ${onNavigate ? styles.pageButton : ""}`}
      style={embedded ? { left: 0, width: "100%", height: "100%", borderRadius: 0 } : undefined}
      onClick={onNavigate}
    >
      <svg className={styles.pagePattern} viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`} aria-hidden="true">
        <path d={pattern.rosette} stroke="var(--color-accent)" strokeOpacity={0.07} strokeWidth={0.6} fill="none" />
        {pattern.waves.map((path, index) => (
          <path
            key={index}
            d={path}
            transform={`translate(${pattern.inset} ${pattern.inset})`}
            stroke="var(--color-accent)"
            strokeOpacity={0.14}
            strokeWidth={0.6}
            fill="none"
          />
        ))}
      </svg>
      <div className={styles.innerRule} />
      <div className={side === "left" ? styles.spineRight : styles.spineLeft} />

      {emptyMessage ? <div className={styles.emptyPageLabel}>{emptyMessage}</div> : null}

      {stamps.map((stamp) => {
        const placement = slotPlacement(stamp.id, stamp.slot, PAGE_WIDTH, PAGE_HEIGHT);
        const left = ((placement.cx - placement.size / 2) / PAGE_WIDTH) * 100;
        const top = ((placement.cy - placement.size / 2) / PAGE_HEIGHT) * 100;
        const width = (placement.size / PAGE_WIDTH) * 100;
        const height = (placement.size / PAGE_HEIGHT) * 100;
        return (
          <button
            key={stamp.id}
            type="button"
            className={styles.stampButton}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              transform: `rotate(${placement.rotation}deg)`,
            }}
            aria-label={`${stamp.place.name}, ${stamp.place.neighborhood}${stamp.verified ? ", verified visit" : ""}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onStamp(stamp);
            }}
          >
            <StampArtwork stamp={stamp} />
            {stamp.verified ? <span className={styles.verifiedMark}>N</span> : null}
          </button>
        );
      })}

      <span className={styles.pageNumber}>{page}</span>
    </div>
  );
}

export function SharedPassportReader({ collectionName, ownerName, coverColor, stamps }: Props) {
  const [spread, setSpread] = useState(0);
  const [turn, setTurn] = useState<TurnState | null>(null);
  const [selected, setSelected] = useState<SharedPassportStamp | null>(null);
  const drag = useRef<DragState | null>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const byPage = useMemo(() => {
    const result = new Map<number, SharedPassportStamp[]>();
    for (const stamp of stamps) {
      const page = result.get(stamp.page) ?? [];
      page.push(stamp);
      result.set(stamp.page, page);
    }
    for (const page of result.values()) page.sort((a, b) => a.slot - b.slot);
    return result;
  }, [stamps]);

  const maxPage = Math.max(2, ...stamps.map((stamp) => stamp.page));
  const totalSpreads = Math.max(1, Math.ceil(maxPage / 2));
  const safeSpread = Math.min(spread, totalSpreads - 1);

  useEffect(() => {
    if (!selected) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);

  const finishTurn = (target: number) => {
    setSpread(target);
    setTurn(null);
    drag.current = null;
  };

  const animateTo = (target: number) => {
    if (turn || target === safeSpread || target < 0 || target >= totalSpreads) return;
    if (wantsReducedMotion()) {
      setSpread(target);
      return;
    }
    const direction: TurnDirection = target > safeSpread ? "next" : "prev";
    setTurn({ direction, progress: 0, settling: false, target });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setTurn((current) => current && current.target === target
          ? { ...current, progress: 1, settling: true }
          : current);
      });
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (turn) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pageWidth = rect.width / 2;
    const localX = event.clientX - rect.left;
    const zone = zoneAt(localX, pageWidth, DRAG_ZONE);
    if (!zone) return;
    if (zone === "next" && safeSpread >= totalSpreads - 1) return;
    if (zone === "prev" && safeSpread <= 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    drag.current = {
      pointerId: event.pointerId,
      startX: localX,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      pageWidth,
      from: safeSpread,
      direction: zone,
    };
    setTurn({ direction: zone, progress: 0, settling: false, target: safeSpread });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const pos = dragPos(current.from, current.startX, localX, current.pageWidth, current.direction, totalSpreads);
    current.lastX = event.clientX;
    current.lastTime = event.timeStamp;
    setTurn((state) => state ? { ...state, progress: Math.abs(pos - current.from) } : state);
  };

  const settlePointer = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const pos = dragPos(current.from, current.startX, localX, current.pageWidth, current.direction, totalSpreads);
    const elapsed = Math.max(1, event.timeStamp - current.lastTime);
    const velocity = cancelled ? 0 : ((event.clientX - current.lastX) / elapsed) * 1000;
    const target = cancelled ? current.from : settleTarget(pos, current.from, velocity, current.pageWidth, totalSpreads);
    const targetProgress = target === current.from ? 0 : 1;
    const currentProgress = Math.abs(pos - current.from);
    drag.current = null;

    if (wantsReducedMotion() || Math.abs(targetProgress - currentProgress) < 0.001) {
      finishTurn(target);
      return;
    }
    setTurn((state) => state ? { ...state, progress: targetProgress, settling: true, target } : state);
  };

  const onTurnTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target || event.propertyName !== "transform" || !turn?.settling) return;
    finishTurn(turn.target);
  };

  const currentLeft = safeSpread * 2 + 1;
  const currentRight = currentLeft + 1;
  let baseLeft = currentLeft;
  let baseRight = currentRight;
  let turnFront: { page: number; side: "left" | "right" } | null = null;
  let turnBack: { page: number; side: "left" | "right" } | null = null;

  if (turn?.direction === "next") {
    baseRight = (safeSpread + 1) * 2 + 2;
    turnFront = { page: currentRight, side: "right" };
    turnBack = { page: (safeSpread + 1) * 2 + 1, side: "left" };
  } else if (turn?.direction === "prev") {
    baseLeft = (safeSpread - 1) * 2 + 1;
    turnFront = { page: currentLeft, side: "left" };
    turnBack = { page: (safeSpread - 1) * 2 + 2, side: "right" };
  }

  const cast = turn ? castShade(turn.progress) : 0;
  const castSide = turn?.direction === "next"
    ? (turn.progress < 0.5 ? "right" : "left")
    : (turn?.progress ?? 0) < 0.5 ? "left" : "right";
  const firstVisiblePage = safeSpread * 2 + 1;
  const lastVisiblePage = Math.min(firstVisiblePage + 1, maxPage);

  return (
    <section
      className={styles.readerShell}
      style={{ "--collection-color": coverColor } as CSSProperties}
      aria-label={`${collectionName} shared collection`}
    >
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Shared by {ownerName}</p>
        <h1 className={styles.title}>{collectionName}</h1>
        <div className={styles.meta}>
          <span className={styles.collectionSwatch} aria-hidden="true" />
          <span>{stamps.length} {stamps.length === 1 ? "stamp" : "stamps"}</span>
        </div>
      </div>

      <p className={styles.hint}>Turn the pages, then tap a stamp to open the visit.</p>

      <div className={styles.bookWrap}>
        <div
          ref={bookRef}
          className={styles.book}
          tabIndex={0}
          role="group"
          aria-label={`Passport pages ${firstVisiblePage} through ${lastVisiblePage}`}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") animateTo(stepTarget(safeSpread, 1, totalSpreads));
            if (event.key === "ArrowLeft") animateTo(stepTarget(safeSpread, -1, totalSpreads));
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => settlePointer(event)}
          onPointerCancel={(event) => settlePointer(event, true)}
        >
          <PassportPage
            page={baseLeft}
            side="left"
            stamps={byPage.get(baseLeft) ?? []}
            onStamp={setSelected}
            onNavigate={!turn && safeSpread > 0 ? () => animateTo(safeSpread - 1) : undefined}
            emptyMessage={stamps.length === 0 && baseLeft === 1 ? "No stamps in this collection yet." : undefined}
          />
          <PassportPage
            page={baseRight}
            side="right"
            stamps={byPage.get(baseRight) ?? []}
            onStamp={setSelected}
            onNavigate={!turn && safeSpread < totalSpreads - 1 ? () => animateTo(safeSpread + 1) : undefined}
          />

          {turn && cast > 0 ? (
            <div
              className={`${styles.castShadow} ${castSide === "left" ? styles.castLeft : styles.castRight}`}
              style={{ opacity: cast }}
            />
          ) : null}

          {turn && turnFront && turnBack ? (
            <div
              className={`${styles.turnSheet} ${turn.direction === "next" ? styles.turnNext : styles.turnPrev} ${turn.settling ? styles.turnSettling : ""}`}
              style={{ transform: `rotateY(${turn.direction === "next" ? -180 * turn.progress : 180 * turn.progress}deg)` }}
              onTransitionEnd={onTurnTransitionEnd}
            >
              <div className={styles.turnFace}>
                <PassportPage
                  page={turnFront.page}
                  side={turnFront.side}
                  stamps={byPage.get(turnFront.page) ?? []}
                  embedded
                  onStamp={setSelected}
                />
                <div className={styles.turnShade} style={{ opacity: flipShade(turn.progress) }} />
              </div>
              <div className={`${styles.turnFace} ${styles.turnBack}`}>
                <PassportPage
                  page={turnBack.page}
                  side={turnBack.side}
                  stamps={byPage.get(turnBack.page) ?? []}
                  embedded
                  onStamp={setSelected}
                />
                <div className={styles.turnShade} style={{ opacity: flipShade(turn.progress) }} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.controls} aria-label="Passport page controls">
        <button
          type="button"
          className={styles.controlButton}
          disabled={safeSpread === 0 || !!turn}
          onClick={() => animateTo(safeSpread - 1)}
          aria-label="Previous pages"
        >
          ←
        </button>
        <span className={styles.spreadLabel} aria-live="polite">
          Pages {firstVisiblePage}{lastVisiblePage !== firstVisiblePage ? `–${lastVisiblePage}` : ""} of {maxPage}
        </span>
        <button
          type="button"
          className={styles.controlButton}
          disabled={safeSpread >= totalSpreads - 1 || !!turn}
          onClick={() => animateTo(safeSpread + 1)}
          aria-label="Next pages"
        >
          →
        </button>
      </div>

      {selected ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <article className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="shared-stamp-title">
            <button ref={closeRef} type="button" className={styles.modalClose} onClick={() => setSelected(null)} aria-label="Close visit details">×</button>
            {selected.photos.length > 0 ? (
              <div className={`${styles.photoGrid} ${selected.photos.length === 1 ? styles.photoGridSingle : ""}`}>
                {selected.photos.map((photo) => (
                  <img key={photo.id} src={photo.url} alt={`${selected.place.name} visit`} className={styles.photo} />
                ))}
              </div>
            ) : null}
            <div className={styles.detailBody}>
              <p className={styles.detailEyebrow}>{selected.place.neighborhood} · {visitDate(selected.visitedAt)}</p>
              <h2 id="shared-stamp-title" className={styles.detailTitle}>{selected.place.name}</h2>
              {selected.caption ? <p className={styles.caption}>{selected.caption}</p> : null}
              {selected.song ? (
                <div className={styles.song}>
                  <p className={styles.songTitle}>{selected.song.title}</p>
                  <p className={styles.songArtist}>{selected.song.artist}</p>
                </div>
              ) : null}
              {selected.verified ? <p className={styles.verified}>Verified visit</p> : null}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
