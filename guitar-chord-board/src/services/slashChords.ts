import { Chord, Note } from "tonal";
import type { Barre, ChordShape, FretValue } from "../types/chord";

/** 標準調弦由六弦到一弦（E A D G B e）的音級（pitch class）。 */
const OPEN_STRING_PITCH_CLASSES = [4, 9, 2, 7, 11, 4] as const;
const BASS_STRING_COUNT = 4;
const MAX_FRET = 15;
const MAX_SEARCH_FRET = 12;
const MIN_SHAPES_BEFORE_SEARCH = 3;
const MAX_FRET_SPREAD = 3;
const MAX_FINGERS = 4;
const MAX_SHAPES_PER_CHORD = 5;
const STRING_LABELS = ["6 弦", "5 弦", "4 弦", "3 弦"] as const;

interface Fingering {
  fingers: (number | null)[];
  barres: Barre[];
  fingerCount: number;
}

function pitchClassAt(stringIndex: number, fret: number): number {
  return (OPEN_STRING_PITCH_CLASSES[stringIndex] + fret) % 12;
}

interface ChordRequirements {
  required: Set<number>;
  /** 和弦所有組成音（含五度）；演奏的音只能是這些加上低音。 */
  allowed: Set<number>;
  rootPitchClass: number;
  /** 四個音以上的和弦（七和弦、九和弦）可以省略根音，由低音承擔。 */
  rootOptional: boolean;
  fifthPitchClass: number | null;
}

/** 和弦必須聽得出來的音：除了完全五度（可省略）以外的所有組成音。 */
function getRequirements(baseSymbol: string): ChordRequirements | null {
  const chord = Chord.get(baseSymbol);
  const rootPitchClass = Note.chroma(chord.tonic ?? "");

  if (chord.empty || typeof rootPitchClass !== "number") {
    return null;
  }

  const required = new Set<number>();
  const allowed = new Set<number>();
  let fifthPitchClass: number | null = null;

  chord.notes.forEach((note, index) => {
    const chroma = Note.chroma(note);
    if (typeof chroma !== "number") {
      return;
    }

    allowed.add(chroma);

    if (chord.intervals[index] === "5P") {
      fifthPitchClass = chroma;
      return;
    }

    required.add(chroma);
  });

  return {
    required,
    allowed,
    rootPitchClass,
    rootOptional: required.size >= 4,
    fifthPitchClass,
  };
}

/** 依琴格推算手指：同一琴格兩弦以上優先用橫按，其餘由低格到高格依序分配。 */
function solveFingering(frets: readonly FretValue[]): Fingering | null {
  const fingers: (number | null)[] = frets.map(() => null);
  const fretted = frets
    .map((fret, index) => ({ fret, index }))
    .filter((entry): entry is { fret: number; index: number } =>
      typeof entry.fret === "number" && entry.fret > 0,
    );

  if (fretted.length === 0) {
    return { fingers, barres: [], fingerCount: 0 };
  }

  const minFret = Math.min(...fretted.map((entry) => entry.fret));
  const atMinFret = fretted.filter((entry) => entry.fret === minFret);
  const barres: Barre[] = [];
  let nextFinger = 1;
  let remaining = fretted;

  if (atMinFret.length >= 2) {
    const from = Math.min(...atMinFret.map((entry) => entry.index));
    const to = Math.max(...atMinFret.map((entry) => entry.index));
    const blocked = frets
      .slice(from, to + 1)
      .some((fret) => fret === 0 || fret === "x");

    if (!blocked) {
      atMinFret.forEach((entry) => {
        fingers[entry.index] = 1;
      });
      barres.push({ fret: minFret, fromString: from + 1, toString: to + 1, finger: 1 });
      nextFinger = 2;
      remaining = fretted.filter((entry) => entry.fret !== minFret);
    }
  }

  const ordered = [...remaining].sort(
    (left, right) => left.fret - right.fret || left.index - right.index,
  );

  for (const entry of ordered) {
    fingers[entry.index] = nextFinger;
    nextFinger += 1;
  }

  const fingerCount = nextFinger - 1;

  if (fingerCount > MAX_FINGERS) {
    return null;
  }

  return { fingers, barres, fingerCount };
}

function describeShape(frets: readonly FretValue[]): {
  baseFret: number;
  hasOpenString: boolean;
} | null {
  const numbers = frets.filter((fret): fret is number => typeof fret === "number");
  const fretted = numbers.filter((fret) => fret > 0);
  const hasOpenString = numbers.includes(0);

  if (fretted.length === 0) {
    return { baseFret: 1, hasOpenString };
  }

  const minFretted = Math.min(...fretted);
  const maxFret = Math.max(...fretted);

  if (maxFret - minFretted > MAX_FRET_SPREAD) {
    return null;
  }

  // 有空弦時圖面必須從琴枕開始，因此全部要落在前五格。
  if (hasOpenString) {
    return maxFret <= 5 ? { baseFret: 1, hasOpenString } : null;
  }

  return { baseFret: Math.max(1, minFretted), hasOpenString };
}

interface Candidate {
  shape: ChordShape;
  score: number;
}

function hasRequiredTones(
  frets: readonly FretValue[],
  requirements: ChordRequirements,
  bassPitchClass: number,
): { ok: boolean; hasFifth: boolean; rootPresent: boolean; soundingCount: number } {
  const pitchClasses = new Set<number>();
  let soundingCount = 0;

  frets.forEach((value, index) => {
    if (typeof value === "number") {
      pitchClasses.add(pitchClassAt(index, value));
      soundingCount += 1;
    }
  });

  // 不屬於和弦、也不是低音的音會讓和弦變成別的和弦，直接排除。
  for (const pitchClass of pitchClasses) {
    if (pitchClass !== bassPitchClass && !requirements.allowed.has(pitchClass)) {
      return { ok: false, hasFifth: false, rootPresent: false, soundingCount };
    }
  }

  const rootPresent = pitchClasses.has(requirements.rootPitchClass);
  const hasFifth =
    requirements.fifthPitchClass !== null &&
    pitchClasses.has(requirements.fifthPitchClass);

  for (const pitchClass of requirements.required) {
    if (pitchClasses.has(pitchClass)) {
      continue;
    }

    const isOmittableRoot =
      requirements.rootOptional &&
      pitchClass === requirements.rootPitchClass &&
      pitchClass !== bassPitchClass;

    if (!isOmittableRoot) {
      return { ok: false, hasFifth, rootPresent, soundingCount };
    }
  }

  return { ok: true, hasFifth, rootPresent, soundingCount };
}

function evaluateCandidate(
  frets: readonly FretValue[],
  context: {
    requirements: ChordRequirements;
    bassPitchClass: number;
    bassString: number;
    baseDisplayName: string;
    bassNote: string;
    slashSymbol: string;
    fromBaseShape: boolean;
  },
): Candidate | null {
  const tones = hasRequiredTones(frets, context.requirements, context.bassPitchClass);

  if (!tones.ok || tones.soundingCount < 4) {
    return null;
  }

  const position = describeShape(frets);
  const fingering = solveFingering(frets);

  if (!position || !fingering) {
    return null;
  }

  const fretted = frets.filter((fret): fret is number => typeof fret === "number" && fret > 0);
  const minFretted = fretted.length > 0 ? Math.min(...fretted) : 0;
  const hasInternalMute = frets
    .slice(context.bassString)
    .some((fret, index, list) => fret === "x" && list.slice(index + 1).some((later) => later !== "x"));
  const positionLabel = position.hasOpenString || minFretted <= 1
    ? "開放位"
    : `第 ${minFretted} 格`;
  const isOpenPosition = position.hasOpenString || minFretted <= 1;

  const score =
    fingering.fingerCount * 1.5 +
    (fingering.barres.length > 0 ? 1.5 : 0) +
    Math.max(0, minFretted - 1) * 0.35 +
    (tones.soundingCount < 5 ? (5 - tones.soundingCount) * 0.8 : 0) +
    (context.requirements.fifthPitchClass !== null && !tones.hasFifth ? 0.8 : 0) +
    (!tones.rootPresent ? 1 : 0) +
    (hasInternalMute ? 1.5 : 0) +
    (position.hasOpenString ? -0.8 : 0) +
    (context.fromBaseShape ? -1.5 : 0);

  const key = frets.join("");

  return {
    score,
    shape: {
      id: `slash-${context.slashSymbol.replace("#", "s").replace("/", "-over-")}-${key}`,
      symbol: context.slashSymbol,
      displayName: `${context.baseDisplayName} / ${context.bassNote}`,
      frets: [...frets],
      fingers: fingering.fingers,
      baseFret: position.baseFret,
      ...(fingering.barres.length > 0 ? { barres: fingering.barres } : {}),
      difficulty: Math.min(
        5,
        Math.max(1, fingering.fingerCount + (fingering.barres.length > 0 ? 1 : 0) - 1),
      ) as ChordShape["difficulty"],
      position: isOpenPosition ? "open" : "movable",
      variantLabel: `${positionLabel}・${STRING_LABELS[context.bassString]}低音`,
      tags: ["generated", "slash", "inversion"],
    },
  };
}

/**
 * 直接搜尋可按的指法：由指定低音弦往高音弦逐弦決定，
 * 並限制手指寬度，再交給 evaluateCandidate 檢查音與指法。
 */
function searchVoicings(
  bassString: number,
  bassFret: number,
  onFound: (frets: FretValue[]) => void,
): void {
  const frets: FretValue[] = ["x", "x", "x", "x", "x", "x"];
  frets[bassString] = bassFret;

  function visit(stringIndex: number, minFretted: number, maxFretted: number, hasOpen: boolean) {
    // 每走到一個長度夠的組合就回報，之後的弦可以繼續往上疊或直接收尾。
    if (stringIndex - bassString >= 4) {
      onFound([...frets]);
    }

    if (stringIndex > 5) {
      return;
    }

    const maxAllowed = hasOpen ? 5 : MAX_SEARCH_FRET;

    // 空弦：只有在整體都落在前五格時才可行。
    if (maxFretted <= 5) {
      frets[stringIndex] = 0;
      visit(stringIndex + 1, minFretted, maxFretted, true);
    }

    const low = minFretted === Infinity ? 1 : Math.max(1, maxFretted - MAX_FRET_SPREAD);
    const high = minFretted === Infinity ? maxAllowed : Math.min(maxAllowed, minFretted + MAX_FRET_SPREAD);

    for (let fret = low; fret <= high; fret += 1) {
      frets[stringIndex] = fret;
      visit(
        stringIndex + 1,
        Math.min(minFretted, fret),
        maxFretted === -Infinity ? fret : Math.max(maxFretted, fret),
        hasOpen,
      );
    }

    frets[stringIndex] = "x";
  }

  const startMin = bassFret > 0 ? bassFret : Infinity;
  const startMax = bassFret > 0 ? bassFret : -Infinity;
  visit(bassString + 1, startMin, startMax, bassFret === 0);
}

/**
 * 由原位和弦的按法推導分數和弦（例如 C/G、G/B）。
 * 1. 保留原按法高音側的音，把最低音換成指定低音。
 * 2. 若得到的選擇不足，再直接搜尋可按的指法補上。
 * 兩種方式都會檢查組成音是否完整、手指是否按得到。
 */
export function deriveSlashShapes(
  baseShapes: readonly ChordShape[],
  baseSymbol: string,
  bassNote: string,
  slashSymbol: string,
): ChordShape[] {
  const bassPitchClass = Note.chroma(bassNote);
  const requirements = getRequirements(baseSymbol);

  if (typeof bassPitchClass !== "number" || !requirements) {
    return [];
  }

  // 低音就是根音時，等同原位和弦。
  if (bassPitchClass === requirements.rootPitchClass) {
    return [...baseShapes];
  }

  const resolvedRequirements: ChordRequirements = requirements;
  const baseDisplayName = baseShapes[0]?.displayName ?? baseSymbol;
  const candidates = new Map<string, Candidate>();

  function consider(
    frets: readonly FretValue[],
    bassString: number,
    fromBaseShape: boolean,
  ) {
    const key = frets.join(",");
    const existing = candidates.get(key);

    if (existing && !fromBaseShape) {
      return;
    }

    const candidate = evaluateCandidate(frets, {
      requirements: resolvedRequirements,
      bassPitchClass,
      bassString,
      baseDisplayName,
      bassNote,
      slashSymbol,
      fromBaseShape,
    });

    if (candidate && (!existing || candidate.score < existing.score)) {
      candidates.set(key, candidate);
    }
  }

  for (const base of baseShapes) {
    for (let bassString = 0; bassString < BASS_STRING_COUNT; bassString += 1) {
      for (let fret = 0; fret <= MAX_FRET; fret += 1) {
        if (pitchClassAt(bassString, fret) !== bassPitchClass) {
          continue;
        }

        const frets = base.frets.map<FretValue>((value, index) => {
          if (index < bassString) {
            return "x";
          }
          return index === bassString ? fret : value;
        });

        consider(frets, bassString, true);
      }
    }
  }

  if (candidates.size < MIN_SHAPES_BEFORE_SEARCH) {
    for (let bassString = 0; bassString < BASS_STRING_COUNT; bassString += 1) {
      for (let fret = 0; fret <= MAX_SEARCH_FRET; fret += 1) {
        if (pitchClassAt(bassString, fret) !== bassPitchClass) {
          continue;
        }

        searchVoicings(bassString, fret, (frets) => consider(frets, bassString, false));
      }
    }
  }

  return [...candidates.values()]
    .sort((left, right) => left.score - right.score)
    .slice(0, MAX_SHAPES_PER_CHORD)
    .map((candidate) => candidate.shape);
}
