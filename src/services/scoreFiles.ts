import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { ScorePage } from "../types/score";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const MAX_PAGES = 24;
const PDF_RENDER_SCALE = 2;
const MAX_RENDER_WIDTH = 2200;

function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`無法讀取 ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("無法載入歌譜圖片。"));
    image.src = source;
  });
}

async function loadImageFile(file: File, pageNumber: number): Promise<ScorePage> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(dataUrl);

  return {
    id: createId("image-page"),
    name: file.name,
    pageNumber,
    dataUrl,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

async function loadPdfFile(file: File, startingPageNumber: number): Promise<ScorePage[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, MAX_PAGES);
  const pages: ScorePage[] = [];

  for (let index = 0; index < pageCount; index += 1) {
    const pdfPage = await pdf.getPage(index + 1);
    const originalViewport = pdfPage.getViewport({ scale: PDF_RENDER_SCALE });
    const widthScale = Math.min(1, MAX_RENDER_WIDTH / originalViewport.width);
    const viewport = pdfPage.getViewport({ scale: PDF_RENDER_SCALE * widthScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("瀏覽器無法建立 PDF 預覽畫布。");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await pdfPage.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    pages.push({
      id: createId("pdf-page"),
      name: file.name,
      pageNumber: startingPageNumber + index,
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    });
  }

  return pages;
}

export async function loadScoreFiles(files: readonly File[]): Promise<ScorePage[]> {
  if (files.length === 0) {
    return [];
  }

  const pages: ScorePage[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`${file.name} 超過 30 MB，請先壓縮或分割檔案。`);
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage =
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      /\.(png|jpe?g)$/i.test(file.name);

    if (isPdf) {
      const pdfPages = await loadPdfFile(file, pages.length + 1);
      pages.push(...pdfPages);
    } else if (isImage) {
      pages.push(await loadImageFile(file, pages.length + 1));
    } else {
      throw new Error(`${file.name} 不是支援的 PNG、JPG、JPEG 或 PDF。`);
    }

    if (pages.length >= MAX_PAGES) {
      break;
    }
  }

  return pages.slice(0, MAX_PAGES).map((page, index) => ({
    ...page,
    pageNumber: index + 1,
  }));
}
