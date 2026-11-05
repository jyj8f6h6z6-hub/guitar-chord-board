import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Song } from "../../types/song";
import type { DiagramMode, Spacing } from "../song/LeadSheet";
import { LeadSheet } from "../song/LeadSheet";

export interface PaperSpec {
  value: string;
  label: string;
  /** 列印時使用的紙張名稱（螢幕版面列印時用 A4） */
  name: string;
  /** 橫式紙張尺寸，mm */
  width: number;
  height: number;
  margin: number;
  gap: number;
}

export type ViewMode = "page" | "scroll";

interface StandPreviewProps {
  song: Song;
  symbols?: Readonly<Record<string, string>>;
  diagramMode: DiagramMode;
  diagramWidth: number;
  showMelody: boolean;
  paper: PaperSpec;
  /** 列印字級縮放（只有固定每行個數時會小於 1） */
  scale: number;
  /** 每一欄第一個項目的編號（項目＝圖例塊＋每一列） */
  starts: readonly number[];
  /** 連續接排後的每一列（和弦編號） */
  rows: readonly (readonly number[])[];
  /** 圖例分成幾塊（每塊幾張圖） */
  legendRows: readonly number[];
  spacing: Spacing;
  lyricPt: number;
  printCols: number;
  title: string;
  meta: string;
  viewMode: ViewMode;
  /** 螢幕版面：頁面就是整個畫面，不縮放 */
  actualSize: boolean;
  performing: boolean;
}

interface ColumnPart {
  start: number;
  end: number;
}

const PX_PER_MM = 96 / 25.4;
const SWIPE_DISTANCE = 60;

/** 螢幕上的譜架預覽：一頁一張橫向紙張，左右兩欄，版面與列印結果相同。 */
export function StandPreview({
  song,
  symbols,
  diagramMode,
  diagramWidth,
  showMelody,
  paper,
  scale,
  starts,
  rows,
  legendRows,
  spacing,
  lyricPt,
  printCols,
  title,
  meta,
  viewMode,
  actualSize,
  performing,
}: StandPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1000);
  const [availHeight, setAvailHeight] = useState(() => Math.max(300, window.innerHeight - 130));
  const [pageIndex, setPageIndex] = useState(0);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const paperPx = paper.width * PX_PER_MM;
  const paperPxHeight = paper.height * PX_PER_MM;

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const update = () => {
      setContainerWidth(container.clientWidth);
      setAvailHeight(performing ? window.innerHeight : Math.max(300, window.innerHeight - 130));
    };
    update();
    window.addEventListener("resize", update);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => {
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [performing]);

  const itemCount = rows.length + legendRows.length;

  const columns: ColumnPart[] = starts.map((start, index) => ({
    start,
    end: index + 1 < starts.length ? starts[index + 1] : itemCount,
  }));

  const pages: ColumnPart[][] = [];

  for (let index = 0; index < columns.length; index += 2) {
    pages.push(columns.slice(index, index + 2));
  }

  const current = Math.min(pageIndex, Math.max(0, pages.length - 1));
  const paged = viewMode === "page" || actualSize;

  useEffect(() => {
    if (!paged) {
      return undefined;
    }

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) {
        return;
      }

      if (event.key === "ArrowRight" || event.key === "PageDown") {
        setPageIndex((value) => Math.min(pages.length - 1, Math.min(value, pages.length - 1) + 1));
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setPageIndex((value) => Math.max(0, Math.min(value, pages.length - 1) - 1));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged, pages.length]);

  const zoom = actualSize
    ? 1
    : viewMode === "page"
      ? Math.min(containerWidth / paperPx, availHeight / paperPxHeight)
      : containerWidth / paperPx;
  const clampedZoom = actualSize ? 1 : Math.min(1.5, Math.max(0.2, zoom));

  const go = (delta: number) => setPageIndex(Math.max(0, Math.min(pages.length - 1, current + delta)));

  const onPointerDown = (event: ReactPointerEvent) => {
    swipeStart.current = event.pointerType === "mouse" ? null : { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: ReactPointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;

    if (!start) {
      return;
    }

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1);
    }
  };

  const shown = paged ? pages.slice(current, current + 1) : pages;
  const firstShown = paged ? current : 0;

  return (
    <div
      className={`stand-preview${performing ? " is-performing" : ""}${actualSize ? " is-actual" : ""}`}
      ref={containerRef}
      data-print-cols={printCols > 0 ? printCols : undefined}
      style={{ "--print-scale": scale, "--print-cols": printCols || 1 } as CSSProperties}
    >
      {!performing && (
        <div className="stand-preview__bar">
          <span className="stand-preview__note">
            預覽：{paper.name && !actualSize ? `${paper.name} 橫式` : "螢幕（平板橫放）"}，共 {pages.length} 頁，依序填滿左欄再右欄。
            {actualSize ? "列印時會改用 A4 橫式重新排版。" : "實際列印是白底黑字，版面與這裡相同。"}
          </span>
          {paged && pages.length > 1 && (
            <span className="stand-preview__pager">
              <button type="button" onClick={() => go(-1)} disabled={current <= 0} aria-label="上一頁">
                ◀
              </button>
              <span>
                第 {current + 1} / {pages.length} 頁
              </span>
              <button type="button" onClick={() => go(1)} disabled={current >= pages.length - 1} aria-label="下一頁">
                ▶
              </button>
            </span>
          )}
        </div>
      )}

      <div
        className="stand-preview__pages"
        style={{ zoom: clampedZoom, touchAction: paged ? "pan-y" : undefined }}
        onPointerDown={paged ? onPointerDown : undefined}
        onPointerUp={paged ? onPointerUp : undefined}
        onPointerCancel={paged ? () => (swipeStart.current = null) : undefined}
      >
        {shown.map((page, shownIndex) => {
          const pageNumber = firstShown + shownIndex;

          return (
            <section
              className="stand-page"
              key={pageNumber}
              aria-label={`第 ${pageNumber + 1} 頁`}
              style={{ width: `${paper.width}mm`, height: `${paper.height}mm`, padding: `${paper.margin}mm` }}
            >
              {pageNumber === 0 && (
                <header className="stand-page__header">
                  <h1>{title}</h1>
                  {meta && <p>{meta}</p>}
                </header>
              )}

              <div className="stand-page__cols" style={{ columnGap: `${paper.gap}mm` }}>
                {page.map((part, columnIndex) => (
                  <div className="stand-col" key={columnIndex}>
                    <LeadSheet
                      song={song}
                      symbols={symbols}
                      diagramMode={diagramMode}
                      diagramWidth={diagramWidth}
                      showMelody={showMelody}
                      part={{ ...part, legend: false }}
                      flow
                      spacing={spacing}
                      lyricPt={lyricPt}
                      legendRows={legendRows}
                      rows={rows}
                      stretch
                    />
                  </div>
                ))}
              </div>

              <span className="stand-page__number">
                {pageNumber + 1} / {pages.length}
              </span>
            </section>
          );
        })}
      </div>

      {performing && paged && pages.length > 1 && (
        <div className="stand-preview__perform-pager" aria-hidden="false">
          <button type="button" onClick={() => go(-1)} disabled={current <= 0} aria-label="上一頁">
            ◀
          </button>
          <span>
            {current + 1} / {pages.length}
          </span>
          <button type="button" onClick={() => go(1)} disabled={current >= pages.length - 1} aria-label="下一頁">
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
