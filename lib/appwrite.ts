import { getLogs, getTargets, getUnlockedAchievements } from './db';
import { type Log, type Target } from './types';

export const DATABASE_ID = 'tasbih';
export const SUBSCRIPTIONS_COLLECTION = 'push_subscriptions';
export const NOTIFICATION_LOGS_COLLECTION = 'notification_logs';
export const ANALYTICS_SESSIONS_COLLECTION = 'analytics_sessions';
export const ANALYTICS_EVENTS_COLLECTION = 'analytics_events';
export const USER_SYNC_COLLECTION = 'user_sync_data';

export const APPWRITE_CONFIG = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || '',
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '',
  functionId: process.env.EXPO_PUBLIC_APPWRITE_PUSH_FUNCTION_ID || '',
};

export function isAppwriteConfigured(): boolean {
  return !!APPWRITE_CONFIG.endpoint && !!APPWRITE_CONFIG.projectId;
}

export interface CloudBackupData {
  logs: Log[];
  targets: Target[];
  unlockedAchievements: string[];
  syncedAt: string;
}

export async function syncLocalDataToCloud(userId: string): Promise<boolean> {
  if (!isAppwriteConfigured()) return false;

  try {
    const logs = await getLogs();
    const targets = await getTargets();
    const achievements = await getUnlockedAchievements();
    const achievementIds = achievements.map((a) => a.achievementId);

    const payload: CloudBackupData = {
      logs,
      targets,
      unlockedAchievements: achievementIds,
      syncedAt: new Date().toISOString(),
    };

    const response = await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${DATABASE_ID}/collections/${USER_SYNC_COLLECTION}/documents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
        },
        body: JSON.stringify({
          documentId: userId || 'default-device-user',
          data: JSON.stringify(payload),
        }),
      }
    );

    return response.ok;
  } catch (e) {
    console.error('Failed to sync data to Appwrite cloud:', e);
    return false;
  }
}

export async function fetchCloudBackup(userId: string): Promise<CloudBackupData | null> {
  if (!isAppwriteConfigured()) return null;

  try {
    const response = await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${DATABASE_ID}/collections/${USER_SYNC_COLLECTION}/documents/${userId || 'default-device-user'}`,
      {
        method: 'GET',
        headers: {
          'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
        },
      }
    );

    if (!response.ok) return null;
    const doc = await response.json();
    return JSON.parse(doc.data) as CloudBackupData;
  } catch (e) {
    console.error('Failed to fetch cloud backup:', e);
    return null;
  }
}
