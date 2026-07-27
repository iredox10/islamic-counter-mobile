import { format } from 'date-fns';
import {
  addAdhkarSession,
  addJournalEntry,
  upsertAdhkarStreak,
  getAdhkarStreak,
  getAdhkarSessions,
  getAdhkarJournal,
} from './db';
import type { AdhkarSession, AdhkarStreak, AdhkarJournal } from './types';

export interface AdhkarSessionData {
  collectionId: string;
  collectionName: string;
  totalItems: number;
}

export interface JournalEntry {
  dhikrName: string;
  dhikrArabic?: string;
  count: number;
  target: number;
}

let currentSession: {
  collectionId: string;
  collectionName: string;
  startedAt: Date;
  totalItems: number;
  completedItems: number;
  totalCounts: number;
  journalEntries: JournalEntry[];
} | null = null;

export function startAdhkarSession(data: AdhkarSessionData): void {
  currentSession = {
    collectionId: data.collectionId,
    collectionName: data.collectionName,
    startedAt: new Date(),
    totalItems: data.totalItems,
    completedItems: 0,
    totalCounts: 0,
    journalEntries: [],
  };
}

export function recordDhikrCompletion(
  dhikrName: string,
  dhikrArabic: string | undefined,
  count: number,
  target: number
): void {
  if (!currentSession) return;
  currentSession.completedItems++;
  currentSession.totalCounts += count;
  currentSession.journalEntries.push({ dhikrName, dhikrArabic, count, target });
}

export async function endAdhkarSession(
  completed: boolean = true
): Promise<AdhkarSession | null> {
  if (!currentSession) return null;

  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const durationSeconds = Math.floor(
    (Date.now() - currentSession.startedAt.getTime()) / 1000
  );

  const session = await addAdhkarSession({
    collectionId: currentSession.collectionId,
    collectionName: currentSession.collectionName,
    dateStr,
    startedAt: currentSession.startedAt.toISOString(),
    completedAt: completed ? new Date().toISOString() : undefined,
    durationSeconds,
    totalItems: currentSession.totalItems,
    completedItems: currentSession.completedItems,
    totalCounts: currentSession.totalCounts,
  });

  if (completed && currentSession.completedItems === currentSession.totalItems) {
    await upsertAdhkarStreak(currentSession.collectionId, dateStr);
  }

  for (const entry of currentSession.journalEntries) {
    await addJournalEntry({
      dateStr,
      collectionId: currentSession.collectionId,
      collectionName: currentSession.collectionName,
      dhikrName: entry.dhikrName,
      dhikrArabic: entry.dhikrArabic,
      count: entry.count,
      target: entry.target,
      completedAt: new Date().toISOString(),
    });
  }

  currentSession = null;
  return session;
}

export function cancelAdhkarSession(): void {
  currentSession = null;
}

export function getCurrentSession() {
  return currentSession;
}

export async function getStreak(
  collectionId: string
): Promise<AdhkarStreak | undefined> {
  return getAdhkarStreak(collectionId);
}

export function getSessionHistory(limit = 30): AdhkarSession[] {
  return [...getAdhkarSessions()]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

export function getJournalHistory(limit = 100): AdhkarJournal[] {
  return [...getAdhkarJournal()]
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, limit);
}
