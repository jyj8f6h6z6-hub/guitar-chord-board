import type { DiagramMode } from "../components/song/LeadSheet";

/** 總覽的版面設定：每首歌各自記住（存在瀏覽器），新歌沿用上一次的設定。 */
export interface OverviewSettings {
  lyricPt: number;
  diagramPx: number;
  printCols: number;
  spChord: number;
  spMelody: number;
  spLyric: number;
  spRow: number;
  diagramMode: DiagramMode;
  /** 格數數字高度（％格高）、線條粗細（％）、圓點大小（％） */
  fretPct: number;
  linePct: number;
  dotPct: number;
}

export const PT_MIN = 14;
export const PT_MAX = 36;
export const DIAGRAM_MIN = 60;
export const DIAGRAM_MAX = 400;
export const COLS_MAX = 12;
export const FRET_PCT = { min: 100, max: 300 } as const;
export const LINE_PCT = { min: 50, max: 300 } as const;
export const DOT_PCT = { min: 50, max: 180 } as const;
export const SPACING_RANGE = { chord: [-6, 24], melody: [-6, 24], lyric: [-6, 24], row: [0, 40] } as const;

export const DEFAULT_OVERVIEW_SETTINGS: OverviewSettings = {
  lyricPt: PT_MIN,
  diagramPx: 72,
  printCols: 0,
  spChord: 0,
  spMelody: 0,
  spLyric: 0,
  spRow: 0,
  diagramMode: "legend",
  fretPct: 200,
  linePct: 100,
  dotPct: 100,
};

const MAP_KEY = "guitar-chord-board:song-settings:v1";
const LAST_KEY = "guitar-chord-board:song-settings:last:v1";
const DIAGRAM_MODES: readonly DiagramMode[] = ["legend", "all", "off"];

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

function sanitize(raw: unknown): OverviewSettings | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const defaults = DEFAULT_OVERVIEW_SETTINGS;

  return {
    lyricPt: clamp(source.lyricPt, PT_MIN, PT_MAX, defaults.lyricPt),
    diagramPx: clamp(source.diagramPx, DIAGRAM_MIN, DIAGRAM_MAX, defaults.diagramPx),
    printCols: clamp(source.printCols, 0, COLS_MAX, defaults.printCols),
    spChord: clamp(source.spChord, SPACING_RANGE.chord[0], SPACING_RANGE.chord[1], 0),
    spMelody: clamp(source.spMelody, SPACING_RANGE.melody[0], SPACING_RANGE.melody[1], 0),
    spLyric: clamp(source.spLyric, SPACING_RANGE.lyric[0], SPACING_RANGE.lyric[1], 0),
    spRow: clamp(source.spRow, SPACING_RANGE.row[0], SPACING_RANGE.row[1], 0),
    fretPct: clamp(source.fretPct, FRET_PCT.min, FRET_PCT.max, defaults.fretPct),
    linePct: clamp(source.linePct, LINE_PCT.min, LINE_PCT.max, defaults.linePct),
    dotPct: clamp(source.dotPct, DOT_PCT.min, DOT_PCT.max, defaults.dotPct),
    // 舊版的「首次出現小圖」已取消，一律改成上方圖例
    diagramMode: DIAGRAM_MODES.includes(source.diagramMode as DiagramMode)
      ? (source.diagramMode as DiagramMode)
      : defaults.diagramMode,
  };
}

/** 舊版（全站共用）存下來的設定，第一次使用時當作起點。 */
function legacySettings(): OverviewSettings {
  const diagramSizes: Record<string, number> = { medium: 72, large: 96, xlarge: 128 };
  const legacySize = readJson("guitar-chord-board:diagram-size");

  return (
    sanitize({
      lyricPt: readJson("guitar-chord-board:lyric-pt"),
      diagramPx:
        readJson("guitar-chord-board:diagram-px") ??
        (typeof legacySize === "string" ? diagramSizes[legacySize] : undefined),
      printCols: readJson("guitar-chord-board:print-cols"),
      spChord: readJson("guitar-chord-board:sp-chord"),
      spMelody: readJson("guitar-chord-board:sp-melody"),
      spLyric: readJson("guitar-chord-board:sp-lyric"),
      spRow: readJson("guitar-chord-board:sp-row"),
      diagramMode: readJson("guitar-chord-board:diagram-mode"),
    }) ?? DEFAULT_OVERVIEW_SETTINGS
  );
}

export function loadOverviewSettings(songId: string): OverviewSettings {
  const map = readJson(MAP_KEY);
  const own = typeof map === "object" && map !== null ? sanitize((map as Record<string, unknown>)[songId]) : null;
  return own ?? sanitize(readJson(LAST_KEY)) ?? legacySettings();
}

export function saveOverviewSettings(songId: string, settings: OverviewSettings): void {
  try {
    const map = readJson(MAP_KEY);
    const next = typeof map === "object" && map !== null ? { ...(map as Record<string, unknown>) } : {};
    next[songId] = settings;
    window.localStorage.setItem(MAP_KEY, JSON.stringify(next));
    window.localStorage.setItem(LAST_KEY, JSON.stringify(settings));
  } catch {
    // 儲存失敗不影響目前畫面。
  }
}
