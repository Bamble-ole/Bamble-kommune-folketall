import { useState, useEffect, useRef } from 'react';

const cache = new Map<string, unknown>();

export function useSSB<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
): { data: T | null; laster: boolean; feil: string | null } {
  const [data, setData]   = useState<T | null>(() =>
    cache.has(cacheKey) ? (cache.get(cacheKey) as T) : null,
  );
  const [laster, setLaster] = useState(!cache.has(cacheKey));
  const [feil, setFeil]     = useState<string | null>(null);
  const hentet              = useRef(cache.has(cacheKey));

  useEffect(() => {
    if (hentet.current) return;
    hentet.current = true;

    fetchFn()
      .then(result => {
        cache.set(cacheKey, result);
        setData(result);
      })
      .catch(err => setFeil((err as Error).message))
      .finally(() => setLaster(false));
  // fetchFn er ikke i deps med vilje — hooken er ment for stabile kall-funksjoner
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return { data, laster, feil };
}
