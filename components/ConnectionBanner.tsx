import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff, Cloud } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

export function ConnectionBanner() {
  const { colors } = useTheme();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      setIsOffline(!navigator.onLine);
    }

    return () => {
      if (typeof window.removeEventListener === 'function') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { backgroundColor: '#7f1d1d', borderColor: '#ef4444' }]}>
      <WifiOff size={14} color="#fca5a5" />
      <Text style={styles.text}>
        Working Offline · All dhikr logs, streaks & stats saved locally
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  text: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
});
