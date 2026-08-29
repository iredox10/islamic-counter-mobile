import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { useDatabaseReady } from '@/hooks/useDatabase';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const FONT_MAP = {
  Cinzel: require('../assets/fonts/Cinzel-Regular.ttf'),
  'Cinzel-SemiBold': require('../assets/fonts/Cinzel-SemiBold.ttf'),
  'Cinzel-Bold': require('../assets/fonts/Cinzel-Bold.ttf'),
  Lato: require('../assets/fonts/Lato-Regular.ttf'),
  LatoBold: require('../assets/fonts/Lato-Bold.ttf'),
} as const;

type FontName = keyof typeof FONT_MAP;

export function useAppFonts() {
  return useFonts(FONT_MAP);
}

export default function RootLayout() {
  const dbReady = useDatabaseReady();
  const [fontsLoaded] = useAppFonts();
  const responseSub = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (dbReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [dbReady, fontsLoaded]);

  useEffect(() => {
    if (!dbReady) return;
    if (Platform.OS === 'web') return;
    if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
      console.warn(
        'expo-notifications is not supported in Expo Go on Android (SDK 53+). Run a development build to enable local notifications.'
      );
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');

        if (typeof Notifications.setNotificationHandler !== 'function') {
          console.warn('expo-notifications module is not fully available; skipping setup.');
          return;
        }

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const lastResponse = await Notifications.getLastNotificationResponse();
        if (lastResponse && !cancelled) {
          handleNotificationNavigation(lastResponse.notification.request.content.data);
        }

        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
          handleNotificationNavigation(response.notification.request.content.data);
        });
        if (cancelled) {
          sub.remove();
          return;
        }
        responseSub.current = sub;

        const [{ getTargets }, { scheduleGoalReminders }, { syncRemindersSchedule }] =
          await Promise.all([
            import('@/lib/db'),
            import('@/lib/goalReminders'),
            import('@/lib/pushNotifications'),
          ]);

        for (const t of getTargets()) {
          if (t.status === 'active') {
            await scheduleGoalReminders(t).catch((e) =>
              console.warn('reschedule goal failed', t.id, e)
            );
          }
        }
        await syncRemindersSchedule().catch((e) =>
          console.warn('reschedule daily reminders failed', e)
        );
      } catch (e) {
        console.warn('Notification setup failed', e);
      }
    })();

    return () => {
      cancelled = true;
      responseSub.current?.remove();
      responseSub.current = null;
    };
  }, [dbReady]);

  if (!dbReady || !fontsLoaded) return null;

  return (
    <ThemeProvider>
      <RootNav />
    </ThemeProvider>
  );
}

function handleNotificationNavigation(data: unknown) {
  if (!data || typeof data !== 'object') return;
  const d = data as { type?: string; targetId?: number; reminderId?: string };
  if (d.type === 'goal' && typeof d.targetId === 'number') {
    router.push('/(tabs)/targets');
  } else if (d.type === 'daily') {
    router.push('/(tabs)/settings');
  }
}

function RootNav() {
  const { resolvedTheme, colors } = useTheme();

  return (
    <>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="history"
          options={{
            presentation: 'card',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}
