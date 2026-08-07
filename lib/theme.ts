export const palette = {
  gold: {
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
  },
  midnight: {
    900: '#0f172a',
    950: '#020617',
  },
  slate: {
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  emerald: {
    400: '#34d399',
    500: '#10b981',
  },
  rose: {
    400: '#fb7185',
  },
  amber: {
    400: '#fbbf24',
  },
  indigo: {
    400: '#818cf8',
  },
  purple: {
    400: '#c084fc',
  },
};

export type AppTheme = {
  background: string;
  backgroundSecondary: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  gold: string;
  goldMuted: string;
  tint: string;
  tabBar: string;
  tabBarBorder: string;
  success: string;
  danger: string;
  inputBg: string;
  overlay: string;
};

export const darkTheme: AppTheme = {
  background: palette.midnight[950],
  backgroundSecondary: palette.midnight[900],
  card: 'rgba(15, 23, 42, 0.85)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  text: palette.slate[100],
  textSecondary: palette.slate[400],
  textMuted: palette.slate[500],
  gold: palette.gold[400],
  goldMuted: 'rgba(245, 158, 11, 0.20)', // web gold-500/20
  tint: palette.gold[400],
  tabBar: 'rgba(15, 23, 42, 0.95)',
  tabBarBorder: 'rgba(255, 255, 255, 0.08)',
  success: palette.emerald[400],
  danger: palette.rose[400],
  inputBg: 'rgba(30, 41, 59, 0.8)',
  overlay: 'rgba(2, 6, 23, 0.85)',
};

export const lightTheme: AppTheme = {
  background: '#f8fafc',
  backgroundSecondary: '#f1f5f9',
  card: '#ffffff',
  cardBorder: 'rgba(15, 23, 42, 0.08)',
  text: palette.slate[900],
  textSecondary: palette.slate[600],
  textMuted: palette.slate[500],
  gold: palette.gold[600],
  goldMuted: 'rgba(217, 119, 6, 0.16)',
  tint: palette.gold[600],
  tabBar: '#ffffff',
  tabBarBorder: 'rgba(15, 23, 42, 0.08)',
  success: palette.emerald[500],
  danger: '#e11d48',
  inputBg: '#f1f5f9',
  overlay: 'rgba(248, 250, 252, 0.9)',
};
