import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';
import safeStorage from '@/lib/storage';
import { darkTheme, lightTheme, type AppTheme } from '@/lib/theme';

export type ThemePreference = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: ThemePreference;
  resolvedTheme: 'dark' | 'light';
  colors: AppTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const STORAGE_KEY = 'theme-preference';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useSystemScheme();
  const [theme, setThemeState] = useState<ThemePreference>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    safeStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setThemeState(stored);
      }
      setReady(true);
    }).catch(() => {
      setReady(true);
    });
  }, []);

  const setTheme = (value: ThemePreference) => {
    setThemeState(value);
    safeStorage.setItem(STORAGE_KEY, value);
  };

  const resolvedTheme: 'dark' | 'light' =
    theme === 'system' ? (system === 'light' ? 'light' : 'dark') : theme;

  const colors = resolvedTheme === 'light' ? lightTheme : darkTheme;

  const value = useMemo(
    () => ({ theme, resolvedTheme, colors, setTheme }),
    [theme, resolvedTheme, colors]
  );

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
