import { useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import {
  KEY_OPTIONS,
  getTranspositionSemitones,
  keyPrefersFlats,
  transposeChordSymbol,
} from "../../services/chordTranspose";
import { allItems, countItems, effectiveSections, hasMelody, songMeta } from "../../services/songModel";
import type { Song } from "../../types/song";
import { ChordCard } from "../chord/ChordCard";
import type { DiagramMode, DiagramSize } from "../song/LeadSheet";
import { DIAGRAM_MODE_LABELS, DIAGRAM_SIZES, LeadSheet } from "../song/LeadSheet";
import { StandPreview } from "./StandPreview";

type OverviewLayout = "lead" | "cards" | "unique";

/** 列印字級（倍率）；用 CSS zoom 整體放大，圖、字、線條一起變大。 */
const PRINT_SCALES: readonly { value: number; label: string }[] = [
  { value: 1, label: "標準" },
  { value: 1.3, label: "大" },
  { value: 1.6, label: "特大" },
];

/** 列印時每一行最多排幾個和弦（0 = 自動換行）；固定時每欄等寬，小節線上下對齊。 */
const PRINT_COLUMNS: readonly { value: number; label: string }[] = [
  { value: 0, label: "自動" },
  { value: 4, label: "4" },
  { value: 6, label: "6" },
  { value: 8, label: "8" },
];

/** 列印紙張：預設＝瀏覽器的設定；A3／A4 橫式＝左右兩欄（譜架用）。尺寸單位 mm。 */
type PrintPaper = "default" | "a3" | "a4";

const PRINT_PAPERS: readonly { value: PrintPaper; label: string; name: string; width: number; height: number }[] = [
  { value: "default", label: "預設", name: "", width: 0, height: 0 },
  { value: "a3", label: "A3 橫式（譜架）", name: "A3", width: 420, height: 297 },
  { value: "a4", label: "A4 橫式", name: "A4", width: 297, height: 210 },
];

const PAPER_MARGIN_MM = 12;
const PAPER_GAP_MM = 12;
const MIN_FIT = 0.55;

/**
 * 算出整體要再縮小多少，才能讓每一行和弦都排在同一排、不掉到下一排。
 * 量的是畫面上每行「不換行」時的自然寬度，與一欄的寬度相比。
 */
function computeFit(box: HTMLElement, paperWidthMm: number, scale: number): number {
  const pxPerMm = 96 / 25.4;
  const columnPx = ((paperWidthMm - 2 * PAPER_MARGIN_MM - PAPER_GAP_MM) / 2) * pxPerMm - 40;
  let worst = 1;

  box.querySelectorAll<HTMLElement>(".lead-line").forEach((line) => {
    const cells = line.querySelector<HTMLElement>(".lead-line__cells");

    if (!cells) {
      return;
    }

    const previous = cells.style.cssText;
    cells.style.cssText = `${previous};flex-wrap:nowrap;width:max-content`;
    const natural = cells.getBoundingClientRect().width;
    cells.style.cssText = previous;

    const fontSize = parseFloat(getComputedStyle(line).fontSize) || 16;
    const total = natural + 3.4 * fontSize + 20;
    worst = Math.min(worst, (columnPx / (total * scale)) * 0.97);
  });

  return Math.max(MIN_FIT, Math.min(1, worst));
}

export interface ColumnPlan {
  /** 每一欄第一個項目的編號（項目＝上方圖例＋每一行譜） */
  starts: number[];
  /** 項目 0 是否為上方圖例 */
  hasLegend: boolean;
  items: HTMLElement[];
  /** 每個項目下方額外的間距（px，未乘列印字級），用來把每一欄的行距拉開、填滿欄高 */
  margins: number[];
}

/**
 * 把每一行譜分配到各欄，讓每一頁左右兩欄的高度盡量相同（最後一頁也是）。
 * 先量每個項目（譜行、圖例）在列印時的高度，用動態規劃找出「最高那一欄最矮」的分法。
 * 高度估計偏保守（+10%），寧可欄底留白也不溢出。
 */
function planColumns(
  box: HTMLElement,
  paper: { width: number; height: number },
  scale: number,
  printCols: number,
): ColumnPlan | null {
  const sheet = box.querySelector<HTMLElement>(".lead-sheet");

  if (!sheet) {
    return null;
  }

  const items = Array.from(sheet.children) as HTMLElement[];
  const hasLegend = items[0]?.classList.contains("lead-legend") ?? false;
  const pxPerMm = 96 / 25.4;
  const columnPx = ((paper.width - 2 * PAPER_MARGIN_MM - PAPER_GAP_MM) / 2) * pxPerMm;
  const pageHeight = (paper.height - 2 * PAPER_MARGIN_MM) * pxPerMm;

  // 列印時的版面：標題在第一頁佔掉一塊高度
  const header = document.querySelector<HTMLElement>(".print-header");
  let headerHeight = 110;

  if (header) {
    const previous = header.style.cssText;
    header.style.cssText = `${previous};display:block`;
    headerHeight = header.getBoundingClientRect().height + 24;
    header.style.cssText = previous;
  }

  // 暫時套上接近列印時的尺寸與版面來量高度
  const saved = new Map<HTMLElement, string>();
  const remember = (element: HTMLElement) => {
    if (!saved.has(element)) {
      saved.set(element, element.style.cssText);
    }
  };

  remember(box);
  remember(sheet);
  box.style.width = `${columnPx / scale}px`;
  sheet.style.cssText += ";padding:0;border:0;display:block";

  const gridStyle =
    printCols > 0 ? `;display:grid;grid-template-columns:repeat(${printCols},minmax(max-content,1fr));align-items:end` : "";

  items.forEach((item) => {
    remember(item);

    if (item.classList.contains("lead-line")) {
      item.style.cssText += ";grid-template-columns:3.4em 1fr;gap:4px;padding:4px 2px";
      const cells = item.querySelector<HTMLElement>(".lead-line__cells");

      if (cells) {
        remember(cells);
        cells.style.cssText += gridStyle;
      }
    }
  });

  const heights = items.map((item) => (item.getBoundingClientRect().height + 6) * scale * 1.1);

  saved.forEach((css, element) => {
    element.style.cssText = css;
  });

  const capacity = (column: number) => (column < 2 ? pageHeight - headerHeight : pageHeight) * 0.97;

  // 先用「依序塞滿」算出需要幾欄，湊成偶數（左右各一欄＝一頁）
  let used = 0;
  let columns = 1;

  heights.forEach((height) => {
    if (used > 0 && used + height > capacity(columns - 1)) {
      columns += 1;
      used = 0;
    }

    used += height;
  });

  columns += columns % 2;
  columns = Math.min(columns, items.length);

  if (columns < 2 || items.length < 2) {
    return { starts: [0], hasLegend, items, margins: spreadMargins(heights, [0], capacity, scale) };
  }

  // 動態規劃：把 items 依序切成 columns 段，使最高的一段最矮
  const prefix = [0];
  heights.forEach((height) => prefix.push(prefix[prefix.length - 1] + height));
  const count = items.length;
  const best: number[][] = Array.from({ length: columns + 1 }, () => new Array(count + 1).fill(Infinity));
  const cut: number[][] = Array.from({ length: columns + 1 }, () => new Array(count + 1).fill(0));
  best[0][0] = 0;

  for (let column = 1; column <= columns; column += 1) {
    for (let end = column; end <= count; end += 1) {
      for (let start = column - 1; start < end; start += 1) {
        const sum = prefix[end] - prefix[start];

        if (sum > capacity(column - 1) && end - start > 1) {
          continue;
        }

        const value = Math.max(best[column - 1][start], sum);

        if (value < best[column][end]) {
          best[column][end] = value;
          cut[column][end] = start;
        }
      }
    }
  }

  if (!Number.isFinite(best[columns][count])) {
    return { starts: [0], hasLegend, items, margins: spreadMargins(heights, [0], capacity, scale) };
  }

  const starts: number[] = [];

  for (let column = columns, end = count; column >= 1; column -= 1) {
    const start = cut[column][end];
    starts.push(start);
    end = start;
  }

  starts.reverse();
  return { starts, hasLegend, items, margins: spreadMargins(heights, starts, capacity, scale) };
}

/**
 * 每一欄把剩下的高度平均加到行與行之間，讓這一欄的行距拉開、填滿欄高。
 * 每個間距最多拉到該欄項目平均高度的 2.5 倍，避免行數很少時間距大得誇張。
 */
function spreadMargins(
  heights: readonly number[],
  starts: readonly number[],
  capacity: (column: number) => number,
  scale: number,
): number[] {
  const margins = heights.map(() => 0);

  starts.forEach((start, column) => {
    const end = column + 1 < starts.length ? starts[column + 1] : heights.length;
    const count = end - start;

    if (count < 2) {
      return;
    }

    const used = heights.slice(start, end).reduce((sum, height) => sum + height, 0);
    const free = capacity(column) - used;

    if (free <= 0) {
      return;
    }

    const average = used / count;
    const extra = Math.min(free / (count - 1), average * 2.5);

    for (let index = start; index < end - 1; index += 1) {
      margins[index] = extra / scale;
    }
  });

  return margins;
}

/** 列印用：在每欄第一個項目前插入強制換欄。傳回還原函式。 */
function applyColumnBreaks(box: HTMLElement, plan: ColumnPlan): () => void {
  plan.starts.slice(1).forEach((index) => {
    plan.items[index].style.breakBefore = "column";
  });

  plan.items.forEach((item, index) => {
    if (plan.margins[index] > 0) {
      item.style.marginBottom = `${6 + plan.margins[index]}px`;
    }
  });

  if (plan.starts.length > 1) {
    box.style.columnFill = "auto";
  }

  return () => {
    plan.items.forEach((item) => {
      item.style.breakBefore = "";
      item.style.marginBottom = "";
    });
    box.style.columnFill = "";
  };
}

/**
 * 譜架版面：先依寬度算出縮小係數（整行不換排），再排欄；
 * 如果只要再縮小一點（最多 15%）就能少用一頁，就縮小，避免「這一頁下面還有大片空白就換頁」。
 */
function computeStandLayout(
  box: HTMLElement,
  paper: { width: number; height: number },
  printScale: number,
  printFit: boolean,
  printCols: number,
): { scale: number; plan: ColumnPlan } | null {
  let scale = printFit ? printScale * computeFit(box, paper.width, printScale) : printScale;
  let plan = planColumns(box, paper, scale, printCols);

  if (!plan) {
    return null;
  }

  const pagesOf = (value: ColumnPlan) => Math.max(1, Math.ceil(value.starts.length / 2));

  if (pagesOf(plan) > 1) {
    for (const factor of [0.97, 0.94, 0.91, 0.88, 0.85]) {
      const candidate = planColumns(box, paper, scale * factor, printCols);

      if (candidate && pagesOf(candidate) < pagesOf(plan)) {
        scale *= factor;
        plan = candidate;
        break;
      }
    }
  }

  return { scale, plan };
}

const LAYOUT_LABELS: Record<OverviewLayout, string> = {
  lead: "簡譜風格",
  cards: "和弦圖卡片",
  unique: "不重複和弦",
};

function keyDisplay(key: string): string {
  return KEY_OPTIONS.find((option) => option.value === key)?.label ?? key;
}

interface SongChordOverviewProps {
  song: Song;
  onApplyTransposition: (symbols: readonly string[], newKey: string) => void;
  onKeyChange: (key: string) => void;
  onPerform: () => void;
}

export function SongChordOverview({ song, onApplyTransposition, onKeyChange, onPerform }: SongChordOverviewProps) {
  const sourceKey = song.key ?? "C";
  const setSourceKey = onKeyChange;
  const [targetKey, setTargetKey] = useState("D");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [layout, setLayout] = usePersistentState<OverviewLayout>("guitar-chord-board:overview-layout", "lead");
  const [diagramSize, setDiagramSize] = usePersistentState<DiagramSize>("guitar-chord-board:diagram-size", "medium");
  const [diagramMode, setDiagramMode] = usePersistentState<DiagramMode>("guitar-chord-board:diagram-mode", "legend");
  const [printScale, setPrintScale] = usePersistentState<number>("guitar-chord-board:print-scale", 1.3);
  const [printCols, setPrintCols] = usePersistentState<number>("guitar-chord-board:print-cols", 0);
  const [showMelody, setShowMelody] = usePersistentState<boolean>("guitar-chord-board:show-melody", true);
  const [printPaper, setPrintPaper] = usePersistentState<PrintPaper>("guitar-chord-board:print-paper", "default");
  const [printFit, setPrintFit] = usePersistentState<boolean>("guitar-chord-board:print-fit", true);
  const boxRef = useRef<HTMLDivElement>(null);
  const [standPlan, setStandPlan] = useState<{ scale: number; starts: number[]; hasLegend: boolean; margins: number[] } | null>(null);
  const songHasMelody = hasMelody(song);
  const paper = PRINT_PAPERS.find((option) => option.value === printPaper) ?? PRINT_PAPERS[0];
  const standMode = paper.value !== "default" && layout === "lead";

  // 譜架模式：列印前量每一行的寬度，必要時整體縮小（讓每行和弦排在同一排），
  // 再把各行分配到左右兩欄、每頁平均；列印後還原。
  useEffect(() => {
    const box = boxRef.current;

    if (!standMode || !box) {
      return undefined;
    }

    let restore: (() => void) | null = null;

    const after = () => {
      restore?.();
      restore = null;
      box.style.setProperty("--print-scale", String(printScale));
    };

    const before = () => {
      after();
      const layoutResult = computeStandLayout(box, paper, printScale, printFit, printCols);
      const effective = layoutResult?.scale ?? printScale;
      box.style.setProperty("--print-scale", String(effective));
      restore = layoutResult ? applyColumnBreaks(box, layoutResult.plan) : null;
    };

    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);

    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      after();
    };
  }, [standMode, printFit, printScale, paper, song, layout, printCols]);

  const items = useMemo(() => allItems(song), [song]);
  const printMeta = songMeta(isPreviewing ? { ...song, key: targetKey } : song);
  const total = countItems(song);
  const sections = effectiveSections(song);

  const transposedSymbols = useMemo(() => {
    const semitones = getTranspositionSemitones(sourceKey, targetKey);
    const preferFlats = keyPrefersFlats(targetKey);
    return items.map((item) => transposeChordSymbol(item.symbol, semitones, preferFlats));
  }, [items, sourceKey, targetKey]);

  const symbolById = useMemo(() => {
    if (!isPreviewing) return undefined;
    return Object.fromEntries(items.map((item, index) => [item.id, transposedSymbols[index]]));
  }, [isPreviewing, items, transposedSymbols]);

  const displayed = (itemId: string, fallback: string) => symbolById?.[itemId] ?? fallback;

  // 譜架預覽：量好每一行的寬度、決定縮小多少與各欄放哪些行（與列印時同一套算法）。
  useEffect(() => {
    const box = boxRef.current;

    if (!standMode || !box) {
      setStandPlan(null);
      return undefined;
    }

    let cancelled = false;

    const compute = () => {
      if (cancelled) {
        return;
      }

      const layoutResult = computeStandLayout(box, paper, printScale, printFit, printCols);
      setStandPlan(
        layoutResult
          ? {
              scale: layoutResult.scale,
              starts: layoutResult.plan.starts,
              hasLegend: layoutResult.plan.hasLegend,
              margins: layoutResult.plan.margins,
            }
          : null,
      );
    };

    compute();
    void document.fonts?.ready.then(compute);

    return () => {
      cancelled = true;
    };
  }, [standMode, printFit, printScale, paper, song, layout, printCols, diagramMode, diagramSize, showMelody, symbolById]);


  const uniqueEntries = useMemo(() => {
    const seen = new Map<string, { symbol: string; shapeId?: string; count: number }>();

    for (const item of items) {
      const symbol = displayed(item.id, item.symbol);
      const existing = seen.get(symbol);

      if (existing) {
        existing.count += 1;
      } else {
        seen.set(symbol, { symbol, shapeId: isPreviewing ? undefined : item.shapeId, count: 1 });
      }
    }

    return [...seen.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, symbolById, isPreviewing]);

  function applyTransposition() {
    if (!isPreviewing || sourceKey === targetKey) return;

    onApplyTransposition(transposedSymbols, targetKey);
    setIsPreviewing(false);
  }

  function restoreOriginalKey() {
    setTargetKey(sourceKey);
    setIsPreviewing(false);
  }

  return (
    <section className="workspace workspace--overview" aria-labelledby="overview-mode-title">
      <div className="workspace__intro">
        <p className="eyebrow">和弦編排・第二步</p>
        <h2 id="overview-mode-title">總覽與移調</h2>
      </div>

      <div className="print-only print-header">
        <h1>{song.title.trim() || "和弦譜"}</h1>
        {printMeta && (
          <p>
            {printMeta}
            {isPreviewing && sourceKey !== targetKey ? `（原調 ${keyDisplay(sourceKey)}）` : ""}
          </p>
        )}
      </div>

      <div className="overview-toolbar">
        <div className="segmented-control" role="group" aria-label="總覽排版">
          {(Object.keys(LAYOUT_LABELS) as OverviewLayout[]).map((key) => (
            <button
              key={key}
              type="button"
              className={layout === key ? "is-active" : ""}
              aria-pressed={layout === key}
              onClick={() => setLayout(key)}
            >
              {LAYOUT_LABELS[key]}
            </button>
          ))}
        </div>

        {layout === "lead" && (
          <div className="segmented-control" role="group" aria-label="和弦按法圖">
            {(Object.keys(DIAGRAM_MODE_LABELS) as DiagramMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={diagramMode === mode ? "is-active" : ""}
                aria-pressed={diagramMode === mode}
                onClick={() => setDiagramMode(mode)}
                title={mode === "off" ? "熟悉之後可以關掉按法圖" : undefined}
              >
                {DIAGRAM_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        )}

        {layout === "lead" && diagramMode !== "off" && (
          <div className="segmented-control" role="group" aria-label="和弦圖大小">
            {(Object.keys(DIAGRAM_SIZES) as DiagramSize[]).map((size) => (
              <button
                key={size}
                type="button"
                className={diagramSize === size ? "is-active" : ""}
                aria-pressed={diagramSize === size}
                onClick={() => setDiagramSize(size)}
              >
                圖{DIAGRAM_SIZES[size].label}
              </button>
            ))}
          </div>
        )}

        {layout === "lead" && songHasMelody && (
          <div className="segmented-control" role="group" aria-label="簡譜旋律">
            <button type="button" className={showMelody ? "is-active" : ""} aria-pressed={showMelody} onClick={() => setShowMelody(true)}>
              顯示旋律
            </button>
            <button type="button" className={!showMelody ? "is-active" : ""} aria-pressed={!showMelody} onClick={() => setShowMelody(false)}>
              只看和弦歌詞
            </button>
          </div>
        )}

        <div className="segmented-control" role="group" aria-label="列印字級">
          <span className="segmented-control__label">列印字級</span>
          {PRINT_SCALES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={printScale === option.value ? "is-active" : ""}
              aria-pressed={printScale === option.value}
              onClick={() => setPrintScale(option.value)}
              title="只影響列印／存成 PDF，不改變畫面"
            >
              {option.label}
            </button>
          ))}
        </div>

        {layout === "lead" && (
          <div className="segmented-control" role="group" aria-label="列印每行和弦數">
            <span className="segmented-control__label">列印每行</span>
            {PRINT_COLUMNS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={printCols === option.value ? "is-active" : ""}
                aria-pressed={printCols === option.value}
                onClick={() => setPrintCols(option.value)}
                title="列印時每一行最多排幾個和弦；固定後每欄等寬、小節線對齊（只影響列印）"
              >
                {option.value === 0 ? "自動" : `${option.label} 個`}
              </button>
            ))}
          </div>
        )}

        {layout === "lead" && (
          <div className="segmented-control" role="group" aria-label="列印紙張">
            <span className="segmented-control__label">列印紙張</span>
            {PRINT_PAPERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={printPaper === option.value ? "is-active" : ""}
                aria-pressed={printPaper === option.value}
                onClick={() => setPrintPaper(option.value)}
                title={
                  option.value === "default"
                    ? "使用瀏覽器列印視窗裡的紙張設定"
                    : "橫放、左右兩欄，一行不會被切在兩欄之間；列印視窗的「每張工作表頁數」請保持 1"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {standMode && (
          <div className="segmented-control" role="group" aria-label="整行不換排">
            <button
              type="button"
              className={printFit ? "is-active" : ""}
              aria-pressed={printFit}
              onClick={() => setPrintFit(!printFit)}
              title="列印時自動縮小，讓每一行的和弦都排在同一排，不會有和弦掉到下一排"
            >
              整行不換排（自動縮小）
            </button>
          </div>
        )}

        <div className="overview-toolbar__actions">
          <button type="button" className="ghost-button" onClick={onPerform} disabled={total === 0}>
            進入演奏模式
          </button>
          <button type="button" className="ghost-button" onClick={() => window.print()} disabled={total === 0}>
            列印／存成 PDF
          </button>
        </div>
      </div>

      <section className="overview-transpose-panel" aria-labelledby="overview-transpose-title">
        <div className="overview-transpose-panel__heading">
          <div>
            <p className="eyebrow">移調</p>
            <h3 id="overview-transpose-title">調整歌曲調性</h3>
          </div>

          {isPreviewing && sourceKey !== targetKey && (
            <span className="overview-transpose-status">
              預覽中：{sourceKey} → {targetKey}
            </span>
          )}
        </div>

        <div className="overview-transpose-controls">
          <label className="overview-key-field" htmlFor="overview-source-key">
            <span className="overview-key-field__label">
              <span aria-hidden="true">♫</span>
              原調
            </span>
            <select
              id="overview-source-key"
              value={sourceKey}
              onChange={(event) => {
                setSourceKey(event.target.value);
                setIsPreviewing(false);
              }}
            >
              {KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <span className="overview-transpose-arrow" aria-hidden="true">
            →
          </span>

          <label className="overview-key-field" htmlFor="overview-target-key">
            <span className="overview-key-field__label">
              <span aria-hidden="true">⇄</span>
              目標調
            </span>
            <select
              id="overview-target-key"
              value={targetKey}
              onChange={(event) => {
                setTargetKey(event.target.value);
                setIsPreviewing(false);
              }}
            >
              {KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overview-transpose-actions">
          <button type="button" className="primary-button" onClick={() => setIsPreviewing(true)} disabled={total === 0}>
            預覽移調
          </button>
          <button
            type="button"
            className="secondary-button transpose-apply-button"
            onClick={applyTransposition}
            disabled={total === 0 || !isPreviewing || sourceKey === targetKey}
          >
            套用到和弦編排區
          </button>
          <button
            type="button"
            className="secondary-button transpose-reset-button"
            onClick={restoreOriginalKey}
            disabled={!isPreviewing && sourceKey === targetKey}
          >
            恢復原調
          </button>
        </div>
      </section>

      <div className="song-overview-summary" aria-live="polite">
        <strong>
          {song.lines.length} 行・{total} 個和弦
        </strong>
        <span>
          {isPreviewing ? "目前顯示移調預覽，尚未修改第一步的和弦編排。" : "內容與第一步建立的和弦編排同步。"}
        </span>
      </div>

      {standMode && <style>{`@page { size: ${paper.name} landscape; margin: ${PAPER_MARGIN_MM}mm; }`}</style>}

      <div
        ref={boxRef}
        className={`print-scale-box${standMode ? " is-stand-hidden" : ""}`}
        data-paper={standMode ? paper.value : undefined}
        data-print-cols={printCols > 0 ? printCols : undefined}
        style={{ "--print-scale": printScale, "--print-cols": printCols || 1 } as React.CSSProperties}
      >
      {total === 0 ? (
        <div className="notice">尚未建立和弦編排。請先前往「① 建立和弦編排」加入並排列歌曲和弦。</div>
      ) : layout === "lead" ? (
        <LeadSheet
          song={song}
          symbols={symbolById}
          diagramMode={diagramMode}
          diagramWidth={DIAGRAM_SIZES[diagramSize].width}
          showMelody={showMelody}
          stretch={standMode}
        />
      ) : layout === "cards" ? (
        <div className="cards-by-line">
          {song.lines.map((line, lineIndex) => {
            const section = sections[lineIndex];

            return (
              <div key={line.id} className={`cards-line${section.kind === "chorus" ? " is-chorus" : ""}`}>
                {section.badge && (
                  <span className={`section-badge${section.kind === "chorus" ? " section-badge--chorus" : ""}`}>
                    {section.badge}
                  </span>
                )}

                <div className="song-overview-grid">
                  {line.items.map((item) => (
                    <div className="song-overview-item" key={item.id}>
                      <ChordCard
                        symbol={displayed(item.id, item.symbol)}
                        compact
                        eyebrow={isPreviewing ? "移調預覽" : "歌曲和弦"}
                        selectedShapeId={isPreviewing ? undefined : item.shapeId}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="song-overview-grid">
          {uniqueEntries.map((entry) => (
            <div className="song-overview-item" key={entry.symbol}>
              <ChordCard
                symbol={entry.symbol}
                compact
                eyebrow={`出現 ${entry.count} 次`}
                selectedShapeId={entry.shapeId}
              />
            </div>
          ))}
        </div>
      )}
      </div>

      {standMode && standPlan && (
        <StandPreview
          song={song}
          symbols={symbolById}
          diagramMode={diagramMode}
          diagramWidth={DIAGRAM_SIZES[diagramSize].width}
          showMelody={showMelody}
          paper={paper}
          margin={PAPER_MARGIN_MM}
          gap={PAPER_GAP_MM}
          scale={standPlan.scale}
          starts={standPlan.starts}
          hasLegend={standPlan.hasLegend}
          margins={standPlan.margins}
          printCols={printCols}
          title={song.title.trim() || "和弦譜"}
          meta={`${printMeta}${isPreviewing && sourceKey !== targetKey ? `（原調 ${keyDisplay(sourceKey)}）` : ""}`}
        />
      )}
    </section>
  );
}
