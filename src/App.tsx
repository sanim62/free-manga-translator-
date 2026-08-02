/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MangaPage, TranslationSettings } from './types';
import { sortMangaFiles } from './utils/naturalSort';
import { generateSampleMangaPages } from './utils/sampleData';
import { renderTranslatedPage, renderSideBySidePage } from './utils/mangaRenderer';

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
    selectedModel: 'gemini-3.6-flash',
    customApiKey: '',
  });

  const addLog = (msg: string) => {
    setLogMessages((prev) => [...prev, msg]);
  };

  // Handle uploaded files with natural sequence sorting
  const handleFilesSelected = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newPages: MangaPage[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const dataUrl = await readFileAsDataURL(file);

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
        return {
          ...p,
          status: 'done' as const,
          translatedImageUrl: transUrl,
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
    addLog('Starting batch translation engine...');

    const updatedPages = [...pages];

    for (let i = 0; i < updatedPages.length; i++) {
      const currentPage = updatedPages[i];
      if (currentPage.status === 'done') continue; // Skip already translated pages

      // Update status to processing
      updatedPages[i] = { ...currentPage, status: 'processing', progress: 10 };
      setPages([...updatedPages]);
      addLog(`[${i + 1}/${pages.length}] Processing ${currentPage.filename}...`);

      try {
        const optimizedImageBase64 = await optimizeImageForTranslation(currentPage.originalUrl);

        const response = await fetch('/api/translate-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: optimizedImageBase64,
            filename: currentPage.filename,
            settings: settings,
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || 'Server error during translation');
        }

        const textBlocks = data.textBlocks || [];
        const pageSummary = data.pageSummary || '';

        // Render typeset translated page
        const translatedDataUrl = await renderTranslatedPage(
          currentPage.originalUrl,
          textBlocks,
          settings
        );

        updatedPages[i] = {
          ...updatedPages[i],
          status: 'done',
          progress: 100,
          textBlocks: textBlocks,
          pageSummary: pageSummary,
          translatedImageUrl: translatedDataUrl,
        };

        setPages([...updatedPages]);
        addLog(`[${i + 1}/${pages.length}] Completed ${currentPage.filename} (${textBlocks.length} bubbles translated).`);

        // Delay between batch items to protect API rate limits
        await new Promise((res) => setTimeout(res, 800));
      } catch (err: any) {
        console.error(`Error on page ${currentPage.filename}:`, err);
        updatedPages[i] = {
          ...updatedPages[i],
          status: 'error',
          errorMessage: err.message,
        };
        setPages([...updatedPages]);
        addLog(`[${i + 1}/${pages.length}] Error on ${currentPage.filename}: ${err.message}`);
      }
    }

    setIsProcessing(false);
    addLog('Batch Translation Process Complete!');
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

  const translatedCount = pages.filter((p) => p.status === 'done').length;

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
