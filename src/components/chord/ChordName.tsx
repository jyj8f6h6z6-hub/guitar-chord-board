import { parseChordSymbol } from "../../utils/chordFormat";

/** 排版好的和弦名稱：♯♭ 上標、sus4／7 等縮小成下標。 */
export function ChordName({ symbol }: { symbol: string }) {
  const parts = parseChordSymbol(symbol);

  if (!parts) {
    return <span className="chord-name">{symbol}</span>;
  }

  return (
    <span className="chord-name" aria-label={symbol}>
      <span aria-hidden="true">
        {parts.root}
        {parts.accidental && <sup className="chord-acc">{parts.accidental}</sup>}
        {parts.quality}
        {parts.sub && <sub className="chord-sub">{parts.sub}</sub>}
        {parts.bassRoot && (
          <>
            <span className="chord-slash">/</span>
            {parts.bassRoot}
            {parts.bassAccidental && <sup className="chord-acc">{parts.bassAccidental}</sup>}
          </>
        )}
      </span>
    </span>
  );
}
