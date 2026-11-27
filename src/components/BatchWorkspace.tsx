import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Edit3,
  Columns,
  Eye,
  Zap,
  Sparkles,
  Layers,
  ArrowRight,
  Download
} from 'lucide-react';
import { MangaPage } from '../types';
import { downloadDataUrl, safeFileStem } from '../utils/downloads';
import { isFullyTranslatedBlock } from '../utils/translationStatus';

interface BatchWorkspaceProps {
  pages: MangaPage[];
  isProcessing: boolean;
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onStartProcessing: () => void;
  onRetryPage: (index: number) => void;
  onOpenEditor: (index: number) => void;
  logMessages: string[];
}

export const BatchWorkspace: React.FC<BatchWorkspaceProps> = ({
  pages,
  isProcessing,
  activePageIndex,
  onSelectPage,
  onStartProcessing,
  onRetryPage,
  onOpenEditor,
  logMessages,
}) => {
  const completedCount = pages.filter((p) => p.status === 'done').length;
  const errorCount = pages.filter((p) => p.status === 'error').length;
  const totalCount = pages.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalBlocks = pages.reduce((acc, p) => acc + (p.textBlocks?.length || 0), 0);
  const fullyTranslatedBlocks = pages.reduce((acc, page) => acc + (page.textBlocks || []).filter(isFullyTranslatedBlock).length, 0);

  return (
    <div className="space-y-6">
      {/* Progress & Quick Stats Banner */}
      <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Zap className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Batch Translation Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Natural sequence ({totalCount} total pages) • Speech bubble OCR & English typesetting
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <span className="text-2xl font-mono font-bold text-indigo-400">
                {progressPercentage}%
              </span>
              <p className="text-[10px] text-slate-500 font-mono uppercase">
                {completedCount}/{totalCount} Pages Done
              </p>
            </div>

            <button
              onClick={onStartProcessing}
              disabled={isProcessing || totalCount === 0}
              className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center space-x-2 ${
                isProcessing
                  ? 'bg-black/40 text-slate-500 cursor-not-allowed border border-white/5'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/30 border border-indigo-400/30'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Processing Chapter...' : 'START BATCH TRANSLATION'}</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-black rounded-full h-3 p-0.5 border border-white/5 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Progress: {completedCount} / {totalCount} pages</span>
            <span>Fully translated: {fullyTranslatedBlocks} / {totalBlocks} bubbles</span>
          </div>
        </div>

        {/* Live Logs Terminal */}
        {logMessages.length > 0 && (
          <div className="bg-black/50 border border-white/5 rounded-lg p-2.5 font-mono text-[10px] max-h-28 overflow-y-auto custom-scrollbar text-slate-400 space-y-1">
            {logMessages.slice(-5).map((log, idx) => (
              <div key={idx} className="flex items-start space-x-2">
                <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                <span className={log.includes('Error') ? 'text-red-400' : 'text-slate-300'}>{log}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pages Grid Gallery */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {pages.map((page, index) => {
          const isSelected = activePageIndex === index;
          const translatedOnPage = page.textBlocks.filter(isFullyTranslatedBlock).length;
          const allTranslated = page.textBlocks.length > 0 && translatedOnPage === page.textBlocks.length;

          return (
            <div
              key={page.id}
              onClick={() => onSelectPage(index)}
              className={`group bg-[#141417] border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer shadow-lg flex flex-col justify-between ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-indigo-950/40'
                  : 'border-white/5 hover:border-white/20'
              }`}
            >
              {/* Image Preview Area */}
              <div className="relative aspect-[3/4] bg-black/60 overflow-hidden">
                <img
                  src={page.translatedImageUrl || page.originalUrl}
                  alt={page.filename}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Top Badge Overlay */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur font-mono text-[11px] font-bold text-indigo-400 border border-indigo-500/30">
                    #{String(index + 1).padStart(3, '0')}
                  </span>

                  {/* Status Indicator */}
                  {page.status === 'processing' && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold flex items-center space-x-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>OCR...</span>
                    </span>
                  )}
                  {page.status === 'done' && (
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold flex items-center space-x-1 ${
                      allTranslated
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {allTranslated ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      <span>{translatedOnPage}/{page.textBlocks.length} translated</span>
                    </span>
                  )}
                  {page.status === 'error' && (
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-semibold flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Failed</span>
                    </span>
                  )}
                  {page.status === 'idle' && (
                    <span className="px-2 py-0.5 rounded bg-black/80 text-slate-400 border border-white/10 text-[10px] font-mono">
                      Queued
                    </span>
                  )}
                </div>

                {/* Page Summary Tooltip / Overlay on Hover */}
                {page.pageSummary && (
                  <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black via-black/90 to-transparent text-[10px] text-slate-300 line-clamp-2 font-mono">
                    {page.pageSummary}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 bg-[#0F0F11] border-t border-white/5 flex items-center justify-between">
                <div className="truncate pr-2">
                  <p className="text-xs font-bold text-slate-200 truncate" title={page.filename}>
                    {page.filename}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {(page.fileSize / 1024).toFixed(0)} KB
                  </p>
                </div>

                <div className="flex items-center space-x-1">
                  {page.status === 'error' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetryPage(index);
                      }}
                      className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all"
                      title="Retry translation"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {page.status === 'done' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!page.translatedImageUrl) return;
                          const sequence = String(page.sequenceIndex || index + 1).padStart(3, '0');
                          downloadDataUrl(page.translatedImageUrl, `translated_${sequence}_${safeFileStem(page.filename)}.jpg`);
                        }}
                        disabled={!page.translatedImageUrl}
                        className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all disabled:opacity-40"
                        title="Download translated image"
                        aria-label={`Download translated image for ${page.filename}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditor(index);
                        }}
                        className="p-1.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition-all flex items-center space-x-1"
                        title="Interactive Text & Typesetting Editor"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-semibold">Edit</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
