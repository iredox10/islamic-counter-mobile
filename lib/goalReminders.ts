import { Platform } from 'react-native';
import { format } from 'date-fns';
import type { Target } from './types';
import { updateTarget } from './db';
import type * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'goal-reminders';

let module: typeof Notifications | null = null;
let loadFailed = false;

async function loadNotifications(): Promise<typeof Notifications | null> {
  if (module) return module;
  if (loadFailed) return null;
  if (Platform.OS === 'web') {
    loadFailed = true;
    return null;
  }
  try {
    const mod = await import('expo-notifications');
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    module = mod;
    return module;
  } catch (e) {
    // expo-notifications is not available in Expo Go on Android (SDK 53+).
    // Reminders degrade gracefully: data is stored, scheduling is skipped.
    loadFailed = true;
    console.warn('expo-notifications unavailable; goal reminders disabled.', e);
    return null;
  }
}

async function ensureChannel(n: typeof Notifications): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const existing = await n.getNotificationChannelAsync(CHANNEL_ID);
    if (existing) return;
    await n.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Goal reminders',
      importance: n.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  } catch {
    /* channel creation is best-effort */
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const n = await loadNotifications();
  if (!n) return false;
  await ensureChannel(n);
  const existing = await n.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await n.requestPermissionsAsync();
  return result.granted;
}

export async function cancelGoalReminders(target: Target): Promise<void> {
  const n = await loadNotifications();
  const ids = target.notificationIds ?? [];
  if (n) {
    for (const id of ids) {
      await n.cancelScheduledNotificationAsync(id).catch(() => {});
    }
  }
  if (ids.length > 0) {
    await updateTarget(target.id, { notificationIds: [] });
  }
}

function hasReminderConfig(target: Target): boolean {
  if (target.reminderType === 'recurring' && target.reminderTime) return true;
  if (target.reminderType === 'one-off' && target.deadline) return true;
  return false;
}

export async function scheduleGoalReminders(target: Target): Promise<void> {
  await cancelGoalReminders(target);

  if (!hasReminderConfig(target)) return;

  const n = await loadNotifications();
  if (!n) return;

  const allowed = await requestNotificationPermission();
  if (!allowed) return;

  const ids: string[] = [];
  const title = '🕌 Dhikr Goal';

  if (target.reminderType === 'recurring' && target.reminderTime) {
    const [hour, minute] = target.reminderTime.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return;

    if (target.frequency === 'daily') {
      const id = await n.scheduleNotificationAsync({
        content: {
          title,
          body: `Your dhikr session "${target.title}" is due (${target.reminderTime})`,
        },
        trigger: {
          type: n.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      ids.push(id);
    } else {
      const days = target.reminderDays?.length ? target.reminderDays : [];
      for (const day of days) {
        const id = await n.scheduleNotificationAsync({
          content: {
            title,
            body: `Weekly dhikr session "${target.title}" is due today (${target.reminderTime})`,
          },
          trigger: {
            type: n.SchedulableTriggerInputTypes.WEEKLY,
            weekday: (day % 7) + 1,
            hour,
            minute,
          },
        });
        ids.push(id);
      }
    }
  } else if (target.reminderType === 'one-off' && target.deadline) {
    const date = new Date(target.deadline);
    if (date.getTime() > Date.now()) {
      const id = await n.scheduleNotificationAsync({
        content: {
          title: '⏰ Goal Deadline',
          body: `Reminder: "${target.title}" is due today (${format(date, 'MMM d, HH:mm')})`,
        },
        trigger: {
          type: n.SchedulableTriggerInputTypes.DATE,
          date,
        },
      });
      ids.push(id);
    }
  }

  if (ids.length > 0) {
    await updateTarget(target.id, { notificationIds: ids });
  }
}