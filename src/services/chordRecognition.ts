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

interface ColorComponent {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

interface ColorChordRegion {
  dataUrl: string;
  bbox: ScoreBoundingBox;
}

type RecognitionPass = "original" | "color-region";

interface ScoreChordCandidate extends ScoreChordMark {
  recognitionPass: RecognitionPass;
}

const MIN_CANDIDATE_CONFIDENCE = 20;
const MIN_REPEATED_CONFIDENCE = 35;
const MIN_UNIQUE_COMPLEX_CONFIDENCE = 45;
const MIN_UNIQUE_SIMPLE_CONFIDENCE = 64;
const MIN_COLOR_REGION_CONFIDENCE = 0;
const MAX_JOINED_WORDS = 3;

const MAX_ANALYSIS_DIMENSION = 2200;
const MAX_COLOR_COMPONENTS = 1800;
const MAX_COLOR_REGIONS = 120;
const MIN_COLOR_PIXEL_COUNT = 16;
const REGION_TARGET_HEIGHT = 180;

const SUPPORTED_SUFFIXES = new Set<string>(
  CHORD_TYPE_OPTIONS.map((option) => option.suffix),
);

const CHORD_CHARACTER_WHITELIST =
  "ABCDEFGabcdefg#bMmmajinsud24579/";
const ROOT_CHARACTER_WHITELIST = "ABCDEFG";

function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
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

  if (
    lowerSuffix === "min" ||
    lowerSuffix === "minor" ||
    lowerSuffix === "in" ||
    lowerSuffix === "rn"
  ) {
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
    const gap = current.left - (previous.left + previous.width);
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
          recognitionPass: "original",
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

function getRoot(symbol: string): string {
  return symbol.match(/^[A-G](?:#|b)?/)?.[0] ?? symbol;
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
    Math.max(left.width, right.width) * 1.35,
  );
  const allowedY = Math.max(
    14,
    Math.max(left.height, right.height) * 1.35,
  );

  return (
    Math.abs(leftCenterX - rightCenterX) <= allowedX &&
    Math.abs(leftCenterY - rightCenterY) <= allowedY
  );
}

function candidatePriority(candidate: ScoreChordCandidate): number {
  const passBonus = candidate.recognitionPass === "color-region" ? 12 : 0;
  const complexBonus =
    candidate.symbol.length > getRoot(candidate.symbol).length ? 52 : 0;
  return candidate.confidence + passBonus + complexBonus;
}

function resolveOverlappingCandidates(
  candidates: readonly ScoreChordCandidate[],
): ScoreChordCandidate[] {
  const sorted = [...candidates].sort(
    (left, right) => candidatePriority(right) - candidatePriority(left),
  );
  const accepted: ScoreChordCandidate[] = [];

  for (const candidate of sorted) {
    const competingIndex = accepted.findIndex(
      (current) =>
        current.pageIndex === candidate.pageIndex &&
        boxesOverlap(current.bbox, candidate.bbox),
    );

    if (competingIndex < 0) {
      accepted.push(candidate);
      continue;
    }

    const current = accepted[competingIndex];
    const sameSymbol = current.symbol === candidate.symbol;
    const sameRoot = getRoot(current.symbol) === getRoot(candidate.symbol);

    if (!sameSymbol && !sameRoot) {
      continue;
    }

    if (candidatePriority(candidate) > candidatePriority(current)) {
      accepted[competingIndex] = candidate;
    }
  }

  return accepted;
}

function filterLikelyChordMarks(
  candidates: readonly ScoreChordCandidate[],
): ScoreChordMark[] {
  const resolved = resolveOverlappingCandidates(candidates);
  const symbolCounts = new Map<string, number>();

  for (const candidate of resolved) {
    symbolCounts.set(
      candidate.symbol,
      (symbolCounts.get(candidate.symbol) ?? 0) + 1,
    );
  }

  return resolved
    .filter((candidate) => {
      if (candidate.recognitionPass === "color-region") {
        return candidate.confidence >= MIN_COLOR_REGION_CONFIDENCE;
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
      reject(new Error("無法載入歌譜圖片進行專用和弦辨識。"));
    image.src = dataUrl;
  });
}

function isColoredPixel(red: number, green: number, blue: number): boolean {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const chroma = maximum - minimum;
  const saturation = maximum === 0 ? 0 : chroma / maximum;

  return (
    chroma >= 28 &&
    saturation >= 0.18 &&
    maximum <= 252 &&
    minimum <= 232
  );
}

function findColorComponents(
  binary: Uint8Array,
  width: number,
  height: number,
): ColorComponent[] {
  const components: ColorComponent[] = [];
  const stack: number[] = [];

  for (let startIndex = 0; startIndex < binary.length; startIndex += 1) {
    if (binary[startIndex] === 0) {
      continue;
    }

    binary[startIndex] = 0;
    stack.push(startIndex);

    let minimumX = width;
    let maximumX = 0;
    let minimumY = height;
    let maximumY = 0;
    let area = 0;

    while (stack.length > 0) {
      const currentIndex = stack.pop();
      if (currentIndex === undefined) {
        break;
      }

      const x = currentIndex % width;
      const y = Math.floor(currentIndex / width);
      minimumX = Math.min(minimumX, x);
      maximumX = Math.max(maximumX, x);
      minimumY = Math.min(minimumY, y);
      maximumY = Math.max(maximumY, y);
      area += 1;

      const left = currentIndex - 1;
      const right = currentIndex + 1;
      const above = currentIndex - width;
      const below = currentIndex + width;

      if (x > 0 && binary[left] === 1) {
        binary[left] = 0;
        stack.push(left);
      }
      if (x + 1 < width && binary[right] === 1) {
        binary[right] = 0;
        stack.push(right);
      }
      if (y > 0 && binary[above] === 1) {
        binary[above] = 0;
        stack.push(above);
      }
      if (y + 1 < height && binary[below] === 1) {
        binary[below] = 0;
        stack.push(below);
      }
    }

    const componentWidth = maximumX - minimumX + 1;
    const componentHeight = maximumY - minimumY + 1;

    if (
      area >= 3 &&
      componentWidth >= 2 &&
      componentHeight >= 3 &&
      componentWidth <= width * 0.15 &&
      componentHeight <= height * 0.12
    ) {
      components.push({
        x: minimumX,
        y: minimumY,
        width: componentWidth,
        height: componentHeight,
        area,
      });
    }

    if (components.length > MAX_COLOR_COMPONENTS) {
      return [];
    }
  }

  return components;
}

function verticalOverlapRatio(
  left: ColorComponent,
  right: ColorComponent,
): number {
  const overlap = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) -
      Math.max(left.y, right.y),
  );
  return overlap / Math.max(1, Math.min(left.height, right.height));
}

function mergeComponents(
  components: readonly ColorComponent[],
): ColorComponent[] {
  const sorted = [...components].sort((left, right) => {
    const rowDistance = left.y - right.y;
    return Math.abs(rowDistance) > 4 ? rowDistance : left.x - right.x;
  });
  const groups: ColorComponent[] = [];

  for (const component of sorted) {
    const matchingIndex = groups.findIndex((group) => {
      const horizontalGap = Math.max(
        0,
        component.x - (group.x + group.width),
        group.x - (component.x + component.width),
      );
      const allowedGap = Math.max(
        5,
        Math.max(group.height, component.height) * 0.85,
      );

      return (
        verticalOverlapRatio(group, component) >= 0.42 &&
        horizontalGap <= allowedGap
      );
    });

    if (matchingIndex < 0) {
      groups.push({ ...component });
      continue;
    }

    const group = groups[matchingIndex];
    const right = Math.max(
      group.x + group.width,
      component.x + component.width,
    );
    const bottom = Math.max(
      group.y + group.height,
      component.y + component.height,
    );
    group.x = Math.min(group.x, component.x);
    group.y = Math.min(group.y, component.y);
    group.width = right - group.x;
    group.height = bottom - group.y;
    group.area += component.area;
  }

  return groups.filter((group) => {
    const fillRatio = group.area / Math.max(1, group.width * group.height);
    return (
      group.area >= 8 &&
      group.height >= 6 &&
      group.width <= group.height * 7.5 &&
      fillRatio >= 0.035
    );
  });
}

function createRegionCanvas(
  sourceCanvas: HTMLCanvasElement,
  bbox: ScoreBoundingBox,
): string {
  const padding = Math.max(5, Math.round(bbox.height * 0.55));
  const sourceX = clamp(Math.floor(bbox.x - padding), 0, sourceCanvas.width - 1);
  const sourceY = clamp(Math.floor(bbox.y - padding), 0, sourceCanvas.height - 1);
  const sourceRight = clamp(
    Math.ceil(bbox.x + bbox.width + padding),
    sourceX + 1,
    sourceCanvas.width,
  );
  const sourceBottom = clamp(
    Math.ceil(bbox.y + bbox.height + padding),
    sourceY + 1,
    sourceCanvas.height,
  );
  const sourceWidth = sourceRight - sourceX;
  const sourceHeight = sourceBottom - sourceY;
  const scale = clamp(REGION_TARGET_HEIGHT / sourceHeight, 4, 14);

  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(sourceWidth * scale) + 40);
  output.height = Math.max(1, Math.round(sourceHeight * scale) + 40);
  const context = output.getContext("2d");

  if (!context) {
    throw new Error("瀏覽器無法建立和弦文字放大畫布。");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    sourceCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    20,
    20,
    Math.round(sourceWidth * scale),
    Math.round(sourceHeight * scale),
  );

  return output.toDataURL("image/png");
}

async function createColorChordRegions(
  dataUrl: string,
): Promise<ColorChordRegion[]> {
  const image = await loadImage(dataUrl);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;
  const analysisScale = Math.min(
    1,
    MAX_ANALYSIS_DIMENSION / Math.max(originalWidth, originalHeight),
  );
  const analysisWidth = Math.max(1, Math.round(originalWidth * analysisScale));
  const analysisHeight = Math.max(1, Math.round(originalHeight * analysisScale));

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = originalWidth;
  sourceCanvas.height = originalHeight;
  const sourceContext = sourceCanvas.getContext("2d");

  const analysisCanvas = document.createElement("canvas");
  analysisCanvas.width = analysisWidth;
  analysisCanvas.height = analysisHeight;
  const analysisContext = analysisCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!sourceContext || !analysisContext) {
    throw new Error("瀏覽器無法建立專用和弦辨識畫布。");
  }

  sourceContext.drawImage(image, 0, 0, originalWidth, originalHeight);
  analysisContext.drawImage(image, 0, 0, analysisWidth, analysisHeight);

  const imageData = analysisContext.getImageData(
    0,
    0,
    analysisWidth,
    analysisHeight,
  );
  const binary = new Uint8Array(analysisWidth * analysisHeight);
  let colorPixelCount = 0;

  for (let index = 0; index < binary.length; index += 1) {
    const offset = index * 4;
    if (
      isColoredPixel(
        imageData.data[offset],
        imageData.data[offset + 1],
        imageData.data[offset + 2],
      )
    ) {
      binary[index] = 1;
      colorPixelCount += 1;
    }
  }

  if (colorPixelCount < MIN_COLOR_PIXEL_COUNT) {
    return [];
  }

  const components = findColorComponents(
    binary,
    analysisWidth,
    analysisHeight,
  );
  const groups = mergeComponents(components).slice(0, MAX_COLOR_REGIONS);
  const inverseScale = 1 / analysisScale;

  return groups.map((group) => {
    const bbox: ScoreBoundingBox = {
      x: group.x * inverseScale,
      y: group.y * inverseScale,
      width: group.width * inverseScale,
      height: group.height * inverseScale,
    };

    return {
      bbox,
      dataUrl: createRegionCanvas(sourceCanvas, bbox),
    };
  });
}

function getRecognitionConfidence(result: unknown): number {
  if (
    typeof result === "object" &&
    result !== null &&
    "data" in result
  ) {
    const data = (result as { data?: { confidence?: unknown } }).data;
    if (typeof data?.confidence === "number") {
      return data.confidence;
    }
  }

  return 0;
}

function getRecognitionText(result: unknown): string {
  if (
    typeof result === "object" &&
    result !== null &&
    "data" in result
  ) {
    const data = (result as { data?: { text?: unknown } }).data;
    if (typeof data?.text === "string") {
      return data.text;
    }
  }

  return "";
}

async function recognizeColorRegions(
  worker: Awaited<ReturnType<typeof createWorker>>,
  regions: readonly ColorChordRegion[],
  pageIndex: number,
  onRegionProgress?: (completed: number, total: number) => void,
): Promise<ScoreChordCandidate[]> {
  const candidates: ScoreChordCandidate[] = [];
  const wideRegions = regions.filter(
    (region) => region.bbox.width / Math.max(1, region.bbox.height) >= 1.35,
  );
  const totalSteps = regions.length + wideRegions.length;
  let completedSteps = 0;

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_CHAR,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
    tessedit_char_whitelist: ROOT_CHARACTER_WHITELIST,
  });

  for (const region of regions) {
    const result = await worker.recognize(region.dataUrl);
    const rawText = getRecognitionText(result);
    const symbol = normalizeRecognizedChord(rawText);

    if (symbol && isSimpleMajorChord(symbol)) {
      candidates.push({
        id: createId("color-root"),
        pageIndex,
        sourceText: rawText.trim(),
        sourceSymbol: symbol,
        symbol,
        confidence: getRecognitionConfidence(result),
        bbox: region.bbox,
        recognitionPass: "color-region",
      });
    }

    completedSteps += 1;
    onRegionProgress?.(completedSteps, totalSteps);
  }

  if (wideRegions.length === 0) {
    return candidates;
  }

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_CHAR,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
    tessedit_char_whitelist: CHORD_CHARACTER_WHITELIST,
  });

  for (const region of wideRegions) {
    const result = await worker.recognize(region.dataUrl);
    const rawText = getRecognitionText(result);
    const symbol = normalizeRecognizedChord(rawText);

    if (symbol && !isSimpleMajorChord(symbol)) {
      candidates.push({
        id: createId("color-chord"),
        pageIndex,
        sourceText: rawText.trim(),
        sourceSymbol: symbol,
        symbol,
        confidence: getRecognitionConfidence(result),
        bbox: region.bbox,
        recognitionPass: "color-region",
      });
    }

    completedSteps += 1;
    onRegionProgress?.(completedSteps, totalSteps);
  }

  return candidates;
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
        ...extractCandidatesFromWords(parseTsv(originalTsv), index),
      );

      currentPassLabel = "尋找彩色和弦";
      onProgress?.({
        pageIndex: index,
        pageCount: pages.length,
        status: `正在找出第 ${index + 1} 頁的彩色和弦位置`,
        progress: 0,
      });

      const regions = await createColorChordRegions(
        pages[index].dataUrl,
      );

      if (regions.length === 0) {
        continue;
      }

      currentPassLabel = "逐字放大辨識";
      candidates.push(
        ...(await recognizeColorRegions(
          worker,
          regions,
          index,
          (completed, total) => {
            onProgress?.({
              pageIndex: index,
              pageCount: pages.length,
              status: `逐字放大辨識：${completed}/${total}`,
              progress: total > 0 ? completed / total : 0,
            });
          },
        )),
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
