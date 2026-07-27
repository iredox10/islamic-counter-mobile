import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore = new Map<string, string>();

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val !== null) return val;
    } catch (e: any) {
      console.warn(`[SafeStorage] AsyncStorage.getItem failed for "${key}":`, e?.message || e);
    }

    if (isLocalStorageAvailable()) {
      try {
        return window.localStorage.getItem(key);
      } catch {}
    }

    return memoryStore.get(key) ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    memoryStore.set(key, value);

    if (isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
    }

    try {
      await AsyncStorage.setItem(key, value);
    } catch (e: any) {
      console.warn(`[SafeStorage] AsyncStorage.setItem failed for "${key}":`, e?.message || e);
    }
  },

  async removeItem(key: string): Promise<void> {
    memoryStore.delete(key);

    if (isLocalStorageAvailable()) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }

    try {
      await AsyncStorage.removeItem(key);
    } catch (e: any) {
      console.warn(`[SafeStorage] AsyncStorage.removeItem failed for "${key}":`, e?.message || e);
    }
  },

  async clear(): Promise<void> {
    memoryStore.clear();

    if (isLocalStorageAvailable()) {
      try {
        window.localStorage.clear();
      } catch {}
    }

    try {
      await AsyncStorage.clear();
    } catch (e: any) {
      console.warn('[SafeStorage] AsyncStorage.clear failed:', e?.message || e);
    }
  },
};

export default safeStorage;
