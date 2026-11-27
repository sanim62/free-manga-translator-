/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MangaPage, TranslationSettings } from './types';
import { sortMangaFiles } from './utils/naturalSort';
import { generateSampleMangaPages } from './utils/sampleData';
import { renderTranslatedPage, renderSideBySidePage } from './utils/mangaRenderer';
import { isFullyTranslatedBlock } from './utils/translationStatus';
import { apiUrl } from './lib/apiUrl';

import { Navbar } from './components/Navbar';
import { UploadZone } from './components/UploadZone';
import { BatchWorkspace } from './components/BatchWorkspace';
import { InteractiveEditor } from './components/InteractiveEditor';
import { MangaReader } from './components/MangaReader';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [pages, setPages] = useState<MangaPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<
    'workspace' | 'editor' | 'reader' | 'export'
  >('workspace');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const [settings, setSettings] = useState<TranslationSettings>({
    honorificsStyle: 'keep',
    translateSFX: true,
    adultTone: true,
    customGlossary: {},
    defaultFontFamily: 'wildwords',
    fontSizeScale: 1.0,
    fontColor: '#000000',
    strokeColor: '#ffffff',
    enableStroke: true,
    bgEraseStyle: 'smooth_fill',
    readingDirection: 'rtl',
  });

  const addLog = (msg: string) => {
    setLogMessages((prev) => [...prev, msg]);
  };

  // Handle uploaded files with natural sequence sorting
  const handleFilesSelected = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files);
    const fileArray = selectedFiles.filter((file) =>
      /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name) &&
      (!file.type || file.type.startsWith('image/'))
    );
    if (fileArray.length < selectedFiles.length) {
      addLog(`Skipped ${selectedFiles.length - fileArray.length} unsupported file(s). Select JPG, PNG, WEBP, GIF, BMP, or AVIF images.`);
    }
    const newPages: MangaPage[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      let dataUrl: string;
      try {
        dataUrl = await readFileAsDataURL(file);
      } catch {
        addLog(`Could not read ${file.name}; skipped that image.`);
        continue;
      }

      newPages.push({
        id: `page_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
        filename: file.name,
        fileSize: file.size,
        sequenceIndex: i + 1,
        originalUrl: dataUrl,
        status: 'idle',
        progress: 0,
        textBlocks: [],
      });
    }

    // Apply natural sequence sorting (001.jpg, 002.jpg, 010.jpg)
    const sorted = sortMangaFiles(newPages).map((p, idx) => ({
      ...p,
      sequenceIndex: idx + 1,
    }));

    setPages((prev) => {
      const combined = sortMangaFiles([...prev, ...sorted]).map((p, idx) => ({
        ...p,
        sequenceIndex: idx + 1,
      }));
      return combined;
    });

    addLog(`Loaded ${sorted.length} images into sequence queue with natural sorting.`);
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Load built-in sample manga chapter
  const handleLoadSamples = async () => {
    const samplePages = generateSampleMangaPages();
    
    // Automatically render typeset translated pages for sample pages so they work instantly!
    const processedSamples = await Promise.all(
      samplePages.map(async (p) => {
        const transUrl = await renderTranslatedPage(p.originalUrl, p.textBlocks, settings);
        const sideBySideUrl = await renderSideBySidePage(p.originalUrl, transUrl, p.sequenceIndex, p.filename);
        return {
          ...p,
          status: 'done' as const,
          translatedImageUrl: transUrl,
          sideBySideImageUrl: sideBySideUrl,
          pageSummary: 'Sample Japanese Manga Page',
        };
      })
    );

    setPages(processedSamples);
    setActivePageIndex(0);
    addLog('Loaded 2 sample manga pages for instant 1-click preview.');
  };

  // Clear page queue
  const handleClearPages = () => {
    setPages([]);
    setActivePageIndex(0);
    setLogMessages([]);
  };

  // Optimize large images to prevent payload size and token budget issues while preserving fine details
  const optimizeImageForTranslation = (dataUrl: string, maxDim = 2200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDim && height <= maxDim) {
          return resolve(dataUrl);
        }
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Process batch translation sequentially
  const handleStartProcessing = async () => {
    if (pages.length === 0 || isProcessing) return;

    setIsProcessing(true);
    addLog('Starting local OCR engine…');

    const updatedPages = [...pages];

    for (let i = 0; i < updatedPages.length; i++) {
      const currentPage = updatedPages[i];
      if (currentPage.status === 'done') continue; // Skip already translated pages

      // Update status to processing
      updatedPages[i] = { ...currentPage, status: 'processing', progress: 5 };
      setPages([...updatedPages]);
      addLog(`[${i + 1}/${pages.length}] Processing ${currentPage.filename}…`);

      try {
        const optimizedImageBase64 = await optimizeImageForTranslation(currentPage.originalUrl);

        updatedPages[i] = { ...updatedPages[i], progress: 10 };
        setPages([...updatedPages]);
        addLog('  → Sending page to the server-side MangaOCR engine…');
        const response = await fetch(apiUrl('/api/translate-page'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: optimizedImageBase64 }),
        });
        const responseText = await response.text();
        let result: { textBlocks?: MangaPage['textBlocks']; pageSummary?: string; error?: string };
        try {
          result = JSON.parse(responseText);
        } catch {
          if (/^\s*<!doctype html|^\s*<html/i.test(responseText)) {
            throw new Error(
              `OCR API returned an HTML page (HTTP ${response.status}). Configure VITE_API_BASE_URL to point at the OCR server; the Netlify site only hosts the frontend.`
            );
          }
          throw new Error(responseText || `OCR server returned status ${response.status}`);
        }
        if (!response.ok || result.error) {
          throw new Error(result.error || 'Server-side manga OCR failed');
        }
        const textBlocks = result.textBlocks || [];
        const pageSummary = result.pageSummary || `[MangaOCR — ${textBlocks.length} bubble(s) detected]`;

        // Render typeset translated page
        const translatedDataUrl = await renderTranslatedPage(
          currentPage.originalUrl,
          textBlocks,
          settings
        );
        const sideBySideDataUrl = await renderSideBySidePage(
          currentPage.originalUrl,
          translatedDataUrl,
          i + 1,
          currentPage.filename
        );

        updatedPages[i] = {
          ...updatedPages[i],
          status: 'done',
          progress: 100,
          textBlocks: textBlocks,
          pageSummary: pageSummary,
          translatedImageUrl: translatedDataUrl,
          sideBySideImageUrl: sideBySideDataUrl,
        };

        setPages([...updatedPages]);
        addLog(`[${i + 1}/${pages.length}] ✓ ${currentPage.filename} — ${textBlocks.length} bubble(s) translated.`);

      } catch (err: any) {
        console.error(`Error on page ${currentPage.filename}:`, err);
        updatedPages[i] = {
          ...updatedPages[i],
          status: 'error',
          errorMessage: err.message,
        };
        setPages([...updatedPages]);
        addLog(`[${i + 1}/${pages.length}] ✗ Error on ${currentPage.filename}: ${err.message}`);
      }
    }

    setIsProcessing(false);
    addLog('✅ All pages processed!');
  };

  // Retry individual page
  const handleRetryPage = async (index: number) => {
    if (index < 0 || index >= pages.length) return;
    const updatedPages = [...pages];
    updatedPages[index] = { ...updatedPages[index], status: 'idle' };
    setPages(updatedPages);
    handleStartProcessing();
  };

  // Page update from Interactive Editor
  const handleUpdatePage = async (updatedPage: MangaPage) => {
    const newPages = pages.map((p) => (p.id === updatedPage.id ? updatedPage : p));
    setPages(newPages);
  };

  const translatedCount = pages.filter((page) =>
    page.status === 'done' && page.textBlocks.length > 0 && page.textBlocks.every(isFullyTranslatedBlock)
  ).length;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-100 font-sans selection:bg-indigo-600 selection:text-white pb-12">
      
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalPages={pages.length}
        translatedCount={translatedCount}
        openSettings={() => setIsSettingsOpen(true)}
        openExport={() => setIsExportOpen(true)}
        onLoadSamples={handleLoadSamples}
      />

      {/* Main Body Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Upload Zone when queue is empty */}
        {pages.length === 0 && (
          <UploadZone
            onFilesSelected={handleFilesSelected}
            onLoadSamples={handleLoadSamples}
            pages={pages}
            onClearPages={handleClearPages}
            onStartProcessing={handleStartProcessing}
            isProcessing={isProcessing}
          />
        )}

        {/* Workspace Tab */}
        {pages.length > 0 && activeTab === 'workspace' && (
          <div className="space-y-6">
            <UploadZone
              onFilesSelected={handleFilesSelected}
              onLoadSamples={handleLoadSamples}
              pages={pages}
              onClearPages={handleClearPages}
              onStartProcessing={handleStartProcessing}
              isProcessing={isProcessing}
            />

            <BatchWorkspace
              pages={pages}
              isProcessing={isProcessing}
              activePageIndex={activePageIndex}
              onSelectPage={(idx) => setActivePageIndex(idx)}
              onStartProcessing={handleStartProcessing}
              onRetryPage={handleRetryPage}
              onOpenEditor={(idx) => {
                setActivePageIndex(idx);
                setActiveTab('editor');
              }}
              logMessages={logMessages}
            />
          </div>
        )}

        {/* Interactive Editor Tab */}
        {pages.length > 0 && activeTab === 'editor' && pages[activePageIndex] && (
          <InteractiveEditor
            page={pages[activePageIndex]}
            settings={settings}
            onUpdatePage={handleUpdatePage}
            onPrevPage={() => setActivePageIndex(Math.max(activePageIndex - 1, 0))}
            onNextPage={() => setActivePageIndex(Math.min(activePageIndex + 1, pages.length - 1))}
            hasPrev={activePageIndex > 0}
            hasNext={activePageIndex < pages.length - 1}
          />
        )}

        {/* Manga Reader Tab */}
        {pages.length > 0 && activeTab === 'reader' && (
          <MangaReader
            pages={pages}
            activePageIndex={activePageIndex}
            onSelectPage={(idx) => setActivePageIndex(idx)}
            settings={settings}
          />
        )}

      </main>

      {/* Modals */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        pages={pages}
        settings={settings}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
      />

    </div>
  );
}
