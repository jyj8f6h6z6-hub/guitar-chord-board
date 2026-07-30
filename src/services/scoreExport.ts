import { jsPDF } from "jspdf";
import { loadImageElement } from "./scoreFiles";
import type { ScoreChordMark, ScorePage } from "../types/score";

function safeFileName(value: string): string {
  const cleaned = value.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  return cleaned || "guitar-chord-score";
}

export async function renderAnnotatedPage(
  page: ScorePage,
  marks: readonly ScoreChordMark[],
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new Error("瀏覽器無法建立下載畫布。");
  }

  canvas.width = page.width;
  canvas.height = page.height;
  const image = await loadImageElement(page.dataUrl);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.textBaseline = "top";

  for (const mark of marks) {
    const paddingX = Math.max(5, mark.bbox.height * 0.25);
    const paddingY = Math.max(3, mark.bbox.height * 0.12);
    const fontSize = Math.max(16, Math.min(54, mark.bbox.height * 1.12));
    context.font = `700 ${fontSize}px Arial, sans-serif`;
    const textWidth = context.measureText(mark.symbol).width;
    const boxWidth = Math.max(mark.bbox.width, textWidth) + paddingX * 2;
    const boxHeight = Math.max(mark.bbox.height, fontSize) + paddingY * 2;
    const x = Math.max(0, mark.bbox.x - paddingX);
    const y = Math.max(0, mark.bbox.y - paddingY);

    context.fillStyle = "#ffffff";
    context.fillRect(x, y, boxWidth, boxHeight);
    context.fillStyle = "#111111";
    context.fillText(mark.symbol, x + paddingX, y + paddingY);
  }

  return canvas;
}

function triggerDownload(url: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export async function downloadAnnotatedPng(
  page: ScorePage,
  marks: readonly ScoreChordMark[],
): Promise<void> {
  const canvas = await renderAnnotatedPage(page, marks);
  const fileName = `${safeFileName(page.name.replace(/\.pdf$/i, ""))}-page-${page.pageNumber}.png`;
  triggerDownload(canvas.toDataURL("image/png"), fileName);
}

export async function downloadAnnotatedPdf(
  pages: readonly ScorePage[],
  marks: readonly ScoreChordMark[],
  baseFileName: string,
): Promise<void> {
  if (pages.length === 0) {
    return;
  }

  const renderedPages: HTMLCanvasElement[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    renderedPages.push(
      await renderAnnotatedPage(
        pages[index],
        marks.filter((mark) => mark.pageIndex === index),
      ),
    );
  }

  const firstCanvas = renderedPages[0];
  const firstOrientation = firstCanvas.width >= firstCanvas.height ? "landscape" : "portrait";
  const document = new jsPDF({
    orientation: firstOrientation,
    unit: "px",
    format: [firstCanvas.width, firstCanvas.height],
    hotfixes: ["px_scaling"],
  });

  document.addImage(
    firstCanvas.toDataURL("image/png"),
    "PNG",
    0,
    0,
    firstCanvas.width,
    firstCanvas.height,
    undefined,
    "FAST",
  );

  for (let index = 1; index < renderedPages.length; index += 1) {
    const canvas = renderedPages[index];
    const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
    document.addPage([canvas.width, canvas.height], orientation);
    document.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      canvas.width,
      canvas.height,
      undefined,
      "FAST",
    );
  }

  document.save(`${safeFileName(baseFileName.replace(/\.(pdf|png|jpe?g)$/i, ""))}-chords.pdf`);
}
