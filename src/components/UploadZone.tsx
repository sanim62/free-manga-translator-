import React, { useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles, FolderPlus, ArrowRight, Trash2 } from 'lucide-react';
import { MangaPage } from '../types';

interface UploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  onLoadSamples: () => void;
  pages: MangaPage[];
  onClearPages: () => void;
  onStartProcessing: () => void;
  isProcessing: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
  onLoadSamples,
  pages,
  onClearPages,
  onStartProcessing,
  isProcessing,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Drop Zone Card */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative group border border-white/5 bg-[#141417] rounded-xl p-6 sm:p-10 text-center transition-all duration-300 shadow-2xl backdrop-blur-sm cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/*, .jpg, .jpeg, .jepg, .webp, .png, .gif, .bmp, .avif, .heic, .heif"
          className="hidden"
        />

        <div className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/[0.02] hover:bg-white/[0.04] p-8 sm:p-10 rounded-lg transition-all duration-300">
          <div className="max-w-md mx-auto space-y-4 pointer-events-none">
            <div className="w-16 h-16 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300 border border-indigo-500/20">
              <UploadCloud className="w-8 h-8 text-indigo-400 animate-pulse" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Drag & Drop Manga Images
              </h2>
              <p className="text-xs text-slate-400 mt-1.5">
                Auto-sequential sorting enabled (<code className="text-indigo-400 font-mono">001.jpg</code>, <code className="text-indigo-400 font-mono">002.jpg</code>, <code className="text-indigo-400 font-mono">010.jpg</code>)
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="text-[11px] px-2.5 py-1 rounded bg-black/40 text-slate-300 border border-white/10 font-mono">
                JPG, JPEG, WEBP, PNG, GIF, AVIF (All Formats)
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                Batch Unlimited Pages
              </span>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-4 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-900/30 transition-all flex items-center space-x-2 border border-indigo-400/40"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Select Images</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadSamples();
                }}
                className="px-4 py-2.5 rounded-lg bg-black/40 hover:bg-white/10 text-emerald-400 font-semibold text-xs sm:text-sm border border-emerald-500/30 hover:border-emerald-500/50 transition-all flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Load Sample Pages</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selected File Queue Preview */}
      {pages.length > 0 && (
        <div className="bg-[#141417] border border-white/5 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs font-mono">
                #{pages.length}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Upload Sequence Queue ({pages.length} Files Selected)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Total size: {(pages.reduce((acc, p) => acc + p.fileSize, 0) / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onClearPages}
                disabled={isProcessing}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/40 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-800/40 transition-all flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>

              <button
                onClick={onStartProcessing}
                disabled={isProcessing}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-900/30 transition-all flex items-center space-x-2 disabled:opacity-50 border border-indigo-400/40"
              >
                <span>{isProcessing ? 'Translating Chapter...' : 'START BATCH TRANSLATION'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick File Strip Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className="group relative bg-black/40 border border-white/10 rounded-lg overflow-hidden hover:border-indigo-500/50 transition-all"
              >
                <div className="aspect-[3/4] bg-black/60 relative">
                  <img
                    src={page.originalUrl}
                    alt={page.filename}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/90 backdrop-blur text-[10px] font-mono text-indigo-400 font-bold border border-indigo-500/30">
                    #{String(index + 1).padStart(3, '0')}
                  </div>
                </div>
                <div className="p-2 text-center bg-black/60">
                  <p className="text-[11px] font-medium text-slate-300 truncate" title={page.filename}>
                    {page.filename}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {(page.fileSize / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
