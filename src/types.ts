export type TextBlockType = 
  | 'speech_bubble'
  | 'thought_bubble'
  | 'narration'
  | 'sfx'
  | 'caption'
  | 'whisper';

export type BubbleColor = 'white' | 'black' | 'transparent' | 'auto';
export type TextAlign = 'center' | 'left' | 'right';
export type FontFamily = 'wildwords' | 'sans' | 'serif' | 'comic' | 'monospaced';

export interface TextBlock {
  id: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  type: TextBlockType;
  reading_order: number;
  ja_text: string;
  en_text: string;
  notes?: string;
  bubble_color: BubbleColor;
  text_align: TextAlign;
  fontSizeModifier?: number; // relative scaling 0.5 - 2.0
  customFontFamily?: FontFamily;
  customFontColor?: string;
}

export type PageStatus = 'idle' | 'processing' | 'done' | 'error';

export interface MangaPage {
  id: string;
  filename: string;
  fileSize: number;
  sequenceIndex: number;
  originalUrl: string;
  status: PageStatus;
  progress: number;
  errorMessage?: string;
  pageSummary?: string;
  textBlocks: TextBlock[];
  width?: number;
  height?: number;
  translatedImageUrl?: string;
  sideBySideImageUrl?: string;
  processedAt?: string;
}

export interface TranslationSettings {
  honorificsStyle: 'keep' | 'localize'; // keep (-san, -chan) vs localize (Mr., etc.)
  translateSFX: boolean;
  adultTone: boolean;
  customGlossary: Record<string, string>;
  defaultFontFamily: FontFamily;
  fontSizeScale: number; // 1.0 default
  fontColor: string; // '#000000'
  strokeColor: string; // '#ffffff'
  enableStroke: boolean;
  bgEraseStyle: 'smooth_fill' | 'rect_fill' | 'none';
  readingDirection: 'rtl' | 'ltr';
  customApiKey?: string;
  selectedModel?: string;
}

export interface MasterIndexData {
  title: string;
  total_pages: number;
  translated_count: number;
  created_at: string;
  settings: TranslationSettings;
  pages: {
    page_number: number;
    filename: string;
    original_file: string;
    translated_file: string;
    side_by_side_file: string;
    text_data_file: string;
    text_count: number;
    summary?: string;
  }[];
}
