import { useSyncExternalStore } from "react";
import type { SongChordItem } from "../types/chord";
import { createId } from "../utils/createId";
import { getChordTheory } from "./chordTheory";

const SONG_STORAGE_KEY = "guitar-chord-board:song:v1";
const LEFT_HANDED_KEY = "guitar-chord-board:left-handed";
const MAX_CHORDS = 64;
const SYMBOL_PATTERN = /^[A-G][#b]?[^\s,]{0,14}$/;

export interface SongState {
  items: SongChordItem[];
  shapeIds: Record<string, string>;
  removeDuplicates: boolean;
  title: string;
}

interface StoredSong {
  symbols: string[];
  shapes: (string | null)[];
  removeDuplicates: boolean;
  title: string;
}

export const DEFAULT_SONG_SYMBOLS: readonly string[] = ["C", "G", "Am", "F"];

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 私密瀏覽或儲存空間已滿時，保存功能靜默失效即可。
  }
}

function isValidSymbol(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SYMBOL_PATTERN.test(value) &&
    getChordTheory(value).valid
  );
}

export function createSongState(
  symbols: readonly string[],
  shapes: readonly (string | null | undefined)[] = [],
  removeDuplicates = false,
  title = "",
): SongState {
  const items = symbols.map((symbol) => ({ id: createId(), symbol }));
  const shapeIds: Record<string, string> = {};

  items.forEach((item, index) => {
    const shapeId = shapes[index];
    if (shapeId) {
      shapeIds[item.id] = shapeId;
    }
  });

  return { items, shapeIds, removeDuplicates, title };
}

export function saveSong(state: SongState): void {
  const stored: StoredSong = {
    symbols: state.items.map((item) => item.symbol),
    shapes: state.items.map((item) => state.shapeIds[item.id] ?? null),
    removeDuplicates: state.removeDuplicates,
    title: state.title,
  };

  writeStorage(SONG_STORAGE_KEY, JSON.stringify(stored));
}

export function loadSavedSong(): SongState | null {
  const raw = readStorage(SONG_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSong>;
    if (!Array.isArray(parsed.symbols)) {
      return null;
    }

    const symbols: string[] = [];
    const shapes: (string | null)[] = [];

    parsed.symbols.slice(0, MAX_CHORDS).forEach((symbol, index) => {
      if (isValidSymbol(symbol)) {
        symbols.push(symbol);
        const shape = parsed.shapes?.[index];
        shapes.push(typeof shape === "string" ? shape : null);
      }
    });

    return createSongState(
      symbols,
      shapes,
      parsed.removeDuplicates === true,
      typeof parsed.title === "string" ? parsed.title.slice(0, 60) : "",
    );
  } catch {
    return null;
  }
}

/** 從網址 ?chords=C,G,Am,F&title=歌名 讀取分享內容。 */
export function parseSharedSong(search: string): SongState | null {
  const params = new URLSearchParams(search);
  const rawChords = params.get("chords");
  if (!rawChords) {
    return null;
  }

  const symbols = rawChords
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(isValidSymbol)
    .slice(0, MAX_CHORDS);

  if (symbols.length === 0) {
    return null;
  }

  return createSongState(symbols, [], false, (params.get("title") ?? "").slice(0, 60));
}

export function buildShareUrl(items: readonly SongChordItem[], title: string): string {
  const chords = items.map((item) => encodeURIComponent(item.symbol)).join(",");
  const titlePart = title.trim() ? `&title=${encodeURIComponent(title.trim())}` : "";

  return `${window.location.origin}${window.location.pathname}?chords=${chords}${titlePart}`;
}

/* 左手模式：小型外部 store，讓和弦圖不必層層傳遞 props。 */
const leftHandedListeners = new Set<() => void>();
let leftHandedValue = readStorage(LEFT_HANDED_KEY) === "1";

function subscribeLeftHanded(listener: () => void): () => void {
  leftHandedListeners.add(listener);
  return () => leftHandedListeners.delete(listener);
}

export function setLeftHanded(value: boolean): void {
  leftHandedValue = value;
  writeStorage(LEFT_HANDED_KEY, value ? "1" : "0");
  leftHandedListeners.forEach((listener) => listener());
}

export function useLeftHanded(): boolean {
  return useSyncExternalStore(
    subscribeLeftHanded,
    () => leftHandedValue,
    () => false,
  );
}
