/**
 * Natural sort comparator for filenames (e.g., "001.jpg", "002.jpg", "010.jpg", "page_1.jpg", "page_10.jpg")
 */
export function naturalSortCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortMangaFiles<T extends { filename: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => naturalSortCompare(a.filename, b.filename));
}
