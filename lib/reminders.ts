import safeStorage from './storage';

export interface DailyReminder {
  id: string;
  name: string;
  time: string;
  enabled: boolean;
  isSalahTime: boolean;
  message: string;
}

export const DEFAULT_REMINDERS: DailyReminder[] = [
  {
    id: 'fajr',
    name: 'Fajr',
    time: '05:30',
    enabled: false,
    isSalahTime: true,
    message: 'Start your day with dhikr after Fajr',
  },
  {
    id: 'dhuhr',
    name: 'Dhuhr',
    time: '12:30',
    enabled: false,
    isSalahTime: true,
    message: 'Remember Allah after Dhuhr prayer',
  },
  {
    id: 'asr',
    name: 'Asr',
    time: '15:30',
    enabled: false,
    isSalahTime: true,
    message: 'Time for evening adhkar after Asr',
  },
  {
    id: 'maghrib',
    name: 'Maghrib',
    time: '18:30',
    enabled: false,
    isSalahTime: true,
    message: 'Evening adhkar time after Maghrib',
  },
  {
    id: 'isha',
    name: 'Isha',
    time: '20:00',
    enabled: false,
    isSalahTime: true,
    message: 'Night dhikr before sleep',
  },
  {
    id: 'morning',
    name: 'Morning Adhkar',
    time: '06:00',
    enabled: false,
    isSalahTime: false,
    message: "Don't forget your morning adhkar",
  },
  {
    id: 'evening',
    name: 'Evening Adhkar',
    time: '17:00',
    enabled: false,
    isSalahTime: false,
    message: 'Time for evening adhkar',
  },
  {
    id: 'fasting_sunnah',
    name: 'Voluntary Fasting (Mondays/Thursdays & White Days)',
    time: '04:30',
    enabled: false,
    isSalahTime: false,
    message: 'Suhoor reminder for Sunnah voluntary fast today',
  },
];

const STORAGE_KEY = 'daily-reminders';

export async function getStoredReminders(): Promise<DailyReminder[]> {
  try {
    const stored = await safeStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* fall through */
  }
  return [...DEFAULT_REMINDERS];
}

export async function saveReminders(reminders: DailyReminder[]): Promise<void> {
  await safeStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function updateReminder(
  reminders: DailyReminder[],
  id: string,
  patch: Partial<DailyReminder>
): DailyReminder[] {
  return reminders.map((r) => (r.id === id ? { ...r, ...patch } : r));
}
