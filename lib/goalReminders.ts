import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { format } from 'date-fns';
import type { Target } from './types';
import { updateTarget } from './db';

const CHANNEL_ID = 'goal-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const existing = await Notifications.getNotificationChannelAsync(CHANNEL_ID);
  if (existing) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Goal reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export async function cancelGoalReminders(target: Target): Promise<void> {
  const ids = target.notificationIds ?? [];
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
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

  const allowed = await requestNotificationPermission();
  if (!allowed) return;

  const ids: string[] = [];
  const title = '🕌 Dhikr Goal';

  if (target.reminderType === 'recurring' && target.reminderTime) {
    const [hour, minute] = target.reminderTime.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return;

    if (target.frequency === 'daily') {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: `Your dhikr session "${target.title}" is due (${target.reminderTime})`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      ids.push(id);
    } else {
      const days = target.reminderDays?.length ? target.reminderDays : [];
      for (const day of days) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body: `Weekly dhikr session "${target.title}" is due today (${target.reminderTime})`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
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
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Goal Deadline',
          body: `Reminder: "${target.title}" is due today (${format(date, 'MMM d, HH:mm')})`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
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