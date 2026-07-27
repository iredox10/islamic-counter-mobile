export interface Log {
  id: number;
  count: number;
  targetId?: number;
  timestamp: string;
  dateStr: string;
}

export interface Target {
  id: number;
  title: string;
  targetCount: number;
  currentCount: number;
  deadline?: string;
  startTime?: string;
  reminderType?: 'one-off' | 'recurring';
  reminderGap?: number;
  frequency?: 'daily' | 'weekly';
  reminderTime?: string;
  reminderDays?: number[];
  lastNotified?: string;
  createdAt: string;
  status: 'active' | 'completed' | 'archived';
}

export interface Duration {
  id: number;
  dateStr: string;
  targetId?: number;
  seconds: number;
}

export interface CollectionProgress {
  id: number;
  collectionId: string;
  itemIndex: number;
  currentCount: number;
  dateStr: string;
}

export interface UnlockedAchievement {
  id: number;
  achievementId: string;
  unlockedAt: string;
}

export interface PrayerCompletion {
  id: number;
  prayer: string;
  dateStr: string;
  completedAt: string;
  totalAdhkar: number;
  completedAdhkar: number;
}

export interface AdhkarSession {
  id: number;
  collectionId: string;
  collectionName: string;
  dateStr: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  totalItems: number;
  completedItems: number;
  totalCounts: number;
}

export interface AdhkarStreak {
  id: number;
  collectionId: string;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string;
}

export interface AdhkarJournal {
  id: number;
  dateStr: string;
  collectionId: string;
  collectionName: string;
  dhikrName: string;
  dhikrArabic?: string;
  count: number;
  target: number;
  completedAt: string;
  notes?: string;
}

export interface DatabaseState {
  logs: Log[];
  targets: Target[];
  durations: Duration[];
  collectionProgress: CollectionProgress[];
  achievements: UnlockedAchievement[];
  prayerCompletions: PrayerCompletion[];
  adhkarSessions: AdhkarSession[];
  adhkarStreaks: AdhkarStreak[];
  adhkarJournal: AdhkarJournal[];
  nextId: number;
}

export const EMPTY_DB: DatabaseState = {
  logs: [],
  targets: [],
  durations: [],
  collectionProgress: [],
  achievements: [],
  prayerCompletions: [],
  adhkarSessions: [],
  adhkarStreaks: [],
  adhkarJournal: [],
  nextId: 1,
};
