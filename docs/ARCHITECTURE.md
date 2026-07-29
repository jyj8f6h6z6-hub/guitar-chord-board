# Architecture

## 元件分層

```text
App
├── SingleChordSearch
│   └── ChordCard
│       ├── Shape selector
│       └── ChordDiagram
└── SongChordMode
    ├── ChordCard（主要和弦，可切換把位）
    └── ChordCard（相關和弦，compact）
```

## 模組責任

- `src/data/chordShapes.ts`：多把位吉他按法、查詢、統計與資料驗證。
- `src/services/chordTheory.ts`：Tonal 和弦理論解析。
- `src/services/chordParser.ts`：多和弦字串解析。
- `src/services/relatedChords.ts`：相關和弦推薦。
- `src/utils/normalizeChordName.ts`：輸入格式正規化。
- `src/utils/chordAliases.ts`：同音異名映射，例如 A# → Bb。
- `src/components/chord/ChordDiagram.tsx`：SVG 指板繪製。
- `src/components/chord/ChordCard.tsx`：按法、把位選擇與理論資料展示。

## 多把位資料模型

同一個 `symbol` 可以出現多筆 `ChordShape`：

```ts
findChordShapes("C");
// c-major-open
// c-major-barre-3
```

`findChordShape()` 保留為取得預設按法的便利函式；預設順序優先考量：

1. `beginner` 標籤。
2. 開放位。
3. 較低難度。

## 資料原則

- 理論資料與實際按法分離。
- `frets` 順序固定為低音 E、A、D、G、B、高音 e。
- `x` 表示不彈，`0` 表示空弦，正整數表示絕對琴格。
- `baseFret` 是圖中第一格的實際琴格。
- 相關和弦只顯示目前已有指法資料的項目。
- 啟動時驗證 ID、六弦資料長度、琴格與橫按範圍；資料錯誤會立即拋出例外。
