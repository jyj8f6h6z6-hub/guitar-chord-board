# Guitar Chord Board 專案操作手冊

> 最後更新：2026-08-04
> 適用版本：0.6.0，目前已完成「三種模式、12 種和弦類型、多把位、拖曳式歌曲和弦編排，以及精簡總覽移調」的專案
> 適合對象：使用 VS Code、GitHub Pages，且剛開始學習程式的使用者

這份文件整合並取代原本的：

- `ARCHITECTURE.md`
- `GITHUB_SETUP.md`
- `PHASE_2_UPDATE.md`

內容包含：

- 平常如何修改與測試網站。
- 如何提交到 GitHub。
- GitHub Pages 如何自動發布。
- 三種使用模式的運作方式。
- 和弦類型、聽感描述與吉他指法資料的位置。
- 手寫按法與自動產生按法的差別。
- 模式二與模式三如何共用歌曲和弦資料。
- 模式三移調預覽與套用流程。
- 已移除圖片、PDF、OCR 與智慧歌譜功能的版本紀錄。
- 常見錯誤與安全復原方法。

---

## 1. 專案資訊

GitHub Repository：

```text
https://github.com/jyj8f6h6z6-hub/guitar-chord-board
```

GitHub Pages 網站：

```text
https://jyj8f6h6z6-hub.github.io/guitar-chord-board/
```

本機專案資料夾：

```text
D:\guitar-chord-board
```

主要分支：

```text
main
```

自動部署設定：

```text
.github/workflows/deploy.yml
```

目前版本：

```text
0.6.0
```

版本由：

```text
package.json
package-lock.json
```

共同管理，網站頁尾會從 `package.json` 自動顯示相同版本。

查看目前版本：

```powershell
npm pkg get version
```

未來升級版本時，例如升級至 `0.7.0`：

```powershell
npm version 0.7.0 --no-git-tag-version
```

若 npm 顯示：

```text
Version not changed
```

通常代表目前已經是指定版本，不是程式錯誤。

---

## 2. 平常修改網站的流程

### 第一步：開啟專案

使用 VS Code 開啟：

```text
D:\guitar-chord-board
```

VS Code 終端機應顯示類似：

```text
PS D:\guitar-chord-board>
```

若不在正確資料夾，執行：

```powershell
cd D:\guitar-chord-board
```

### 第二步：查看目前狀態

```bash
git status
```

修改前若顯示：

```text
nothing to commit, working tree clean
```

代表目前沒有尚未提交的修改。

若出現修改中的檔案，先確認它們是不是上次尚未完成的工作，不要直接覆蓋。

### 第三步：啟動本機網站

```bash
npm run dev
```

瀏覽器通常會開啟：

```text
http://localhost:5173
```

停止本機網站時，在終端機按：

```text
Ctrl + C
```

### 第四步：修改程式

修改完成後，先儲存所有檔案。

VS Code 分頁旁若有小圓點，代表檔案尚未儲存。

也可以使用：

```text
Ctrl + S
```

儲存目前檔案。

### 第五步：檢查程式

先停止正在執行的 `npm run dev`，再依序執行：

```bash
npm run typecheck
npm run build
```

用途：

- `npm run typecheck`：檢查 TypeScript 型別。
- `npm run build`：建立正式版網站並再次檢查程式。
- 成功後會產生 `dist` 資料夾。

兩個指令都成功後，再執行：

```bash
npm run dev
```

使用瀏覽器確認畫面與操作正常。

### 第六步：查看這次修改

```bash
git status
```

確認只有預期修改的檔案。

若只是修改文件，建議只加入該文件：

```bash
git add docs/PROJECT_GUIDE.md
```

若是修改網站程式，建議只加入 `src`：

```bash
git add src
```

不要在有 `.bak`、`.patch`、臨時 `.cjs` 工具時直接使用：

```text
git add .
```

以免把臨時檔案一起上傳。

### 第七步：提交到 GitHub

例如修改網站程式：

```bash
git add src
git status
git commit -m "描述這次修改"
git push
```

例如更新本文件：

```bash
git add docs/PROJECT_GUIDE.md
git status
git commit -m "更新專案操作手冊"
git push
```

---

## 3. GitHub Pages 自動發布

每次 push 到 `main` 後，GitHub Actions 會自動：

1. 取得最新程式碼。
2. 安裝 Node.js。
3. 安裝 dependencies。
4. 執行 TypeScript 檢查。
5. 執行 Vite build。
6. 建立 `dist`。
7. 上傳建置結果。
8. 發布到 GitHub Pages。

查看部署狀態：

```text
GitHub Repository
→ Actions
→ Deploy Guitar Chord Board to GitHub Pages
```

狀態說明：

- 綠色勾勾：部署成功。
- 黃色圓點：正在部署。
- 紅色叉叉：部署失敗。

部署成功後開啟：

```text
https://jyj8f6h6z6-hub.github.io/guitar-chord-board/
```

若仍看到舊畫面，可按：

```text
Ctrl + F5
```

手機或平板若仍顯示舊版本，可關閉瀏覽器分頁後重新開啟正式網站。

---

## 4. 部署失敗時

先回到 VS Code 執行：

```bash
npm install
npm run typecheck
npm run build
```

若本機也失敗，先修正終端機顯示的錯誤。

若本機成功，可在 GitHub 重新執行：

```text
Repository
→ Actions
→ 選擇失敗的 workflow
→ Re-run jobs
→ Re-run all jobs
```

不要在尚未找到錯誤原因時重複 push 很多次。

---

## 5. 常見 Git 訊息

### `nothing to commit`

代表目前沒有新的修改可以提交。

可能原因：

- 檔案沒有修改。
- 檔案尚未儲存。
- 修改已經提交。
- 修改後又改回原本內容。

先確認檔案已儲存，再執行：

```bash
git status
```

### `Everything up-to-date`

代表本機沒有新的 commit 需要推送。

### `LF will be replaced by CRLF`

Windows 上可能看到：

```text
warning: LF will be replaced by CRLF
```

這是換行格式提醒，通常不是程式錯誤，也不代表 push 失敗。

### Push 被拒絕

不要使用：

```text
git push --force
```

先執行：

```bash
git pull --rebase
```

沒有衝突時再執行：

```bash
git push
```

若出現 conflict，先停止操作並確認衝突檔案，不要任意刪除內容。

### `patch does not apply`

代表 patch 建立時的檔案內容，與目前本機檔案不完全一致。

不要強制套用。先確認：

```bash
git status
```

並改用完整檔案覆蓋或專用修正工具。

---

## 6. 不需要上傳的資料

以下資料夾不需要手動提交：

```text
node_modules/
dist/
```

原因：

- `node_modules` 可由 `npm install` 重新建立。
- `dist` 可由 `npm run build` 重新建立。
- GitHub Actions 會自行建立正式版 `dist`。

更新過程中可能出現的臨時檔案也不應提交：

```text
*.bak
*.patch
apply-*.cjs
*.zip
```

例如：

```text
chordShapes.ts.before-phase2.bak
chordShapes.ts.before-all-positions-123456789.bak
chord-shapes-integration.patch
apply-phase2.cjs
apply-all-positions.cjs
```

確認網站正常後可刪除這些臨時檔案。

---

## 7. 目前網站的三種模式

網站目前有三個模式：

```text
模式一：單一和弦查詢
模式二：歌曲和弦編排
模式三：歌曲和弦精簡總覽＋移調
```

三個模式由：

```text
src/App.tsx
```

統一管理與切換。

### 模式一：單一和弦查詢

用途：

- 使用選單組合和弦，不需要切換中文或英文輸入法。
- 查看聽感描述、組成音、吉他指法與所有可用把位。

選單分為：

```text
根音
升降記號
和弦類型
```

例如：

```text
根音：C
升降記號：♯
和弦類型：m7
```

會組合成：

```text
C#m7
```

### 模式二：歌曲和弦編排

用途：

- 以「待選區」固定顯示 `C、D、E、F、G、A、B`。
- 點擊待選和弦即可加入，或拖曳到「和弦編排區」的指定位置。
- 待選區不會因加入和弦而減少，因此可重複加入相同和弦。
- 編排區內的和弦可拖曳重新排序。
- 將編排區內的和弦拖出編排區並放開即可移除；觸控裝置另有 `×` 按鈕。
- 點擊編排區中的某一個和弦時，才顯示完整按法與 12 種同根音類型。
- 選擇類型時，只替換目前點選的那一個和弦。
- 可替每個編排項目選擇不同把位。

### 模式三：歌曲和弦精簡總覽＋移調

用途：

- 直接顯示模式二「和弦編排區」目前的結果。
- 保留模式二的順序、重複項目、類型與選定把位。
- 不顯示未點選的其他候選類型。
- 提供「♫ 原調」與「⇄ 目標調」選單。
- 可先預覽移調，不立即修改模式二。
- 確認後可將移調結果套用到模式二的和弦編排區。
- 可恢復原調。

模式三不是另一份獨立資料，而是模式二編排結果的同步總覽。

## 8. 目前網站主要架構

```text
App
├── 網站標頭
├── 首頁標題
├── 三模式切換
├── SingleChordSearch（模式一）
│   ├── 根音選單
│   ├── 升降記號選單
│   ├── 12 種和弦類型選單
│   ├── 聽感描述
│   └── ChordCard
│       ├── 多把位選擇
│       └── ChordDiagram
├── SongChordMode（模式二）
│   ├── 待選區 C～B
│   ├── DndContext 拖曳管理
│   ├── 和弦編排區
│   │   ├── 點擊／拖曳加入
│   │   ├── 插入指定位置
│   │   ├── 重新排序
│   │   └── 拖出移除／觸控 × 移除
│   ├── 點選單一編排項目
│   ├── 主和弦 ChordCard 與把位選擇
│   ├── 選中和弦的 12 種類型 ChordCard
│   └── 移除重複和弦
├── SongChordOverview（模式三）
│   ├── 模式二編排結果的 compact ChordCard
│   ├── 原調與目標調選單
│   ├── 移調預覽
│   ├── 套用到和弦編排區
│   └── 恢復原調
└── 頁尾
```

目前首頁預設顯示：

```text
單一和弦查詢
```

## 9. `App.tsx` 的重要責任

檔案：

```text
src/App.tsx
```

負責：

- 整個頁面骨架。
- 三種模式切換。
- GitHub Repository 連結。
- 保存模式二的 `SongChordItem[]` 和弦編排資料。
- 每個編排項目使用獨立 `id`，即使和弦名稱相同也能分別排序、修改與選把位。
- 保存「移除重複和弦」設定。
- 以項目 ID 保存每一個和弦選定的把位。
- 處理加入、插入、重新排序、移除與類型替換。
- 將模式二編排結果提供給模式三。
- 接收模式三確認後的移調結果，更新模式二編排區。

重要狀態概念：

```text
mode
songItems
removeDuplicates
songShapeIds
```

資料關係：

```text
待選區加入、拖曳排序或類型替換
        ↓
App 更新 songItems
        ↓
每個項目保留獨立 id、symbol 與把位
        ↓
模式二與模式三同時取得最新編排結果
        ↓
模式三可預覽移調
        ↓
確認後將新 symbol 寫回 songItems
```

因此模式三可以同步顯示模式二的結果，並在使用者確認後將移調結果套用回模式二。

## 10. 模式一的檔案與資料流

主要元件：

```text
src/components/search/SingleChordSearch.tsx
```

和弦選單資料：

```text
src/data/chordTypes.ts
```

模式一保存：

```text
rootNote
accidental
chordType
selectedChord
```

資料流：

```text
使用者選擇根音
        +
選擇升降記號
        +
選擇和弦類型
        ↓
buildChordSymbol()
        ↓
顯示「目前選擇」與聽感描述
        ↓
按下「顯示按法」
        ↓
getChordTheory()
        ↓
ChordCard
        ↓
findChordShapes()
        ↓
ChordDiagram
```

模式一不再使用文字輸入框輸入和弦名稱。

手機送出後仍會自動將結果區移到畫面中，方便直接查看和弦圖。

---

## 11. 12 種和弦類型與聽感描述

檔案：

```text
src/data/chordTypes.ts
```

目前包含 12 種：

| 代號   | 中文名稱     | 聽感摘要             |
| ------ | ------------ | -------------------- |
| 無後綴 | 大三和弦     | 明亮、穩定、開闊     |
| `m`    | 小三和弦     | 黯淡、悲傷、沉穩     |
| `7`    | 屬七和弦     | 有張力、不穩定       |
| `maj7` | 大七和弦     | 浪漫、柔和、都市感   |
| `m7`   | 小七和弦     | 憂鬱但柔和、放鬆     |
| `sus4` | 掛四和弦     | 懸空、期待、等待解決 |
| `add9` | 加九和弦     | 明亮、精緻、水晶感   |
| `sus2` | 掛二和弦     | 明亮、空靈、空間感   |
| `m7b5` | 半減七和弦   | 酸楚、憂鬱、過渡張力 |
| `mM7`  | 小大七和弦   | 神祕、戲劇化、懸疑   |
| `maj9` | 大九和弦     | 華麗、高級、寬廣     |
| `7#9`  | 屬七升九和弦 | 刺耳、霸道、爆發力強 |

程式內使用的字串是：

```text
m7b5
7#9
```

畫面顯示時可以使用較易閱讀的：

```text
m7♭5
7♯9
```

聽感描述屬於一般印象，不是絕對結果。

實際聽感仍會受到以下因素影響：

- 前後和弦。
- 節奏。
- 速度。
- 音色。
- 樂器編制。
- 和弦轉位。
- 旋律音。

### 根音

根音選單：

```text
C D E F G A B
```

### 升降記號

升降記號選單：

```text
自然音
♯ 升半音
♭ 降半音
```

程式使用：

```text
""
"#"
"b"
```

---

## 12. 模式二的檔案與資料流

主要元件：

```text
src/components/search/SongChordMode.tsx
```

拖曳套件：

```text
@dnd-kit/core
@dnd-kit/sortable
@dnd-kit/utilities
```

### 編排資料

模式二使用：

```ts
interface SongChordItem {
  id: string;
  symbol: string;
}
```

範例：

```ts
[
  { id: "唯一-id-1", symbol: "C" },
  { id: "唯一-id-2", symbol: "G" },
  { id: "唯一-id-3", symbol: "C" }
]
```

獨立 ID 可確保兩個相同的 `C` 仍能分別移動、修改類型與選擇把位。

### 待選區

固定顯示：

```text
C D E F G A B
```

操作方式：

- 點擊：加入編排區最後面。
- 拖曳：插入編排區的指定位置。
- 待選和弦不會減少，可重複加入。
- 開啟「移除重複和弦」時，已存在的相同 symbol 不會再次加入。

### 和弦編排區

支援：

- 第一個和弦置中顯示。
- 拖曳到另一個和弦前方、後方或兩者中間。
- 拖曳既有和弦重新排序。
- 拖出編排區並放開即可移除。
- 觸控裝置顯示 `×` 作為移除備用操作。
- 剩餘項目會自動重新排列。

拖出移除依賴：

```ts
collisionDetection={pointerWithin}
```

若改回 `closestCenter`，滑鼠離開編排區後仍可能命中最近的項目，導致無法判斷 `event.over === null`。

### 點擊與類型選擇

```text
點擊一個編排和弦
        ↓
以 item.id 設定目前選中項目
        ↓
顯示該和弦完整 ChordCard
        ↓
顯示同根音 12 種 CHORD_TYPE_OPTIONS
        ↓
點擊候選類型
        ↓
只替換目前 item.id 對應的 symbol
        ↓
模式三同步更新
```

再次點擊同一和弦或按「關閉」，可收合類型區。

### 把位選擇

把位資料以項目 ID 保存：

```text
Record<string, string>
```

因此重新排序後，把位仍會跟著正確的和弦項目移動。

### 已移除的功能

自 0.6.0 起，模式二不再包含：

- 圖片或 PDF 上傳。
- OCR 和弦辨識。
- OCR 結果取代或附加到編排區。

上述功能將在另一個獨立專案重新開發。

## 13. 模式三的檔案與資料流

主要元件：

```text
src/components/search/SongChordOverview.tsx
```

移調服務：

```text
src/services/chordTranspose.ts
```

樣式：

```text
src/mode3.css
```

模式三接收：

```text
items
selectedShapeIds
onApplyTransposition
```

其中：

- `items`：模式二目前的 `SongChordItem[]` 編排結果。
- `selectedShapeIds`：以項目 ID 保存的把位資料。
- `onApplyTransposition`：將確認後的移調結果寫回模式二。

### 顯示方式

模式三使用：

```text
compact ChordCard
```

因此：

- 卡片較小。
- 不顯示完整理論資訊。
- 不顯示多把位按鈕。
- 未預覽移調時，直接使用模式二已選定的把位。
- 手機版固定使用兩欄。
- iPad 與電腦依螢幕寬度自動增加欄數。

### 移調流程

```text
♫ 原調
    +
⇄ 目標調
    ↓
預覽移調
    ↓
transposeChordSymbol()
    ↓
模式三顯示預覽結果
    ↓
按「套用到和弦編排區」
    ↓
App 更新 songItems
    ↓
模式二與模式三同步為新調
```

「預覽移調」不會立刻修改模式二。只有按下「套用到和弦編排區」後才會寫回。

移調套用後會清除原本把位選擇，避免舊和弦的把位錯誤套用到新和弦。

例如：

```text
原調 C：C G Am F
目標調 D：D A Bm G
```

## 14. `ChordCard` 的責任

檔案：

```text
src/components/chord/ChordCard.tsx
```

負責：

- 和弦名稱。
- 理論名稱。
- 組成音。
- 斜線和弦低音。
- 同音異名提示。
- 指法圖。
- 難度。
- 把位名稱。
- 多把位按鈕。
- 一般模式與 compact 模式。
- 接收外部選定把位。
- 點選候選卡片後回傳和弦名稱。

重要 props：

```text
symbol
compact
onSelect
selectedShapeId
onShapeChange
eyebrow
```

### 一般模式

使用於：

- 模式一結果。
- 模式二左側主和弦。

顯示：

- 完整名稱。
- 同音異名。
- 難度。
- 把位。
- 組成音。
- 手指說明。
- 多把位選擇。

### Compact 模式

使用於：

- 模式二右側 12 種候選和弦。
- 模式三精簡總覽。

省略詳細文字，以減少卡片大小。

---

## 15. `ChordDiagram` 的責任

檔案：

```text
src/components/chord/ChordDiagram.tsx
```

負責使用 SVG 繪製：

- 六條琴弦。
- 琴格。
- 按弦點。
- 空弦。
- 不彈標示。
- 橫按。
- 手指編號。
- 起始琴格。

`ChordDiagram` 不負責決定和弦怎麼按。

它只將 `ChordShape` 資料畫出來。

---

## 16. 和弦資料分成三個主要檔案

```text
src/data
├── chordShapes.ts
├── chordTypes.ts
└── generatedChordShapes.ts
```

三個檔案都要保留。

它們不是重複檔案。

### `src/data/chordShapes.ts`

負責：

- 保存人工整理的開放和弦與特殊按法。
- 整合人工按法與自動產生按法。
- 查詢某個和弦的全部按法。
- 排序多個把位。
- 建立快速查詢表。
- 驗證資料格式。
- 提供把位名稱。
- 提供統計資料。

這是和弦指法資料的主要入口。

其他元件通常呼叫：

```ts
findChordShapes(symbol);
```

而不是直接讀取陣列。

### `src/data/chordTypes.ts`

負責：

- 模式一的根音選單。
- 模式一的升降記號選單。
- 12 種和弦類型。
- 中文名稱。
- 聽感描述。
- 組合和弦名稱的 `buildChordSymbol()`。
- 模式二右側的 12 種候選類型。

修改類型名稱或聽感描述時，主要修改這個檔案。

### `src/data/generatedChordShapes.ts`

負責使用模板自動建立可移動按法。

目前支援：

- 低音 E 弦根音按法。
- A 弦根音按法。
- 第 1 格至第 11 格的常用把位。
- 12 種和弦類型。
- 自動建立 `baseFret`。
- 自動建立橫按資料。
- 自動建立把位名稱。
- 避免加入與現有手寫指法完全相同的資料。

第 12 格通常與空弦音高重複，因此自動資料只建立第 1 至第 11 格。

---

## 17. 手寫按法與自動產生按法

目前和弦按法來源有兩種。

### 手寫按法

放在：

```text
src/data/chordShapes.ts
```

適合：

- 開放和弦。
- 初學者簡易按法。
- 特殊轉位。
- 不符合一般 E 型或 A 型模板的按法。
- 想指定特定手指編號的按法。

例如：

```text
C 開放位
F 簡易位
Cadd9 開放位
Bm7 簡易位
```

### 自動產生按法

由：

```text
src/data/generatedChordShapes.ts
```

使用模板產生。

適合：

- 封閉和弦。
- 低音 E 弦根音。
- A 弦根音。
- 同一類型沿著指板移動的按法。

例如 C 大三和弦可能包含：

```text
開放位
第 3 格・A 弦根音
第 8 格・低音 E 弦根音
```

### 合併規則

```text
人工按法
    +
自動產生按法
    ↓
完全相同的 symbol 與 frets 去除重複
    ↓
findChordShapes()
```

排序原則：

1. `beginner` 標籤優先。
2. 開放位優先。
3. 較低把位優先。
4. 難度較低者優先。

因此 `G#` 不會只顯示第 11 格 A 弦根音，也可以顯示第 4 格低音 E 弦根音。

---

## 18. 和弦按法資料規則

`frets` 順序固定為：

```text
低音 E、A、D、G、B、高音 e
```

例如：

```ts
frets: ["x", 3, 2, 0, 1, 0];
```

代表：

```text
低音 E：不彈
A：第 3 格
D：第 2 格
G：空弦
B：第 1 格
高音 e：空弦
```

數值規則：

- `"x"`：不彈。
- `0`：空弦。
- 正整數：實際琴格。
- `baseFret`：和弦圖第一格的實際琴格。
- `barres`：橫按資料。
- `fingers`：六條弦的手指編號。
- `position: "open"`：開放位。
- `position: "movable"`：可移動按法。

手指編號：

```text
1：食指
2：中指
3：無名指
4：小指
```

### 一筆資料的重要欄位

```ts
{
  id: "唯一識別名稱",
  symbol: "Cmaj7",
  displayName: "C Major 7",
  frets: [...],
  fingers: [...],
  baseFret: 1,
  barres: [...],
  difficulty: 1,
  position: "open",
  variantLabel: "開放位",
  tags: [...]
}
```

### 驗證項目

啟動時會檢查：

- `id` 不可重複。
- `frets` 必須有六個位置。
- `fingers` 必須有六個位置。
- 琴格數值必須有效。
- 橫按弦數範圍必須有效。
- 橫按琴格必須有效。

新增資料後若網站無法啟動，先查看終端機顯示的資料驗證錯誤。

---

## 19. 理論資料與指法資料的差別

和弦理論：

```text
src/services/chordTheory.ts
```

使用 Tonal 計算：

- 和弦是否有效。
- 和弦正式名稱。
- 組成音。
- 音程。
- 斜線和弦低音。

吉他怎麼按：

```text
src/data/chordShapes.ts
src/data/generatedChordShapes.ts
```

因此完整流程是：

```text
和弦名稱
├── Tonal → 理論名稱與組成音
└── 指法資料 → 琴格、手指與橫按
```

網站查詢時不會到其他和弦網站即時抓取指法。

Tonal 套件已在安裝 dependencies 時下載，並在建置時包入網站。

---

## 20. 同音異名

檔案：

```text
src/utils/chordAliases.ts
```

用途是讓不同音名共用相同指法。

例如：

```text
A# → Bb
Gb → F#
G# → Ab
Db → C#
D# → Eb
```

因此使用者選擇 `G#` 時，畫面可以顯示 `G#`，但指法資料可能採用 `Ab`。

`ChordCard` 會顯示：

```text
按法與音名採用 Ab
```

同音異名只改變資料查詢方式，不會改掉使用者原本選擇的顯示名稱。

---

## 21. 文字解析服務

### `src/services/chordParser.ts`

負責模式二：

- 用空格分割。
- 用逗號分割。
- 用換行分割。
- 清理空項目。
- 移除重複和弦。

### `src/utils/normalizeChordName.ts`

負責清理和弦文字，例如：

- 空白。
- 升降符號。
- 輸入格式。

模式一目前改用選單，不再依靠使用者手動輸入和弦名稱。

但歌曲模式與其他服務仍可能使用文字正規化功能。

### `src/services/relatedChords.ts`

保留原本的相關和弦推薦邏輯。

目前模式二只在使用者點選編排區和弦後，顯示完整 12 種同根音類型，因此不再以 `relatedChords.ts` 作為主要候選來源。

除非未來重新加入「音樂理論相關和弦推薦」功能，否則平常不需要修改這個檔案。

---

## 22. CSS 樣式分工

### `src/styles.css`

負責：

- 全站外觀。
- 標頭與頁尾。
- 模式按鈕。
- 模式一查詢區。
- 和弦選單。
- 聽感描述。
- 和弦卡。
- 和弦圖。
- 模式二待選區、和弦編排區與拖曳狀態。
- 電腦版與手機版響應式樣式。

### `src/mode3.css`

負責：

- 三模式按鈕橫向捲動。
- 模式三精簡總覽。
- 模式三手機兩欄。
- 模式二選中和弦的 12 種類型網格。
- 目前選定類型的黃色邊框。
- 模式三原調、目標調與移調按鈕。
- 手機版移調控制與候選卡片排列。

目前只需保留：

```text
src/styles.css
src/mode3.css
```

`src/score.css` 已於 0.6.0 移除。

## 23. 電腦版、手機版與 iPad

### 模式一電腦版

使用雙欄排列：

```text
左側：根音、升降記號、類型與聽感
右側：和弦圖
```

### 模式一手機版

使用單欄排列：

```text
選單與聽感
↓
和弦圖
```

### 模式二電腦版

由上到下顯示：

```text
待選區
和弦編排區
選中和弦的完整按法與 12 種類型
```

待選區通常一列顯示 `C～B`。編排區會置中排列和弦，並可拖曳插入、排序或拖出移除。

### 模式二手機版

- 待選區改為較少欄數。
- 編排和弦會自動換行。
- 支援觸控拖曳。
- 每個編排項目顯示 `×`。
- 選中和弦的 12 種候選使用兩欄排列。

### 模式三手機版

- 主和弦精簡卡固定兩欄排列。
- 原調與目標調選單改為垂直排列。
- 預覽、套用與恢復按鈕使用全寬排列。

### iPad

- 模式三會依可用寬度自動增加欄數。
- 移調控制保留較大的操作空間。

## 24. 基本功能測試

每次修改和弦相關程式後，建議完整測試。

### 模式一測試

依序測試：

```text
C
F
F#m
Bbmaj7
G#
C#mM7
Dmaj9
F7#9
G#m7b5
Cadd9
Bm7
```

確認：

- 和弦名稱正確。
- 聽感描述會跟類型改變。
- 組成音正常。
- 有和弦圖。
- 多把位按鈕正常。
- 同音異名提示正常。

### 模式二測試

確認：

1. 點擊待選區的 `C、G、A、F`，能依序加入編排區。
2. 從待選區拖曳和弦到指定位置，插入位置正確。
3. 編排區既有和弦可重新排序。
4. 將既有和弦拖出編排區並放開，可以移除。
5. 手機或觸控模式可用 `×` 移除。
6. 點擊編排區中的某一個和弦後，才顯示完整按法與 12 種類型。
7. 點選 `Gmaj9` 時，只替換目前選中的 `G`。
8. 相同和弦出現兩次時，可分別選擇類型與把位。
9. 開啟「移除重複和弦」後，只保留每種 symbol 第一次出現的位置。
10. 畫面中沒有圖片上傳、PDF 或 OCR 區域。

### 模式三測試

先在模式二建立：

```text
C G Am F
```

確認：

- 模式三顯示相同順序。
- 模式二選定把位能保留。
- 原調選 `C`、目標調選 `D` 後，預覽顯示 `D A Bm G`。
- 預覽時模式二仍維持 `C G Am F`。
- 按「套用到和弦編排區」後，模式二更新成 `D A Bm G`。
- 套用後原調更新為 `D`。
- 「恢復原調」可取消尚未套用的預覽。
- 手機版使用兩欄，卡片沒有超出畫面。

### 發布前指令

```powershell
npm run typecheck
npm run build
npm run dev
```

## 25. 新增或修改和弦時該改哪裡

### 修改聽感描述

```text
src/data/chordTypes.ts
```

### 新增第 13 種和弦類型

通常要同時修改：

```text
src/data/chordTypes.ts
src/data/generatedChordShapes.ts
```

### 新增特殊開放按法

```text
src/data/chordShapes.ts
```

### 新增同音異名

```text
src/utils/chordAliases.ts
```

### 修改模式二候選或拖曳編排

```text
src/components/search/SongChordMode.tsx
src/styles.css
src/mode3.css
```

### 修改模式三總覽或移調介面

```text
src/components/search/SongChordOverview.tsx
src/mode3.css
```

### 修改移調規則

```text
src/services/chordTranspose.ts
```

### 修改三模式共用狀態

```text
src/App.tsx
```

### 已移除的檔案

以下檔案自 0.6.0 起已不存在，不要再依照舊文件修改：

```text
src/components/score/
src/services/chordRecognition.ts
src/services/scoreExport.ts
src/services/scoreFiles.ts
src/types/score.ts
src/score.css
```

## 26. 修改 Repository 名稱時

若 GitHub Repository 不再叫：

```text
guitar-chord-board
```

需要修改三個地方。

### `vite.config.ts`

```ts
const repositoryName = "新的-repository-名稱";
```

### `src/App.tsx`

```ts
const REPOSITORY_URL = "https://github.com/jyj8f6h6z6-hub/新的-repository-名稱";
```

### Git remote

```bash
git remote set-url origin https://github.com/jyj8f6h6z6-hub/新的-repository-名稱.git
git remote -v
```

修改後執行：

```bash
npm run build
git add src vite.config.ts
git commit -m "更新 repository 名稱與部署路徑"
git push
```

---

## 27. 修改出錯時的安全復原

先查看最近的 commit：

```bash
git log --oneline -5
```

### 尚未 commit

只還原單一檔案：

```bash
git restore 路徑
```

例如：

```bash
git restore src/App.tsx
```

還原所有已追蹤但尚未提交的檔案：

```bash
git restore .
```

注意：`git restore .` 不會刪除未追蹤的新檔案。

### 已經 commit 或 push

建議使用：

```bash
git revert COMMIT編號
git push
```

例如：

```bash
git revert a1b2c3d
git push
```

不要使用：

```text
git push --force
```

`git revert` 會保留修改紀錄，GitHub Pages 也會自動部署復原後的版本。

---

## 28. 更新包的安全套用方式

收到 zip 更新包時：

1. 停止 `npm run dev`。
2. 備份整個專案資料夾。
3. 解壓縮更新包。
4. 確認第一層是否直接看到 `src`。
5. 將更新包的 `src` 複製到專案根目錄。
6. Windows 詢問時選擇取代。
7. 確認沒有變成 `src\src`。
8. 執行 `npm run typecheck`。
9. 執行 `npm run build`。
10. 執行 `npm run dev`。
11. 完整測試後才 commit。

正確：

```text
D:\guitar-chord-board\src\data\chordTypes.ts
```

錯誤：

```text
D:\guitar-chord-board\src\src\data\chordTypes.ts
```

---

## 29. 目前不應重複套用的舊更新

目前專案已包含：

- 0.2.0 多把位與同音異名。
- 模式一選單與 12 種和弦類型。
- 自動產生的低音 E 弦與 A 弦根音按法。
- 模式二待選區、拖曳式和弦編排與拖出移除。
- 模式三精簡總覽與移調。
- `@dnd-kit` 拖曳套件。

0.4.0 曾加入圖片、PDF、OCR 與智慧歌譜功能，但這些功能已於 0.6.0 從本專案移除。

因此不要再次套用舊的歌譜更新包：

```text
guitar-chord-board-score-phase1.zip
pdfjs-render-fix.zip
guitar-chord-ocr-filter-update.zip
guitar-chord-ocr-color-pass-update.zip
```

也不要重新安裝以下已移除 dependencies：

```text
tesseract.js
pdfjs-dist
jspdf
```

重新套用會把已刪除的圖片視譜程式帶回主專案。

## 30. 每次發布前檢查

```text
□ 所有修改檔案都已儲存
□ npm run typecheck 成功
□ npm run build 成功
□ 模式一選單正常
□ 模式一聽感描述正常
□ 模式一多把位正常
□ 模式二待選區點擊與拖曳加入正常
□ 模式二可插入指定位置並重新排序
□ 模式二拖出編排區可以移除
□ 模式二觸控 × 移除正常
□ 模式二只在點選和弦後顯示 12 種候選
□ 模式二類型替換只影響選中項目
□ 模式二把位選擇正常
□ 模式二沒有圖片、PDF 或 OCR 功能
□ 模式三完整同步模式二編排順序與項目
□ 模式三原調與目標調選單正常
□ 模式三預覽不會提前修改模式二
□ 模式三套用移調後會同步更新模式二
□ 模式三恢復原調正常
□ 手機版畫面正常
□ iPad 版畫面正常
□ git status 只有預期修改
□ 沒有把 .bak、.patch、.cjs、.zip 加入 Git
□ commit 訊息能說明修改內容
□ git push 成功
□ GitHub Actions 顯示綠色勾勾
□ GitHub Pages 正式網站已確認
```

## 31. 0.4.0：拍照視譜與智慧歌譜第一期（歷史紀錄）

0.4.0 曾加入：

- 圖片與 PDF 上傳。
- Tesseract.js OCR。
- PDF.js 逐頁渲染。
- 模式四智慧歌譜。
- PNG 與 PDF 匯出。

這些功能後來確認應獨立成另一個專案，因此自 0.6.0 起已從 Guitar Chord Board 移除。

本專案不保留其原始元件、服務、型別或 dependencies。

---

## 32. 0.5.0：拖曳式歌曲和弦編排

### 已完成

- 模式二改為「待選區」與「和弦編排區」。
- 待選區固定保留 `C、D、E、F、G、A、B`。
- 支援點擊加入、拖曳插入與編排區內重新排序。
- 使用 `pointerWithin` 判斷拖出編排區，放開後移除項目。
- 觸控裝置提供 `×` 移除按鈕。
- 每個和弦使用獨立 `SongChordItem.id`。
- 類型替換與把位選擇以項目 ID 對應。
- 模式三同步模式二的順序、重複項目、類型與把位。
- 新增 `@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`。

---

## 33. 0.6.0：聚焦三種和弦模式

### 架構調整

- 移除模式四「智慧歌譜」。
- 移除模式二圖片與 PDF 上傳區。
- 移除 OCR、歌譜覆蓋與 PNG／PDF 匯出。
- 移除 `tesseract.js`、`pdfjs-dist`、`jspdf`。
- 專案保留三種模式：單一和弦查詢、歌曲和弦編排、精簡總覽＋移調。

### 模式三移調

- 提供「♫ 原調」與「⇄ 目標調」。
- 可先預覽移調。
- 預覽不會立即修改模式二。
- 可將結果套用到和弦編排區。
- 可恢復原調。
- 共用 `src/services/chordTranspose.ts`。

### 版本與 Git 標籤

```powershell
npm version 0.6.0 --no-git-tag-version
npm run typecheck
npm run build

git add package.json package-lock.json src docs/PROJECT_GUIDE.md
git commit -m "release: focus app on chord arranging and transposition v0.6.0"
git tag -a v0.6.0 -m "Guitar Chord Board v0.6.0"
git push
git push origin v0.6.0
```

網站頁尾會顯示：

```text
Guitar Chord Board · 0.6.0
```

---

## 34. 這份文件之後如何維護

每次新增大功能後，至少更新以下區域：

1. 「目前網站的三種模式」。
2. 「網站主要架構」。
3. 「主要檔案用途」。
4. 「基本功能測試」。
5. 「版本更新紀錄」。
6. 「目前不應重複套用的舊更新」。
7. 「發布前檢查」。

本文件應保留在：

```text
docs/PROJECT_GUIDE.md
```

更新文件後提交：

```bash
git add docs/PROJECT_GUIDE.md
git status
git commit -m "更新專案操作手冊"
git push
```
