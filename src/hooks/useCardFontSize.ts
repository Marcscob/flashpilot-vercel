import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "card-font-size";
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 48;

export function useCardFontSize() {
  const [fontSize, setFontSize] = useState(22);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (saved >= MIN_FONT_SIZE && saved <= MAX_FONT_SIZE) setFontSize(saved);
    } catch {
      // Font sizing still works in memory when browser storage is unavailable.
    }
  }, []);

  const changeFontSize = useCallback((delta: number) => {
    setFontSize((previous) => {
      const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, previous + delta));
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Font sizing still works in memory when browser storage is unavailable.
      }
      return next;
    });
  }, []);

  return { fontSize, changeFontSize };
}
