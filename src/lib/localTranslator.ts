import dictionaryData from '../data/manga-dictionary.json';
import romajiDictionaryData from '../../manga-dictionary.json';

const dictionary = dictionaryData as Record<string, string>;
const romajiDictionary = romajiDictionaryData as Record<string, string>;
const japaneseTerms = Object.keys(dictionary).sort((a, b) => b.length - a.length);

export interface DictionaryTranslation {
  text: string;
  complete: boolean;
}

/**
 * Splits Japanese text into tokens (kanji/kana runs or single chars)
 * and looks each up in the local manga dictionary.
 * Returns dictionary-backed English text and reports whether every Japanese
 * span was covered. Unknown Japanese is omitted so it cannot masquerade as English.
 *
 * This intentionally uses local dictionary lookups only; it does not call AI.
 */
export function translateWithDictionary(jaText: string): string {
  return translateWithDictionaryDetailed(jaText).text;
}

export function translateWithDictionaryDetailed(jaText: string): DictionaryTranslation {
  if (!jaText || jaText.trim() === '') return { text: '', complete: false };
  // Tesseract often inserts spaces/newlines between glyphs in vertical manga
  // columns. Remove only Japanese-to-Japanese spacing for dictionary lookup.
  const normalizedText = jaText.replace(
    /([\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uff65-\uff9f])\s+(?=[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uff65-\uff9f])/g,
    '$1'
  );
  // Prefer a phrase entry even when OCR inserted ellipses or sentence marks
  // inside it (for example, 「いや．．．でも」).
  const punctuationFreeText = normalizedText.replace(/[．.…、。！？!?\s]/g, '');
  const exactPhrase = dictionary[normalizedText] || dictionary[punctuationFreeText];
  if (exactPhrase) return { text: preferredTranslation(exactPhrase), complete: true };
  // Greedy longest-match segmentation preserves known phrases (e.g. やばい)
  // inside longer Japanese sentences instead of passing an entire kana run through.
  const chunks = normalizedText.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uff65-\uff9f]+|[^\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uff65-\uff9f]+/g) || [];
  let complete = true;
  const text = chunks.map((chunk) => {
    if (!/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uff65-\uff9f]/.test(chunk)) {
      return translateRomaji(chunk);
    }
    const parts: string[] = [];
    for (let i = 0; i < chunk.length;) {
      const match = japaneseTerms.find((term) => (term.length > 1 || chunk.length === 1) && chunk.startsWith(term, i));
      if (match) {
        parts.push(preferredTranslation(dictionary[match]));
        i += match.length;
      } else {
        // Do not put untranslated Japanese back into the English typesetting.
        complete = false;
        i++;
        while (i < chunk.length && !japaneseTerms.some((term) => term.length > 1 && chunk.startsWith(term, i))) i++;
      }
    }
    return parts.join(' ');
  }).join('')
    .replace(/．．．|…{2,}/g, '…')
    .replace(/、/g, ', ')
    .replace(/。/g, '.')
    .replace(/[！]/g, '!')
    .replace(/[？]/g, '?')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,.!?])\s*([,.!?])+/g, '$1')
    .trim();
  return { text, complete };
}

function preferredTranslation(value: string): string {
  // Dictionary values sometimes list alternatives; a manga bubble should show
  // one readable choice rather than every slash-separated synonym.
  return value.split(/\s+\/\s+/, 1)[0].trim();
}

function translateRomaji(text: string): string {
  return text.replace(/[A-Za-zāīūēōĀĪŪĒŌ-]+/g, (word) => {
    const translated = romajiDictionary[word.toLowerCase()];
    return translated ? preferredTranslation(translated) : word;
  });
}
