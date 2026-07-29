# Architecture

## 元件分層

```text
App
├── SingleChordSearch
│   └── ChordCard
│       └── ChordDiagram
└── SongChordMode
    ├── ChordCard（主要和弦）
    └── ChordCard（相關和弦，compact）
```

## 模組責任

- `src/data/chordShapes.ts`：吉他按法資料與查詢。
- `src/services/chordTheory.ts`：Tonal 和弦理論解析。
- `src/services/chordParser.ts`：多和弦字串解析。
- `src/services/relatedChords.ts`：相關和弦推薦。
- `src/utils/normalizeChordName.ts`：輸入正規化。
- `src/components/chord/ChordDiagram.tsx`：SVG 指板繪製。
- `src/components/chord/ChordCard.tsx`：按法與理論資料展示。

## 資料原則

- 理論資料與實際按法分離。
- `frets` 順序固定為低音 E、A、D、G、B、高音 e。
- `x` 表示不彈，`0` 表示空弦，正整數表示絕對琴格。
- `baseFret` 是圖中第一格的實際琴格。
- 相關和弦只顯示目前已有指法資料的項目。
