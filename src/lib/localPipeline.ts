import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { createInterface } from 'readline';
import { existsSync } from 'fs';
import path from 'path';
import { translateWithDictionaryDetailed } from './localTranslator';

export interface TextBlock {
  id: string;
  box_2d: [number, number, number, number];
  type: string;
  reading_order: number;
  ja_text: string;
  en_text: string;
  translation_complete?: boolean;
  notes: string;
  bubble_color: string;
  text_align: string;
}

type PendingRequest = { resolve: (blocks: TextBlock[]) => void; reject: (error: Error) => void };
type OcrProgress = (stage: string, progress: number) => void;

let pythonService: ChildProcessWithoutNullStreams | null = null;
let readyPromise: Promise<void> | null = null;
let readyResolve: (() => void) | null = null;
let readyReject: ((error: Error) => void) | null = null;
let requestCounter = 0;
const pending = new Map<string, PendingRequest>();

process.once('exit', () => {
  pythonService?.kill();
});

/** Start one persistent MangaOCR process and wait until its model is loaded. */
export function initializeLocalPipeline(onProgress?: OcrProgress): Promise<void> {
  if (pythonService && readyPromise) return readyPromise;

  onProgress?.('Starting MangaOCR model…', 5);
  const scriptPath = path.join(process.cwd(), 'python', 'ocr_service.py');
  const venvPython = path.join(process.cwd(), '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
  const pythonCommand = process.env.PYTHON_BIN || (existsSync(venvPython)
    ? venvPython
    : process.platform === 'win32' ? 'python' : 'python3');
  const modelCache = process.env.MANGA_OCR_CACHE || path.join(process.cwd(), '.model-cache');

  pythonService = spawn(pythonCommand, [scriptPath], {
    cwd: process.cwd(),
    env: { ...process.env, MANGA_OCR_CACHE: modelCache, PYTHONIOENCODING: 'utf-8' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  readyPromise = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  const thisService = pythonService;
  const stdout = createInterface({ input: thisService.stdout });
  stdout.on('line', (line) => {
    let message: any;
    try {
      message = JSON.parse(line);
    } catch {
      console.warn('[MangaOCR] Ignoring non-JSON worker output:', line.slice(0, 300));
      return;
    }

    if (message.type === 'ready') {
      readyResolve?.();
      readyResolve = null;
      readyReject = null;
      return;
    }

    const request = pending.get(String(message.id));
    if (!request) return;
    pending.delete(String(message.id));
    if (message.error) {
      request.reject(new Error(message.error));
      return;
    }
    const blocks = (message.textBlocks || []) as TextBlock[];
    request.resolve(blocks.map((block) => {
      const translation = translateWithDictionaryDetailed(block.ja_text);
      return {
        ...block,
        en_text: translation.text,
        translation_complete: translation.complete,
        notes: translation.complete
          ? '[MangaOCR — dictionary translation]'
          : '[MangaOCR — incomplete dictionary coverage; source text suppressed]',
      };
    }));
  });

  thisService.stderr.on('data', (chunk) => {
    const output = chunk.toString().trim();
    if (output) console.error(`[MangaOCR] ${output}`);
  });

  const failService = (error: Error) => {
    readyReject?.(error);
    readyResolve = null;
    readyReject = null;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
    if (pythonService === thisService) {
      pythonService = null;
      readyPromise = null;
    }
  };
  thisService.on('error', (error) => failService(new Error(`Could not start Python OCR service: ${error.message}`)));
  thisService.on('close', (code) => failService(new Error(`MangaOCR service exited unexpectedly (code ${code ?? 'unknown'}).`)));

  onProgress?.('Loading Japanese manga OCR model…', 20);
  return readyPromise;
}

export async function runLocalPipeline(imageBase64: string, onProgress?: OcrProgress): Promise<TextBlock[]> {
  onProgress?.('Loading MangaOCR model (first server startup may take a few minutes)…', 10);
  await initializeLocalPipeline(onProgress);
  if (!pythonService || !readyPromise) throw new Error('MangaOCR service is not available.');
  onProgress?.('Reading Japanese text…', 75);

  const id = `ocr-${Date.now()}-${++requestCounter}`;
  return new Promise<TextBlock[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    pythonService!.stdin.write(`${JSON.stringify({ id, imageBase64 })}\n`, (error) => {
      if (!error) return;
      pending.delete(id);
      reject(new Error(`Could not send image to OCR service: ${error.message}`));
    });
  });
}
