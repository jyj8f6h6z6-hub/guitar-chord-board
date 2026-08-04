import type {
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
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
import { CHORD_TYPE_OPTIONS, ROOT_NOTES } from "../../data/chordTypes";
import type { SongChordItem } from "../../types/chord";
import { ChordCard } from "../chord/ChordCard";
import { ScoreImportPanel } from "../score/ScoreImportPanel";

interface SongChordModeProps {
  items: readonly SongChordItem[];
  onItemsChange: (items: SongChordItem[]) => void;
  removeDuplicates: boolean;
  onRemoveDuplicatesChange: (value: boolean) => void;
  selectedShapeIds: Readonly<Record<string, string>>;
  onShapeChange: (itemId: string, shapeId: string) => void;
  onReplaceChord: (itemId: string, newSymbol: string) => void;
  onReplaceRecognized: (symbols: string[]) => void;
  onAppendRecognized: (symbols: string[]) => void;
}

interface ActiveDrag {
  kind: "palette" | "arrangement";
  symbol: string;
  itemId?: string;
}

const ARRANGEMENT_DROP_ID = "song-arrangement-drop-zone";
const PALETTE_PREFIX = "palette:";

const CHORD_ROOT_PATTERN = /^([A-G])([#b]?)/;

function getChordRoot(symbol: string): string | null {
  const match = symbol.match(CHORD_ROOT_PATTERN);
  return match ? `${match[1]}${match[2]}` : null;
}

function createSongChordItem(symbol: string): SongChordItem {
  return {
    id: crypto.randomUUID(),
    symbol,
  };
}

function PaletteChord({
  symbol,
  onAdd,
}: {
  symbol: string;
  onAdd: (symbol: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `${PALETTE_PREFIX}${symbol}`,
    data: {
      kind: "palette",
      symbol,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      style={style}
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
  index,
  isSelected,
  onSelect,
  onRemove,
}: {
  item: SongChordItem;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      kind: "arrangement",
      symbol: item.symbol,
      itemId: item.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`arranged-chord${isSelected ? " is-selected" : ""}${
        isDragging ? " is-dragging" : ""
      }`}
    >
      <button
        type="button"
        className="arranged-chord__main"
        onClick={onSelect}
        {...attributes}
        {...listeners}
      >
        <span className="arranged-chord__number">{index + 1}</span>
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
  );
}

function ArrangementDropZone({
  children,
  isDragging,
}: {
  children: React.ReactNode;
  isDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: ARRANGEMENT_DROP_ID,
  });

  return (
    <div
      ref={setNodeRef}
      className={`arrangement-drop-zone${isOver ? " is-over" : ""}${
        isDragging ? " is-dragging" : ""
      }`}
    >
      {children}
    </div>
  );
}

function getPointerInsertionIndex(
  event: DragEndEvent,
  overIndex: number,
): number {
  const activeRect = event.active.rect.current.translated;
  const overRect = event.over?.rect;

  if (!activeRect || !overRect) {
    return overIndex;
  }

  const activeCenterX = activeRect.left + activeRect.width / 2;
  const activeCenterY = activeRect.top + activeRect.height / 2;
  const overCenterX = overRect.left + overRect.width / 2;
  const overCenterY = overRect.top + overRect.height / 2;

  const isBelow =
    activeCenterY > overCenterY + overRect.height * 0.25;
  const isSameRow =
    Math.abs(activeCenterY - overCenterY) <
    overRect.height * 0.65;
  const isAfterOnSameRow =
    isSameRow && activeCenterX > overCenterX;

  return overIndex + (isBelow || isAfterOnSameRow ? 1 : 0);
}

export function SongChordMode({
  items,
  onItemsChange,
  removeDuplicates,
  onRemoveDuplicatesChange,
  selectedShapeIds,
  onShapeChange,
  onReplaceChord,
  onReplaceRecognized,
  onAppendRecognized,
}: SongChordModeProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    null,
  );
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedItem =
    items.find((item) => item.id === selectedItemId) ?? null;
  const selectedRoot = selectedItem
    ? getChordRoot(selectedItem.symbol)
    : null;

  useEffect(() => {
    if (
      selectedItemId &&
      !items.some((item) => item.id === selectedItemId)
    ) {
      setSelectedItemId(null);
    }
  }, [items, selectedItemId]);

  function addChord(symbol: string, index = items.length) {
    if (
      removeDuplicates &&
      items.some((item) => item.symbol === symbol)
    ) {
      return;
    }

    const newItem = createSongChordItem(symbol);
    const nextItems = [...items];
    nextItems.splice(index, 0, newItem);

    onItemsChange(nextItems);
    setSelectedItemId(newItem.id);
  }

  function removeChord(itemId: string) {
    onItemsChange(items.filter((item) => item.id !== itemId));

    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;

    if (!data) {
      return;
    }

    setActiveDrag({
      kind:
        data.kind === "palette"
          ? "palette"
          : "arrangement",
      symbol: String(data.symbol ?? ""),
      itemId:
        typeof data.itemId === "string"
          ? data.itemId
          : undefined,
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const dragData = event.active.data.current;
    const over = event.over;

    setActiveDrag(null);

    if (!dragData) {
      return;
    }

    if (dragData.kind === "palette") {
      if (!over) {
        return;
      }

      const symbol = String(dragData.symbol ?? "");

      if (!symbol) {
        return;
      }

      if (over.id === ARRANGEMENT_DROP_ID) {
        addChord(symbol);
        return;
      }

      const overIndex = items.findIndex(
        (item) => item.id === over.id,
      );

      if (overIndex < 0) {
        return;
      }

      const insertIndex = getPointerInsertionIndex(
        event,
        overIndex,
      );

      addChord(symbol, insertIndex);
      return;
    }

    const activeItemId = String(event.active.id);

    if (!over) {
      removeChord(activeItemId);
      return;
    }

    const oldIndex = items.findIndex(
      (item) => item.id === activeItemId,
    );

    if (oldIndex < 0) {
      return;
    }

    if (over.id === ARRANGEMENT_DROP_ID) {
      const nextItems = [...items];
      const [movedItem] = nextItems.splice(oldIndex, 1);
      nextItems.push(movedItem);
      onItemsChange(nextItems);
      return;
    }

    const overIndex = items.findIndex(
      (item) => item.id === over.id,
    );

    if (overIndex < 0 || overIndex === oldIndex) {
      return;
    }

    let insertIndex = getPointerInsertionIndex(
      event,
      overIndex,
    );

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(oldIndex, 1);

    if (insertIndex > oldIndex) {
      insertIndex -= 1;
    }

    nextItems.splice(insertIndex, 0, movedItem);
    onItemsChange(nextItems);
  }

  function handleDragCancel() {
    setActiveDrag(null);
  }

  function selectItem(itemId: string) {
    setSelectedItemId((current) =>
      current === itemId ? null : itemId,
    );
  }

  return (
    <section
      className="workspace workspace--song"
      aria-labelledby="song-mode-title"
    >
      <div className="workspace__intro">
        <p className="eyebrow">模式二</p>
        <h2 id="song-mode-title">一次整理整首歌的和弦</h2>
      </div>

      <ScoreImportPanel
        currentSymbols={items.map((item) => item.symbol)}
        onReplaceRecognized={onReplaceRecognized}
        onAppendRecognized={onAppendRecognized}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="song-arranger">
          <section
            className="song-arranger__section"
            aria-labelledby="palette-title"
          >
            <div className="song-arranger__heading">
              <div>
                <p className="eyebrow">待選區</p>
                <h3 id="palette-title">選擇根音</h3>
              </div>

              <span>點擊加入，或拖曳到編排區</span>
            </div>

            <div className="palette-chord-list">
              {ROOT_NOTES.map((symbol) => (
                <PaletteChord
                  key={symbol}
                  symbol={symbol}
                  onAdd={addChord}
                />
              ))}
            </div>
          </section>

          <section
            className="song-arranger__section"
            aria-labelledby="arrangement-title"
          >
            <div className="song-arranger__heading">
              <div>
                <p className="eyebrow">和弦編排區</p>
                <h3 id="arrangement-title">歌曲順序</h3>
              </div>

              <span>{items.length} 個和弦</span>
            </div>

            <SortableContext
              items={items.map((item) => item.id)}
              strategy={horizontalListSortingStrategy}
            >
              <ArrangementDropZone
                isDragging={
                  activeDrag?.kind === "arrangement"
                }
              >
                {items.length > 0 ? (
                  <div className="arranged-chord-list">
                    {items.map((item, index) => (
                      <SortableSongChord
                        key={item.id}
                        item={item}
                        index={index}
                        isSelected={
                          selectedItemId === item.id
                        }
                        onSelect={() => selectItem(item.id)}
                        onRemove={() => removeChord(item.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="arrangement-empty">
                    將待選區的和弦拖曳到這裡
                  </div>
                )}
              </ArrangementDropZone>
            </SortableContext>

            <div className="song-options song-arranger__options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={removeDuplicates}
                  onChange={(event) =>
                    onRemoveDuplicatesChange(
                      event.target.checked,
                    )
                  }
                />
                移除重複和弦
              </label>

              <span>
                拖曳調整順序；拖出編排區即可移除
              </span>
            </div>
          </section>
        </div>

        <DragOverlay>
          {activeDrag ? (
            <div className="drag-overlay-chord">
              {activeDrag.symbol}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedItem && selectedRoot ? (
        <section
          className="selected-chord-editor"
          aria-labelledby="selected-chord-editor-title"
        >
          <div className="selected-chord-editor__heading">
            <div>
              <p className="eyebrow">目前編輯</p>
              <h3 id="selected-chord-editor-title">
                {selectedItem.symbol}
              </h3>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedItemId(null)}
            >
              關閉
            </button>
          </div>

          <div className="selected-chord-editor__layout">
            <div className="selected-chord-editor__main">
              <ChordCard
                symbol={selectedItem.symbol}
                selectedShapeId={
                  selectedShapeIds[selectedItem.id]
                }
                onShapeChange={(shapeId) =>
                  onShapeChange(selectedItem.id, shapeId)
                }
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

              <div className="chord-type-grid">
                {CHORD_TYPE_OPTIONS.map((option) => {
                  const candidateSymbol = `${selectedRoot}${option.suffix}`;
                  const isCurrent =
                    candidateSymbol === selectedItem.symbol;

                  return (
                    <div
                      className={`chord-type-option${
                        isCurrent ? " is-current" : ""
                      }`}
                      key={option.suffix || "major"}
                    >
                      <ChordCard
                        symbol={candidateSymbol}
                        compact
                        eyebrow={option.label}
                        onSelect={(newSymbol) =>
                          onReplaceChord(
                            selectedItem.id,
                            newSymbol,
                          )
                        }
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
          點選和弦編排區中的和弦，可查看按法並修改和弦類型。
        </div>
      )}
    </section>
  );
}
