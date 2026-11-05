import { useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import {
  KEY_OPTIONS,
  getTranspositionSemitones,
  keyPrefersFlats,
  transposeChordSymbol,
} from "../../services/chordTranspose";
import { packRows } from "../../services/flow";
import {
  COLS_MAX,
  DEFAULT_OVERVIEW_SETTINGS,
  DIAGRAM_MAX,
  DIAGRAM_MIN,
  PT_MAX,
  PT_MIN,
  SPACING_RANGE,
  loadOverviewSettings,
  saveOverviewSettings,
} from "../../services/overviewSettings";
import type { OverviewSettings } from "../../services/overviewSettings";
import { allItems, countItems, effectiveSections, hasMelody, songMeta } from "../../services/songModel";
import type { Song } from "../../types/song";
import { ChordCard } from "../chord/ChordCard";
import type { DiagramMode, FlowMetrics, Spacing } from "../song/LeadSheet";
import { DIAGRAM_MODE_LABELS, LeadSheet } from "../song/LeadSheet";
import { StandPreview } from "./StandPreview";
import type { PaperSpec, ViewMode } from "./StandPreview";
import { PtSelect, StepperRange } from "./OverviewControls";

type OverviewLayout = "lead" | "cards" | "unique";

/** 歌詞字級（pt）的下拉選項；也可以用 − ＋ 一格一格調。 */
const PT_PRESETS = [14, 15, 16, 18, 20, 22, 24, 28, 32, 36];

/** 紙張：預設＝瀏覽器的設定；A3／A4 橫式＝左右兩欄（譜架用）；螢幕＝一頁就是整個畫面（平板橫放）。尺寸單位 mm。 */
type PrintPaper = "default" | "a3" | "a4" | "screen";

const PAPER_A4: PaperSpec = { value: "a4", label: "A4 橫式", name: "A4", width: 297, height: 210, margin: 12, gap: 12 };

const PRINT_PAPERS: readonly PaperSpec[] = [
  { value: "default", label: "預設", name: "", width: 0, height: 0, margin: 0, gap: 0 },
  { value: "a3", label: "A3 橫式（譜架）", name: "A3", width: 420, height: 297, margin: 12, gap: 12 },
  PAPER_A4,
  { value: "screen", label: "螢幕（平板橫放）", name: "A4", width: 0, height: 0, margin: 6, gap: 6 },
];

const MIN_FIT = 0.25;

const PX_PER_MM = 96 / 25.4;

interface StandRows {
  scale: number;
  rows: number[][];
  legendRows: number[];
  /** 這組排列是依哪一種紙張（尺寸）算的 */
  paperKey: string;
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

function columnWidthPx(paper: PaperSpec): number {
  const columns = paper.columns ?? 2;
  return ((paper.width - 2 * paper.margin - paper.gap * (columns - 1)) / columns) * PX_PER_MM;
}

/**
 * 譜架版面第一步：依欄寬把和弦排成列（只在小節線折行，段落開頭另起一列）。
 * 自動模式不縮小；只有「單一和弦寬過一欄」，或固定每行和弦數且放不下時才縮小（最多到 55%）。
 */
function planFlowRows(
  box: HTMLElement,
  paper: PaperSpec,
  printScale: number,
  printFit: boolean,
  printCols: number,
  metrics: FlowMetrics,
): StandRows | null {
  const columnPx = columnWidthPx(paper);

  // 量欄寬時不套固定欄數的格線（格線會被內容撐寬，量不準）
  const measured = withPrintStyles(box, columnPx, printScale, 0, (sheet) => {
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

  return { scale, rows: packRows(metrics.cells, metrics.widths, avail, printCols), legendRows: measured?.legendRows ?? [], paperKey: "" };
}

/**
 * 譜架版面第二步：依序把每一列（含最上方圖例）塞進欄，放不下才換下一欄。
 * 高度是把列印用的字級與間距套上去後，量每一列真正的高度。
 */
function planColumns(
  box: HTMLElement,
  paper: PaperSpec,
  scale: number,
  printCols: number,
): { starts: number[] } | null {
  const columnPx = columnWidthPx(paper);
  const pageHeight = (paper.height - 2 * paper.margin) * PX_PER_MM;

  // 標題在第一頁佔掉的高度：預覽已經畫出來就直接量，否則用標準值（A3／A4 都一樣）
  const previewHeader = document.querySelector<HTMLElement>(".stand-page__header");
  const zoom = parseFloat(getComputedStyle(document.querySelector<HTMLElement>(".stand-preview__pages") ?? document.body).zoom) || 1;
  const headerHeight = previewHeader ? previewHeader.getBoundingClientRect().height / zoom + 14 : 87;

  const measured = withPrintStyles(box, columnPx, scale, printCols, (sheet) => {
    const items = Array.from(sheet.children).filter((element) => !element.classList.contains("lead-flow-measure") && !element.classList.contains("lead-flow-probe")) as HTMLElement[];
    return {
      heights: items.map((item) => (item.getBoundingClientRect().height + 6) * scale * 1.004),
    };
  });

  if (!measured) {
    return null;
  }

  const capacity = (column: number) => (column < (paper.columns ?? 2) ? pageHeight - headerHeight : pageHeight) * 0.997;

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
}

export function SongChordOverview({ song, onApplyTransposition, onKeyChange }: SongChordOverviewProps) {
  const sourceKey = song.key ?? "C";
  const setSourceKey = onKeyChange;
  const [targetKey, setTargetKey] = useState("D");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [layout, setLayout] = usePersistentState<OverviewLayout>("guitar-chord-board:overview-layout", "lead");
  const [settings, setSettingsState] = useState<OverviewSettings>(() => loadOverviewSettings(song.id));
  const [showMelody, setShowMelody] = usePersistentState<boolean>("guitar-chord-board:show-melody", true);
  const [printPaper, setPrintPaper] = usePersistentState<PrintPaper>("guitar-chord-board:print-paper", "default");
  const [printFit, setPrintFit] = usePersistentState<boolean>("guitar-chord-board:print-fit", true);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>("guitar-chord-board:stand-view", "page");
  const [panelOpen, setPanelOpen] = usePersistentState<boolean>("guitar-chord-board:overview-panel", true);
  const [performing, setPerforming] = useState(false);
  const [performPanel, setPerformPanel] = useState(false);
  const [floatPanel, setFloatPanel] = useState(false);
  // 觸控裝置（平板）：只有「預設」「螢幕」；電腦：只有「預設」「A3」「A4」
  const [isTablet, setIsTablet] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTablet(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [printOverride, setPrintOverride] = useState(false);
  const previousPaper = useRef<PrintPaper>("default");
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(1000);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

  // 換歌就換成那首歌各自記住的設定（新歌沿用上一次的設定）
  useEffect(() => {
    setSettingsState(loadOverviewSettings(song.id));
  }, [song.id]);

  const updateSettings = (patch: Partial<OverviewSettings>) => {
    const next = { ...settings, ...patch };
    setSettingsState(next);
    saveOverviewSettings(song.id, next);
  };

  const { lyricPt, diagramPx, printCols, diagramMode } = settings;
  const spacing = useMemo<Spacing>(
    () => ({ chord: settings.spChord, melody: settings.spMelody, lyric: settings.spLyric, row: settings.spRow }),
    [settings.spChord, settings.spMelody, settings.spLyric, settings.spRow],
  );
  const boxRef = useRef<HTMLDivElement>(null);
  const [flowMetrics, setFlowMetrics] = useState<FlowMetrics | null>(null);
  const [standRows, setStandRows] = useState<StandRows | null>(null);
  const [standPlan, setStandPlan] = useState<StandPlan | null>(null);
  const standPlanRef = useRef<StandPlan | null>(null);
  standPlanRef.current = standPlan;
  const songHasMelody = hasMelody(song);
  const screenHeightPx = performing ? viewportHeight : Math.max(360, viewportHeight - 130);
  const basePaper = useMemo<PaperSpec>(() => {
    const found = PRINT_PAPERS.find((option) => option.value === printPaper) ?? PRINT_PAPERS[0];
    return found.value === "screen"
      ? {
          ...found,
          width: hostWidth / PX_PER_MM,
          height: screenHeightPx / PX_PER_MM,
          // 窄螢幕或直立：單欄
          columns: hostWidth < 700 || screenHeightPx > hostWidth ? 1 : 2,
        }
      : found;
  }, [printPaper, hostWidth, screenHeightPx]);
  // 螢幕版面按「列印」時，暫時改用 A4 橫式重新排版
  const paper = printOverride ? PAPER_A4 : basePaper;
  const actualSize = !printOverride && printPaper === "screen";
  const paperKey = `${paper.value}:${Math.round(paper.width)}x${Math.round(paper.height)}x${paper.columns ?? 2}`;
  const standMode = paper.value !== "default" && layout === "lead";
  // 簡譜風格的字級用歌詞 pt 直接設定；其他排版（卡片、不重複和弦）沿用整體縮放，14pt ＝ 原大小
  const printScale = layout === "lead" ? 1 : lyricPt / PT_MIN;

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

  // 量預覽區的寬度（螢幕版面的頁寬）與視窗高度
  useEffect(() => {
    const update = () => {
      setViewportHeight(window.innerHeight);
      setHostWidth(performing ? window.innerWidth : Math.floor(hostRef.current?.clientWidth ?? 1000));
    };
    update();
    window.addEventListener("resize", update);
    const host = hostRef.current;
    const observer = host && typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;

    if (host) {
      observer?.observe(host);
    }

    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [performing, printPaper, panelOpen]);

  // 螢幕版面：先用 A4 重新排好版，再開列印視窗；列印完還原
  useEffect(() => {
    if (!printOverride) {
      return undefined;
    }

    const done = () => setPrintOverride(false);
    window.addEventListener("afterprint", done);
    const ready = standPlan !== null && standPlan.paperKey.startsWith("a4:");
    const timer = ready ? window.setTimeout(() => window.print(), 120) : undefined;

    return () => {
      window.removeEventListener("afterprint", done);

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [printOverride, standPlan]);

  function printNow() {
    if (printPaper === "screen") {
      setPrintOverride(true);
    } else {
      window.print();
    }
  }

  function enterPerform() {
    if (layout !== "lead") {
      setLayout("lead");
    }

    previousPaper.current = printPaper;
    setPrintPaper("screen");
    setPerformPanel(false);
    setPerforming(true);

    try {
      void document.documentElement.requestFullscreen?.();
    } catch {
      // 不支援全螢幕時，只隱藏其他畫面。
    }
  }

  function exitPerform() {
    setPerforming(false);
    setPrintPaper(previousPaper.current === "screen" ? "default" : previousPaper.current);

    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    }
  }

  useEffect(() => {
    if (!performing) {
      return undefined;
    }

    document.body.classList.add("is-performing");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        exitPerform();
      }
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        exitPerform();
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.body.classList.remove("is-performing");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performing]);

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
        const planned = planFlowRows(box, paper, printScale, printFit, printCols, flowMetrics);
        setStandRows(planned ? { ...planned, paperKey } : null);
      }
    };

    compute();
    void document.fonts?.ready.then(compute);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standMode, printFit, printScale, paperKey, paper, printCols, flowMetrics]);

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

  // 之前存的紙張在這個裝置上沒有時，改回預設（演奏中除外）
  useEffect(() => {
    if (performing) {
      return;
    }

    if (isTablet ? printPaper === "a3" || printPaper === "a4" : printPaper === "screen") {
      setPrintPaper("default");
    }
  }, [isTablet, performing, printPaper, setPrintPaper]);

  const paperOptions = PRINT_PAPERS.filter((option) =>
    option.value === "default" ? true : isTablet ? option.value === "screen" : option.value !== "screen",
  );

  const panelDock = !performing && printPaper !== "screen";
  const panelVisible = performing ? performPanel : panelDock ? panelOpen : floatPanel;

  return (
    <section className={`workspace workspace--overview${performing ? " is-performing" : ""}`} aria-labelledby="overview-mode-title">
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

      <div className={`overview-layout${panelDock && panelVisible ? " has-dock" : ""}`}>
        <button
          type="button"
          className={`overview-panel-toggle${performing ? " is-perform" : ""}${panelDock ? "" : " is-float"}`}
          onClick={() => (performing ? setPerformPanel(!performPanel) : panelDock ? setPanelOpen(!panelOpen) : setFloatPanel(!floatPanel))}
          aria-expanded={panelVisible}
        >
          {panelVisible ? "隱藏設定" : "⚙ 顯示設定"}
        </button>

        {performing && (
          <button type="button" className="overview-perform-exit" onClick={exitPerform}>
            ✕ 結束演奏
          </button>
        )}

        <aside
          className={`overview-panel overview-panel--${panelDock ? "dock" : "float"}`}
          hidden={!panelVisible}
          aria-label="總覽設定"
        >
          <div className="overview-panel__section">
            <h3>排版</h3>
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

          {layout === "lead" && (
            <div className="overview-panel__section">
              <h3>顯示</h3>
              <div className="segmented-control" role="group" aria-label="和弦按法圖">
                {(Object.keys(DIAGRAM_MODE_LABELS) as DiagramMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={diagramMode === mode ? "is-active" : ""}
                    aria-pressed={diagramMode === mode}
                    onClick={() => updateSettings({ diagramMode: mode })}
                    title={mode === "off" ? "熟悉之後可以關掉按法圖" : undefined}
                  >
                    {DIAGRAM_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>

              {songHasMelody && (
                <div className="segmented-control" role="group" aria-label="簡譜旋律">
                  <button type="button" className={showMelody ? "is-active" : ""} aria-pressed={showMelody} onClick={() => setShowMelody(true)}>
                    顯示旋律
                  </button>
                  <button type="button" className={!showMelody ? "is-active" : ""} aria-pressed={!showMelody} onClick={() => setShowMelody(false)}>
                    只看和弦歌詞
                  </button>
                </div>
              )}

              {diagramMode !== "off" && (
                <StepperRange
                  label="和弦圖大小"
                  unit="px"
                  value={diagramPx}
                  min={DIAGRAM_MIN}
                  max={DIAGRAM_MAX}
                  onChange={(value) => updateSettings({ diagramPx: value })}
                />
              )}
            </div>
          )}

          <div className="overview-panel__section">
            <h3>字級與間距</h3>
            <PtSelect value={lyricPt} min={PT_MIN} max={PT_MAX} presets={PT_PRESETS} onChange={(value) => updateSettings({ lyricPt: value })} />

            {layout === "lead" && (
              <details className="spacing-tune">
                <summary>上下間距微調</summary>
                <div className="spacing-tune__grid">
                  <StepperRange label="和弦名稱上下" unit="px" value={settings.spChord} min={SPACING_RANGE.chord[0]} max={SPACING_RANGE.chord[1]} onChange={(value) => updateSettings({ spChord: value })} />
                  <StepperRange label="旋律上下" unit="px" value={settings.spMelody} min={SPACING_RANGE.melody[0]} max={SPACING_RANGE.melody[1]} onChange={(value) => updateSettings({ spMelody: value })} />
                  <StepperRange label="歌詞各節之間" unit="px" value={settings.spLyric} min={SPACING_RANGE.lyric[0]} max={SPACING_RANGE.lyric[1]} onChange={(value) => updateSettings({ spLyric: value })} />
                  <StepperRange label="列與列之間" unit="px" value={settings.spRow} min={SPACING_RANGE.row[0]} max={SPACING_RANGE.row[1]} onChange={(value) => updateSettings({ spRow: value })} />
                </div>
              </details>
            )}
          </div>

          {layout === "lead" && (
            <div className="overview-panel__section">
              <h3>紙張與列印</h3>
              <div className="segmented-control segmented-control--wrap" role="group" aria-label="紙張">
                {paperOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={printPaper === option.value ? "is-active" : ""}
                    aria-pressed={printPaper === option.value}
                    onClick={() => {
                      setPrintPaper(option.value as PrintPaper);
                      setFloatPanel(false);
                    }}
                    title={
                      option.value === "default"
                        ? "使用瀏覽器列印視窗裡的紙張設定"
                        : option.value === "screen"
                          ? "一頁就是整個畫面（平板橫放用）"
                          : "橫放、左右兩欄，依序填滿；列印視窗的「每張工作表頁數」請保持 1"
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {standMode && !actualSize && (
                <div className="segmented-control" role="group" aria-label="預覽方式">
                  <button type="button" className={viewMode === "page" ? "is-active" : ""} aria-pressed={viewMode === "page"} onClick={() => setViewMode("page")}>
                    一頁一頁
                  </button>
                  <button type="button" className={viewMode === "scroll" ? "is-active" : ""} aria-pressed={viewMode === "scroll"} onClick={() => setViewMode("scroll")}>
                    連續捲動
                  </button>
                </div>
              )}

              <StepperRange
                label="列印每行和弦數"
                value={printCols === 0 ? 1 : printCols}
                min={1}
                max={COLS_MAX}
                valueText={(value) => (value <= 1 ? "自動" : "個")}
                onChange={(value) => updateSettings({ printCols: value <= 1 ? 0 : value })}
                hint="最左邊（1）＝自動。固定後每欄等寬、小節線上下對齊（只影響列印）"
              />

              {standMode && printCols > 0 && (
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
            </div>
          )}

          <div className="overview-panel__section overview-panel__actions">
            <button type="button" className="ghost-button" onClick={enterPerform} disabled={total === 0}>
              進入演奏模式
            </button>
            {!isTablet && (
              <button type="button" className="ghost-button" onClick={printNow} disabled={total === 0}>
                列印／存成 PDF
              </button>
            )}
            <button type="button" className="ghost-button" onClick={() => updateSettings({ ...DEFAULT_OVERVIEW_SETTINGS })}>
              還原預設
            </button>
          </div>
        </aside>

        <div className="overview-main" ref={hostRef}>
          <div className="song-overview-summary" aria-live="polite">
            <strong>
              {song.lines.length} 行・{total} 個和弦
            </strong>
            <span>
              {isPreviewing ? "目前顯示移調預覽，尚未修改第一步的和弦編排。" : "內容與第一步建立的和弦編排同步。"}
            </span>
          </div>

          {standMode && <style>{`@page { size: ${paper.name} landscape; margin: 12mm; }`}</style>}

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
              diagramWidth={diagramPx}
              showMelody={showMelody}
              stretch
              flow
              spacing={spacing}
              lyricPt={lyricPt}
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

          {standMode && standPlan && !printOverride && (
            <StandPreview
              song={song}
              symbols={symbolById}
              diagramMode={diagramMode}
              diagramWidth={diagramPx}
              showMelody={showMelody}
              paper={paper}
              scale={standPlan.scale}
              starts={standPlan.starts}
              rows={standPlan.rows}
              spacing={spacing}
              lyricPt={lyricPt}
              legendRows={standPlan.legendRows}
              viewMode={viewMode}
              actualSize={actualSize}
              performing={performing}
              printCols={printCols}
              title={song.title.trim() || "和弦譜"}
              meta={`${printMeta}${isPreviewing && sourceKey !== targetKey ? `（原調 ${keyDisplay(sourceKey)}）` : ""}`}
            />
          )}
        </div>
      </div>
    </section>
  );
}
