import { format, subDays } from 'date-fns';
import {
  addAdhkarSession,
  addJournalEntry,
  upsertAdhkarStreak,
  getAdhkarStreak,
  getAllAdhkarStreaks,
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

export function getAllStreaks(): AdhkarStreak[] {
  return [...getAllAdhkarStreaks()].sort(
    (a, b) => b.currentStreak - a.currentStreak
  );
}

export interface WeeklySummary {
  days: Array<{
    dateStr: string;
    totalCounts: number;
    totalDuration: number;
    sessionsCount: number;
  }>;
  totalCounts: number;
  totalDuration: number;
  totalSessions: number;
}

export function getWeeklySummary(): WeeklySummary {
  const days: WeeklySummary['days'] = [];
  const sessions = getAdhkarSessions();

  for (let i = 6; i >= 0; i--) {
    const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const daySessions = sessions.filter((s) => s.dateStr === dateStr);
    days.push({
      dateStr,
      totalCounts: daySessions.reduce((sum, s) => sum + s.totalCounts, 0),
      totalDuration: daySessions.reduce(
        (sum, s) => sum + s.durationSeconds,
        0
      ),
      sessionsCount: daySessions.length,
    });
  }

  return {
    days,
    totalCounts: days.reduce((sum, d) => sum + d.totalCounts, 0),
    totalDuration: days.reduce((sum, d) => sum + d.totalDuration, 0),
    totalSessions: days.reduce((sum, d) => sum + d.sessionsCount, 0),
  };
}

export function getDailyStats(dateStr: string): {
  counts: number;
  duration: number;
  sessions: number;
} {
  const daySessions = getAdhkarSessions().filter((s) => s.dateStr === dateStr);
  return {
    counts: daySessions.reduce((sum, s) => sum + s.totalCounts, 0),
    duration: daySessions.reduce((sum, s) => sum + s.durationSeconds, 0),
    sessions: daySessions.length,
  };
}

export function exportHistoryJSON(): string {
  const data = {
    exportedAt: new Date().toISOString(),
    sessions: getAdhkarSessions(),
    journal: getAdhkarJournal(),
    streaks: getAllAdhkarStreaks(),
  };
  return JSON.stringify(data, null, 2);
}

export function exportHistoryCSV(): string {
  const rows: string[] = ['Date,Collection,Dhikr,Count,Target,Completed At'];
  for (const entry of getAdhkarJournal()) {
    rows.push(
      `${entry.dateStr},"${entry.collectionName}","${entry.dhikrName}",${entry.count},${entry.target},${entry.completedAt}`
    );
  }
  return rows.join('\n');
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
