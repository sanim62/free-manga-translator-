/**
 * browserOcr.ts — Client-side manga OCR pipeline using Tesseract.js
 *
 * Replaces the Python ocr_service.py + Node localPipeline.ts entirely.
 * Runs 100% in the browser — no server, no API key, no model download (streamed lazily).
 *
 * Pipeline:
 *   1. Load image onto a canvas
 *   2. Detect speech bubbles via canvas-based contour approximation
 *   3. For each bubble crop, run Tesseract.js Japanese OCR (jpn + jpn_vert)
 *   4. Return TextBlock[] with ja_text filled (en_text left for dictionary layer)
 */

import { createWorker, PSM } from 'tesseract.js';
import { translateWithDictionary } from './localTranslator';
import type { TextBlock } from '../types';

// Singleton Tesseract worker — created once, reused for the whole session
let _worker: Awaited<ReturnType<typeof createWorker>> | null = null;
let _workerReady = false;
let _workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

export type OcrProgressCallback = (stage: string, progress: number) => void;

/**
 * Initialise (or return cached) Tesseract worker with Japanese language data.
 * Language data is fetched from jsDelivr CDN on first call (~10 MB, cached by browser).
 */
export async function getWorker(onProgress?: OcrProgressCallback): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (_worker && _workerReady) return _worker;
  if (_workerPromise) return _workerPromise;

  onProgress?.('Loading Japanese OCR engine…', 5);
  _workerPromise = (async () => {
    try {
      _worker = await createWorker('jpn', 1, {
        logger: (m) => {
          if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
            onProgress?.('Loading OCR core…', 10);
          } else if (m.status === 'loading language traineddata') {
            onProgress?.('Loading Japanese language data…', 20 + Math.round((m.progress || 0) * 40));
          } else if (m.status === 'initialized tesseract') {
            onProgress?.('OCR engine ready', 65);
          }
        },
        // Serve a compact Japanese model with the app itself. This avoids a
        // slow or blocked third-party download before the first image can OCR.
        langPath: new URL('/tessdata/', window.location.origin).href,
        // Reuse browser-cached trained data on subsequent visits.
        cacheMethod: 'write',
      });
      await _worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      _workerReady = true;
      onProgress?.('OCR engine ready', 70);
      return _worker;
    } catch (error) {
      _worker = null;
      _workerReady = false;
      throw error;
    } finally {
      _workerPromise = null;
    }
  })();
  return _workerPromise;
}

// ─── Canvas-based bubble detection ───────────────────────────────────────────

interface BubbleRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  /** box_2d: [ymin, xmin, ymax, xmax] 0-1000 */
  box_2d: [number, number, number, number];
  color: 'white' | 'black';
}

/**
 * Detect speech bubble bounding boxes using a canvas threshold + run-length scan.
 * Works entirely with browser Canvas 2D API — no OpenCV needed.
 *
 * Algorithm:
 *  1. Draw image to canvas
 *  2. Get pixel data
 *  3. Threshold to binary (white pixels = potential bubble interior)
 *  4. Flood-fill / connected-component scan to find white regions
 *  5. Filter by size, aspect ratio, and interior brightness
 */
export function detectBubbles(imageData: ImageData, imgW: number, imgH: number): BubbleRegion[] {
  const { data, width, height } = imageData;
  const minArea = width * height * 0.003;
  const maxArea = width * height * 0.35;
  const bubbles: BubbleRegion[] = [];
  for (const polarity of ['light', 'dark'] as const) {
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      binary[i] = polarity === 'light' ? (lum > 200 ? 1 : 0) : (lum < 55 ? 1 : 0);
    }
    const labels = new Int32Array(width * height).fill(-1);
    const queue = new Int32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!binary[idx] || labels[idx] !== -1) continue;
      let head = 0, tail = 0, x1 = x, y1 = y, x2 = x, y2 = y;
      queue[tail++] = idx; labels[idx] = idx;
      while (head < tail) {
        const cur = queue[head++], cx = cur % width, cy = Math.floor(cur / width);
        x1 = Math.min(x1, cx); y1 = Math.min(y1, cy); x2 = Math.max(x2, cx); y2 = Math.max(y2, cy);
        let nb = cur - 1;
        if (cx > 0 && binary[nb] && labels[nb] === -1) { labels[nb] = idx; queue[tail++] = nb; }
        nb = cur + 1;
        if (cx + 1 < width && binary[nb] && labels[nb] === -1) { labels[nb] = idx; queue[tail++] = nb; }
        nb = cur - width;
        if (cy > 0 && binary[nb] && labels[nb] === -1) { labels[nb] = idx; queue[tail++] = nb; }
        nb = cur + width;
        if (cy + 1 < height && binary[nb] && labels[nb] === -1) { labels[nb] = idx; queue[tail++] = nb; }
      }
      const bw = x2 - x1 + 1, bh = y2 - y1 + 1, area = bw * bh;
      const touchesEdge = x1 <= 1 || y1 <= 1 || x2 >= width - 2 || y2 >= height - 2;
      if (tail < minArea || tail > maxArea || area > maxArea || touchesEdge || bw < 20 || bh < 15) continue;
      const aspect = bw / bh;
      if (aspect < 0.15 || aspect > 6 || tail / area < 0.40) continue;
      const pad = 6, rx = Math.max(0, x1 - pad), ry = Math.max(0, y1 - pad), rx2 = Math.min(width, x2 + pad + 1), ry2 = Math.min(height, y2 + pad + 1);
      bubbles.push({ x: rx, y: ry, w: rx2 - rx, h: ry2 - ry, color: polarity === 'light' ? 'white' : 'black',
        box_2d: [Math.round(ry / height * 1000), Math.round(rx / width * 1000), Math.round(ry2 / height * 1000), Math.round(rx2 / width * 1000)] });
    }
  }

  // Sort manga reading order: right-to-left columns, top-to-bottom rows
  bubbles.sort((a, b) => {
    const rowA = Math.round(a.y / 140);
    const rowB = Math.round(b.y / 140);
    if (rowA !== rowB) return rowA - rowB;
    return b.x - a.x; // right-to-left
  });

  // De-duplicate heavily overlapping boxes (IoU > 0.5)
  const kept: BubbleRegion[] = [];
  for (const b of bubbles) {
    const overlap = kept.some((k) => iou(b, k) > 0.5);
    if (!overlap) kept.push(b);
  }

  return kept;
}

function iou(a: BubbleRegion, b: BubbleRegion): number {
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.w, b.x + b.w);
  const iy2 = Math.min(a.y + a.h, b.y + b.h);
  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const union = a.w * a.h + b.w * b.h - inter;
  return inter / union;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

/**
 * Full client-side OCR pipeline:
 *   1. Detect bubbles from the image data URL
 *   2. For each bubble, run Tesseract Japanese OCR
 *   3. Translate with dictionary
 *   4. Return TextBlock[] matching the same shape as the old server response
 */
export async function runBrowserOcr(
  imageDataUrl: string,
  onProgress?: OcrProgressCallback
): Promise<TextBlock[]> {
  onProgress?.('Preparing image…', 2);

  // Draw image to an offscreen canvas
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  onProgress?.('Preparing image for bubble detection…', 8);
  // Connected-component detection is quadratic in neither dimension, but
  // doing it over a 2200px scan still means millions of pixel visits. A
  // 1200px analysis copy keeps bubble geometry while cutting that work sharply.
  const detectionScale = Math.min(1, 1200 / Math.max(img.width, img.height));
  const detectionCanvas = document.createElement('canvas');
  detectionCanvas.width = Math.max(1, Math.round(img.width * detectionScale));
  detectionCanvas.height = Math.max(1, Math.round(img.height * detectionScale));
  const detectionCtx = detectionCanvas.getContext('2d')!;
  detectionCtx.drawImage(canvas, 0, 0, detectionCanvas.width, detectionCanvas.height);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  onProgress?.('Detecting speech bubbles…', 10);
  const imageData = detectionCtx.getImageData(0, 0, detectionCanvas.width, detectionCanvas.height);
  const scaleX = img.width / detectionCanvas.width;
  const scaleY = img.height / detectionCanvas.height;
  const bubbles = detectBubbles(imageData, detectionCanvas.width, detectionCanvas.height).map((bubble) => ({
    ...bubble,
    x: Math.max(0, Math.round(bubble.x * scaleX)),
    y: Math.max(0, Math.round(bubble.y * scaleY)),
    w: Math.min(img.width - Math.round(bubble.x * scaleX), Math.round(bubble.w * scaleX)),
    h: Math.min(img.height - Math.round(bubble.y * scaleY), Math.round(bubble.h * scaleY)),
  }));

  if (bubbles.length === 0) {
    onProgress?.('No speech bubbles detected', 100);
    return [];
  }

  onProgress?.(`Found ${bubbles.length} bubble(s) — initialising OCR…`, 15);
  const worker = await getWorker(onProgress);

  const results: TextBlock[] = [];

  for (let i = 0; i < bubbles.length; i++) {
    const bubble = bubbles[i];
    const pct = Math.round(70 + (i / bubbles.length) * 25);
    onProgress?.(`OCR bubble ${i + 1}/${bubbles.length}…`, pct);

    // Crop bubble to its own canvas
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = bubble.w;
    cropCanvas.height = bubble.h;
    const cropCtx = cropCanvas.getContext('2d')!;
    cropCtx.drawImage(canvas, bubble.x, bubble.y, bubble.w, bubble.h, 0, 0, bubble.w, bubble.h);

    // Upscale tiny crops for better OCR accuracy
    let ocrCanvas = cropCanvas;
    if (bubble.w < 120 || bubble.h < 80) {
      const scale = Math.max(120 / bubble.w, 80 / bubble.h);
      ocrCanvas = document.createElement('canvas');
      ocrCanvas.width = Math.round(bubble.w * scale);
      ocrCanvas.height = Math.round(bubble.h * scale);
      const sc = ocrCanvas.getContext('2d')!;
      sc.imageSmoothingQuality = 'high';
      sc.drawImage(cropCanvas, 0, 0, ocrCanvas.width, ocrCanvas.height);
    }

    try {
      if (bubble.color === 'black') {
        const invertCtx = ocrCanvas.getContext('2d')!;
        const pixels = invertCtx.getImageData(0, 0, ocrCanvas.width, ocrCanvas.height);
        for (let p = 0; p < pixels.data.length; p += 4) {
          pixels.data[p] = 255 - pixels.data[p]; pixels.data[p + 1] = 255 - pixels.data[p + 1]; pixels.data[p + 2] = 255 - pixels.data[p + 2];
        }
        invertCtx.putImageData(pixels, 0, 0);
      }
      const { data } = await worker.recognize(ocrCanvas);
      const jaText = data.text.trim();
      if (!jaText) continue;

      results.push({
        id: `bubble_${i + 1}`,
        box_2d: bubble.box_2d,
        type: 'speech_bubble',
        reading_order: i + 1,
        ja_text: jaText,
        en_text: translateWithDictionary(jaText),
        notes: '[Local OCR — dictionary translation]',
        bubble_color: bubble.color,
        text_align: 'center',
      });
    } catch (e) {
      console.warn(`[BrowserOCR] Failed to OCR bubble ${i + 1}:`, e);
    }
  }

  onProgress?.('Translation complete!', 100);
  return results;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Terminate the Tesseract worker — call on app unmount if needed */
export async function terminateOcrWorker() {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    _workerReady = false;
  }
}
