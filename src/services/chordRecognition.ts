import { createWorker, PSM } from "tesseract.js";
import { getChordTheory } from "./chordTheory";
import { normalizeChordName } from "../utils/normalizeChordName";
import type {
  ScoreBoundingBox,
  ScoreChordMark,
  ScorePage,
  ScoreRecognitionProgress,
} from "../types/score";

interface TsvWord {
  lineKey: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  text: string;
}

const MIN_CONFIDENCE = 35;
const MAX_JOINED_WORDS = 3;

function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

function cleanOcrToken(value: string): string {
  return value
    .trim()
    .replaceAll("♯", "#")
    .replaceAll("＃", "#")
    .replaceAll("♭", "b")
    .replaceAll("△", "maj")
    .replaceAll("Δ", "maj")
    .replaceAll("ø", "m7b5")
    .replaceAll("Ø", "m7b5")
    .replaceAll("°", "dim")
    .replace(/[()[\]{}<>「」『』【】]/g, "")
    .replace(/^[^A-Ga-g]+/, "")
    .replace(/[^A-Za-z0-9#b/+.-]+$/g, "")
    .replace(/\.$/, "")
    .replace(/-/g, "");
}

function normalizeRecognizedChord(rawValue: string): string | null {
  const cleaned = cleanOcrToken(rawValue);

  if (!cleaned || !/^[A-Ga-g]/.test(cleaned)) {
    return null;
  }

  const normalized = normalizeChordName(cleaned)
    .replace(/^([A-G][#b]?)M7(?=\/|$)/, "$1maj7")
    .replace(/majmaj/gi, "maj");
  const theory = getChordTheory(normalized);

  return theory.valid ? theory.symbol : null;
}

function parseTsv(tsv: string): TsvWord[] {
  const rows = tsv.split(/\r?\n/).slice(1);
  const words: TsvWord[] = [];

  for (const row of rows) {
    if (!row.trim()) {
      continue;
    }

    const columns = row.split("\t");
    if (columns.length < 12) {
      continue;
    }

    const [level, page, block, paragraph, line, word, left, top, width, height, confidence, ...textParts] =
      columns;
    const text = textParts.join("\t").trim();
    const confidenceValue = Number(confidence);

    if (level !== "5" || !text || !Number.isFinite(confidenceValue)) {
      continue;
    }

    words.push({
      lineKey: `${page}-${block}-${paragraph}-${line}-${word ? "line" : ""}`.replace(/-line$/, ""),
      left: Number(left),
      top: Number(top),
      width: Number(width),
      height: Number(height),
      confidence: confidenceValue,
      text,
    });
  }

  return words;
}

function getLineGroupKey(word: TsvWord): string {
  const parts = word.lineKey.split("-");
  return parts.slice(0, 4).join("-");
}

function combineBoundingBoxes(words: readonly TsvWord[]): ScoreBoundingBox {
  const left = Math.min(...words.map((word) => word.left));
  const top = Math.min(...words.map((word) => word.top));
  const right = Math.max(...words.map((word) => word.left + word.width));
  const bottom = Math.max(...words.map((word) => word.top + word.height));

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function wordsAreClose(words: readonly TsvWord[]): boolean {
  for (let index = 1; index < words.length; index += 1) {
    const previous = words[index - 1];
    const current = words[index];
    const gap = current.left - (previous.left + previous.width);
    const allowedGap = Math.max(18, Math.max(previous.height, current.height) * 0.9);

    if (gap > allowedGap) {
      return false;
    }
  }

  return true;
}

function extractMarksFromWords(words: readonly TsvWord[], pageIndex: number): ScoreChordMark[] {
  const lineGroups = new Map<string, TsvWord[]>();

  for (const word of words) {
    const key = getLineGroupKey(word);
    const group = lineGroups.get(key) ?? [];
    group.push(word);
    lineGroups.set(key, group);
  }

  const marks: ScoreChordMark[] = [];

  for (const group of lineGroups.values()) {
    group.sort((left, right) => left.left - right.left);
    let wordIndex = 0;

    while (wordIndex < group.length) {
      let acceptedLength = 0;
      let acceptedSymbol: string | null = null;
      let acceptedWords: TsvWord[] = [];

      for (
        let length = Math.min(MAX_JOINED_WORDS, group.length - wordIndex);
        length >= 1;
        length -= 1
      ) {
        const candidateWords = group.slice(wordIndex, wordIndex + length);
        if (!wordsAreClose(candidateWords)) {
          continue;
        }

        const rawCandidate = candidateWords.map((word) => word.text).join("");
        const symbol = normalizeRecognizedChord(rawCandidate);

        if (symbol) {
          acceptedLength = length;
          acceptedSymbol = symbol;
          acceptedWords = candidateWords;
          break;
        }
      }

      if (!acceptedSymbol || acceptedWords.length === 0) {
        wordIndex += 1;
        continue;
      }

      const confidence =
        acceptedWords.reduce((total, word) => total + word.confidence, 0) / acceptedWords.length;

      if (confidence >= MIN_CONFIDENCE) {
        marks.push({
          id: createId("ocr-chord"),
          pageIndex,
          sourceText: acceptedWords.map((word) => word.text).join(" "),
          sourceSymbol: acceptedSymbol,
          symbol: acceptedSymbol,
          confidence,
          bbox: combineBoundingBoxes(acceptedWords),
        });
      }

      wordIndex += Math.max(1, acceptedLength);
    }
  }

  return marks.sort((left, right) => {
    if (left.pageIndex !== right.pageIndex) {
      return left.pageIndex - right.pageIndex;
    }

    const rowDistance = left.bbox.y - right.bbox.y;
    return Math.abs(rowDistance) > 12 ? rowDistance : left.bbox.x - right.bbox.x;
  });
}

export async function recognizeScoreChords(
  pages: readonly ScorePage[],
  onProgress?: (progress: ScoreRecognitionProgress) => void,
): Promise<ScoreChordMark[]> {
  if (pages.length === 0) {
    return [];
  }

  let currentPageIndex = 0;
  const worker = await createWorker("eng", 1, {
    logger(message) {
      const progressValue = typeof message.progress === "number" ? message.progress : 0;
      const status = typeof message.status === "string" ? message.status : "辨識中";
      onProgress?.({
        pageIndex: currentPageIndex,
        pageCount: pages.length,
        status,
        progress: progressValue,
      });
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });

    const marks: ScoreChordMark[] = [];

    for (let index = 0; index < pages.length; index += 1) {
      currentPageIndex = index;
      onProgress?.({
        pageIndex: index,
        pageCount: pages.length,
        status: `正在辨識第 ${index + 1} 頁`,
        progress: 0,
      });

      const result = await worker.recognize(pages[index].dataUrl, {}, { tsv: true });
      const tsv = typeof result.data.tsv === "string" ? result.data.tsv : "";
      marks.push(...extractMarksFromWords(parseTsv(tsv), index));
    }

    return marks;
  } finally {
    await worker.terminate();
  }
}

export function uniqueRecognizedSymbols(marks: readonly ScoreChordMark[]): string[] {
  const seen = new Set<string>();
  const symbols: string[] = [];

  for (const mark of marks) {
    if (!seen.has(mark.symbol)) {
      seen.add(mark.symbol);
      symbols.push(mark.symbol);
    }
  }

  return symbols;
}
