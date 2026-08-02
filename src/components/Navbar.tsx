import React from 'react';
import {
  BookOpen,
  Layers,
  Edit3,
  Columns,
  Download,
  Settings,
  Sparkles,
  Zap
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'workspace' | 'editor' | 'reader' | 'export';
  setActiveTab: (tab: 'workspace' | 'editor' | 'reader' | 'export') => void;
  totalPages: number;
  translatedCount: number;
  openSettings: () => void;
  openExport: () => void;
  onLoadSamples: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  totalPages,
  translatedCount,
  openSettings,
  openExport,
  onLoadSamples,
}) => {
  return (
    <header className="bg-[#0F0F11] border-b border-white/10 text-slate-200 sticky top-0 z-40 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-base shadow-md shadow-indigo-900/40">
              文
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg tracking-tight text-white">
                  MANGA TRANSLATOR
                </h1>
                <span className="text-[10px] uppercase font-mono tracking-wider font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-400/30">
                  JP → EN
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
                <span>Local Engine Active • OCR & Typesetting</span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'workspace'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40 border border-indigo-400/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Workspace</span>
              {totalPages > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-black/50 text-indigo-300 font-mono">
                  {translatedCount}/{totalPages}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('editor')}
              disabled={totalPages === 0}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                totalPages === 0 ? 'opacity-30 cursor-not-allowed text-slate-600' :
                activeTab === 'editor'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40 border border-indigo-400/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">Interactive</span> Editor
            </button>

            <button
              onClick={() => setActiveTab('reader')}
              disabled={totalPages === 0}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                totalPages === 0 ? 'opacity-30 cursor-not-allowed text-slate-600' :
                activeTab === 'reader'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40 border border-indigo-400/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Translated Reader</span>
            </button>
          </nav>

          {/* Action Tools */}
          <div className="flex items-center space-x-2">
            {totalPages === 0 && (
              <button
                onClick={onLoadSamples}
                className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load Sample</span>
              </button>
            )}

            <button
              onClick={openExport}
              disabled={totalPages === 0}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                totalPages === 0
                  ? 'opacity-30 cursor-not-allowed text-slate-600 border-white/5'
                  : 'bg-[#141417] hover:bg-white/10 text-slate-200 border-white/10 shadow-sm'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={openSettings}
              className="p-2 rounded-lg text-slate-400 hover:text-white bg-[#141417] hover:bg-white/10 border border-white/10 transition-all"
              title="Translation Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
