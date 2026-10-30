const ROOT_ALIASES: Readonly<Record<string, string>> = {
  Db: "C#",
  "D#": "Eb",
  "G#": "Ab",
  "A#": "Bb",
  Gb: "F#",
  "E#": "F",
  Fb: "E",
  Cb: "B",
  "B#": "C",
};

const ROOT_PATTERN = /^([A-G](?:#|b)?)(.*)$/;

/**
 * 將同音異名解析到專案採用的指法名稱。
 * 例如 Db 使用 C# 指法、D# 使用 Eb 指法、A# 使用 Bb 指法。
 */
export function resolveChordAlias(symbol: string): string {
  if (!symbol) {
    return symbol;
  }

  const [chordPart, bassPart] = symbol.split("/");
  const resolvedChord = resolvePart(chordPart);
  const resolvedBass = bassPart ? resolvePart(bassPart) : undefined;

  return resolvedBass ? `${resolvedChord}/${resolvedBass}` : resolvedChord;
}

function resolvePart(value: string): string {
  const match = value.match(ROOT_PATTERN);

  if (!match) {
    return value;
  }

  const [, root, suffix] = match;
  return `${ROOT_ALIASES[root] ?? root}${suffix}`;
}
