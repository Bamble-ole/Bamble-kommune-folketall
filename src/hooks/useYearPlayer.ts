import { useEffect, useRef, useState } from 'react';

interface Options {
  years: number[];
  activeYear: number;
  setActiveYear: (year: number) => void;
  intervalMs?: number;
}

export function useYearPlayer({ years, activeYear, setActiveYear, intervalMs = 800 }: Options) {
  const [playing, setPlaying] = useState(false);
  const activeYearRef = useRef(activeYear);
  activeYearRef.current = activeYear;

  useEffect(() => {
    if (!playing) return;

    const id = setInterval(() => {
      const sorted = [...years].sort((a, b) => a - b);
      const idx = sorted.indexOf(activeYearRef.current);
      if (idx === -1 || idx >= sorted.length - 1) {
        setPlaying(false);
      } else {
        setActiveYear(sorted[idx + 1]);
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [playing, years, setActiveYear, intervalMs]);

  return { playing, toggle: () => setPlaying(p => !p), stop: () => setPlaying(false) };
}
