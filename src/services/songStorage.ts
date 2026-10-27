import type { SectionKind, Song, SongItem, SongLine } from "../types/song";
import { SECTION_KINDS } from "../types/song";
import { createId } from "../utils/createId";
import { KEY_OPTIONS } from "./chordTranspose";
import { getChordTheory } from "./chordTheory";
import {
  MAX_ITEMS_PER_LINE,
  MAX_ITEMS_TOTAL,
  MAX_LABEL_LENGTH,
  MAX_LINES,
  MAX_PALETTE,
  MAX_TITLE_LENGTH,
  createDefaultSong,
  createLine,
  createSong,
  linesFromSymbols,
  normalizeLyric,
} from "./songModel";

const LIBRARY_KEY = "guitar-chord-board:library:v2";
const LEGACY_SONG_KEY = "guitar-chord-board:song:v1";
const FILE_FORMAT = "guitar-chord-board-songs";
const SYMBOL_PATTERN = /^[A-G][#b]?[^\s,]{0,14}$/;
const MAX_SHARE_TOKEN_LENGTH = 7000;
const MAX_DECODED_BYTES = 500_000;

export interface Library {
  currentId: string;
  songs: Song[];
}

/* ---------- 讀寫 localStorage ---------- */

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/* ---------- 序列化與驗證 ---------- */

interface SerializedChord {
  symbol: string;
  lyric?: string;
  bar?: boolean;
  shape?: string;
}

interface SerializedLine {
  section?: SectionKind;
  label?: string;
  chords: SerializedChord[];
}

export interface SerializedSong {
  title: string;
  key?: string;
  palette?: string[];
  lines: SerializedLine[];
}

export function isValidSymbol(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SYMBOL_PATTERN.test(value) &&
    getChordTheory(value).valid
  );
}

export function serializeSong(song: Song): SerializedSong {
  return {
    title: song.title,
    ...(song.key ? { key: song.key } : {}),
    ...(song.palette && song.palette.length > 0 ? { palette: song.palette } : {}),
    lines: song.lines.map((line) => ({
      ...(line.section ? { section: line.section } : {}),
      ...(line.customLabel ? { label: line.customLabel } : {}),
      chords: line.items.map((item) => ({
        symbol: item.symbol,
        ...(item.lyric ? { lyric: item.lyric } : {}),
        ...(item.bar ? { bar: true } : {}),
        ...(item.shapeId ? { shape: item.shapeId } : {}),
      })),
    })),
  };
}

function asString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").slice(0, maxLength) : "";
}

/** 檢查並整理外部來源（分享連結、匯入檔）的資料，不合格的內容直接丟棄。 */
export function sanitizeSong(raw: unknown): Song | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as { title?: unknown; key?: unknown; palette?: unknown; lines?: unknown };

  if (!Array.isArray(source.lines)) {
    return null;
  }

  let total = 0;
  const lines: SongLine[] = [];

  for (const rawLine of source.lines.slice(0, MAX_LINES)) {
    if (!rawLine || typeof rawLine !== "object") {
      continue;
    }

    const lineSource = rawLine as {
      section?: unknown;
      label?: unknown;
      chords?: unknown;
    };
    const section = (SECTION_KINDS as readonly unknown[]).includes(lineSource.section)
      ? (lineSource.section as SectionKind)
      : "";
    const items: SongItem[] = [];

    if (Array.isArray(lineSource.chords)) {
      for (const rawChord of lineSource.chords.slice(0, MAX_ITEMS_PER_LINE)) {
        if (total >= MAX_ITEMS_TOTAL) {
          break;
        }

        const chord = rawChord as Partial<SerializedChord> | null;

        if (!chord || !isValidSymbol(chord.symbol)) {
          continue;
        }

        total += 1;
        items.push({
          id: createId(),
          symbol: chord.symbol,
          lyric: typeof chord.lyric === "string" ? normalizeLyric(chord.lyric) : "",
          bar: chord.bar === true,
          ...(typeof chord.shape === "string" && chord.shape.length <= 80
            ? { shapeId: chord.shape }
            : {}),
        });
      }
    }

    lines.push(
      createLine(items, section, asString(lineSource.label, MAX_LABEL_LENGTH)),
    );
  }

  const key =
    typeof source.key === "string" && KEY_OPTIONS.some((option) => option.value === source.key)
      ? source.key
      : undefined;

  const palette = Array.isArray(source.palette)
    ? [...new Set(source.palette.filter(isValidSymbol))].slice(0, MAX_PALETTE)
    : undefined;

  return createSong(asString(source.title, MAX_TITLE_LENGTH), lines, key, palette);
}

/* ---------- 歌單 ---------- */

interface LegacySong {
  symbols?: unknown;
  shapes?: unknown;
  title?: unknown;
}

function migrateLegacySong(): Song | null {
  const raw = readStorage(LEGACY_SONG_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as LegacySong;

    if (!Array.isArray(parsed.symbols)) {
      return null;
    }

    const shapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
    const symbols = parsed.symbols.filter(isValidSymbol).slice(0, MAX_ITEMS_TOTAL);
    const song = createSong(
      asString(parsed.title, MAX_TITLE_LENGTH),
      linesFromSymbols(symbols, Math.max(symbols.length, 1)),
    );

    // 舊版沒有分行，全部放在同一行；按法選擇依順序帶回。
    song.lines[0].items.forEach((item, index) => {
      const shape = shapes[index];
      if (typeof shape === "string") {
        item.shapeId = shape;
      }
    });

    return song;
  } catch {
    return null;
  }
}

function createFreshLibrary(): Library {
  const song = createDefaultSong();
  return { currentId: song.id, songs: [song] };
}

export function loadLibrary(): Library {
  const raw = readStorage(LIBRARY_KEY);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { currentId?: unknown; songs?: unknown };

      if (Array.isArray(parsed.songs)) {
        const songs: Song[] = [];

        for (const entry of parsed.songs) {
          const song = sanitizeSong(entry);
          const stored = entry as { id?: unknown; updatedAt?: unknown };

          if (song) {
            if (typeof stored.id === "string" && stored.id.length <= 80) {
              song.id = stored.id;
            }
            if (typeof stored.updatedAt === "number") {
              song.updatedAt = stored.updatedAt;
            }
            songs.push(song);
          }
        }

        if (songs.length > 0) {
          const currentId =
            typeof parsed.currentId === "string" &&
            songs.some((song) => song.id === parsed.currentId)
              ? parsed.currentId
              : songs[0].id;

          return { currentId, songs };
        }
      }
    } catch {
      // 資料損毀時改用預設內容，不影響網站使用。
    }
  }

  const legacy = migrateLegacySong();

  if (legacy) {
    return { currentId: legacy.id, songs: [legacy] };
  }

  return createFreshLibrary();
}

export function saveLibrary(library: Library): boolean {
  return writeStorage(
    LIBRARY_KEY,
    JSON.stringify({
      version: 2,
      currentId: library.currentId,
      songs: library.songs.map((song) => ({
        id: song.id,
        updatedAt: song.updatedAt,
        ...serializeSong(song),
      })),
    }),
  );
}

/* ---------- 匯出入 ---------- */

export function exportSongsToJson(songs: readonly Song[]): string {
  return JSON.stringify(
    {
      format: FILE_FORMAT,
      version: 2,
      exportedAt: new Date().toISOString(),
      songs: songs.map(serializeSong),
    },
    null,
    2,
  );
}

/** 解析匯入檔，可接受整份備份或單首歌；格式不對回傳 null。 */
export function parseImportedJson(text: string): Song[] | null {
  try {
    const parsed = JSON.parse(text) as { format?: unknown; songs?: unknown; lines?: unknown };

    const candidates: unknown[] = Array.isArray(parsed.songs)
      ? parsed.songs
      : Array.isArray(parsed.lines)
        ? [parsed]
        : [];

    const songs = candidates
      .slice(0, 200)
      .map((entry) => sanitizeSong(entry))
      .filter((song): song is Song => song !== null);

    return songs.length > 0 ? songs : null;
  } catch {
    return null;
  }
}

/* ---------- 分享連結 ---------- */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let start = 0; start < bytes.length; start += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function readAll(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("資料過大");
    }
    chunks.push(value);
  }

  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function pipeThrough(
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
  limit: number,
): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  void writer.write(bytes as unknown as BufferSource).catch(() => undefined);
  void writer.close().catch(() => undefined);
  return readAll(transform.readable as ReadableStream<Uint8Array>, limit);
}

/** 產生分享用的短字串：瀏覽器支援時先壓縮（z 開頭），否則直接編碼（p 開頭）。 */
export async function encodeShareToken(song: Song): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(serializeSong(song)));

  if (typeof CompressionStream !== "undefined") {
    try {
      const compressed = await pipeThrough(bytes, new CompressionStream("deflate-raw"), MAX_DECODED_BYTES);
      return `z${toBase64Url(compressed)}`;
    } catch {
      // 壓縮失敗時改用未壓縮版本。
    }
  }

  return `p${toBase64Url(bytes)}`;
}

export async function decodeShareToken(token: string): Promise<Song | null> {
  if (token.length < 2 || token.length > MAX_SHARE_TOKEN_LENGTH * 4) {
    return null;
  }

  try {
    const body = fromBase64Url(token.slice(1));
    let json: Uint8Array;

    if (token[0] === "z") {
      if (typeof DecompressionStream === "undefined") {
        return null;
      }
      json = await pipeThrough(body, new DecompressionStream("deflate-raw"), MAX_DECODED_BYTES);
    } else if (token[0] === "p") {
      json = body;
    } else {
      return null;
    }

    return sanitizeSong(JSON.parse(new TextDecoder().decode(json)));
  } catch {
    return null;
  }
}

export function isShareTokenTooLong(token: string): boolean {
  return token.length > MAX_SHARE_TOKEN_LENGTH;
}

export function buildShareUrl(token: string): string {
  return `${window.location.origin}${window.location.pathname}?s=${token}`;
}

/** 讀取網址上的分享內容（新格式 ?s=，也相容舊版 ?chords=）。 */
export async function readSharedSongFromUrl(search: string): Promise<Song | null> {
  const params = new URLSearchParams(search);
  const token = params.get("s");

  if (token) {
    return decodeShareToken(token);
  }

  const legacy = params.get("chords");

  if (legacy) {
    const symbols = legacy
      .split(",")
      .map((symbol) => symbol.trim())
      .filter(isValidSymbol)
      .slice(0, 64);

    if (symbols.length > 0) {
      return createSong(
        asString(params.get("title"), MAX_TITLE_LENGTH),
        linesFromSymbols(symbols, symbols.length),
      );
    }
  }

  return null;
}

export function hasSharedSongInUrl(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("s") || params.has("chords");
}
