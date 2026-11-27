import React, { useState } from 'react';
import JSZip from 'jszip';
import { MangaPage, MasterIndexData, TranslationSettings } from '../types';
import { safeFileStem } from '../utils/downloads';
import { isFullyTranslatedBlock } from '../utils/translationStatus';
import {
  X,
  Download,
  FileJson,
  FolderArchive,
  CheckCircle2,
  Columns,
  Image as ImageIcon,
  Loader2,
  Sparkles
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: MangaPage[];
  settings: TranslationSettings;
}

export async function buildFullChapterZip(
  pages: MangaPage[],
  masterIndexData: MasterIndexData
): Promise<Uint8Array> {
  const zip = new JSZip();
  const outputFolder = zip.folder('translated_output');
  if (!outputFolder) throw new Error('Failed to create output folder');
  const translatedFolder = outputFolder.folder('translated_images');
  const sideBySideFolder = outputFolder.folder('side_by_side');
  const textOnlyFolder = outputFolder.folder('text_only');
  if (!translatedFolder || !sideBySideFolder || !textOnlyFolder) throw new Error('Failed to create output folders');

  outputFolder.file('master_index.json', JSON.stringify(masterIndexData, null, 2));
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const sequence = String(page.sequenceIndex || i + 1).padStart(3, '0');
    const stem = safeFileStem(page.filename);
    textOnlyFolder.file(`text_only_${sequence}_${stem}.json`, JSON.stringify({
      page_number: i + 1,
      filename: page.filename,
      summary: page.pageSummary,
      text_blocks: page.textBlocks,
    }, null, 2));

    const translated = page.translatedImageUrl?.split(',')[1];
    const sideBySide = page.sideBySideImageUrl?.split(',')[1];
    if (!translated || !sideBySide) throw new Error(`Page ${page.filename} is missing a rendered export image`);
    // Both renderer functions return image/jpeg data URLs, regardless of the upload's extension.
    translatedFolder.file(`translated_${sequence}_${stem}.jpg`, translated, { base64: true });
    sideBySideFolder.file(`side_by_side_${sequence}_${stem}.jpg`, sideBySide, { base64: true });
  }
  return zip.generateAsync({ type: 'uint8array' });
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  pages,
  settings,
}) => {
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<string>('');

  if (!isOpen) return null;

  const translatedCount = pages.filter((p) => p.status === 'done').length;
  const incompleteTranslations = pages.reduce((count, page) => count + page.textBlocks.filter((block) => !isFullyTranslatedBlock(block)).length, 0);
  const outputReady = pages.length > 0 && pages.every(
    (page) => page.status === 'done' && !!page.translatedImageUrl && !!page.sideBySideImageUrl
  );

  // Generate master_index.json structure
  const masterIndexData: MasterIndexData = {
    title: 'Manga Chapter Translation',
    total_pages: pages.length,
    translated_count: translatedCount,
    created_at: new Date().toISOString(),
    settings: settings,
    pages: pages.map((p, idx) => ({
      page_number: idx + 1,
      filename: p.filename,
      original_file: `original_${p.filename}`,
      translated_file: `translated_images/translated_${String(p.sequenceIndex || idx + 1).padStart(3, '0')}_${safeFileStem(p.filename)}.jpg`,
      side_by_side_file: `side_by_side/side_by_side_${String(p.sequenceIndex || idx + 1).padStart(3, '0')}_${safeFileStem(p.filename)}.jpg`,
      text_data_file: `text_only/text_only_${String(p.sequenceIndex || idx + 1).padStart(3, '0')}_${safeFileStem(p.filename)}.json`,
      text_count: p.textBlocks.length,
      summary: p.pageSummary,
    })),
  };

  // Export full ZIP package
  const handleExportFullZip = async () => {
    if (!outputReady) return;
    setIsZipping(true);
    setZipProgress('Creating output folder structure...');

    try {
      for (let i = 0; i < pages.length; i++) {
        setZipProgress(`Packing Page ${i + 1} / ${pages.length}...`);
      }

      setZipProgress('Compressing ZIP archive...');
      const archive = await buildFullChapterZip(pages, masterIndexData);
      const content = new Blob([archive], { type: 'application/zip' });

      // Trigger download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `translated_manga_chapter.zip`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    } catch (err: any) {
      console.error('Failed to create ZIP package:', err);
      alert('Failed to package ZIP: ' + err.message);
    } finally {
      setIsZipping(false);
      setZipProgress('');
    }
  };

  // Export Master Index JSON individually
  const handleExportMasterIndexJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(masterIndexData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'master_index.json';
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#141417] border border-white/5 rounded-xl max-w-xl w-full p-6 shadow-2xl relative space-y-6">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Export Translated Chapter</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Download structured output package with images, side-by-side, & JSON data
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Directory Output Structure Preview */}
        <div className="bg-black/50 border border-white/10 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-2">
          <div className="text-indigo-400 font-bold flex items-center space-x-1.5">
            <FolderArchive className="w-4 h-4" />
            <span>translated_output/</span>
          </div>
          <div className="pl-4 space-y-1.5 text-slate-400">
            <div className="flex items-center space-x-2 text-emerald-400">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>├── translated_images/ ({translatedCount} Typeset Pages)</span>
            </div>
            <div className="flex items-center space-x-2 text-purple-300">
              <Columns className="w-3.5 h-3.5" />
              <span>├── side_by_side/ ({translatedCount} Comparison Pages)</span>
            </div>
            <div className="flex items-center space-x-2 text-indigo-300">
              <FileJson className="w-3.5 h-3.5" />
              <span>├── text_only/ (JSON Speech Data)</span>
            </div>
            <div className="flex items-center space-x-2 text-purple-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>└── master_index.json (Complete Sequence Index)</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleExportFullZip}
            disabled={isZipping || !outputReady}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-xl shadow-indigo-950/50 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 border border-indigo-400/30"
          >
            {isZipping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{zipProgress || 'Preparing ZIP Archive...'}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Full Chapter Output Package (.ZIP)</span>
              </>
            )}
          </button>
          {!outputReady && pages.length > 0 && (
            <p className="text-center text-xs text-amber-300">
              Finish batch processing all pages before exporting the complete three-folder package.
            </p>
          )}
          {outputReady && incompleteTranslations > 0 && (
            <p className="text-center text-xs text-amber-300">
              {incompleteTranslations} bubble(s) still need dictionary entries. Their source lettering is cleared, but the translated bubble may be blank or partial.
            </p>
          )}

          <button
            onClick={handleExportMasterIndexJson}
            className="w-full py-2.5 rounded-lg bg-black/40 hover:bg-white/10 text-slate-200 font-semibold text-xs border border-white/10 transition-all flex items-center justify-center space-x-2"
          >
            <FileJson className="w-4 h-4 text-purple-400" />
            <span>Export Master Index JSON Only (master_index.json)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
