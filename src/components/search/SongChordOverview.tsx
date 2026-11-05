import { useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import {
  KEY_OPTIONS,
  getTranspositionSemitones,
  keyPrefersFlats,
  transposeChordSymbol,
} from "../../services/chordTranspose";
import { packRows } from "../../services/flow";
import { allItems, countItems, effectiveSections, hasMelody, songMeta } from "../../services/songModel";
import type { Song } from "../../types/song";
import { ChordCard } from "../chord/ChordCard";
import type { DiagramMode, DiagramSize, FlowMetrics, Spacing } from "../song/LeadSheet";
import { DEFAULT_SPACING, DIAGRAM_MODE_LABELS, DIAGRAM_SIZES, LeadSheet } from "../song/LeadSheet";
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

const PX_PER_MM = 96 / 25.4;

interface StandRows {
  scale: number;
  rows: number[][];
  legendRows: number[];
}

interface StandPlan extends StandRows {
  starts: number[];
}

/** 暫時套上接近列印時的尺寸與版面（欄寬、字級、間距）來量，fn 執行完還原。 */
function withPrintStyles<T>(box: HTMLElement, columnPx: number, scale: number, printCols: number, fn: (sheet: HTMLElement) => T): T | null {
  const sheet = box.querySelector<HTMLElement>(".lead-sheet");

  if (!sheet) {
    return null;
  }

  const saved = new Map<HTMLElement, string>();
  const remember = (element: HTMLElement) => {
    if (!saved.has(element)) {
      saved.set(element, element.style.cssText);
    }
  };

  remember(box);
  remember(sheet);
  box.style.width = `${columnPx / scale}px`;
  sheet.style.cssText += ";padding:0;border:0;display:block;--lead-edge:calc(6px + 3.4em + 4px)";

  const gridStyle =
    printCols > 0 ? `;display:grid;grid-template-columns:repeat(${printCols},minmax(max-content,1fr));align-items:end` : "";

  (Array.from(sheet.children) as HTMLElement[]).forEach((item) => {
    remember(item);

    if (item.classList.contains("lead-line")) {
      item.style.cssText += ";grid-template-columns:3.4em 1fr;gap:4px;padding:calc(4px + var(--sp-row, 0px)) 2px";
      const cells = item.querySelector<HTMLElement>(".lead-line__cells");

      if (cells) {
        remember(cells);
        cells.style.cssText += gridStyle;
      }
    }
  });

  try {
    return fn(sheet);
  } finally {
    saved.forEach((css, element) => {
      element.style.cssText = css;
    });
  }
}

function columnWidthPx(paper: { width: number }): number {
  return ((paper.width - 2 * PAPER_MARGIN_MM - PAPER_GAP_MM) / 2) * PX_PER_MM;
}

/**
 * 譜架版面第一步：依欄寬把和弦排成列（只在小節線折行，段落開頭另起一列）。
 * 自動模式不縮小；只有「單一和弦寬過一欄」，或固定每行和弦數且放不下時才縮小（最多到 55%）。
 */
function planFlowRows(
  box: HTMLElement,
  paper: { width: number },
  printScale: number,
  printFit: boolean,
  printCols: number,
  metrics: FlowMetrics,
): StandRows | null {
  const columnPx = columnWidthPx(paper);

  const measured = withPrintStyles(box, columnPx, printScale, printCols, (sheet) => {
    const cells = sheet.querySelector<HTMLElement>(".lead-line:not(.lead-flow-probe) .lead-line__cells");

    if (!cells) {
      return null;
    }

    const content = cells.clientWidth - (parseFloat(getComputedStyle(cells).paddingLeft) || 0);

    // 上方圖例：一列放得下幾張圖，分成一塊一列（太高的圖例才能分到不同欄）
    const legendRows: number[] = [];
    const figures = Array.from(sheet.querySelectorAll<HTMLElement>(".lead-legend__item"));
    const block = sheet.querySelector<HTMLElement>(".lead-legend");

    if (figures.length > 0 && block) {
      const style = getComputedStyle(block);
      const inner = block.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      const gap = parseFloat(style.columnGap) || 0;
      const widest = Math.max(...figures.map((figure) => figure.getBoundingClientRect().width));
      const perRow = Math.max(1, Math.floor((inner + gap) / (widest + gap)));

      for (let from = 0; from < figures.length; from += perRow) {
        legendRows.push(Math.min(perRow, figures.length - from));
      }
    }

    return { overhead: columnPx / printScale - content, legendRows };
  });

  const overhead = measured?.overhead ?? null;

  if (overhead === null || metrics.cells.length === 0) {
    return null;
  }

  let needed = Math.max(...metrics.widths, 1);
  let shrink = true;

  if (printCols > 0) {
    // 固定每行幾個：每一欄等寬，整列寬度＝各欄最寬者相加
    const columnMax: number[] = [];
    packRows(metrics.cells, metrics.widths, 0, printCols).forEach((row) => {
      row.forEach((cellIndex, position) => {
        columnMax[position] = Math.max(columnMax[position] ?? 0, metrics.widths[cellIndex] ?? 0);
      });
    });
    needed = columnMax.reduce((sum, value) => sum + value, 0);
    shrink = printFit;
  }

  const fit = shrink ? Math.max(MIN_FIT, Math.min(1, columnPx / (printScale * (needed + overhead + 4)))) : 1;
  const scale = printScale * fit;
  const avail = columnPx / scale - overhead - 2;

  return { scale, rows: packRows(metrics.cells, metrics.widths, avail, printCols), legendRows: measured?.legendRows ?? [] };
}

/**
 * 譜架版面第二步：依序把每一列（含最上方圖例）塞進欄，放不下才換下一欄。
 * 高度是把列印用的字級與間距套上去後，量每一列真正的高度。
 */
function planColumns(
  box: HTMLElement,
  paper: { width: number; height: number },
  scale: number,
  printCols: number,
): { starts: number[] } | null {
  const columnPx = columnWidthPx(paper);
  const pageHeight = (paper.height - 2 * PAPER_MARGIN_MM) * PX_PER_MM;

  // 標題在第一頁佔掉的高度：預覽已經畫出來就直接量，否則用標準值（A3／A4 都一樣）
  const previewHeader = document.querySelector<HTMLElement>(".stand-page__header");
  const zoom = parseFloat(getComputedStyle(document.querySelector<HTMLElement>(".stand-preview__pages") ?? document.body).zoom) || 1;
  const headerHeight = previewHeader ? previewHeader.getBoundingClientRect().height / zoom + 14 : 87;

  const measured = withPrintStyles(box, columnPx, scale, printCols, (sheet) => {
    const items = Array.from(sheet.children).filter((element) => !element.classList.contains("lead-flow-measure") && !element.classList.contains("lead-flow-probe")) as HTMLElement[];
    return {
      heights: items.map((item) => (item.getBoundingClientRect().height + 6) * scale * 1.0),
    };
  });

  if (!measured) {
    return null;
  }

  const capacity = (column: number) => (column < 2 ? pageHeight - headerHeight : pageHeight) * 0.998;

  // 依序塞滿：從左欄開始一列一列排，放不下才換下一欄（右欄、下一頁的左欄…）
  const starts = [0];
  let used = 0;

  measured.heights.forEach((height, index) => {
    // 每欄最後一列底下的空隙（margin）會被欄底吃掉，不用算進去
    if (used > 0 && used + height - 6 * scale > capacity(starts.length - 1)) {
      starts.push(index);
      used = 0;
    }

    used += height;
  });

  return { starts };
}

/** 列印用：在每欄第一個項目前插入強制換欄。傳回還原函式。 */
function applyColumnBreaks(box: HTMLElement, starts: readonly number[]): () => void {
  const sheet = box.querySelector<HTMLElement>(".lead-sheet");
  const items = sheet
    ? (Array.from(sheet.children).filter((element) => !element.classList.contains("lead-flow-measure") && !element.classList.contains("lead-flow-probe")) as HTMLElement[])
    : [];

  starts.slice(1).forEach((index) => {
    if (items[index]) {
      items[index].style.breakBefore = "column";
    }
  });

  if (starts.length > 1) {
    box.style.columnFill = "auto";
  }

  return () => {
    items.forEach((item) => {
      item.style.breakBefore = "";
    });
    box.style.columnFill = "";
  };
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
  const [spChord, setSpChord] = usePersistentState<number>("guitar-chord-board:sp-chord", 0);
  const [spMelody, setSpMelody] = usePersistentState<number>("guitar-chord-board:sp-melody", 0);
  const [spLyric, setSpLyric] = usePersistentState<number>("guitar-chord-board:sp-lyric", 0);
  const [spRow, setSpRow] = usePersistentState<number>("guitar-chord-board:sp-row", 0);
  const spacing = useMemo<Spacing>(
    () => ({ chord: spChord, melody: spMelody, lyric: spLyric, row: spRow }),
    [spChord, spMelody, spLyric, spRow],
  );
  const setSpacing = (next: Spacing) => {
    setSpChord(next.chord);
    setSpMelody(next.melody);
    setSpLyric(next.lyric);
    setSpRow(next.row);
  };
  const boxRef = useRef<HTMLDivElement>(null);
  const [flowMetrics, setFlowMetrics] = useState<FlowMetrics | null>(null);
  const [standRows, setStandRows] = useState<StandRows | null>(null);
  const [standPlan, setStandPlan] = useState<StandPlan | null>(null);
  const standPlanRef = useRef<StandPlan | null>(null);
  standPlanRef.current = standPlan;
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
      const plan = standPlanRef.current;
      box.style.setProperty("--print-scale", String(plan?.scale ?? printScale));
      restore = plan ? applyColumnBreaks(box, plan.starts) : null;
    };

    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);

    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      after();
    };
  }, [standMode, printScale, paper, layout]);

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

  // 譜架版面第一步：依欄寬排成列（量好每個和弦的自然寬度後才排）。
  useEffect(() => {
    const box = boxRef.current;

    if (!standMode || !box || !flowMetrics) {
      setStandRows(null);
      return undefined;
    }

    let cancelled = false;

    const compute = () => {
      if (!cancelled) {
        setStandRows(planFlowRows(box, paper, printScale, printFit, printCols, flowMetrics));
      }
    };

    compute();
    void document.fonts?.ready.then(compute);

    return () => {
      cancelled = true;
    };
  }, [standMode, printFit, printScale, paper, printCols, flowMetrics]);

  // 譜架版面第二步：排好列之後，量每一列真正的高度，依序塞進各欄。
  useEffect(() => {
    const box = boxRef.current;

    if (!standMode || !box || !standRows) {
      setStandPlan(null);
      return undefined;
    }

    const plan = planColumns(box, paper, standRows.scale, printCols);
    setStandPlan(plan ? { ...standRows, ...plan } : null);
    return undefined;
  }, [standMode, standRows, paper, printCols, spacing]);

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

        {layout === "lead" && (
          <details className="spacing-tune">
            <summary>上下間距微調（和弦、旋律、歌詞、列與列）</summary>
            <div className="spacing-tune__grid">
              {(
                [
                  ["chord", "和弦名稱上下", -6, 24],
                  ["melody", "旋律上下", -6, 24],
                  ["lyric", "歌詞各節之間", -6, 24],
                  ["row", "列與列之間", 0, 40],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key}>
                  <span>
                    {label}：{spacing[key]}px
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={spacing[key]}
                    onChange={(event) => setSpacing({ ...spacing, [key]: Number(event.target.value) })}
                  />
                </label>
              ))}
              <button type="button" className="ghost-button" onClick={() => setSpacing(DEFAULT_SPACING)}>
                還原預設
              </button>
            </div>
          </details>
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
          stretch
          flow
          spacing={spacing}
          rows={standMode ? standRows?.rows : undefined}
          legendRows={standMode ? standRows?.legendRows : undefined}
          measureWidths={standMode}
          onFlowMetrics={standMode ? setFlowMetrics : undefined}
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
          rows={standPlan.rows}
          spacing={spacing}
          legendRows={standPlan.legendRows}
          printCols={printCols}
          title={song.title.trim() || "和弦譜"}
          meta={`${printMeta}${isPreviewing && sourceKey !== targetKey ? `（原調 ${keyDisplay(sourceKey)}）` : ""}`}
        />
      )}
    </section>
  );
}
