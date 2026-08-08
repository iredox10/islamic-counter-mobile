import React from 'react';
import {
  View,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import Text from '@/components/AppText';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Rect,
} from 'react-native-svg';
import { format } from 'date-fns';
import { gregorianToHijri } from '@/lib/hijri';
import type { ShareCardData } from '@/lib/share';
import { FONTS } from '@/lib/fonts';

const CARD_W = 800;
const CARD_H = 1000;

export const ShareCard = React.forwardRef<View, ShareCardProps>(
  ({ data, style }, ref) => {
    const hijriDate = gregorianToHijri(data.completedAt);
    const completionPercent = Math.round(
      (data.count / data.targetCount) * 100
    );

    return (
      <View ref={ref} collapsable={false} style={[styles.card, style]}>
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={CARD_W}
          height={CARD_H}
          viewBox={`0 0 ${CARD_W} ${CARD_H}`}
        >
          <Defs>
            <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#0f172a" />
              <Stop offset="100%" stopColor="#020617" />
            </LinearGradient>
            <LinearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#fbbf24" />
              <Stop offset="100%" stopColor="#d97706" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={CARD_W} height={CARD_H} fill="url(#bgGrad)" />
          <Circle cx={100} cy={100} r={200} fill="rgba(212,175,55,0.05)" />
          <Circle cx={700} cy={900} r={160} fill="rgba(212,175,55,0.03)" />
          <Rect
            x={20}
            y={20}
            width={CARD_W - 40}
            height={CARD_H - 40}
            rx={40}
            fill="none"
            stroke="rgba(212,175,55,0.2)"
            strokeWidth={4}
          />
          <Circle
            cx={400}
            cy={360}
            r={120}
            fill="rgba(212,175,55,0.1)"
            stroke="url(#goldGrad)"
            strokeWidth={6}
          />
        </Svg>

        <Text style={styles.arabic}>الْحَمْدُ لِلَّهِ</Text>
        <Text style={styles.english}>ALHAMDULILLAH</Text>

        <View style={styles.trophyWrap}>
          <Text style={{ fontSize: 80 }}>🏆</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {data.title}
        </Text>

        <Text style={styles.count}>{data.count.toLocaleString()}</Text>
        <Text style={styles.target}>
          of {data.targetCount.toLocaleString()} ({completionPercent}%)
        </Text>

        {(data.streak || data.totalLifetime) && (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statIcon}>🔥</Text>
              <Text style={styles.statLabel}>{data.streak} day streak</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.stat}>
              <Text style={styles.statIcon}>✨</Text>
              <Text style={styles.statLabel}>
                {data.totalLifetime?.toLocaleString()} total
              </Text>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.date}>
          {format(data.completedAt, 'MMMM d, yyyy')} • {hijriDate.formatted}
        </Text>
        <Text style={styles.brand}>Tasbih PWA</Text>
      </View>
    );
  }
);

export interface ShareCardProps {
  data: ShareCardData;
  style?: StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    alignItems: 'center',
    overflow: 'hidden',
  },
  arabic: {
    marginTop: 96,
    fontSize: 44,
    letterSpacing: 4,
    color: '#d4af37',
    fontFamily: FONTS.serif,
  },
  english: {
    marginTop: 12,
    fontSize: 24,
    letterSpacing: 8,
    color: '#94a3b8',
    fontFamily: FONTS.sans,
    fontWeight: '600',
  },
  trophyWrap: {
    marginTop: 56,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 6,
    borderColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  title: {
    marginTop: 60,
    fontSize: 42,
    color: '#f8fafc',
    fontFamily: FONTS.serif,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 60,
  },
  count: {
    marginTop: 48,
    fontSize: 96,
    color: '#fbbf24',
    fontFamily: FONTS.serif,
    fontWeight: '700',
    letterSpacing: -2,
  },
  target: {
    marginTop: 10,
    fontSize: 28,
    color: '#64748b',
    fontFamily: FONTS.sans,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 80,
    alignSelf: 'stretch',
  },
  stat: {
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 30,
  },
  statLabel: {
    marginTop: 8,
    fontSize: 22,
    color: '#94a3b8',
    fontFamily: FONTS.sans,
  },
  divider: {
    marginTop: 60,
    width: 600,
    height: 2,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  date: {
    marginTop: 32,
    fontSize: 20,
    color: '#64748b',
    fontFamily: FONTS.sans,
  },
  brand: {
    position: 'absolute',
    right: 48,
    bottom: 36,
    fontSize: 18,
    color: '#475569',
    fontFamily: FONTS.sans,
  },
});