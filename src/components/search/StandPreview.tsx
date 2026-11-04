import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Song } from "../../types/song";
import type { DiagramMode } from "../song/LeadSheet";
import { LeadSheet } from "../song/LeadSheet";

interface StandPreviewProps {
  song: Song;
  symbols?: Readonly<Record<string, string>>;
  diagramMode: DiagramMode;
  diagramWidth: number;
  showMelody: boolean;
  /** 紙張（橫式）尺寸，mm */
  paper: { name: string; width: number; height: number };
  margin: number;
  gap: number;
  /** 列印字級（含自動縮小） */
  scale: number;
  /** 每一欄第一個項目的編號（項目＝上方圖例＋每一行譜） */
  starts: readonly number[];
  hasLegend: boolean;
  printCols: number;
  title: string;
  meta: string;
}

interface ColumnPart {
  start: number;
  end: number;
  legend: boolean;
}

/** 螢幕上的譜架預覽：一頁一張橫向紙張，左右兩欄，版面與列印結果相同。 */
export function StandPreview({
  song,
  symbols,
  diagramMode,
  diagramWidth,
  showMelody,
  paper,
  margin,
  gap,
  scale,
  starts,
  hasLegend,
  printCols,
  title,
  meta,
}: StandPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const paperPx = (paper.width * 96) / 25.4;

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    const update = () => setZoom(Math.min(1.5, Math.max(0.2, container.clientWidth / paperPx)));
    update();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [paperPx]);

  const offset = hasLegend ? 1 : 0;
  const lineCount = song.lines.length;
  const itemCount = lineCount + offset;

  const columns: ColumnPart[] = starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : itemCount;
    return {
      start: Math.max(0, start - offset),
      end: Math.max(0, end - offset),
      legend: hasLegend && start === 0,
    };
  });

  const pages: ColumnPart[][] = [];

  for (let index = 0; index < columns.length; index += 2) {
    pages.push(columns.slice(index, index + 2));
  }

  return (
    <div
      className="stand-preview"
      ref={containerRef}
      data-print-cols={printCols > 0 ? printCols : undefined}
      style={{ "--print-scale": scale, "--print-cols": printCols || 1 } as CSSProperties}
    >
      <p className="stand-preview__note">
        預覽：{paper.name} 橫式，共 {pages.length} 頁，左右兩欄平均分配。實際列印是白底黑字，版面與這裡相同。
      </p>

      <div className="stand-preview__pages" style={{ zoom }}>
        {pages.map((page, pageIndex) => (
          <section
            className="stand-page"
            key={pageIndex}
            aria-label={`第 ${pageIndex + 1} 頁`}
            style={{ width: `${paper.width}mm`, height: `${paper.height}mm`, padding: `${margin}mm` }}
          >
            {pageIndex === 0 && (
              <header className="stand-page__header">
                <h1>{title}</h1>
                {meta && <p>{meta}</p>}
              </header>
            )}

            <div className="stand-page__cols" style={{ columnGap: `${gap}mm` }}>
              {page.map((part, columnIndex) => (
                <div className="stand-col" key={columnIndex}>
                  <LeadSheet
                    song={song}
                    symbols={symbols}
                    diagramMode={diagramMode}
                    diagramWidth={diagramWidth}
                    showMelody={showMelody}
                    part={part}
                  />
                </div>
              ))}
            </div>

            <span className="stand-page__number">
              {pageIndex + 1} / {pages.length}
            </span>
          </section>
        ))}
      </div>
    </div>
  );
}
