export interface ChordParts {
  root: string;
  /** ♯ 或 ♭（空字串代表沒有） */
  accidental: string;
  /** 緊接在根音後面、與根音同大小的部分（小三和弦的 m） */
  quality: string;
  /** 縮小成下標的部分，例如 7、sus4、maj7、7♭5 */
  sub: string;
  bassRoot: string;
  bassAccidental: string;
}

const PATTERN = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/;

function accidentalSymbol(value: string): string {
  return value === "#" ? "♯" : value === "b" ? "♭" : "";
}

/** 把和弦名稱拆成排版用的幾個部分；無法辨識時回傳 null（直接顯示原文）。 */
export function parseChordSymbol(symbol: string): ChordParts | null {
  const match = symbol.match(PATTERN);

  if (!match) {
    return null;
  }

  const [, root, accidental, rest, bassRoot = "", bassAccidental = ""] = match;
  const hasMinor = rest.startsWith("m") && !rest.startsWith("maj");
  const quality = hasMinor ? "m" : "";
  const sub = (hasMinor ? rest.slice(1) : rest).replace(/#/g, "♯").replace(/(?<=\d)b/g, "♭");

  return {
    root,
    accidental: accidentalSymbol(accidental),
    quality,
    sub,
    bassRoot,
    bassAccidental: accidentalSymbol(bassAccidental),
  };
}
