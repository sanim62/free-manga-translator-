import React, { useState, useEffect, useRef } from 'react';
import {
  MangaPage,
  TextBlock,
  TranslationSettings,
  BubbleColor,
  TextAlign,
  FontFamily
} from '../types';
import { renderTranslatedPage } from '../utils/mangaRenderer';
import {
  Plus,
  Trash2,
  Check,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface InteractiveEditorProps {
  page: MangaPage;
  settings: TranslationSettings;
  onUpdatePage: (updatedPage: MangaPage) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export const InteractiveEditor: React.FC<InteractiveEditorProps> = ({
  page,
  settings,
  onUpdatePage,
  onPrevPage,
  onNextPage,
  hasPrev,
  hasNext,
}) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    page.textBlocks[0]?.id || null
  );
  const [viewMode, setViewMode] = useState<'translated' | 'original' | 'boxes'>(
    'translated'
  );
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isRendering, setIsRendering] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedBlock = page.textBlocks.find((b) => b.id === selectedBlockId);

  // Re-render Canvas when text blocks or settings change
  useEffect(() => {
    let isMounted = true;
    const updateCanvas = async () => {
      if (!page.originalUrl) return;
      setIsRendering(true);
      try {
        const renderedDataUrl = await renderTranslatedPage(
          page.originalUrl,
          page.textBlocks,
          settings
        );
        if (isMounted) {
          onUpdatePage({
            ...page,
            translatedImageUrl: renderedDataUrl,
          });
        }
      } catch (err) {
        console.error('Failed to render translated canvas:', err);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    };

    updateCanvas();
    return () => {
      isMounted = false;
    };
  }, [page.textBlocks, settings, page.originalUrl]);

  // Update a single text block
  const handleUpdateBlock = (updatedBlock: TextBlock) => {
    const updatedBlocks = page.textBlocks.map((b) =>
      b.id === updatedBlock.id ? updatedBlock : b
    );
    onUpdatePage({ ...page, textBlocks: updatedBlocks });
  };

  // Add new speech bubble manually
  const handleAddBlock = () => {
    const newBlock: TextBlock = {
      id: `custom_${Date.now()}`,
      box_2d: [400, 300, 600, 700], // Default center box
      type: 'speech_bubble',
      reading_order: page.textBlocks.length + 1,
      ja_text: '新規テキスト',
      en_text: 'New English Text',
      bubble_color: 'white',
      text_align: 'center',
      fontSizeModifier: 1.0,
    };

    const updatedBlocks = [...page.textBlocks, newBlock];
    onUpdatePage({ ...page, textBlocks: updatedBlocks });
    setSelectedBlockId(newBlock.id);
  };

  // Delete text block
  const handleDeleteBlock = (id: string) => {
    const updatedBlocks = page.textBlocks.filter((b) => b.id !== id);
    onUpdatePage({ ...page, textBlocks: updatedBlocks });
    if (selectedBlockId === id) {
      setSelectedBlockId(updatedBlocks[0]?.id || null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[700px]">
      
      {/* Left Canvas Preview Area (8 cols) */}
      <div className="lg:col-span-7 bg-[#141417] border border-white/5 rounded-xl p-4 flex flex-col justify-between shadow-2xl relative">
        
        {/* Canvas Toolbar Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 text-xs font-semibold">
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onPrevPage}
              disabled={!hasPrev}
              className="p-1.5 rounded-lg bg-black/40 hover:bg-white/10 disabled:opacity-30 text-slate-300 border border-white/10 transition-all"
              title="Previous Page"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300 font-bold">
              {page.filename} (#{page.sequenceIndex})
            </span>
            <button
              onClick={onNextPage}
              disabled={!hasNext}
              className="p-1.5 rounded-lg bg-black/40 hover:bg-white/10 disabled:opacity-30 text-slate-300 border border-white/10 transition-all"
              title="Next Page"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* View Modes */}
          <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setViewMode('translated')}
              className={`px-3 py-1 rounded transition-all ${
                viewMode === 'translated'
                  ? 'bg-indigo-600 text-white shadow border border-indigo-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Typeset
            </button>
            <button
              onClick={() => setViewMode('boxes')}
              className={`px-3 py-1 rounded transition-all ${
                viewMode === 'boxes'
                  ? 'bg-indigo-600 text-white shadow border border-indigo-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Boxes Overlay
            </button>
            <button
              onClick={() => setViewMode('original')}
              className={`px-3 py-1 rounded transition-all ${
                viewMode === 'original'
                  ? 'bg-indigo-600 text-white shadow border border-indigo-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Original (JP)
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-black/40 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setZoomLevel((z) => Math.max(z - 0.2, 0.6))}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] w-12 text-center text-slate-300">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(z + 0.2, 2.5))}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1.0)}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas Display Viewport */}
        <div
          ref={containerRef}
          className="flex-1 min-h-[500px] max-h-[750px] overflow-auto flex items-center justify-center p-4 bg-black/60 rounded-xl relative custom-scrollbar border border-white/5"
        >
          <div
            className="relative transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
          >
            {/* Base Image */}
            <img
              src={
                viewMode === 'original'
                  ? page.originalUrl
                  : page.translatedImageUrl || page.originalUrl
              }
              alt="Manga Page Canvas"
              className="max-w-full rounded-lg shadow-2xl border border-white/10 select-none"
            />

            {/* Interactive Bounding Box Overlays */}
            {viewMode === 'boxes' &&
              page.textBlocks.map((block) => {
                const [ymin, xmin, ymax, xmax] = block.box_2d;
                const top = `${ymin / 10}%`;
                const left = `${xmin / 10}%`;
                const width = `${(xmax - xmin) / 10}%`;
                const height = `${(ymax - ymin) / 10}%`;
                const isSelected = selectedBlockId === block.id;

                return (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    style={{ top, left, width, height }}
                    className={`absolute cursor-pointer rounded border-2 transition-all flex items-start justify-start p-1 backdrop-blur-[1px] ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/25 ring-4 ring-indigo-500/30 z-20'
                        : 'border-amber-400/80 bg-amber-400/10 hover:bg-amber-400/20 z-10'
                    }`}
                  >
                    <span className="bg-black/90 text-white font-mono font-bold text-[10px] px-1 rounded shadow border border-white/20">
                      #{block.reading_order}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Footer Summary */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>
            {page.textBlocks.length} Speech Bubbles Detected
          </span>
          {isRendering && (
            <span className="text-indigo-400 font-semibold animate-pulse flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Rendering Typeset...</span>
            </span>
          )}
        </div>
      </div>

      {/* Right Speech Bubble Editor Side Panel (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Speech Bubble List Header */}
        <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center space-x-2 uppercase tracking-wide">
              <Type className="w-4 h-4 text-indigo-400" />
              <span>Typesetting & Text Editor</span>
            </h3>

            <button
              onClick={handleAddBlock}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow flex items-center space-x-1 transition-all border border-indigo-400/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Bubble</span>
            </button>
          </div>

          {/* Quick Speech Bubbles Selector Pills */}
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
            {page.textBlocks.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBlockId(b.id)}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold border transition-all flex items-center space-x-1.5 ${
                  selectedBlockId === b.id
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-950/40'
                    : 'bg-black/40 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <span>#{b.reading_order}</span>
                <span className="max-w-[100px] truncate">{b.en_text || b.ja_text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Bubble Editor Form */}
        {selectedBlock ? (
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                  Bubble #{selectedBlock.reading_order}
                </span>
                <span className="text-xs text-slate-400 capitalize font-medium">
                  {selectedBlock.type.replace('_', ' ')}
                </span>
              </div>

              <button
                onClick={() => handleDeleteBlock(selectedBlock.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all"
                title="Delete Speech Bubble"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* English Translation Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-indigo-400 flex items-center justify-between">
                <span>English Translation (Typeset)</span>
                <span className="text-[10px] text-slate-500 font-normal">Real-time update</span>
              </label>
              <textarea
                value={selectedBlock.en_text}
                onChange={(e) =>
                  handleUpdateBlock({ ...selectedBlock, en_text: e.target.value })
                }
                rows={3}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
                placeholder="Type English translated text..."
              />
            </div>

            {/* Japanese Original OCR Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Original Japanese OCR
              </label>
              <input
                type="text"
                value={selectedBlock.ja_text}
                onChange={(e) =>
                  handleUpdateBlock({ ...selectedBlock, ja_text: e.target.value })
                }
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 font-jp focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Formatting & Typesetting Controls */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              
              {/* Bubble Background Fill Color */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Bubble Fill Mask
                </label>
                <select
                  value={selectedBlock.bubble_color}
                  onChange={(e) =>
                    handleUpdateBlock({
                      ...selectedBlock,
                      bubble_color: e.target.value as BubbleColor,
                    })
                  }
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="white">White Bubble</option>
                  <option value="black">Black Bubble</option>
                  <option value="transparent">Transparent / SFX</option>
                </select>
              </div>

              {/* Text Alignment */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Text Alignment
                </label>
                <div className="flex items-center space-x-1 bg-black/50 p-1 rounded-lg border border-white/10">
                  <button
                    onClick={() => handleUpdateBlock({ ...selectedBlock, text_align: 'left' })}
                    className={`flex-1 py-1 rounded flex justify-center text-xs ${
                      selectedBlock.text_align === 'left' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleUpdateBlock({ ...selectedBlock, text_align: 'center' })}
                    className={`flex-1 py-1 rounded flex justify-center text-xs ${
                      selectedBlock.text_align === 'center' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleUpdateBlock({ ...selectedBlock, text_align: 'right' })}
                    className={`flex-1 py-1 rounded flex justify-center text-xs ${
                      selectedBlock.text_align === 'right' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Font Size Modifier */}
              <div className="space-y-1 col-span-2">
                <div className="flex justify-between text-[11px] font-medium text-slate-400">
                  <span>Relative Font Size</span>
                  <span className="font-mono text-indigo-400">
                    {((selectedBlock.fontSizeModifier || 1.0) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={selectedBlock.fontSizeModifier || 1.0}
                  onChange={(e) =>
                    handleUpdateBlock({
                      ...selectedBlock,
                      fontSizeModifier: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-indigo-500 bg-black/50"
                />
              </div>

            </div>

            {/* Nuance Note */}
            {selectedBlock.notes && (
              <div className="p-3 rounded-lg bg-black/50 border border-white/10 text-xs text-amber-300/90 space-y-1">
                <span className="font-bold text-[10px] uppercase tracking-wider text-amber-400">
                  Translation Nuance Note:
                </span>
                <p>{selectedBlock.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#141417] border border-white/5 rounded-xl p-8 text-center text-slate-500">
            <p className="text-sm">No speech bubble selected.</p>
            <p className="text-xs mt-1">Click a bubble pill or bounding box on the page preview to edit.</p>
          </div>
        )}

      </div>

    </div>
  );
};
