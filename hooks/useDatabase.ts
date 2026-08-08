import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  hydrateDatabase,
  subscribe,
  getState,
  getLogs,
  getTargets,
  getDurations,
  getCollectionProgressForDate,
  getUnlockedAchievements,
  getPrayerCompletions,
  getPrayerCompletionsByDate,
  getAdhkarSessions,
  getAdhkarJournal,
  getAllAdhkarStreaks,
} from '@/lib/db';
import type { DatabaseState } from '@/lib/types';

export function useDatabaseReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrateDatabase().then(() => setReady(true));
  }, []);

  return ready;
}

function areEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  }
  if (
    typeof a === 'object' &&
    a !== null &&
    typeof b === 'object' &&
    b !== null
  ) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.is(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

const snapshotCache = new Map<string, { state: DatabaseState; result: any }>();

function getMemoizedSnapshot<T>(key: string, fn: () => T): T {
  const currentState = getState();
  const cached = snapshotCache.get(key);

  if (cached && cached.state === currentState) {
    return cached.result;
  }

  const nextResult = fn();

  if (cached && areEqual(cached.result, nextResult)) {
    snapshotCache.set(key, { state: currentState, result: cached.result });
    return cached.result;
  }

  snapshotCache.set(key, { state: currentState, result: nextResult });
  return nextResult;
}

export function useLogs() {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot('logs', getLogs),
    () => getMemoizedSnapshot('logs', getLogs)
  );
}

export function useTargets() {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot('targets', getTargets),
    () => getMemoizedSnapshot('targets', getTargets)
  );
}

export function useDurations() {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot('durations', getDurations),
    () => getMemoizedSnapshot('durations', getDurations)
  );
}

export function useCollectionProgress(dateStr: string) {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot(`collectionProgress:${dateStr}`, () => getCollectionProgressForDate(dateStr)),
    () => getMemoizedSnapshot(`collectionProgress:${dateStr}`, () => getCollectionProgressForDate(dateStr))
  );
}

export function useAchievements() {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot('achievements', getUnlockedAchievements),
    () => getMemoizedSnapshot('achievements', getUnlockedAchievements)
  );
}

export function usePrayerCompletions() {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot('prayerCompletions', getPrayerCompletions),
    () => getMemoizedSnapshot('prayerCompletions', getPrayerCompletions)
  );
}

export function usePrayerCompletionsToday(dateStr: string) {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot(`prayerCompletionsToday:${dateStr}`, () => getPrayerCompletionsByDate(dateStr)),
    () => getMemoizedSnapshot(`prayerCompletionsToday:${dateStr}`, () => getPrayerCompletionsByDate(dateStr))
  );
}

export function useAdhkarSessions() {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot('adhkarSessions', getAdhkarSessions),
    () => getMemoizedSnapshot('adhkarSessions', getAdhkarSessions)
  );
}

export function useAdhkarJournal() {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot('adhkarJournal', getAdhkarJournal),
    () => getMemoizedSnapshot('adhkarJournal', getAdhkarJournal)
  );
}

export function useAdhkarStreaks() {
  return useSyncExternalStore(
    subscribe,
    () => getMemoizedSnapshot('adhkarStreaks', getAllAdhkarStreaks),
    () => getMemoizedSnapshot('adhkarStreaks', getAllAdhkarStreaks)
  );
}
