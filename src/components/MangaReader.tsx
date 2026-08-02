import React, { useState, useEffect } from 'react';
import { MangaPage, TranslationSettings } from '../types';
import {
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Sliders,
  Eye,
  RotateCw
} from 'lucide-react';

interface MangaReaderProps {
  pages: MangaPage[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  settings: TranslationSettings;
}

export const MangaReader: React.FC<MangaReaderProps> = ({
  pages,
  activePageIndex,
  onSelectPage,
  settings,
}) => {
  const [readingDirection, setReadingDirection] = useState<'rtl' | 'ltr'>(
    settings.readingDirection || 'rtl'
  );
  const [viewOriginal, setViewOriginal] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const currentPage = pages[activePageIndex];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (readingDirection === 'rtl') {
          handlePrev();
        } else {
          handleNext();
        }
      } else if (e.key === 'ArrowLeft') {
        if (readingDirection === 'rtl') {
          handleNext();
        } else {
          handlePrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePageIndex, readingDirection, pages.length]);

  const handleNext = () => {
    if (activePageIndex < pages.length - 1) {
      onSelectPage(activePageIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activePageIndex > 0) {
      onSelectPage(activePageIndex - 1);
    }
  };

  if (!currentPage) return null;

  return (
    <div
      className={`space-y-4 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-[#0A0A0B] p-4 flex flex-col justify-between overflow-hidden'
          : ''
      }`}
    >
      {/* Reader Toolbar */}
      <div className="bg-[#141417] border border-white/5 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2 uppercase tracking-wide">
              <span>Manga Reader Mode</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {readingDirection.toUpperCase()} Direction
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Page {activePageIndex + 1} of {pages.length} — Use Arrow Keys to Turn Pages
            </p>
          </div>
        </div>

        {/* Reader Settings & Controls */}
        <div className="flex items-center space-x-3">
          
          {/* RTL / LTR Toggle */}
          <button
            onClick={() => setReadingDirection(readingDirection === 'rtl' ? 'ltr' : 'rtl')}
            className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-white/10 text-slate-300 font-mono text-xs font-semibold border border-white/10 transition-all"
            title="Toggle Reading Direction (RTL for Manga)"
          >
            Mode: {readingDirection === 'rtl' ? 'RTL (Japanese)' : 'LTR (Western)'}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg bg-black/40 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all"
            title="Toggle Fullscreen Reader"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Manga Page Viewport */}
      <div className="bg-[#141417] border border-white/5 rounded-xl p-4 flex-1 flex items-center justify-center relative shadow-2xl min-h-[650px] overflow-auto">
        
        {/* Next / Prev Floating Navigation Overlay Buttons */}
        <button
          onClick={readingDirection === 'rtl' ? handleNext : handlePrev}
          disabled={readingDirection === 'rtl' ? activePageIndex === pages.length - 1 : activePageIndex === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/80 hover:bg-indigo-600 text-white border border-white/20 disabled:opacity-20 shadow-2xl transition-all z-20 backdrop-blur"
          title="Previous Page (RTL Right-to-Left)"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <button
          onClick={readingDirection === 'rtl' ? handlePrev : handleNext}
          disabled={readingDirection === 'rtl' ? activePageIndex === 0 : activePageIndex === pages.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/80 hover:bg-indigo-600 text-white border border-white/20 disabled:opacity-20 shadow-2xl transition-all z-20 backdrop-blur"
          title="Next Page (RTL Right-to-Left)"
        >
          <ArrowRight className="w-6 h-6" />
        </button>

        {/* Display Translated Manga Image Page */}
        <div className="max-w-4xl mx-auto flex justify-center">
          <img
            src={currentPage.translatedImageUrl || currentPage.originalUrl}
            alt={currentPage.filename}
            className="max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
          />
        </div>
      </div>

      {/* Reader Page Scrubber Carousel */}
      <div className="flex items-center justify-center space-x-2 overflow-x-auto p-2 custom-scrollbar">
        {pages.map((p, idx) => (
          <button
            key={p.id}
            onClick={() => onSelectPage(idx)}
            className={`w-12 h-16 rounded-lg bg-black/50 border overflow-hidden transition-all flex-shrink-0 relative ${
              activePageIndex === idx
                ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                : 'border-white/10 opacity-50 hover:opacity-100'
            }`}
          >
            <img src={p.translatedImageUrl || p.originalUrl} alt={p.filename} className="w-full h-full object-cover" />
            <span className="absolute bottom-0 inset-x-0 bg-black/90 font-mono text-[9px] text-indigo-300 text-center font-bold">
              {idx + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
