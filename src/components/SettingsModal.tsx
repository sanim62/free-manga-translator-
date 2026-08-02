import React from 'react';
import { TranslationSettings, FontFamily } from '../types';
import { X, Settings, Sliders, Check, Sparkles } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TranslationSettings;
  onUpdateSettings: (newSettings: TranslationSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#141417] border border-white/5 rounded-xl max-w-lg w-full p-6 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Translation & Typesetting Settings</h3>
              <p className="text-xs text-slate-400 mt-0.5">Configure Japanese translation nuances & font overlay style</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Translation Nuance Settings */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Model & Quota Management</span>
          </h4>

          {/* Model Selection */}
          <div className="space-y-1.5 bg-black/50 p-3 rounded-lg border border-white/10">
            <label className="text-xs font-semibold text-slate-200">Gemini Model</label>
            <select
              value={settings.selectedModel || 'gemini-3.6-flash'}
              onChange={(e) =>
                onUpdateSettings({ ...settings, selectedModel: e.target.value })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="gemini-3.6-flash">gemini-3.6-flash (Recommended - High Accuracy)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast & High Quota)</option>
              <option value="gemini-flash-latest">gemini-flash-latest (Auto Fallback)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Automatic fallbacks will engage if a rate limit or quota limit is encountered.
            </p>
          </div>

          {/* Custom API Key Input (Optional) */}
          <div className="space-y-1.5 bg-black/50 p-3 rounded-lg border border-white/10">
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>Custom Gemini API Key (Optional)</span>
              <span className="text-[10px] text-indigo-400 font-mono">Bypasses Default Quotas</span>
            </label>
            <input
              type="password"
              placeholder="AIzaSy... (Leave empty to use built-in system key)"
              value={settings.customApiKey || ''}
              onChange={(e) =>
                onUpdateSettings({ ...settings, customApiKey: e.target.value })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-600"
            />
            <p className="text-[11px] text-slate-500 mt-0.5">
              Paste your own free or paid Google Gemini API key if you want unlimited personal requests.
            </p>
          </div>

          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5 pt-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Translation Rules & Nuances</span>
          </h4>

          {/* Honorifics Style */}
          <div className="space-y-1.5 bg-black/50 p-3 rounded-lg border border-white/10">
            <label className="text-xs font-semibold text-slate-200">Japanese Honorifics (-san, -chan, -senpai)</label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onUpdateSettings({ ...settings, honorificsStyle: 'keep' })}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  settings.honorificsStyle === 'keep'
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                    : 'bg-black/40 text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                Keep (-san, -chan, -senpai)
              </button>

              <button
                onClick={() => onUpdateSettings({ ...settings, honorificsStyle: 'localize' })}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  settings.honorificsStyle === 'localize'
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                    : 'bg-black/40 text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                Localize (Mr, Ms, Bro)
              </button>
            </div>
          </div>

          {/* Sound Effects (SFX) Translation */}
          <div className="flex items-center justify-between bg-black/50 p-3 rounded-lg border border-white/10">
            <div>
              <p className="text-xs font-semibold text-slate-200">Detect & Translate Sound Effects (SFX)</p>
              <p className="text-[11px] text-slate-500">Includes visual sound effect translations (e.g. THUMP, DASH)</p>
            </div>
            <input
              type="checkbox"
              checked={settings.translateSFX}
              onChange={(e) => onUpdateSettings({ ...settings, translateSFX: e.target.checked })}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Typesetting & Font Overlay Settings */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Sliders className="w-3.5 h-3.5" />
            <span>Typesetting Overlay Customization</span>
          </h4>

          {/* Default Font Family */}
          <div className="space-y-1.5 bg-black/50 p-3 rounded-lg border border-white/10">
            <label className="text-xs font-semibold text-slate-200">Default Font Style</label>
            <select
              value={settings.defaultFontFamily}
              onChange={(e) =>
                onUpdateSettings({ ...settings, defaultFontFamily: e.target.value as FontFamily })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="wildwords">Wild Words Manga Style (Comic Sans/Bangers)</option>
              <option value="sans">Clean Anime Sans-Serif (System UI / Segoe)</option>
              <option value="serif">Classic Storybook Serif (Georgia)</option>
              <option value="monospaced">Console Monospaced (Courier)</option>
            </select>
          </div>

          {/* Overall Font Scale Multiplier */}
          <div className="space-y-1.5 bg-black/50 p-3 rounded-lg border border-white/10">
            <div className="flex justify-between text-xs font-semibold text-slate-200">
              <span>Overall Font Scale Multiplier</span>
              <span className="font-mono text-indigo-400">{(settings.fontSizeScale * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.5"
              step="0.05"
              value={settings.fontSizeScale}
              onChange={(e) =>
                onUpdateSettings({ ...settings, fontSizeScale: parseFloat(e.target.value) })
              }
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Enable Text Stroke Outline */}
          <div className="flex items-center justify-between bg-black/50 p-3 rounded-lg border border-white/10">
            <div>
              <p className="text-xs font-semibold text-slate-200">Enable Outline Stroke around Text</p>
              <p className="text-[11px] text-slate-500">Improves contrast and legibility over dark or transparent backgrounds</p>
            </div>
            <input
              type="checkbox"
              checked={settings.enableStroke}
              onChange={(e) => onUpdateSettings({ ...settings, enableStroke: e.target.checked })}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-950/40 transition-all border border-indigo-400/30"
          >
            Save & Apply Settings
          </button>
        </div>

      </div>
    </div>
  );
};
