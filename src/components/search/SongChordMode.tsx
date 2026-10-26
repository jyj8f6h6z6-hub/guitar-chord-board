import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import {
  CHORD_TYPE_OPTIONS,
  ROOT_KEY_OPTIONS,
  ROOT_NOTES,
  findRootKeyOption,
  formatNoteLabel,
} from "../../data/chordTypes";
import {
  MAX_ITEMS_PER_LINE,
  MAX_ITEMS_TOTAL,
  MAX_LABEL_LENGTH,
  MAX_LYRIC_LENGTH,
  MAX_LYRIC_ROWS,
  addLine,
  countItems,
  duplicateItem,
  duplicateLine,
  effectiveSections,
  insertChord,
  locateItem,
  mergeLineUp,
  moveItem,
  moveItemBy,
  moveLine,
  removeItem,
  removeLine,
  replaceSymbol,
  setBar,
  setLyric,
  setSection,
  setShape,
  splitLineAfter,
} from "../../services/songModel";
import type { Song, SongItem, SongLine } from "../../types/song";
import { SECTION_KINDS, SECTION_LABELS } from "../../types/song";
import type { SectionKind } from "../../types/song";
import { ChordCard } from "../chord/ChordCard";
import { ProgressionPresets } from "./ProgressionPresets";

interface SongChordModeProps {
  song: Song;
  onChange: (change: (song: Song) => Song, coalesceKey?: string) => void;
  onApplyProgression: (symbols: string[], lineSize?: number) => void;
}

interface ActiveDrag {
  kind: "palette" | "arrangement";
  symbol: string;
}

const LINE_PREFIX = "line:";
const PALETTE_PREFIX = "palette:";
const CHORD_ROOT_PATTERN = /^([A-G])([#b]?)/;

type PaletteAccidentalMode = "natural" | "flat" | "sharp";

const PALETTE_ROOT_NOTES: Record<PaletteAccidentalMode, readonly string[]> = {
  natural: ROOT_NOTES,
  flat: ["B", "Db", "Eb", "E", "Gb", "Ab", "Bb"],
  sharp: ["C#", "D#", "F", "F#", "G#", "A#", "C"],
};

function getChordRoot(symbol: string): string | null {
  const match = symbol.match(CHORD_ROOT_PATTERN);
  return match ? `${match[1]}${match[2]}` : null;
}

function PaletteChord({ symbol, onAdd }: { symbol: string; onAdd: (symbol: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${PALETTE_PREFIX}${symbol}`,
    data: { kind: "palette", symbol },
  });

  return (
    <button
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={`palette-chord${isDragging ? " is-dragging" : ""}`}
      type="button"
      onClick={() => onAdd(symbol)}
      {...listeners}
      {...attributes}
    >
      {symbol}
    </button>
  );
}

function SortableSongChord({
  item,
  isSelected,
  onSelect,
  onRemove,
  onLyric,
}: {
  item: SongItem;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onLyric: (lyric: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { kind: "arrangement", symbol: item.symbol, itemId: item.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`arranged-chord${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${
        item.bar ? " has-bar" : ""
      }`}
    >
      <div className="arranged-chord__top">
        <button type="button" className="arranged-chord__main" onClick={onSelect} {...attributes} {...listeners}>
          <strong>{item.symbol}</strong>
        </button>

        <button
          type="button"
          className="arranged-chord__remove"
          onClick={onRemove}
          aria-label={`移除 ${item.symbol}`}
        >
          ×
        </button>
      </div>

      <textarea
        className="arranged-chord__lyric"
        value={item.lyric}
        rows={Math.min(Math.max(item.lyric.split("\n").length, 1), MAX_LYRIC_ROWS)}
        maxLength={MAX_LYRIC_LENGTH}
        placeholder="歌詞"
        title="按 Enter 換行：每一行代表一節（第 1 節、第 2 節…）"
        aria-label={`${item.symbol} 的歌詞`}
        onChange={(event) => onLyric(event.target.value)}
      />
    </div>
  );
}

function LineDropZone({ lineId, isActive, children }: { lineId: string; isActive: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${LINE_PREFIX}${lineId}` });

  return (
    <div
      ref={setNodeRef}
      className={`arrangement-drop-zone line-drop-zone${isOver ? " is-over" : ""}${isActive ? " is-active" : ""}`}
    >
      {children}
    </div>
  );
}

function getPointerInsertionIndex(event: DragEndEvent, overIndex: number): number {
  const activeRect = event.active.rect.current.translated;
  const overRect = event.over?.rect;

  if (!activeRect || !overRect) {
    return overIndex;
  }

  const activeCenterX = activeRect.left + activeRect.width / 2;
  const activeCenterY = activeRect.top + activeRect.height / 2;
  const overCenterX = overRect.left + overRect.width / 2;
  const overCenterY = overRect.top + overRect.height / 2;

  const isBelow = activeCenterY > overCenterY + overRect.height * 0.25;
  const isSameRow = Math.abs(activeCenterY - overCenterY) < overRect.height * 0.65;
  const isAfterOnSameRow = isSameRow && activeCenterX > overCenterX;

  return overIndex + (isBelow || isAfterOnSameRow ? 1 : 0);
}

function LineHeader({
  line,
  index,
  total,
  inherited,
  onChange,
}: {
  line: SongLine;
  index: number;
  total: number;
  inherited: string | null;
  onChange: SongChordModeProps["onChange"];
}) {
  return (
    <div className="line-head">
      <span className="line-head__number">第 {index + 1} 行</span>

      <select
        className="line-head__section"
        value={line.section}
        aria-label={`第 ${index + 1} 行的段落標籤`}
        onChange={(event) =>
          onChange((song) => setSection(song, line.id, event.target.value as SectionKind, line.customLabel))
        }
      >
        {SECTION_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {SECTION_LABELS[kind]}
          </option>
        ))}
      </select>

      {line.section === "custom" && (
        <input
          className="line-head__custom"
          type="text"
          value={line.customLabel}
          maxLength={MAX_LABEL_LENGTH}
          placeholder="例如：Solo"
          aria-label="自訂段落名稱"
          onChange={(event) =>
            onChange((song) => setSection(song, line.id, "custom", event.target.value), `label:${line.id}`)
          }
        />
      )}

      {line.section === "" && inherited && <span className="line-head__inherit">（接續{inherited}）</span>}

      <span className="line-head__actions">
        <button
          type="button"
          onClick={() => onChange((song) => moveLine(song, line.id, -1))}
          disabled={index === 0}
          aria-label="這一行上移"
          title="上移"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onChange((song) => moveLine(song, line.id, 1))}
          disabled={index === total - 1}
          aria-label="這一行下移"
          title="下移"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onChange((song) => duplicateLine(song, line.id)?.song ?? song)}
          aria-label="複製這一行"
          title="複製這一行（含歌詞）"
        >
          複製行
        </button>
        <button
          type="button"
          onClick={() => onChange((song) => mergeLineUp(song, line.id))}
          disabled={index === 0}
          aria-label="合併到上一行"
          title="合併到上一行"
        >
          併上行
        </button>
        <button
          type="button"
          onClick={() => onChange((song) => removeLine(song, line.id))}
          aria-label="刪除這一行"
          title="刪除這一行"
        >
          刪除行
        </button>
      </span>
    </div>
  );
}

export function SongChordMode({ song, onChange, onApplyProgression }: SongChordModeProps) {
  const [paletteAccidentalMode, setPaletteAccidentalMode] = useState<PaletteAccidentalMode>("natural");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [notice, setNotice] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sections = effectiveSections(song);
  const total = countItems(song);
  const selected = selectedItemId ? locateItem(song, selectedItemId) : null;
  const selectedItem = selected?.item ?? null;
  const selectedRoot = selectedItem ? getChordRoot(selectedItem.symbol) : null;
  const [selectedBaseSymbol, selectedBassNote] = selectedItem ? selectedItem.symbol.split("/") : ["", undefined];
  const selectedRootPitchClass = selectedRoot ? findRootKeyOption(selectedRoot)?.pitchClass : undefined;
  const paletteRootNotes = PALETTE_ROOT_NOTES[paletteAccidentalMode];

  useEffect(() => {
    if (selectedItemId && !locateItem(song, selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [song, selectedItemId]);

  function targetLineId(): string {
    if (selected) return selected.line.id;
    if (activeLineId && song.lines.some((line) => line.id === activeLineId)) return activeLineId;
    return song.lines[song.lines.length - 1].id;
  }

  function limitReached(lineId: string): boolean {
    const line = song.lines.find((entry) => entry.id === lineId);

    if (total >= MAX_ITEMS_TOTAL || (line && line.items.length >= MAX_ITEMS_PER_LINE)) {
      setNotice("這一行或整首歌的和弦數已達上限。");
      return true;
    }

    setNotice("");
    return false;
  }

  function addChord(symbol: string, lineId?: string, index?: number) {
    const target = lineId ?? targetLineId();

    if (limitReached(target)) return;

    // 有選取和弦時，點擊待選區的和弦會插在它後面，方便連續輸入。
    const at = index ?? (selected && !lineId ? selected.itemIndex + 1 : undefined);
    const result = insertChord(song, symbol, target, at);
    onChange(() => result.song);
    setSelectedItemId(result.itemId);
    setActiveLineId(target);
  }

  function removeChord(itemId: string) {
    onChange((current) => removeItem(current, itemId));

    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    }
  }

  function duplicateSelected() {
    if (!selectedItemId) return;

    if (limitReached(selected?.line.id ?? "")) return;

    const result = duplicateItem(song, selectedItemId);

    if (result) {
      onChange(() => result.song);
      setSelectedItemId(result.itemId);
    }
  }

  function splitAfterSelected() {
    if (!selectedItemId) return;
    const result = splitLineAfter(song, selectedItemId);

    if (result) {
      onChange(() => result.song);
      setActiveLineId(result.lineId);
      setNotice("");
    } else {
      setNotice("行數已達上限。");
    }
  }

  function addNewLine() {
    const afterId = selected?.line.id ?? activeLineId ?? undefined;
    const result = addLine(song, afterId);

    if (result) {
      onChange(() => result.song);
      setActiveLineId(result.lineId);
      setSelectedItemId(null);
      setNotice("");
    } else {
      setNotice("行數已達上限。");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;

    if (!data) return;

    setActiveDrag({
      kind: data.kind === "palette" ? "palette" : "arrangement",
      symbol: String(data.symbol ?? ""),
    });
  }

  function resolveTarget(event: DragEndEvent): { lineId: string; index?: number } | null {
    const over = event.over;

    if (!over) return null;

    const overId = String(over.id);

    if (overId.startsWith(LINE_PREFIX)) {
      return { lineId: overId.slice(LINE_PREFIX.length) };
    }

    const location = locateItem(song, overId);

    if (!location) return null;

    return {
      lineId: location.line.id,
      index: getPointerInsertionIndex(event, location.itemIndex),
    };
  }

  function handleDragEnd(event: DragEndEvent) {
    const dragData = event.active.data.current;
    setActiveDrag(null);

    if (!dragData) return;

    if (dragData.kind === "palette") {
      const symbol = String(dragData.symbol ?? "");
      const target = resolveTarget(event);

      if (symbol && target) {
        addChord(symbol, target.lineId, target.index);
      }

      return;
    }

    const activeItemId = String(event.active.id);

    if (!event.over) {
      removeChord(activeItemId);
      return;
    }

    const target = resolveTarget(event);

    if (!target) return;

    const targetLine = song.lines.find((line) => line.id === target.lineId);
    const toIndex = target.index ?? targetLine?.items.length ?? 0;

    onChange((current) => moveItem(current, activeItemId, target.lineId, toIndex));
  }

  function selectItem(itemId: string) {
    setSelectedItemId((current) => (current === itemId ? null : itemId));
  }

  const inheritedLabel = (lineIndex: number): string | null => {
    const kind = sections[lineIndex].kind;
    return kind === "" ? null : SECTION_LABELS[kind].replace("…", "");
  };

  return (
    <section className="workspace workspace--song" aria-labelledby="song-mode-title">
      <div className="workspace__intro">
        <p className="eyebrow">和弦編排・第一步</p>
        <h2 id="song-mode-title">建立和弦編排</h2>
      </div>

      <ProgressionPresets hasItems={total > 0} onApply={onApplyProgression} />

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        <div className="song-arranger">
          <section className="song-arranger__section" aria-labelledby="palette-title">
            <div className="song-arranger__heading">
              <div>
                <p className="eyebrow">待選區</p>
                <h3 id="palette-title">選擇根音</h3>
              </div>

              <div className="palette-heading-actions">
                <div className="palette-accidental-control" role="group" aria-label="調整待選區根音">
                  <button
                    type="button"
                    className={paletteAccidentalMode === "flat" ? "is-active" : ""}
                    onClick={() => setPaletteAccidentalMode("flat")}
                  >
                    ♭ 降半音
                  </button>
                  <button
                    type="button"
                    className={paletteAccidentalMode === "natural" ? "is-active" : ""}
                    onClick={() => setPaletteAccidentalMode("natural")}
                  >
                    ♮ 還原
                  </button>
                  <button
                    type="button"
                    className={paletteAccidentalMode === "sharp" ? "is-active" : ""}
                    onClick={() => setPaletteAccidentalMode("sharp")}
                  >
                    ♯ 升半音
                  </button>
                </div>

                <span>點擊加入（有選取和弦時插在它後面），或拖曳到任一行</span>
              </div>
            </div>

            <div className="palette-chord-list">
              {paletteRootNotes.map((symbol) => (
                <PaletteChord key={symbol} symbol={symbol} onAdd={(value) => addChord(value)} />
              ))}
            </div>
          </section>

          <section className="song-arranger__section" aria-labelledby="arrangement-title">
            <div className="song-arranger__heading">
              <div>
                <p className="eyebrow">和弦編排區</p>
                <h3 id="arrangement-title">歌曲順序</h3>
              </div>

              <div className="song-arranger__count">
                <span>
                  {song.lines.length} 行・{total} 個和弦
                </span>
              </div>
            </div>

            <div className="song-lines">
              {song.lines.map((line, lineIndex) => {
                const isChorus = sections[lineIndex].kind === "chorus";
                const isActive = (selected?.line.id ?? activeLineId) === line.id;

                return (
                  <div
                    key={line.id}
                    className={`song-line${isChorus ? " is-chorus" : ""}${isActive ? " is-active" : ""}`}
                    onClick={() => setActiveLineId(line.id)}
                  >
                    <LineHeader
                      line={line}
                      index={lineIndex}
                      total={song.lines.length}
                      inherited={inheritedLabel(lineIndex)}
                      onChange={onChange}
                    />

                    <SortableContext items={line.items.map((item) => item.id)} strategy={horizontalListSortingStrategy}>
                      <LineDropZone lineId={line.id} isActive={isActive}>
                        {line.items.length > 0 ? (
                          <div className="arranged-chord-list">
                            {line.items.map((item) => (
                              <SortableSongChord
                                key={item.id}
                                item={item}
                                isSelected={selectedItemId === item.id}
                                onSelect={() => selectItem(item.id)}
                                onRemove={() => removeChord(item.id)}
                                onLyric={(lyric) =>
                                  onChange((current) => setLyric(current, item.id, lyric), `lyric:${item.id}`)
                                }
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="arrangement-empty">把和弦拖曳到這一行，或點待選區加入</div>
                        )}
                      </LineDropZone>
                    </SortableContext>
                  </div>
                );
              })}
            </div>

            <div className="song-options song-arranger__options">
              <button type="button" className="ghost-button" onClick={addNewLine}>
                ＋ 新增一行
              </button>
              <span>拖曳調整順序（可拖到其他行）；拖出編排區即可移除。每行代表一句，歌詞打在和弦下方；歌詞按 Enter 換行代表第 2、3 節。</span>
            </div>

            {notice && (
              <p className="song-bar__message" role="status">
                {notice}
              </p>
            )}
          </section>
        </div>

        <DragOverlay>{activeDrag ? <div className="drag-overlay-chord">{activeDrag.symbol}</div> : null}</DragOverlay>
      </DndContext>

      {selectedItem && selectedRoot ? (
        <section className="selected-chord-editor" aria-labelledby="selected-chord-editor-title">
          <div className="selected-chord-editor__heading">
            <div className="selected-chord-editor__heading-main">
              <div>
                <p className="eyebrow">目前編輯</p>
                <h3 id="selected-chord-editor-title">{selectedItem.symbol}</h3>
              </div>
            </div>

            <button type="button" className="secondary-button" onClick={() => setSelectedItemId(null)}>
              關閉
            </button>
          </div>

          <div className="chord-toolbar" role="toolbar" aria-label="選取的和弦操作">
            <button type="button" className="ghost-button" onClick={() => onChange((s) => moveItemBy(s, selectedItem.id, -1))}>
              ← 前移
            </button>
            <button type="button" className="ghost-button" onClick={() => onChange((s) => moveItemBy(s, selectedItem.id, 1))}>
              後移 →
            </button>
            <button type="button" className="ghost-button" onClick={duplicateSelected}>
              ⧉ 複製和弦
            </button>
            <button type="button" className="ghost-button" onClick={splitAfterSelected}>
              ↵ 從此換行
            </button>
            <button
              type="button"
              className={`ghost-button${selectedItem.bar ? " is-active" : ""}`}
              aria-pressed={selectedItem.bar}
              onClick={() => onChange((s) => setBar(s, selectedItem.id, !selectedItem.bar))}
            >
              ｜ 小節線
            </button>
            <button type="button" className="ghost-button" onClick={() => removeChord(selectedItem.id)}>
              刪除
            </button>
          </div>

          <div className="selected-chord-editor__layout">
            <div className="selected-chord-editor__main">
              <ChordCard
                symbol={selectedItem.symbol}
                selectedShapeId={selectedItem.shapeId}
                onShapeChange={(shapeId) => onChange((s) => setShape(s, selectedItem.id, shapeId))}
              />
            </div>

            <div className="selected-chord-editor__types">
              <div className="related-heading">
                <div>
                  <p className="eyebrow">12 種和弦類型</p>
                  <h3>{selectedRoot} 的和弦類型</h3>
                </div>

                <span>點選後只修改目前選中的和弦</span>
              </div>

              <div className="bass-picker">
                <div className="bass-picker__heading">
                  <strong>低音（分數和弦）</strong>
                  <small>換成其他低音，例如 C/G、G/B</small>
                </div>

                <div className="bass-picker__list">
                  <button
                    type="button"
                    className={`ux-key${selectedBassNote ? "" : " is-active"}`}
                    aria-pressed={!selectedBassNote}
                    onClick={() => onChange((s) => replaceSymbol(s, selectedItem.id, selectedBaseSymbol))}
                  >
                    原位
                  </button>

                  {ROOT_KEY_OPTIONS.map((option) => {
                    const isRoot = option.pitchClass === selectedRootPitchClass;
                    const isActive =
                      selectedBassNote !== undefined &&
                      findRootKeyOption(selectedBassNote)?.pitchClass === option.pitchClass;

                    return (
                      <button
                        key={option.pitchClass}
                        type="button"
                        className={`ux-key${option.sharp !== option.flat ? " is-black" : ""}${isActive ? " is-active" : ""}`}
                        aria-pressed={isActive}
                        disabled={isRoot}
                        title={isRoot ? "與根音相同" : undefined}
                        onClick={() =>
                          onChange((s) => replaceSymbol(s, selectedItem.id, `${selectedBaseSymbol}/${option.common}`))
                        }
                      >
                        {formatNoteLabel(option.common)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="chord-type-grid">
                {CHORD_TYPE_OPTIONS.map((option) => {
                  const candidateSymbol = `${selectedRoot}${option.suffix}${selectedBassNote ? `/${selectedBassNote}` : ""}`;
                  const isCurrent = candidateSymbol === selectedItem.symbol;

                  return (
                    <div className={`chord-type-option${isCurrent ? " is-current" : ""}`} key={option.suffix || "major"}>
                      <ChordCard
                        symbol={candidateSymbol}
                        compact
                        eyebrow={option.label}
                        onSelect={(newSymbol) => onChange((s) => replaceSymbol(s, selectedItem.id, newSymbol))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="selected-chord-editor-placeholder">
          點一下編排區的和弦，就能複製、換行、加小節線、查看按法並改成其他和弦類型。
        </div>
      )}
    </section>
  );
}
