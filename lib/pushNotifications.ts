import { Alert, Platform } from 'react-native';
import { getStoredReminders, saveReminders, type DailyReminder } from './reminders';
import { playCompletionSound, getSelectedSound } from './sounds';

export interface NotificationStatus {
  granted: boolean;
  canRequest: boolean;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await window.Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }
  return true;
}

export async function scheduleLocalReminder(reminder: DailyReminder): Promise<void> {
  if (!reminder.enabled) return;

  const [hours, minutes] = reminder.time.split(':').map(Number);
  const now = new Date();
  const scheduledDate = new Date();
  scheduledDate.setHours(hours, minutes, 0, 0);

  if (scheduledDate <= now) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }

  const delayMs = scheduledDate.getTime() - now.getTime();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission === 'granted') {
      setTimeout(() => {
        new window.Notification(`🕌 ${reminder.name}`, {
          body: reminder.message,
        });
        getSelectedSound().then((s) => playCompletionSound(s));
      }, Math.min(delayMs, 2147483647));
    }
  }
}

export async function triggerImmediateReminder(reminderName: string, message: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission === 'granted') {
      new window.Notification(`🕌 ${reminderName}`, { body: message });
    }
  }
  playCompletionSound('chime');
}

export async function syncRemindersSchedule(): Promise<void> {
  const reminders = await getStoredReminders();
  for (const r of reminders) {
    if (r.enabled) {
      await scheduleLocalReminder(r);
    }
  }
}
