import express from 'express';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { runLocalPipeline } from './src/lib/localPipeline';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean)
);

// High limit for base64 manga page uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Allow a separately hosted static frontend (for example Netlify) to call this
// OCR server. Leave the list empty for same-origin deployments.
app.use('/api', (req, res, next) => {
  const origin = req.get('Origin');
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    return origin && allowedOrigins.has(origin) ? res.sendStatus(204) : res.sendStatus(403);
  }
  next();
});

console.log('[STARTUP] Manga Translator — Local OCR mode (no API key required).');
console.log('[STARTUP] Make sure Python dependencies are installed: pip install -r requirements.txt');

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'manga-ocr', translation: 'local-dictionary' });
});

// Translation endpoint — always uses local OCR pipeline
app.post('/api/translate-page', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    const textBlocks = await runLocalPipeline(imageBase64);
    const translatedCount = textBlocks.filter((block) => block.translation_complete && block.en_text.trim()).length;

    return res.json({
      pageSummary: `[MangaOCR — ${textBlocks.length} bubble(s): ${translatedCount} fully translated; ${textBlocks.length - translatedCount} need dictionary coverage]`,
      textBlocks,
    });
  } catch (err: any) {
    console.error('[Server] Local OCR pipeline error:', err.message);
    return res.status(500).json({
      error: `Local OCR failed: ${err.message}. Make sure Python and manga-ocr are installed (pip install -r requirements.txt).`,
    });
  }
});


// Vite Integration for dev vs static build in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
