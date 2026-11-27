export function safeFileStem(filename: string): string {
  const stem = filename.replace(/\.[^/.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return stem.replace(/^\.+$/, '') || 'manga-page';
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
