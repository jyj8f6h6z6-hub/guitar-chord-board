export type NoteOctave = "normal" | "high" | "low";

export interface NoteSymbolData {
  id: string;
  value: string;
  octave: NoteOctave;
  underline: boolean;
}

interface NoteSymbolProps {
  note: NoteSymbolData;
  selected: boolean;
  onSelect: () => void;
}

export function NoteSymbol({
  note,
  selected,
  onSelect,
}: NoteSymbolProps) {
  return (
    <button
      type="button"
      className={`notation-note${
        selected ? " is-selected" : ""
      }`}
      onClick={onSelect}
    >
      <span className="notation-note__high">
        {note.octave === "high" ? "•" : ""}
      </span>

      <span className="notation-note__number">
        {note.value || "1"}
      </span>

      <span className="notation-note__low">
        {note.octave === "low" ? "•" : ""}
      </span>

      {note.underline && (
        <span
          className="notation-note__underline"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
