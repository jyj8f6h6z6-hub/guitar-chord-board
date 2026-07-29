# PROJECT_STATUS

> 專案：Guitar Chord Board
> 版本：0.2.0
> 狀態：第二階段「資料品質與多把位」已完成，待使用者本機驗收及推送
> 最後更新：2026-07-29
> 主要開發環境：VS Code
> Repository：`jyj8f6h6z6-hub/guitar-chord-board`
> 部署：GitHub Actions／GitHub Pages

## 1. 專案目標

建立一個吉他和弦按法網站，讓使用者可以：

1. 輸入單一和弦名稱，查詢按法與組成音。
2. 一次輸入多個歌曲和弦，由上而下顯示全部按法。
3. 在每個主和弦右側查看常見變化、掛留和弦及轉位和弦。
4. 在同一和弦已有多個按法時切換開放位、簡易位或封閉位。
5. 在桌機與手機上清楚閱讀和弦圖。

## 2. 里程碑狀態

### 0.1.0：MVP 基礎版

- [x] React＋TypeScript＋Vite 專案架構。
- [x] 單一和弦查詢與歌曲和弦清單。
- [x] Tonal 組成音解析。
- [x] SVG 六弦指板、琴格、空弦、禁彈、指法與橫按。
- [x] 相關和弦與轉位替換。
- [x] VS Code workspace、Git 與 GitHub Pages workflow。
- [x] 本機安裝、型別檢查、建置及 GitHub Pages 首次部署成功。

### 0.2.0：資料品質與多把位

- [x] 將資料模型改為一個和弦可對應多個按法。
- [x] 在完整和弦卡加入「切換把位」控制。
- [x] 為 C、G、A、Am、F、D、Dm、E、Em、B、Bm 增加替代把位。
- [x] 新增 F#、F#m、F#m7、Bb、Bbm、Bb7、Bbmaj7。
- [x] 新增 Cadd9、Em7、Dm7、Bm7、Amaj7、G6。
- [x] 支援常見同音異名：A# 使用 Bb 指法、Gb 使用 F# 指法。
- [x] 同音異名查詢顯示實際採用的音名與按法。
- [x] 加入和弦資料啟動時驗證：ID、六弦長度、琴格範圍及橫按範圍。
- [x] 改善手機版卡片、按法選擇器、組成音與橫向捲動。
- [x] 頁首 GitHub 連結改為實際 repository。
- [x] 統計改為由資料庫自動計算。

## 3. 目前資料量

- 吉他按法：**72**
- 不重複和弦名稱：**61**
- 已提供兩種以上按法的常用和弦：**11**

資料陣列順序固定為：

```text
低音 E、A、D、G、B、高音 e
```

`x` 代表不彈，`0` 代表空弦，正整數代表絕對琴格。

## 4. 0.2.0 驗收項目

請在使用者本機 VS Code 執行：

```bash
npm run typecheck
npm run build
npm run dev
```

瀏覽器測試：

- [ ] `C` 可在開放位與第 3 格封閉位間切換。
- [ ] `F` 預設顯示簡易位，並可切換完整橫按。
- [ ] `A#` 顯示採用 `Bb` 按法，組成音為 Bb、D、F。
- [ ] `Gb` 可顯示 `F#` 的按法。
- [ ] `F#m`、`Bbmaj7`、`Cadd9`、`Bm7` 可正常顯示。
- [ ] 歌曲模式輸入 `C G Am F`，各主要和弦可切換把位。
- [ ] 手機寬度下相關和弦及把位按鈕可水平滑動，頁面沒有橫向溢位。
- [ ] GitHub Actions 完成部署，公開網站顯示版本 `0.2.0`。

## 5. 已知限制

1. 多把位目前集中於最常用的大、小和弦，尚未讓所有 7、maj7、sus 和弦都有替代按法。
2. 指法資料為專案內建資料，仍需逐筆進行音樂性與人體工學校對。
3. 相關和弦仍採預先定義規則，尚未根據歌曲調性或前後文推薦。
4. 尚未支援移調、段落、歌曲保存、列印版或 PDF。
5. 尚未支援左手模式、自訂調弦、七弦吉他或烏克麗麗。
6. 尚未建立正式單元測試框架；目前為資料啟動驗證與 TypeScript build 檢查。

## 6. 技術架構

| 項目 | 選擇 | 用途 |
|---|---|---|
| UI | React | 元件與畫面狀態 |
| 語言 | TypeScript | 型別安全與資料模型 |
| 開發／建置 | Vite | 本機伺服器與正式版建置 |
| 音樂理論 | Tonal | 和弦解析、組成音與音程 |
| 和弦圖 | SVG | 清晰且可縮放的吉他按法圖 |
| 資料 | TypeScript 靜態資料 | 多按法和弦資料庫 |
| 原始碼管理 | Git／GitHub | 版本控制與協作 |
| 部署 | GitHub Actions＋Pages | push 到 `main` 自動發布 |

## 7. 主要資料流

```text
使用者輸入
  ↓
normalizeChordName
  ↓
resolveChordAlias（A# → Bb、Gb → F#）
  ↓
和弦名稱
  ├─ Tonal → 組成音、音程、正式名稱
  ├─ chordShapes → 一個或多個吉他按法
  └─ relatedChords → 相關變化與轉位
  ↓
ChordCard
  ├─ Shape selector → 切換把位
  └─ ChordDiagram → SVG 指板
```

## 8. 下一階段建議：0.3.0 歌曲工具

優先順序：

1. 加入整首歌升降 Key／移調。
2. 加入歌曲名稱與 Verse、Chorus 等段落。
3. 使用 localStorage 保存最近歌曲。
4. 增加列印友善版面。
5. 增加複製歌曲和弦清單功能。
6. 建立 Vitest 單元測試，覆蓋輸入解析、別名、移調與資料驗證。

## 9. 本次更新後的 Git 操作

```bash
git status
git add .
git commit -m "feat: add multiple chord positions and enharmonic aliases"
git push
```

推送後由 GitHub Actions 自動重新建置與發布。
