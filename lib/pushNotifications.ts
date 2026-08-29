import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getStoredReminders, saveReminders, type DailyReminder } from './reminders';
import { playCompletionSound, getSelectedSound } from './sounds';
import type * as Notifications from 'expo-notifications';

const DAILY_CHANNEL_ID = 'daily-reminders';

let module: typeof Notifications | null = null;
let loadFailed = false;

function isExpoGoOnAndroid(): boolean {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

async function loadNotifications(): Promise<typeof Notifications | null> {
  if (module) return module;
  if (loadFailed) return null;
  if (Platform.OS === 'web' || isExpoGoOnAndroid()) {
    loadFailed = true;
    return null;
  }
  try {
    const mod = await import('expo-notifications');
    if (typeof mod.scheduleNotificationAsync !== 'function') {
      loadFailed = true;
      return null;
    }
    module = mod;
    return module;
  } catch (e) {
    loadFailed = true;
    console.warn('expo-notifications unavailable; daily reminders disabled.', e);
    return null;
  }
}

async function ensureDailyChannel(n: typeof Notifications): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const existing = await n.getNotificationChannelAsync(DAILY_CHANNEL_ID);
    if (existing) return;
    await n.setNotificationChannelAsync(DAILY_CHANNEL_ID, {
      name: 'Daily Adhkar Reminders',
      importance: n.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  } catch {
    /* best-effort */
  }
}

export interface NotificationStatus {
  granted: boolean;
  canRequest: boolean;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (window.Notification.permission === 'granted') return true;
      if (window.Notification.permission === 'denied') return false;
      const permission = await window.Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }
  const n = await loadNotifications();
  if (!n) return false;
  await ensureDailyChannel(n);
  const existing = await n.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await n.requestPermissionsAsync();
  return result.granted;
}

export async function cancelLocalReminder(reminder: DailyReminder): Promise<void> {
  if (!reminder.notificationId) return;
  const n = await loadNotifications();
  if (n) {
    await n.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => {});
  }
  const stored = await getStoredReminders();
  const updated = stored.map((r) =>
    r.id === reminder.id ? { ...r, notificationId: undefined } : r
  );
  await saveReminders(updated);
}

export async function scheduleLocalReminder(reminder: DailyReminder): Promise<void> {
  if (!reminder.enabled) return;

  await cancelLocalReminder(reminder);

  const [hours, minutes] = reminder.time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission !== 'granted') return;
    const now = new Date();
    const scheduledDate = new Date();
    scheduledDate.setHours(hours, minutes, 0, 0);
    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }
    const delayMs = Math.min(scheduledDate.getTime() - now.getTime(), 2147483647);
    setTimeout(() => {
      new window.Notification(`🕌 ${reminder.name}`, { body: reminder.message });
      getSelectedSound().then((s) => playCompletionSound(s));
    }, delayMs);
    return;
  }

  const n = await loadNotifications();
  if (!n) return;
  await ensureDailyChannel(n);

  const id = await n.scheduleNotificationAsync({
    content: {
      title: `🕌 ${reminder.name}`,
      body: reminder.message,
      data: { type: 'daily', reminderId: reminder.id },
      ...(Platform.OS === 'android' ? { channelId: DAILY_CHANNEL_ID } : {}),
    },
    trigger: {
      type: n.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    },
  });

  const stored = await getStoredReminders();
  const updated = stored.map((r) =>
    r.id === reminder.id ? { ...r, notificationId: id } : r
  );
  await saveReminders(updated);
}

export async function triggerImmediateReminder(reminderName: string, message: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
    if (window.Notification.permission === 'granted') {
      new window.Notification(`🕌 ${reminderName}`, { body: message });
    }
  }
  await playCompletionSound('chime');
}

export async function syncRemindersSchedule(): Promise<void> {
  const reminders = await getStoredReminders();
  for (const r of reminders) {
    if (r.enabled) {
      await scheduleLocalReminder(r);
    } else if (r.notificationId) {
      await cancelLocalReminder(r);
    }
  }
}

export async function getScheduledReminderCount(): Promise<number> {
  const n = await loadNotifications();
  if (!n) return 0;
  try {
    const all = await n.getAllScheduledNotificationsAsync();
    return all.length;
  } catch {
    return 0;
  }
}
