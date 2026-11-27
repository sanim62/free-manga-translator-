import { TextBlock, TranslationSettings } from '../types';

/**
 * Renders translated text overlays onto an HTML5 Canvas over the original manga page image.
 */
export async function renderTranslatedPage(
  imageSrc: string,
  textBlocks: TextBlock[],
  settings: TranslationSettings
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to get 2d context'));
      }

      // 1. Draw original image
      ctx.drawImage(img, 0, 0);

      // 2. Render each text block
      textBlocks.forEach((block) => {
        renderSingleBlock(ctx, block, img.width, img.height, settings);
      });

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
}

/**
 * Renders a side-by-side comparison image (Original vs Translated)
 */
export async function renderSideBySidePage(
  originalSrc: string,
  translatedSrc: string,
  pageNumber: number,
  filename: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const imgOrig = new Image();
    const imgTrans = new Image();
    imgOrig.crossOrigin = 'anonymous';
    imgTrans.crossOrigin = 'anonymous';

    let loadedCount = 0;
    const onLoaded = () => {
      loadedCount++;
      if (loadedCount < 2) return;

      const gap = 30;
      const headerHeight = 60;
      const w = Math.max(imgOrig.width, imgTrans.width);
      const h = Math.max(imgOrig.height, imgTrans.height);

      const canvas = document.createElement('canvas');
      canvas.width = w * 2 + gap + 40;
      canvas.height = h + headerHeight + 40;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No context'));

      // Background
      ctx.fillStyle = '#111827'; // Dark theme gray-900
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header Bar
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, 0, canvas.width, headerHeight);

      ctx.fillStyle = '#f3f4f6';
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`PAGE ${pageNumber} — ${filename}`, 20, headerHeight / 2);

      // Sub-titles
      ctx.font = '600 16px "Segoe UI", sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('ORIGINAL (JAPANESE)', 20 + 10, headerHeight - 12);
      ctx.fillText('TRANSLATED (ENGLISH)', 20 + w + gap + 10, headerHeight - 12);

      // Draw Left Image (Original)
      const xLeft = 20;
      const yTop = headerHeight + 20;
      ctx.drawImage(imgOrig, xLeft, yTop, w, h);

      // Draw Right Image (Translated)
      const xRight = 20 + w + gap;
      ctx.drawImage(imgTrans, xRight, yTop, w, h);

      // Divider line
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(20 + w + gap / 2, headerHeight + 10);
      ctx.lineTo(20 + w + gap / 2, canvas.height - 10);
      ctx.stroke();

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };

    imgOrig.onload = onLoaded;
    imgTrans.onload = onLoaded;
    imgOrig.onerror = reject;
    imgTrans.onerror = reject;

    imgOrig.src = originalSrc;
    imgTrans.src = translatedSrc;
  });
}

function renderSingleBlock(
  ctx: CanvasRenderingContext2D,
  block: TextBlock,
  imgWidth: number,
  imgHeight: number,
  settings: TranslationSettings
) {
  const [ymin, xmin, ymax, xmax] = block.box_2d;

  // Convert normalized 0-1000 coords
  const x = (xmin / 1000) * imgWidth;
  const y = (ymin / 1000) * imgHeight;
  const w = Math.max(((xmax - xmin) / 1000) * imgWidth, 20);
  const h = Math.max(((ymax - ymin) / 1000) * imgHeight, 20);

  const text = block.en_text ? block.en_text.trim() : '';

  // 1. Erase / Fill background inside speech bubble
  if (settings.bgEraseStyle !== 'none') {
    ctx.save();
    let fillColor = '#ffffff';
    if (block.bubble_color === 'black') fillColor = '#000000';
    if (block.bubble_color === 'transparent') fillColor = 'transparent';

    if (fillColor !== 'transparent') {
      ctx.fillStyle = fillColor;

      if (block.type === 'speech_bubble' || block.type === 'thought_bubble') {
        // Fill the detected bubble interior contour instead of approximating
        // every bubble with an ellipse that can spill onto nearby artwork.
        traceBubblePath(ctx, block, imgWidth, imgHeight, x, y, w, h);
        ctx.fill();
      } else {
        // Rounded rect for narration / caption / sfx
        const cornerRadius = Math.min(w, h, 8);
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h - 4, cornerRadius);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Even when no dictionary entry exists, erase the source lettering inside
  // the detected balloon so untranslated Japanese is never presented as English.
  if (!text) return;

  // 2. Typeset text
  ctx.save();
  if (hasBubblePolygon(block)) {
    traceBubblePath(ctx, block, imgWidth, imgHeight, x, y, w, h);
    ctx.clip();
  }

  // Font family resolution
  const familyKey = block.customFontFamily || settings.defaultFontFamily;
  let fontCSS = 'sans-serif';
  if (familyKey === 'wildwords' || familyKey === 'comic') {
    fontCSS = '"Comic Sans MS", "Bangers", "Impact", sans-serif';
  } else if (familyKey === 'serif') {
    fontCSS = 'Georgia, "Times New Roman", serif';
  } else if (familyKey === 'monospaced') {
    fontCSS = '"Courier New", monospace';
  } else {
    fontCSS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  }

  const textColor = block.customFontColor || (block.bubble_color === 'black' ? '#ffffff' : settings.fontColor);
  const modifier = (block.fontSizeModifier || 1.0) * settings.fontSizeScale;

  // Auto-fit font size calculation
  let fontSize = Math.min(Math.max(h * 0.22 * modifier, 10), 72);
  const paddingX = Math.min(w * 0.12, 20);
  const paddingY = Math.min(h * 0.12, 20);
  const maxTextWidth = Math.max(w - paddingX * 2, 20);
  const maxTextHeight = Math.max(h - paddingY * 2, 20);

  ctx.font = `700 ${fontSize}px ${fontCSS}`;

  // Word wrap calculation
  let lines = wrapText(ctx, text, maxTextWidth);
  let totalHeight = lines.length * fontSize * 1.15;

  // Reduce font size if line height exceeds box height
  let attempts = 0;
  while (totalHeight > maxTextHeight && fontSize > 8 && attempts < 12) {
    fontSize -= 1.5;
    ctx.font = `700 ${fontSize}px ${fontCSS}`;
    lines = wrapText(ctx, text, maxTextWidth);
    totalHeight = lines.length * fontSize * 1.15;
    attempts++;
  }

  // Keep every glyph inside its bubble. Long unbroken strings are split by
  // wrapText; if there are still too many lines, shorten the last visible line.
  const lineStep = fontSize * 1.15;
  const visibleLineCount = Math.max(1, Math.floor(maxTextHeight / lineStep));
  if (lines.length > visibleLineCount) {
    lines = lines.slice(0, visibleLineCount);
    lines[lines.length - 1] = fitWithEllipsis(ctx, lines[lines.length - 1], maxTextWidth);
  }

  // Draw lines
  ctx.fillStyle = textColor;
  ctx.textAlign = block.text_align === 'left' ? 'left' : block.text_align === 'right' ? 'right' : 'center';
  ctx.textBaseline = 'middle';

  const startY = y + h / 2 - (lines.length - 1) * (lineStep / 2);

  lines.forEach((line, idx) => {
    const lineY = startY + idx * lineStep;
    let lineX = x + w / 2;
    if (block.text_align === 'left') lineX = x + paddingX;
    if (block.text_align === 'right') lineX = x + w - paddingX;

    // Optional stroke outline for readability
    if (settings.enableStroke || block.bubble_color === 'transparent') {
      ctx.strokeStyle = block.bubble_color === 'black' ? '#000000' : settings.strokeColor;
      ctx.lineWidth = Math.max(fontSize * 0.15, 2);
      ctx.strokeText(line, lineX, lineY, maxTextWidth);
    }

    ctx.fillText(line, lineX, lineY, maxTextWidth);
  });

  ctx.restore();
}

function hasBubblePolygon(block: TextBlock): boolean {
  return Array.isArray(block.bubble_polygon) && block.bubble_polygon.length >= 3;
}

function traceBubblePath(
  ctx: CanvasRenderingContext2D,
  block: TextBlock,
  imgWidth: number,
  imgHeight: number,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (!hasBubblePolygon(block)) {
    const insetX = Math.min(w * 0.08, 12);
    const insetY = Math.min(h * 0.08, 12);
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.max((w - insetX * 2) / 2, 5), Math.max((h - insetY * 2) / 2, 5), 0, 0, 2 * Math.PI);
    return;
  }

  const points = block.bubble_polygon!;
  ctx.beginPath();
  ctx.moveTo((points[0][0] / 1000) * imgWidth, (points[0][1] / 1000) * imgHeight);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo((points[i][0] / 1000) * imgWidth, (points[i][1] / 1000) * imgHeight);
  }
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (ctx.measureText(word).width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      // Break a single oversized word by Unicode code point so it cannot spill
      // beyond the bubble even when it contains no spaces.
      let fragment = '';
      for (const char of Array.from(word)) {
        if (fragment && ctx.measureText(fragment + char).width > maxWidth) {
          lines.push(fragment);
          fragment = char;
        } else fragment += char;
      }
      currentLine = fragment;
    } else if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : [text];
}

function fitWithEllipsis(ctx: CanvasRenderingContext2D, line: string, maxWidth: number): string {
  const suffix = '…';
  let chars = Array.from(line);
  while (chars.length && ctx.measureText(chars.join('') + suffix).width > maxWidth) chars.pop();
  return chars.join('') + suffix;
}
