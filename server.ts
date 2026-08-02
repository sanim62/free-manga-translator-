import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const currentDir = process.cwd();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// High limit for base64 manga page uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasApiKey: !!apiKey });
});

// Translation API Endpoint
app.post('/api/translate-page', async (req, res) => {
  try {
    const { imageBase64, filename, settings } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    const customKey = settings?.customApiKey?.trim();
    const effectiveApiKey = customKey || process.env.GEMINI_API_KEY;

    if (!effectiveApiKey) {
      return res.status(500).json({
        error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in your .env file or enter a custom API key in Settings.',
      });
    }

    // Always create a fresh AI instance with the effective key to avoid null reference crashes
    const aiInstance = new GoogleGenAI({
      apiKey: effectiveApiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    // Extract raw base64 data and normalize mime type for Gemini API compatibility
    let mimeType = 'image/jpeg';
    let rawData = imageBase64;
    if (typeof imageBase64 === 'string' && imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      const rawMime = parts[0].replace(/^data:/, '').trim().toLowerCase();
      rawData = parts[1];

      if (rawMime.includes('png')) {
        mimeType = 'image/png';
      } else if (rawMime.includes('webp')) {
        mimeType = 'image/webp';
      } else if (rawMime.includes('gif')) {
        mimeType = 'image/gif';
      } else if (rawMime.includes('heic')) {
        mimeType = 'image/heic';
      } else if (rawMime.includes('heif')) {
        mimeType = 'image/heif';
      } else {
        mimeType = 'image/jpeg';
      }
    }

    const parsedData = await callGeminiTranslation(aiInstance, mimeType, rawData, filename, settings);

    // Ensure IDs on text blocks
    if (parsedData.text_blocks && Array.isArray(parsedData.text_blocks)) {
      parsedData.text_blocks = parsedData.text_blocks.map((blk: any, index: number) => ({
        id: blk.id || `block_${index + 1}`,
        box_2d: blk.box_2d || [100, 100, 300, 300],
        type: blk.type || 'speech_bubble',
        reading_order: blk.reading_order || index + 1,
        ja_text: blk.ja_text || '',
        en_text: blk.en_text || '',
        notes: blk.notes || '',
        bubble_color: blk.bubble_color || 'white',
        text_align: blk.text_align || 'center',
      }));
    }

    return res.json({
      pageSummary: parsedData.page_summary || '',
      textBlocks: parsedData.text_blocks || [],
    });
  } catch (err: any) {
    console.error('Translation error:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred during translation processing.',
    });
  }
});

/**
 * Helper function to call Gemini with model fallbacks and exponential backoff retry.
 * Handles rate limits (429), quota exhaustion, safety blocks, and temporary network glitches.
 */
async function callGeminiTranslation(
  aiInstance: GoogleGenAI,
  mimeType: string,
  rawData: string,
  filename: string,
  settings: any
) {
  const honorificsDirective =
    settings?.honorificsStyle === 'keep'
      ? 'Retain Japanese honorifics like -san, -chan, -sama, -senpai, -kun, -sensei.'
      : 'Localize Japanese honorifics into natural English terms or titles.';

  const sfxDirective = settings?.translateSFX
    ? 'Detect and translate Sound Effects (SFX) with vivid English sound representations (e.g. THUMP, RUMBLE, DASH).'
    : 'Ignore minor SFX if unreadable or focus on dialogue speech bubbles.';

  const systemPrompt = `You are a world-class Japanese Manga Localization Specialist and High-Precision OCR Engine.
Your primary objective is to scan this manga page exhaustively and detect EVERY single Japanese text instance without missing any speech bubble, thought, or sound effect.

DETECTION GUIDELINES:
1. EXHAUSTIVE SCANNING: Scan the entire page panel by panel, from top-right to bottom-left (standard Japanese manga reading order).
2. DETECT ALL TEXT TYPES:
   - Speech bubbles (oval, spiked, jagged, screaming, whispered)
   - Thought bubbles (cloud-shaped, soft)
   - Narration boxes (rectangular captions, chapter titles, location indicators)
   - Vertical floating text (character side commentary, handwritten notes, outside-bubble reactions)
   - Sound Effects (SFX / Onomatopoeia) embedded in panels or art
   - Faint or small background text
3. ACCURATE BOUNDING BOXES: For every detected text element, provide a precise bounding box [ymin, xmin, ymax, xmax] scaled 0 to 1000. Ensure the box fits the entire text block and bubble container.
4. HIGH-QUALITY TRANSLATION:
   - Perform accurate Japanese OCR (ja_text).
   - Provide a natural, contextually fluent, idiomatic English translation (en_text) suited for professional manga typesetting.
   - Match the emotional tone, register, slang, and personality of each character.
   - Avoid literal or robotic machine translation.
5. DIRECTIVES:
   - ${honorificsDirective}
   - ${sfxDirective}

IMPORTANT: You MUST respond ONLY with valid JSON matching the requested schema. Do NOT include any explanation text before or after the JSON.
CRITICAL: DO NOT SKIP ANY SPEECH BUBBLE OR FLOATING TEXT. If a bubble contains text, you MUST include it in the text_blocks array.`;

  const selectedModel = settings?.selectedModel?.trim();
  const baseModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  const modelsToTry = selectedModel && !baseModels.includes(selectedModel)
    ? [selectedModel, ...baseModels]
    : baseModels;
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        console.log(`[Gemini] Attempting model: ${modelName}, attempt: ${attempts + 1}/${maxAttempts}`);

        const response = await aiInstance.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: rawData,
                },
              },
              {
                text: `Analyze this manga page (${filename || 'page.jpg'}) thoroughly. Extract ALL Japanese speech bubbles, thought bubbles, floating side commentary, narration boxes, and sound effects with bounding boxes and natural, idiomatic English translations. Respond ONLY with valid JSON.`,
              },
            ],
          },
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                page_summary: {
                  type: Type.STRING,
                  description: 'A 1-sentence summary of what happens on this manga page.',
                },
                text_blocks: {
                  type: Type.ARRAY,
                  description: 'List of detected text regions on the manga page.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      box_2d: {
                        type: Type.ARRAY,
                        items: { type: Type.INTEGER },
                        description: 'Bounding box [ymin, xmin, ymax, xmax] in 0-1000 scale',
                      },
                      type: {
                        type: Type.STRING,
                        description:
                          'speech_bubble, thought_bubble, narration, sfx, caption, whisper',
                      },
                      reading_order: { type: Type.INTEGER },
                      ja_text: { type: Type.STRING, description: 'Original Japanese text' },
                      en_text: { type: Type.STRING, description: 'Translated English text' },
                      notes: { type: Type.STRING, description: 'Contextual nuance note' },
                      bubble_color: {
                        type: Type.STRING,
                        description: 'white, black, transparent',
                      },
                      text_align: { type: Type.STRING, description: 'center, left, right' },
                    },
                    required: ['box_2d', 'type', 'reading_order', 'ja_text', 'en_text'],
                  },
                },
              },
              required: ['page_summary', 'text_blocks'],
            },
          },
        });

        // --- Safely extract the response text ---
        // Step 1: Check for safety blocks on the response object
        try {
          const candidates = (response as any).candidates;
          if (candidates && candidates.length > 0) {
            const finishReason = candidates[0].finishReason;
            if (finishReason === 'SAFETY' || finishReason === 'BLOCKED' || finishReason === 'OTHER') {
              const safetyRatings = candidates[0].safetyRatings
                ? JSON.stringify(candidates[0].safetyRatings)
                : 'unknown';
              console.warn(`[Gemini] Response blocked. Reason: ${finishReason}, Ratings: ${safetyRatings}`);
              throw new Error(`Image was blocked by Gemini safety filters (reason: ${finishReason}). Try a different image or model.`);
            }
          }
          const promptFeedback = (response as any).promptFeedback;
          if (promptFeedback?.blockReason) {
            console.warn(`[Gemini] Prompt blocked. Reason: ${promptFeedback.blockReason}`);
            throw new Error(`Prompt was blocked by Gemini (reason: ${promptFeedback.blockReason}). Try a different image.`);
          }
        } catch (safetyErr: any) {
          if (safetyErr.message?.includes('blocked') || safetyErr.message?.includes('SAFETY') || safetyErr.message?.includes('safety')) {
            throw safetyErr;
          }
          // If safety check itself errors, log and continue to try reading text
          console.warn('[Gemini] Safety check encountered non-critical error:', safetyErr.message);
        }

        // Step 2: Safely read .text (can throw in some SDK versions)
        let resultText = '';
        try {
          resultText = response.text ?? '';
        } catch (textErr: any) {
          console.error('[Gemini] response.text threw:', textErr.message);
          throw new Error(`Gemini response could not be read: ${textErr.message}`);
        }

        if (!resultText || resultText.trim().length === 0) {
          throw new Error('Gemini returned an empty response. The image may have been blocked or is unprocessable.');
        }

        console.log(`[Gemini] Raw response length: ${resultText.length} chars, first 100: ${resultText.substring(0, 100)}`);

        // Step 3: Extract and parse JSON
        let cleanedText = resultText.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        const jsonStartIndex = cleanedText.indexOf('{');
        const jsonEndIndex = cleanedText.lastIndexOf('}');

        if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
          cleanedText = cleanedText.substring(jsonStartIndex, jsonEndIndex + 1);
        } else {
          throw new Error(`Gemini did not return valid JSON. Response: "${resultText.substring(0, 200)}". The image may have triggered a content filter.`);
        }

        const parsed = JSON.parse(cleanedText);
        console.log(`[Gemini] Successfully parsed JSON with ${parsed.text_blocks?.length || 0} text blocks.`);
        return parsed;

      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        console.warn(`[Gemini] Error with model ${modelName} attempt ${attempts + 1}: ${errMsg}`);

        const isRetryable =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('quota') ||
          errMsg.includes('Overloaded') ||
          errMsg.includes('INTERNAL') ||
          errMsg.includes('empty response');

        if (isRetryable && attempts < maxAttempts - 1) {
          attempts++;
          const delayMs = attempts * 2000;
          console.warn(`[Gemini] Retrying in ${delayMs}ms...`);
          await new Promise((res) => setTimeout(res, delayMs));
        } else {
          console.warn(`[Gemini] Model ${modelName} exhausted. Moving to next fallback.`);
          break;
        }
      }
    }
  }

  throw lastError || new Error('Failed to translate manga page after trying all available models.');
}

// Vite Integration for dev vs static build in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
