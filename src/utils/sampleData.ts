import { MangaPage } from '../types';

/**
 * Creates high-quality synthetic Japanese manga page samples for instant 1-click testing.
 */
export function generateSampleMangaPages(): MangaPage[] {
  // Generate Canvas Page 1
  const page1DataUrl = createSampleCanvasPage(1);
  const page2DataUrl = createSampleCanvasPage(2);

  return [
    {
      id: 'sample_page_001',
      filename: '001.jpg',
      fileSize: 420000,
      sequenceIndex: 1,
      originalUrl: page1DataUrl,
      status: 'idle',
      progress: 0,
      textBlocks: [
        {
          id: 'b1',
          box_2d: [120, 520, 260, 880], // [ymin, xmin, ymax, xmax] 0-1000
          type: 'speech_bubble',
          reading_order: 1,
          ja_text: 'ついに見つけたぞ！伝説の魔導書を！',
          en_text: 'I finally found it! The legendary spellbook!',
          bubble_color: 'white',
          text_align: 'center'
        },
        {
          id: 'b2',
          box_2d: [380, 100, 520, 420],
          type: 'thought_bubble',
          reading_order: 2,
          ja_text: '（本当にこの力を使っていいのだろうか…？）',
          en_text: '(Should I really use this power...?)',
          bubble_color: 'white',
          text_align: 'center'
        },
        {
          id: 'b3',
          box_2d: [680, 480, 850, 920],
          type: 'speech_bubble',
          reading_order: 3,
          ja_text: 'さあ、冒険の始まりだ！準備はいいか？',
          en_text: 'Now, the adventure begins! Are you ready?',
          bubble_color: 'white',
          text_align: 'center'
        },
        {
          id: 'b4',
          box_2d: [50, 50, 120, 350],
          type: 'narration',
          reading_order: 0,
          ja_text: '第１章：運命の扉',
          en_text: 'Chapter 1: Door of Destiny',
          bubble_color: 'black',
          text_align: 'left'
        }
      ]
    },
    {
      id: 'sample_page_002',
      filename: '002.jpg',
      fileSize: 450000,
      sequenceIndex: 2,
      originalUrl: page2DataUrl,
      status: 'idle',
      progress: 0,
      textBlocks: [
        {
          id: 'p2_b1',
          box_2d: [150, 120, 290, 480],
          type: 'speech_bubble',
          reading_order: 1,
          ja_text: '待ってください！一人で行くのは危険です！',
          en_text: 'Please wait! Going alone is dangerous!',
          bubble_color: 'white',
          text_align: 'center'
        },
        {
          id: 'p2_b2',
          box_2d: [360, 550, 520, 900],
          type: 'speech_bubble',
          reading_order: 2,
          ja_text: '私を連れて行ってください。役に立ちます！',
          en_text: 'Please take me with you. I will be useful!',
          bubble_color: 'white',
          text_align: 'center'
        },
        {
          id: 'p2_b3',
          box_2d: [700, 180, 880, 750],
          type: 'sfx',
          reading_order: 3,
          ja_text: 'ゴゴゴゴゴ… (地鳴りの音)',
          en_text: 'RUMBLE RUMBLE... (Ground shaking)',
          bubble_color: 'transparent',
          text_align: 'center'
        }
      ]
    }
  ];
}

function createSampleCanvasPage(pageNumber: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1130;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background comic panel tone
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border & Grid Manga panels
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 4;

  if (pageNumber === 1) {
    // Panel 1 - Top
    ctx.strokeRect(30, 30, 740, 320);
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(32, 32, 736, 316);

    // Panel 2 - Mid Left
    ctx.strokeRect(30, 370, 350, 280);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(32, 372, 346, 276);

    // Panel 3 - Mid Right
    ctx.strokeRect(400, 370, 370, 280);

    // Panel 4 - Bottom
    ctx.strokeRect(30, 670, 740, 420);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(32, 672, 736, 416);

    // Speech Bubbles - Japanese Text Rendered
    drawSpeechBubble(ctx, 580, 190, 140, 70, 'white');
    drawJapaneseTextVertical(ctx, 'ついに見つけたぞ！\n伝説の魔導書を！', 580, 190);

    drawSpeechBubble(ctx, 200, 450, 120, 70, 'white');
    drawJapaneseTextVertical(ctx, '（本当にこの力を\n使っていいのか…）', 200, 450);

    drawSpeechBubble(ctx, 560, 760, 160, 80, 'white');
    drawJapaneseTextVertical(ctx, 'さあ、冒険の始まりだ！\n準備はいいか？', 560, 760);

    // Narration Box
    ctx.fillStyle = '#111827';
    ctx.fillRect(50, 50, 240, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('第１章：運命の扉', 170, 75);

  } else {
    // Page 2
    ctx.strokeRect(30, 30, 740, 340);
    ctx.strokeRect(30, 390, 740, 260);
    ctx.strokeRect(30, 670, 740, 420);

    drawSpeechBubble(ctx, 240, 220, 140, 70, 'white');
    drawJapaneseTextVertical(ctx, '待ってください！\n一人で行くのは危険です！', 240, 220);

    drawSpeechBubble(ctx, 580, 520, 140, 70, 'white');
    drawJapaneseTextVertical(ctx, '私を連れて行って！\n役に立ちます！', 580, 520);

    // SFX text
    ctx.fillStyle = '#dc2626';
    ctx.font = '900 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ゴ ゴ ゴ ゴ ゴ', 400, 840);
  }

  // Manga Screentone Effect (Dots)
  ctx.fillStyle = 'rgba(0,0,0,0.03)';
  for (let x = 0; x < canvas.width; x += 8) {
    for (let y = 0; y < canvas.height; y += 8) {
      if ((x + y) % 16 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Page Footer
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`- ${pageNumber} -`, canvas.width / 2, canvas.height - 15);

  return canvas.toDataURL('image/jpeg', 0.9);
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fillColor: string
) {
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawJapaneseTextVertical(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number
) {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 16px "Hiragino Kaku Gothic ProN", "MS Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = text.split('\n');
  const lineGap = 22;
  const startY = cy - ((lines.length - 1) * lineGap) / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, cx, startY + i * lineGap);
  });

  ctx.restore();
}
