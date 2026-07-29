const NOTE_PATTERN = /^([a-gA-G])([#b]?)(.*)$/;

export function normalizeChordName(rawValue: string): string {
  const cleaned = rawValue
    .trim()
    .replaceAll("♯", "#")
    .replaceAll("＃", "#")
    .replaceAll("♭", "b")
    .replaceAll("／", "/")
    .replace(/\s+/g, "")
    .replace(/major/gi, "maj")
    .replace(/minor/gi, "m")
    .replace(/min/gi, "m");

  if (!cleaned) {
    return "";
  }

  return cleaned
    .split("/")
    .map((part) => normalizeChordPart(part))
    .join("/");
}

function normalizeChordPart(value: string): string {
  const match = value.match(NOTE_PATTERN);

  if (!match) {
    return value;
  }

  const [, note, accidental, suffix] = match;
  return `${note.toUpperCase()}${accidental}${suffix}`;
}
