import React, { useState, useEffect } from 'react';
import { MangaPage } from '../types';
import { renderSideBySidePage } from '../utils/mangaRenderer';
import { Download, ArrowLeft, ArrowRight, RefreshCw, Columns, Sparkles } from 'lucide-react';

interface SideBySideViewProps {
  pages: MangaPage[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
}

export const SideBySideView: React.FC<SideBySideViewProps> = ({
  pages,
  activePageIndex,
  onSelectPage,
}) => {
  const currentPage = pages[activePageIndex];
  const [sideBySideUrl, setSideBySideUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!currentPage || !currentPage.originalUrl) return;

    const generate = async () => {
      setIsGenerating(true);
      try {
        const transUrl = currentPage.translatedImageUrl || currentPage.originalUrl;
        const result = await renderSideBySidePage(
          currentPage.originalUrl,
          transUrl,
          currentPage.sequenceIndex,
          currentPage.filename
        );
        if (isMounted) {
          setSideBySideUrl(result);
        }
      } catch (err) {
        console.error('Failed to render side-by-side view:', err);
      } finally {
        if (isMounted) setIsGenerating(false);
      }
    };

    generate();
    return () => {
      isMounted = false;
    };
  }, [currentPage]);

  if (!currentPage) return null;

  const handleDownload = () => {
    if (!sideBySideUrl) return;
    const a = document.createElement('a');
    a.href = sideBySideUrl;
    a.download = `side_by_side_${currentPage.filename}`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center space-x-2">
            <Columns className="w-4 h-4 text-indigo-400" />
            <span>Side-by-Side Comparison Output</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Compare original Japanese raw manga page with translated English typeset page side-by-side
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-black/40 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => onSelectPage(Math.max(activePageIndex - 1, 0))}
              disabled={activePageIndex === 0}
              className="p-1.5 rounded-md bg-black/40 hover:bg-white/10 disabled:opacity-30 text-slate-300 transition-all border border-white/5"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs text-slate-300 font-bold px-2">
              Page {activePageIndex + 1} / {pages.length}
            </span>
            <button
              onClick={() => onSelectPage(Math.min(activePageIndex + 1, pages.length - 1))}
              disabled={activePageIndex === pages.length - 1}
              className="p-1.5 rounded-md bg-black/40 hover:bg-white/10 disabled:opacity-30 text-slate-300 transition-all border border-white/5"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleDownload}
            disabled={!sideBySideUrl || isGenerating}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-900/30 transition-all flex items-center space-x-1.5 border border-indigo-400/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Side-by-Side Image</span>
          </button>
        </div>
      </div>

      {/* Main Composite Image Display */}
      <div className="bg-[#141417] border border-white/5 rounded-xl p-4 min-h-[600px] flex items-center justify-center relative shadow-2xl">
        {isGenerating ? (
          <div className="text-center text-indigo-400 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto" />
            <p className="text-xs font-semibold uppercase tracking-wider">Generating Side-by-Side Comparison...</p>
          </div>
        ) : sideBySideUrl ? (
          <div className="w-full flex justify-center overflow-auto max-h-[800px] custom-scrollbar">
            <img
              src={sideBySideUrl}
              alt="Side-by-Side Comparison"
              className="max-w-full rounded-lg border border-white/10 shadow-2xl"
            />
          </div>
        ) : (
          <p className="text-slate-500 text-xs">Select a page to preview side-by-side output.</p>
        )}
      </div>

      {/* Pages Carousel Bar */}
      <div className="flex space-x-3 overflow-x-auto pb-2 custom-scrollbar">
        {pages.map((p, idx) => (
          <button
            key={p.id}
            onClick={() => onSelectPage(idx)}
            className={`flex-shrink-0 w-20 aspect-[3/4] bg-black/50 border rounded-lg overflow-hidden transition-all relative ${
              activePageIndex === idx
                ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                : 'border-white/10 opacity-60 hover:opacity-100'
            }`}
          >
            <img src={p.translatedImageUrl || p.originalUrl} alt={p.filename} className="w-full h-full object-cover" />
            <span className="absolute bottom-1 right-1 px-1 rounded bg-black/90 font-mono text-[9px] text-indigo-400 font-bold border border-indigo-500/30">
              #{idx + 1}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
