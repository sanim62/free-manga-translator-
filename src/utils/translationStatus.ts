import type { TextBlock } from '../types';

const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u9fff\uff65-\uff9f]/;

export function isFullyTranslatedBlock(block: TextBlock): boolean {
  const text = block.en_text?.trim() || '';
  if (!text || block.translation_complete === false || JAPANESE_TEXT.test(text)) return false;
  return true;
}
