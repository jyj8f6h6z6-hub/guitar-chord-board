import { createWorker, PSM } from "tesseract.js";
import { CHORD_TYPE_OPTIONS } from "../data/chordTypes";
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

type RecognitionPass = "original" | "color";

interface ScoreChordCandidate extends ScoreChordMark {
  recognitionPass: RecognitionPass;
}

const MIN_CANDIDATE_CONFIDENCE = 20;
const MIN_REPEATED_CONFIDENCE = 35;
const MIN_UNIQUE_COMPLEX_CONFIDENCE = 45;
const MIN_UNIQUE_SIMPLE_CONFIDENCE = 64;
const MIN_COLOR_CONFIDENCE = 18;
const MAX_JOINED_WORDS = 3;
const MIN_COLOR_PIXEL_COUNT = 20;

const SUPPORTED_SUFFIXES = new Set(
  CHORD_TYPE_OPTIONS.map((option) => option.suffix),
);

const CHORD_CHARACTER_WHITELIST =
  "ABCDEFGabcdefg#bMmmajinsud24579/";

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
    .replace(/[()[\]{}<>「」『』【】]/g, "")
    .replace(/^[`'".,，:：;；!?！？|_=~]+/g, "")
    .replace(/[`'".,，:：;；!?！？|_=~]+$/g, "")
    .replace(/\s+/g, "");
}

function normalizeRecognizedSuffix(rawSuffix: string): string | null {
  if (SUPPORTED_SUFFIXES.has(rawSuffix)) {
    return rawSuffix;
  }

  const lowerSuffix = rawSuffix.toLowerCase();

  if (rawSuffix === "M7" || lowerSuffix === "major7") {
    return "maj7";
  }

  if (lowerSuffix === "maj") {
    return "";
  }

  if (lowerSuffix === "min" || lowerSuffix === "minor") {
    return "m";
  }

  if (lowerSuffix === "min7" || lowerSuffix === "minor7") {
    return "m7";
  }

  if (lowerSuffix === "maj9" || lowerSuffix === "major9") {
    return "maj9";
  }

  if (lowerSuffix === "sus4") {
    return "sus4";
  }

  if (lowerSuffix === "sus2") {
    return "sus2";
  }

  if (lowerSuffix === "add9") {
    return "add9";
  }

  if (lowerSuffix === "m7b5") {
    return "m7b5";
  }

  if (rawSuffix === "mM7") {
    return "mM7";
  }

  if (lowerSuffix === "7#9") {
    return "7#9";
  }

  return null;
}

function normalizeRecognizedChord(rawValue: string): string | null {
  const cleaned = cleanOcrToken(rawValue);

  if (!cleaned) {
    return null;
  }

  const slashParts = cleaned.split("/");
  if (slashParts.length > 2) {
    return null;
  }

  const chordPart = slashParts[0];
  const bassPart = slashParts[1];

  const chordMatch = chordPart.match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!chordMatch) {
    return null;
  }

  const [, rawRoot, accidental, rawSuffix] = chordMatch;
  const suffix = normalizeRecognizedSuffix(rawSuffix);
  if (suffix === null) {
    return null;
  }

  let bass = "";
  if (bassPart !== undefined) {
    const bassMatch = bassPart.match(/^([A-Ga-g])([#b]?)$/);
    if (!bassMatch) {
      return null;
    }

    bass = `/${bassMatch[1].toUpperCase()}${bassMatch[2]}`;
  }

  const normalized = normalizeChordName(
    `${rawRoot.toUpperCase()}${accidental}${suffix}${bass}`,
  );
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

    const [
      level,
      page,
      block,
      paragraph,
      line,
      word,
      left,
      top,
      width,
      height,
      confidence,
      ...textParts
    ] = columns;

    const text = textParts.join("\t").trim();
    const confidenceValue = Number(confidence);

    if (
      level !== "5" ||
      !text ||
      !Number.isFinite(confidenceValue)
    ) {
      continue;
    }

    words.push({
      lineKey: `${page}-${block}-${paragraph}-${line}-${word ? "line" : ""}`.replace(
        /-line$/,
        "",
      ),
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

function combineBoundingBoxes(
  words: readonly TsvWord[],
): ScoreBoundingBox {
  const left = Math.min(...words.map((word) => word.left));
  const top = Math.min(...words.map((word) => word.top));
  const right = Math.max(
    ...words.map((word) => word.left + word.width),
  );
  const bottom = Math.max(
    ...words.map((word) => word.top + word.height),
  );

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
    const gap =
      current.left - (previous.left + previous.width);
    const allowedGap = Math.max(
      18,
      Math.max(previous.height, current.height) * 0.9,
    );

    if (gap > allowedGap) {
      return false;
    }
  }

  return true;
}

function extractCandidatesFromWords(
  words: readonly TsvWord[],
  pageIndex: number,
  recognitionPass: RecognitionPass,
): ScoreChordCandidate[] {
  const lineGroups = new Map<string, TsvWord[]>();

  for (const word of words) {
    const key = getLineGroupKey(word);
    const group = lineGroups.get(key) ?? [];
    group.push(word);
    lineGroups.set(key, group);
  }

  const candidates: ScoreChordCandidate[] = [];

  for (const group of lineGroups.values()) {
    group.sort((left, right) => left.left - right.left);
    let wordIndex = 0;

    while (wordIndex < group.length) {
      let acceptedLength = 0;
      let acceptedSymbol: string | null = null;
      let acceptedWords: TsvWord[] = [];

      for (
        let length = Math.min(
          MAX_JOINED_WORDS,
          group.length - wordIndex,
        );
        length >= 1;
        length -= 1
      ) {
        const candidateWords = group.slice(
          wordIndex,
          wordIndex + length,
        );

        if (!wordsAreClose(candidateWords)) {
          continue;
        }

        const rawCandidate = candidateWords
          .map((word) => word.text)
          .join("");
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
        acceptedWords.reduce(
          (total, word) => total + word.confidence,
          0,
        ) / acceptedWords.length;

      if (confidence >= MIN_CANDIDATE_CONFIDENCE) {
        candidates.push({
          id: createId("ocr-chord"),
          pageIndex,
          sourceText: acceptedWords
            .map((word) => word.text)
            .join(" "),
          sourceSymbol: acceptedSymbol,
          symbol: acceptedSymbol,
          confidence,
          bbox: combineBoundingBoxes(acceptedWords),
          recognitionPass,
        });
      }

      wordIndex += Math.max(1, acceptedLength);
    }
  }

  return candidates;
}

function isSimpleMajorChord(symbol: string): boolean {
  return /^[A-G](?:#|b)?$/.test(symbol);
}

function boxesOverlap(
  left: ScoreBoundingBox,
  right: ScoreBoundingBox,
): boolean {
  const leftCenterX = left.x + left.width / 2;
  const leftCenterY = left.y + left.height / 2;
  const rightCenterX = right.x + right.width / 2;
  const rightCenterY = right.y + right.height / 2;

  const allowedX = Math.max(
    20,
    Math.max(left.width, right.width) * 1.2,
  );
  const allowedY = Math.max(
    14,
    Math.max(left.height, right.height) * 1.2,
  );

  return (
    Math.abs(leftCenterX - rightCenterX) <= allowedX &&
    Math.abs(leftCenterY - rightCenterY) <= allowedY
  );
}

function removeDuplicateCandidates(
  candidates: readonly ScoreChordCandidate[],
): ScoreChordCandidate[] {
  const sorted = [...candidates].sort((left, right) => {
    if (left.recognitionPass !== right.recognitionPass) {
      return left.recognitionPass === "color" ? -1 : 1;
    }

    return right.confidence - left.confidence;
  });

  const accepted: ScoreChordCandidate[] = [];

  for (const candidate of sorted) {
    const duplicateIndex = accepted.findIndex(
      (current) =>
        current.pageIndex === candidate.pageIndex &&
        current.symbol === candidate.symbol &&
        boxesOverlap(current.bbox, candidate.bbox),
    );

    if (duplicateIndex < 0) {
      accepted.push(candidate);
      continue;
    }

    if (candidate.confidence > accepted[duplicateIndex].confidence) {
      accepted[duplicateIndex] = candidate;
    }
  }

  return accepted;
}

function filterLikelyChordMarks(
  candidates: readonly ScoreChordCandidate[],
): ScoreChordMark[] {
  const deduplicated = removeDuplicateCandidates(candidates);
  const symbolCounts = new Map<string, number>();

  for (const candidate of deduplicated) {
    symbolCounts.set(
      candidate.symbol,
      (symbolCounts.get(candidate.symbol) ?? 0) + 1,
    );
  }

  return deduplicated
    .filter((candidate) => {
      if (candidate.recognitionPass === "color") {
        return candidate.confidence >= MIN_COLOR_CONFIDENCE;
      }

      const count = symbolCounts.get(candidate.symbol) ?? 0;

      if (count >= 2) {
        return candidate.confidence >= MIN_REPEATED_CONFIDENCE;
      }

      if (isSimpleMajorChord(candidate.symbol)) {
        return candidate.confidence >= MIN_UNIQUE_SIMPLE_CONFIDENCE;
      }

      return candidate.confidence >= MIN_UNIQUE_COMPLEX_CONFIDENCE;
    })
    .map(({ recognitionPass: _recognitionPass, ...mark }) => mark)
    .sort((left, right) => {
      if (left.pageIndex !== right.pageIndex) {
        return left.pageIndex - right.pageIndex;
      }

      const rowDistance = left.bbox.y - right.bbox.y;
      return Math.abs(rowDistance) > 12
        ? rowDistance
        : left.bbox.x - right.bbox.x;
    });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("無法載入歌譜圖片進行彩色和弦辨識。"));
    image.src = dataUrl;
  });
}

async function createColorChordMask(
  dataUrl: string,
): Promise<string | null> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error("瀏覽器無法建立彩色和弦辨識畫布。");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const source = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const binary = new Uint8Array(canvas.width * canvas.height);
  let colorPixelCount = 0;

  for (let index = 0; index < binary.length; index += 1) {
    const offset = index * 4;
    const red = source.data[offset];
    const green = source.data[offset + 1];
    const blue = source.data[offset + 2];

    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const chroma = maximum - minimum;
    const saturation = maximum === 0 ? 0 : chroma / maximum;

    const isColoredText =
      chroma >= 34 &&
      saturation >= 0.22 &&
      maximum <= 250 &&
      minimum <= 225;

    if (isColoredText) {
      binary[index] = 1;
      colorPixelCount += 1;
    }
  }

  if (colorPixelCount < MIN_COLOR_PIXEL_COUNT) {
    return null;
  }

  const output = context.createImageData(
    canvas.width,
    canvas.height,
  );

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      let isTextPixel = false;

      for (
        let offsetY = -1;
        offsetY <= 1 && !isTextPixel;
        offsetY += 1
      ) {
        const neighborY = y + offsetY;
        if (neighborY < 0 || neighborY >= canvas.height) {
          continue;
        }

        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const neighborX = x + offsetX;
          if (neighborX < 0 || neighborX >= canvas.width) {
            continue;
          }

          if (binary[neighborY * canvas.width + neighborX] === 1) {
            isTextPixel = true;
            break;
          }
        }
      }

      const outputOffset = (y * canvas.width + x) * 4;
      const value = isTextPixel ? 0 : 255;

      output.data[outputOffset] = value;
      output.data[outputOffset + 1] = value;
      output.data[outputOffset + 2] = value;
      output.data[outputOffset + 3] = 255;
    }
  }

  context.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function recognizeScoreChords(
  pages: readonly ScorePage[],
  onProgress?: (
    progress: ScoreRecognitionProgress,
  ) => void,
): Promise<ScoreChordMark[]> {
  if (pages.length === 0) {
    return [];
  }

  let currentPageIndex = 0;
  let currentPassLabel = "原圖";
  const worker = await createWorker("eng", 1, {
    logger(message) {
      const progressValue =
        typeof message.progress === "number"
          ? message.progress
          : 0;
      const status =
        typeof message.status === "string"
          ? message.status
          : "辨識中";

      onProgress?.({
        pageIndex: currentPageIndex,
        pageCount: pages.length,
        status: `${currentPassLabel}：${status}`,
        progress: progressValue,
      });
    },
  });

  try {
    const candidates: ScoreChordCandidate[] = [];

    for (let index = 0; index < pages.length; index += 1) {
      currentPageIndex = index;

      currentPassLabel = "原圖";
      onProgress?.({
        pageIndex: index,
        pageCount: pages.length,
        status: `正在辨識第 ${index + 1} 頁原圖`,
        progress: 0,
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
        tessedit_char_whitelist: "",
      });

      const originalResult = await worker.recognize(
        pages[index].dataUrl,
        {},
        { tsv: true },
      );
      const originalTsv =
        typeof originalResult.data.tsv === "string"
          ? originalResult.data.tsv
          : "";

      candidates.push(
        ...extractCandidatesFromWords(
          parseTsv(originalTsv),
          index,
          "original",
        ),
      );

      const colorMask = await createColorChordMask(
        pages[index].dataUrl,
      );

      if (!colorMask) {
        continue;
      }

      currentPassLabel = "彩色和弦";
      onProgress?.({
        pageIndex: index,
        pageCount: pages.length,
        status: `正在辨識第 ${index + 1} 頁彩色和弦`,
        progress: 0,
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
        tessedit_char_whitelist: CHORD_CHARACTER_WHITELIST,
      });

      const colorResult = await worker.recognize(
        colorMask,
        {},
        { tsv: true },
      );
      const colorTsv =
        typeof colorResult.data.tsv === "string"
          ? colorResult.data.tsv
          : "";

      candidates.push(
        ...extractCandidatesFromWords(
          parseTsv(colorTsv),
          index,
          "color",
        ),
      );
    }

    return filterLikelyChordMarks(candidates);
  } finally {
    await worker.terminate();
  }
}

export function uniqueRecognizedSymbols(
  marks: readonly ScoreChordMark[],
): string[] {
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
