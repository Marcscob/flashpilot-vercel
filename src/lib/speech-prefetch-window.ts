export function speechPrefetchWindow<T>(cards: readonly T[], currentIndex: number): readonly T[] {
  if (currentIndex < 0 || currentIndex >= cards.length) return [];
  return cards.slice(currentIndex, currentIndex + 3);
}