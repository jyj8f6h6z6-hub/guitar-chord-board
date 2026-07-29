# GitHub 與 GitHub Pages 設定

## 目前 repository

```text
https://github.com/jyj8f6h6z6-hub/guitar-chord-board
```

GitHub Pages 已設定使用 GitHub Actions，首次部署已成功。

## 日常發布流程

在 VS Code 終端機執行：

```bash
git status
git add .
git commit -m "描述這次修改"
git push
```

`.github/workflows/deploy.yml` 會在每次 push 到 `main` 時：

1. 取出程式碼。
2. 安裝 Node.js。
3. 安裝 dependencies。
4. 執行 TypeScript 與 Vite build。
5. 上傳 `dist`。
6. 發布到 GitHub Pages。

## 重新執行失敗的部署

```text
Repository → Actions → 選擇失敗的 workflow → Re-run jobs
```

## 修改 repository 名稱

若 repository 名稱不是 `guitar-chord-board`，修改 `vite.config.ts`：

```ts
const repositoryName = "新的-repository-名稱";
```

同時更新 `src/App.tsx` 內的 `REPOSITORY_URL`。
