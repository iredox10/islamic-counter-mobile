import safeStorage from './storage';
import {
  EMPTY_DB,
  type DatabaseState,
  type Log,
  type Target,
  type Duration,
  type CollectionProgress,
  type UnlockedAchievement,
  type PrayerCompletion,
  type AdhkarSession,
  type AdhkarStreak,
  type AdhkarJournal,
} from './types';

const STORAGE_KEY = 'islamic-counter-db-v1';

type Listener = () => void;

let state: DatabaseState = { ...EMPTY_DB, nextId: 1 };
let hydrated = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function nextId(): number {
  const id = state.nextId;
  state = { ...state, nextId: id + 1 };
  return id;
}

async function persist() {
  try {
    await safeStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to persist database', e);
  }
  emit();
}

export async function hydrateDatabase(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await safeStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = { ...EMPTY_DB, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load database', e);
  }
  hydrated = true;
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): DatabaseState {
  return state;
}

// ── Logs ──────────────────────────────────────────────

export async function addLog(log: Omit<Log, 'id'>): Promise<Log> {
  const entry: Log = { ...log, id: nextId() };
  state = { ...state, logs: [...state.logs, entry] };
  await persist();
  return entry;
}

export function getLogs(): Log[] {
  return state.logs;
}

export function getLogsByDate(dateStr: string): Log[] {
  return state.logs.filter((l) => l.dateStr === dateStr);
}

// ── Targets ───────────────────────────────────────────

export async function addTarget(
  target: Omit<Target, 'id'>
): Promise<Target> {
  const entry: Target = { ...target, id: nextId() };
  state = { ...state, targets: [...state.targets, entry] };
  await persist();
  return entry;
}

export async function updateTarget(
  id: number,
  patch: Partial<Target>
): Promise<void> {
  state = {
    ...state,
    targets: state.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  };
  await persist();
}

export async function deleteTarget(id: number): Promise<void> {
  state = { ...state, targets: state.targets.filter((t) => t.id !== id) };
  await persist();
}

export function getTargets(): Target[] {
  return state.targets;
}

export function getTarget(id: number): Target | undefined {
  return state.targets.find((t) => t.id === id);
}

// ── Durations ─────────────────────────────────────────

export async function incrementDuration(
  dateStr: string,
  targetId: number,
  seconds = 1
): Promise<void> {
  const existing = state.durations.find(
    (d) => d.dateStr === dateStr && (d.targetId ?? 0) === targetId
  );
  if (existing) {
    state = {
      ...state,
      durations: state.durations.map((d) =>
        d.id === existing.id ? { ...d, seconds: d.seconds + seconds } : d
      ),
    };
  } else {
    state = {
      ...state,
      durations: [
        ...state.durations,
        { id: nextId(), dateStr, targetId, seconds },
      ],
    };
  }
  await persist();
}

export function getDurations(): Duration[] {
  return state.durations;
}

// ── Collection Progress ───────────────────────────────

export async function setCollectionProgress(
  collectionId: string,
  itemIndex: number,
  currentCount: number,
  dateStr: string
): Promise<void> {
  const existing = state.collectionProgress.find(
    (p) =>
      p.collectionId === collectionId &&
      p.itemIndex === itemIndex &&
      p.dateStr === dateStr
  );
  if (existing) {
    state = {
      ...state,
      collectionProgress: state.collectionProgress.map((p) =>
        p.id === existing.id ? { ...p, currentCount } : p
      ),
    };
  } else {
    state = {
      ...state,
      collectionProgress: [
        ...state.collectionProgress,
        { id: nextId(), collectionId, itemIndex, currentCount, dateStr },
      ],
    };
  }
  await persist();
}

export function getCollectionProgressForDate(dateStr: string): CollectionProgress[] {
  return state.collectionProgress.filter((p) => p.dateStr === dateStr);
}

// ── Achievements ──────────────────────────────────────

export async function unlockAchievement(achievementId: string): Promise<void> {
  if (state.achievements.some((a) => a.achievementId === achievementId)) return;
  state = {
    ...state,
    achievements: [
      ...state.achievements,
      {
        id: nextId(),
        achievementId,
        unlockedAt: new Date().toISOString(),
      },
    ],
  };
  await persist();
}

export function getUnlockedAchievements(): UnlockedAchievement[] {
  return state.achievements;
}

// ── Prayer Completions ────────────────────────────────

export async function addPrayerCompletion(
  data: Omit<PrayerCompletion, 'id'>
): Promise<void> {
  const exists = state.prayerCompletions.some(
    (p) => p.prayer === data.prayer && p.dateStr === data.dateStr
  );
  if (exists) return;
  state = {
    ...state,
    prayerCompletions: [
      ...state.prayerCompletions,
      { ...data, id: nextId() },
    ],
  };
  await persist();
}

export function getPrayerCompletions(): PrayerCompletion[] {
  return state.prayerCompletions;
}

export function getPrayerCompletionsByDate(dateStr: string): PrayerCompletion[] {
  return state.prayerCompletions.filter((p) => p.dateStr === dateStr);
}

// ── Adhkar Sessions / Streaks / Journal ───────────────

export async function addAdhkarSession(
  session: Omit<AdhkarSession, 'id'>
): Promise<AdhkarSession> {
  const entry: AdhkarSession = { ...session, id: nextId() };
  state = { ...state, adhkarSessions: [...state.adhkarSessions, entry] };
  await persist();
  return entry;
}

export async function upsertAdhkarStreak(
  collectionId: string,
  dateStr: string
): Promise<void> {
  const existing = state.adhkarStreaks.find((s) => s.collectionId === collectionId);
  if (!existing) {
    state = {
      ...state,
      adhkarStreaks: [
        ...state.adhkarStreaks,
        {
          id: nextId(),
          collectionId,
          currentStreak: 1,
          longestStreak: 1,
          lastCompletedDate: dateStr,
        },
      ],
    };
  } else {
    const last = new Date(existing.lastCompletedDate);
    const today = new Date(dateStr);
    const daysDiff = Math.round(
      (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
    );
    let newCurrent = 1;
    if (daysDiff === 0) newCurrent = existing.currentStreak;
    else if (daysDiff === 1) newCurrent = existing.currentStreak + 1;

    state = {
      ...state,
      adhkarStreaks: state.adhkarStreaks.map((s) =>
        s.id === existing.id
          ? {
              ...s,
              currentStreak: newCurrent,
              longestStreak: Math.max(s.longestStreak, newCurrent),
              lastCompletedDate: dateStr,
            }
          : s
      ),
    };
  }
  await persist();
}

export function getAdhkarStreak(collectionId: string): AdhkarStreak | undefined {
  return state.adhkarStreaks.find((s) => s.collectionId === collectionId);
}

export function getAllAdhkarStreaks(): AdhkarStreak[] {
  return state.adhkarStreaks;
}

export async function addJournalEntry(
  entry: Omit<AdhkarJournal, 'id'>
): Promise<void> {
  state = {
    ...state,
    adhkarJournal: [...state.adhkarJournal, { ...entry, id: nextId() }],
  };
  await persist();
}

export function getAdhkarSessions(): AdhkarSession[] {
  return state.adhkarSessions;
}

export function getAdhkarJournal(): AdhkarJournal[] {
  return state.adhkarJournal;
}

export async function clearAllData(): Promise<void> {
  state = { ...EMPTY_DB, nextId: 1 };
  await persist();
}

export async function exportAllData(): Promise<string> {
  return JSON.stringify(state, null, 2);
}

export async function importAllData(json: string): Promise<void> {
  await importAndMergeData(json, 'replace');
}

export async function importAndMergeData(
  json: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Create a safety restore point backup
    await safeStorage.setItem('islamic-counter-db-backup', JSON.stringify(state));

    const imported = JSON.parse(json) as Partial<DatabaseState>;
    if (!imported || typeof imported !== 'object') {
      return { success: false, message: 'Invalid database backup JSON.' };
    }

    if (mode === 'replace') {
      state = { ...EMPTY_DB, ...imported, nextId: imported.nextId || nextId() };
      await persist();
      return { success: true, message: 'Database replaced successfully. Backup created.' };
    }

    // 2. Smart Merge Strategy
    const existingLogKeys = new Set(
      state.logs.map((l) => `${l.dateStr}_${l.timestamp}_${l.count}`)
    );
    const newLogs: Log[] = [];
    (imported.logs || []).forEach((l) => {
      const key = `${l.dateStr}_${l.timestamp}_${l.count}`;
      if (!existingLogKeys.has(key)) {
        newLogs.push({ ...l, id: nextId() });
        existingLogKeys.add(key);
      }
    });

    const existingTargetTitles = new Set(state.targets.map((t) => t.title.toLowerCase()));
    const newTargets: Target[] = [];
    (imported.targets || []).forEach((t) => {
      if (!existingTargetTitles.has(t.title.toLowerCase())) {
        newTargets.push({ ...t, id: nextId() });
        existingTargetTitles.add(t.title.toLowerCase());
      }
    });

    const existingAchievementIds = new Set(state.achievements.map((a) => a.achievementId));
    const newAchievements: UnlockedAchievement[] = [];
    (imported.achievements || []).forEach((a) => {
      if (!existingAchievementIds.has(a.achievementId)) {
        newAchievements.push({ ...a, id: nextId() });
        existingAchievementIds.add(a.achievementId);
      }
    });

    state = {
      ...state,
      logs: [...state.logs, ...newLogs],
      targets: [...state.targets, ...newTargets],
      achievements: [...state.achievements, ...newAchievements],
    };

    await persist();
    return {
      success: true,
      message: `Merged ${newLogs.length} new logs, ${newTargets.length} new targets, and ${newAchievements.length} achievements.`,
    };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Failed to import backup.' };
  }
}
