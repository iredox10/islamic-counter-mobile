import { useEffect, useState, useCallback } from 'react';
import safeStorage from '@/lib/storage';

const KEYS = {
  sound: 'sound-enabled',
  autoReset: 'auto-reset',
  showAdhkarList: 'show-adhkar-list',
  counterState: 'counter-state',
  multiCounter: 'multi-counter-state',
  multiMode: 'multi-mode',
  prayerMode: 'prayer-mode',
} as const;

export function useBooleanSetting(key: string, defaultValue = false) {
  const [value, setValue] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    safeStorage
      .getItem(key)
      .then((v) => {
        if (v !== null) setValue(v === 'true');
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [key]);

  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      safeStorage.setItem(key, String(next));
    },
    [key]
  );

  return [value, set, loaded] as const;
}

export function useJsonSetting<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    safeStorage
      .getItem(key)
      .then((v) => {
        if (v) {
          try {
            setValue(JSON.parse(v));
          } catch {
            /* keep default */
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        safeStorage.setItem(key, JSON.stringify(resolved));
        return resolved;
      });
    },
    [key]
  );

  return [value, set, loaded] as const;
}

export { KEYS };
