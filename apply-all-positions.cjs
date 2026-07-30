const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();
const chordShapesPath = path.join(projectRoot, "src", "data", "chordShapes.ts");
const generatedPath = path.join(projectRoot, "src", "data", "generatedChordShapes.ts");

function fail(message) {
  console.error(`\n錯誤：${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(chordShapesPath)) {
  fail("找不到 src/data/chordShapes.ts。請先切換到 D:\\guitar-chord-board。")
}

if (!fs.existsSync(generatedPath)) {
  fail("找不到 src/data/generatedChordShapes.ts。請先把更新包內的 src 複製到專案根目錄。")
}

const generatedContent = fs.readFileSync(generatedPath, "utf8");
if (!generatedContent.includes("existingShapes: readonly ChordShape[]")) {
  fail("generatedChordShapes.ts 不是這次的多把位版本，請重新複製更新包內的 src。")
}

let content = fs.readFileSync(chordShapesPath, "utf8");
const originalContent = content;

if (!content.includes("HAND_AUTHORED_CHORD_SHAPES")) {
  fail("找不到 HAND_AUTHORED_CHORD_SHAPES，已停止修改。")
}

const oldSetPattern = /const\s+HAND_AUTHORED_SYMBOLS\s*=\s*new\s+Set\(\s*HAND_AUTHORED_CHORD_SHAPES\.map\(\(shape\)\s*=>\s*shape\.symbol\),?\s*\);\s*/;
content = content.replace(oldSetPattern, "");

content = content.replace(
  /createGeneratedChordShapes\(\s*HAND_AUTHORED_SYMBOLS\s*\)/g,
  "createGeneratedChordShapes(HAND_AUTHORED_CHORD_SHAPES)",
);

if (!content.includes("createGeneratedChordShapes(HAND_AUTHORED_CHORD_SHAPES)")) {
  fail("找不到舊的產生式和弦連接位置，已停止修改。")
}

if (!content.includes("left.baseFret - right.baseFret")) {
  const oldSortPattern = /return\s+beginnerDifference\s*\|\|\s*openDifference\s*\|\|\s*left\.difficulty\s*-\s*right\.difficulty\s*;/;

  if (!oldSortPattern.test(content)) {
    fail("找不到原本的把位排序程式，已停止修改。")
  }

  content = content.replace(
    oldSortPattern,
    `return (\n      beginnerDifference ||\n      openDifference ||\n      left.baseFret - right.baseFret ||\n      left.difficulty - right.difficulty\n    );`,
  );
}

if (content.includes("HAND_AUTHORED_SYMBOLS")) {
  fail("舊的 HAND_AUTHORED_SYMBOLS 仍然存在，為避免不完整修改，已停止。")
}

if (content === originalContent) {
  console.log("\n多把位連接與排序已經完成，不需要重複修改。\n");
  process.exit(0);
}

const timestamp = Date.now();
const backupPath = path.join(
  projectRoot,
  `chordShapes.ts.before-all-positions-${timestamp}.bak`,
);
fs.writeFileSync(backupPath, originalContent, "utf8");
fs.writeFileSync(chordShapesPath, content, "utf8");

console.log("\n已完成：");
console.log("1. 同一和弦可保留手寫按法，再補低音 E 弦與 A 弦根音把位。");
console.log("2. 完全相同的指法不會重複顯示。");
console.log("3. 開放位優先，其餘依較低把位排列。");
console.log(`\n備份檔：${backupPath}`);
console.log("\n接著請執行：");
console.log("npm run typecheck");
console.log("npm run build");
console.log("npm run dev\n");
