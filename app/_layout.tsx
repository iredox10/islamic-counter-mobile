import { useEffect } from 'react';
import { Stack } from 'expo-router';
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

  useEffect(() => {
    if (dbReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [dbReady, fontsLoaded]);

  if (!dbReady || !fontsLoaded) return null;

  return (
    <ThemeProvider>
      <RootNav />
    </ThemeProvider>
  );
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
