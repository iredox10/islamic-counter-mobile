import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text as RNNativeText,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Flame,
  Layers,
  Check,
  Circle,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { format } from 'date-fns';

import { useTheme } from '@/context/ThemeContext';
import { Screen, Card, Title, Subtitle } from '@/components/ui';
import { useLogs, useTargets, usePrayerCompletionsToday } from '@/hooks/useDatabase';
import { useBooleanSetting, useJsonSetting, KEYS } from '@/hooks/useSettings';
import {
  addLog,
  updateTarget,
  incrementDuration,
  addPrayerCompletion,
  unlockAchievement,
  getUnlockedAchievements,
} from '@/lib/db';
import { calculateStreak, todayStr } from '@/lib/utils';
import {
  gregorianToHijri,
  getSpecialDay,
  getUpcomingSpecialDays,
  isVoluntaryFastDay,
} from '@/lib/hijri';
import {
  PRAYERS,
  getPrayerAdhkar,
  type PrayerName,
  type AdhkarItem,
} from '@/lib/adhkar';
import { checkAchievements, type Achievement } from '@/lib/achievements';
import { getTarget } from '@/lib/db';
import { playTapSound, playCompletionSound, getSelectedSound } from '@/lib/sounds';
import { cancelGoalReminders, cancelLateReminder, scheduleGoalReminders } from '@/lib/goalReminders';
import { useAchievementTracker } from '@/lib/useAchievementTracker';
import { shareProgress } from '@/lib/share';
import { AchievementToast } from '@/components/AchievementToast';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { FONTS } from '@/lib/fonts';

const MULTI_PRESET = [
  { name: 'SubhanAllah', arabic: 'سُبْحَانَ اللَّهِ', target: 33 },
  { name: 'Alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', target: 33 },
  { name: 'Allahu Akbar', arabic: 'اللَّهُ أَكْبَرُ', target: 33 },
];

function Text({ style, ...props }: React.ComponentProps<typeof RNNativeText>) {
  return (
    <RNNativeText {...props} style={[{ fontFamily: FONTS.sans }, style]} />
  );
}

const RING_SIZE = 320; // outer svg viewport: button 288px + ring drawn around
const RING_RADIUS = 48; // web: viewBox 0 0 100 100, circle r=48 (relative to 100)
const RING_VIEWBOX = 100; // matches web's w-72 button scaled to the same viewBox
const RING_STROKE = 2; // web iris thin 2px hairline ring
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const BUTTON_SIZE = 288; // web: w-72 h-72 rounded-full button
const WEB_GOLD = '#fbbf24'; // web gold-400 (counter number, active states)
const WEB_GOLD_500 = '#f59e0b'; // web gold-500 (progress ring)
const WEB_GOLD_GLOW = 'rgba(245,158,11,0.5)'; // web shadow glow on progress ring
const WEB_SLATE_800 = '#1e293b'; // web midnight-800 (button top gradient)
const WEB_SLATE_950 = '#020617'; // web midnight-950 (button bottom gradient)
const WEB_SLATE_700 = '#334155'; // web slate-700 (hairline line)
const WEB_SLATE_400 = '#94a3b8'; // web slate-400
const WEB_SLATE_500 = '#64748b'; // web slate-500
const WEB_SLATE_300 = '#cbd5e1'; // web slate-300
const WEB_EMERALD_400 = '#34d399'; // web emerald-400
const WEB_WHITE_5 = 'rgba(255,255,255,0.05)'; // web border-white/5

export default function CounterScreen() {
  const { colors } = useTheme();
  const dateStr = todayStr();
  const logs = useLogs();
  const targets = useTargets();
  const prayerCompletions = usePrayerCompletionsToday(dateStr);

  const [sessionCount, setSessionCount] = useJsonSetting(KEYS.counterState, {
    count: 0,
    targetId: null as number | null,
  });
  const [soundEnabled, setSoundEnabled] = useBooleanSetting(KEYS.sound, false);
  const [showAdhkarList, setShowAdhkarList] = useBooleanSetting(KEYS.showAdhkarList, true);
  const [multiMode, setMultiMode] = useBooleanSetting(KEYS.multiMode, false);
  const [multiCounts, setMultiCounts] = useJsonSetting(KEYS.multiCounter, [0, 0, 0]);
  const [autoReset] = useBooleanSetting(KEYS.autoReset, false);

  const [activeCounterIndex, setActiveCounterIndex] = useState(0);
  const [prayerMode, setPrayerMode] = useState<PrayerName | null>(null);
  const [showPrayerSelector, setShowPrayerSelector] = useState(false);
  const [prayerAdhkar, setPrayerAdhkar] = useState<AdhkarItem[]>([]);
  const [prayerCounts, setPrayerCounts] = useState<number[]>([]);
  const [activeAdhkarIndex, setActiveAdhkarIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [toastAchievement, setToastAchievement] = useState<Achievement | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCount, setManualCount] = useState('');
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const count = sessionCount.count;
  const activeTargetId = sessionCount.targetId;
  const activeTarget = activeTargetId
    ? targets.find((t) => t.id === activeTargetId)
    : undefined;

  // Midnight auto-reset
  useEffect(() => {
    if (!autoReset) return;
    (async () => {
      const { default: safeStorage } = await import('@/lib/storage');
      const last = await safeStorage.getItem('last-counter-date');
      if (last && last !== dateStr) {
        setSessionCount({ count: 0, targetId: null });
      }
      await safeStorage.setItem('last-counter-date', dateStr);
    })();
  }, [autoReset, dateStr, setSessionCount]);

  // Prayer mode setup
  useEffect(() => {
    if (prayerMode) {
      const items = getPrayerAdhkar(prayerMode);
      setPrayerAdhkar(items);
      setPrayerCounts(items.map(() => 0));
      setActiveAdhkarIndex(0);
    } else {
      setPrayerAdhkar([]);
      setPrayerCounts([]);
    }
  }, [prayerMode]);

  // Duration timer while counting
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      incrementDuration(dateStr, activeTargetId ?? 0, 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, dateStr, activeTargetId]);

  const todayTotal = useMemo(
    () => logs.filter((l) => l.dateStr === dateStr).reduce((a, l) => a + l.count, 0),
    [logs, dateStr]
  );
  const totalCount = useMemo(() => logs.reduce((a, l) => a + l.count, 0), [logs]);
  const uniqueDates = useMemo(() => [...new Set(logs.map((l) => l.dateStr))], [logs]);
  const { currentStreak } = calculateStreak(uniqueDates);
  const completedGoals = targets.filter((t) => t.status === 'completed').length;

  useAchievementTracker(totalCount, currentStreak, completedGoals, sessionCount.count);

  const hijri = gregorianToHijri(new Date());
  const specialDay = getSpecialDay(hijri);
  const upcomingDays = getUpcomingSpecialDays(hijri, 1);

  const displayCount = prayerMode
    ? prayerCounts[activeAdhkarIndex] ?? 0
    : multiMode
      ? multiCounts[activeCounterIndex]
      : count;

  const displayTarget = prayerMode && prayerAdhkar[activeAdhkarIndex]
    ? prayerAdhkar[activeAdhkarIndex].target
    : multiMode
      ? MULTI_PRESET[activeCounterIndex].target
      : activeTarget
        ? activeTarget.targetCount
        : 33;

  const progress =
    prayerMode && prayerAdhkar.length > 0
      ? Math.min(100, ((prayerCounts[activeAdhkarIndex] || 0) / prayerAdhkar[activeAdhkarIndex].target) * 100)
      : multiMode
        ? Math.min(100, (multiCounts[activeCounterIndex] / MULTI_PRESET[activeCounterIndex].target) * 100)
        : activeTarget
          ? Math.min(100, (activeTarget.currentCount / activeTarget.targetCount) * 100)
          : ((count % 33) / 33) * 100;

  const displayLabel = prayerMode && prayerAdhkar[activeAdhkarIndex]
    ? prayerAdhkar[activeAdhkarIndex].title
    : multiMode
      ? MULTI_PRESET[activeCounterIndex].name
      : activeTarget?.title ?? 'Tasbih';

  const displayArabic = prayerMode && prayerAdhkar[activeAdhkarIndex]
    ? prayerAdhkar[activeAdhkarIndex].arabic
    : multiMode
      ? MULTI_PRESET[activeCounterIndex].arabic
      : undefined;

  const checkAndUnlock = useCallback(
    async (session: number) => {
      const unlocked = getUnlockedAchievements().map((a) => a.achievementId);
      const hour = new Date().getHours();
      const newly = checkAchievements(
        totalCount + 1,
        currentStreak,
        completedGoals,
        session,
        {
          isFajr: hour >= 4 && hour < 7,
          isAfterIsha: hour >= 20 || hour < 4,
          isFriday: new Date().getDay() === 5,
          isRamadan: hijri.month === 9,
          isEid: specialDay?.name.includes('Eid') ?? false,
        },
        unlocked
      );
      for (const a of newly) {
        await unlockAchievement(a.id);
        setToastAchievement(a);
      }
    },
    [totalCount, currentStreak, completedGoals, hijri.month, specialDay]
  );

  const hapticForCount = async (n: number) => {
    if (soundEnabled) {
      if (n === 33 || n === 100 || n === 1000) {
        playCompletionSound(await getSelectedSound());
      } else {
        playTapSound();
      }
    }
    if (n === 33 || n === 100 || n === 1000) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleTap = async () => {
    setRipple(true);
    setTimeout(() => setRipple(false), 300);
    if (!isActive) setIsActive(true);
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => setIsActive(false), 60000);

    if (prayerMode && prayerAdhkar.length > 0) {
      const newCounts = [...prayerCounts];
      newCounts[activeAdhkarIndex] = (newCounts[activeAdhkarIndex] || 0) + 1;
      setPrayerCounts(newCounts);
      await hapticForCount(newCounts[activeAdhkarIndex]);

      const target = prayerAdhkar[activeAdhkarIndex].target;
      if (newCounts[activeAdhkarIndex] >= target && activeAdhkarIndex < prayerAdhkar.length - 1) {
        setActiveAdhkarIndex((i) => i + 1);
      }

      const allDone = newCounts.every((c, i) => c >= prayerAdhkar[i].target);
      const wasIncomplete = prayerCounts.some((c, i) => c < prayerAdhkar[i].target);
      if (allDone && wasIncomplete) {
        await addPrayerCompletion({
          prayer: prayerMode,
          dateStr,
          completedAt: new Date().toISOString(),
          totalAdhkar: prayerAdhkar.length,
          completedAdhkar: prayerAdhkar.length,
        });
        setShowCompletion(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      return;
    }

    if (multiMode) {
      const next = [...multiCounts];
      next[activeCounterIndex] = next[activeCounterIndex] + 1;
      setMultiCounts(next);
      await hapticForCount(next[activeCounterIndex]);
      if (
        next[activeCounterIndex] >= MULTI_PRESET[activeCounterIndex].target &&
        activeCounterIndex < MULTI_PRESET.length - 1
      ) {
        setActiveCounterIndex((i) => i + 1);
      }
      await addLog({
        count: 1,
        timestamp: new Date().toISOString(),
        dateStr,
      });
      return;
    }

    const newCount = count + 1;
    setSessionCount({ count: newCount, targetId: activeTargetId });
    await hapticForCount(newCount);
    await addLog({
      count: 1,
      timestamp: new Date().toISOString(),
      dateStr,
      targetId: activeTargetId ?? undefined,
    });

    if (activeTargetId) {
      const t = getTarget(activeTargetId);
      if (t) {
        const nextCurrent = t.currentCount + 1;
        const patch: Partial<typeof t> = { currentCount: nextCurrent };
        if (nextCurrent >= t.targetCount) {
          patch.status = 'completed';
          await cancelGoalReminders(t).catch((e) =>
            console.warn('cancelGoalReminders failed', e)
          );
        } else if (t.currentCount === 0 && t.lateReminderId) {
          await cancelLateReminder(t).catch((e) =>
            console.warn('cancelLateReminder failed', e)
          );
        }
        await updateTarget(activeTargetId, patch);
      }
    }

    await checkAndUnlock(newCount);
  };

  const handleReset = () => {
    Alert.alert('Reset counter?', 'Session and goal progress will be reset to 0.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setSessionCount({ count: 0, targetId: activeTargetId });
          setMultiCounts([0, 0, 0]);
          setActiveCounterIndex(0);
          if (activeTargetId) {
            const t = getTarget(activeTargetId);
            await updateTarget(activeTargetId, {
              currentCount: 0,
              ...(t && t.status === 'completed' ? { status: 'active' } : {}),
            });
            if (t) {
              await cancelGoalReminders(t).catch((e) =>
                console.warn('cancelGoalReminders failed', e)
              );
              await scheduleGoalReminders({ ...t, currentCount: 0, status: 'active' as const }).catch(
                (e) => console.warn('scheduleGoalReminders failed', e)
              );
            }
          }
          if (prayerMode) {
            setPrayerCounts(prayerAdhkar.map(() => 0));
            setActiveAdhkarIndex(0);
          }
        },
      },
    ]);
  };

  const handleSelectPrayer = (prayer: PrayerName) => {
    setPrayerMode(prayer === prayerMode ? null : prayer);
    setMultiMode(false);
    setShowPrayerSelector(false);
  };

  const handleManualSubmit = async () => {
    const value = parseInt(manualCount, 10);
    if (isNaN(value) || value <= 0) return;

    if (multiMode) {
      const next = [...multiCounts];
      next[activeCounterIndex] += value;
      setMultiCounts(next);
    } else {
      setSessionCount({ count: count + value, targetId: activeTargetId });
    }

    await addLog({
      count: value,
      timestamp: new Date().toISOString(),
      dateStr,
      targetId: activeTargetId ?? undefined,
    });

    if (activeTargetId) {
      const t = getTarget(activeTargetId);
      if (t) {
        const nextCurrent = t.currentCount + value;
        const patch: Partial<typeof t> = { currentCount: nextCurrent };
        if (nextCurrent >= t.targetCount) {
          patch.status = 'completed';
          await cancelGoalReminders(t).catch((e) =>
            console.warn('cancelGoalReminders failed', e)
          );
        } else if (t.currentCount === 0 && t.lateReminderId) {
          await cancelLateReminder(t).catch((e) =>
            console.warn('cancelLateReminder failed', e)
          );
        }
        await updateTarget(activeTargetId, patch);
      }
    }

    setManualCount('');
    setShowManualEntry(false);
  };

  const activePrayerName = prayerMode
    ? PRAYERS.find((p) => p.id === prayerMode)?.name ?? ''
    : '';

  const prayerLabel = prayerMode ? 'After ' + activePrayerName : 'Post-Salah';

  const completedPrayers = new Set(prayerCompletions.map((p) => p.prayer));
  const voluntaryFast = isVoluntaryFastDay();

  const progressMode = prayerMode && prayerAdhkar.length > 0;

  const counterContent = progressMode ? (
    <>
      <Text
        style={[styles.dhikrArabicSm, { color: colors.gold, opacity: 0.7, writingDirection: 'rtl' }]}
        numberOfLines={1}
      >
        {displayArabic}
      </Text>
      <Text
        style={[styles.bigCount, serifStyle, { color: colors.gold }]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {displayCount}
      </Text>
      <Text style={[styles.targetText, { color: colors.textMuted }]}>
        / {displayTarget}
      </Text>
    </>
  ) : multiMode ? (
    <>
      <Text style={[styles.dhikrArabic, { color: colors.gold, opacity: 0.7, writingDirection: 'rtl' }]}>
        {MULTI_PRESET[activeCounterIndex].arabic}
      </Text>
      <Text
        style={[styles.bigCount, serifStyle, { color: colors.gold }]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {displayCount}
      </Text>
      <Text style={[styles.targetText, { color: colors.textMuted }]}>
        / {displayTarget}
      </Text>
    </>
  ) : (
    <Text
      style={[styles.bigCountSingle, serifStyle, { color: colors.gold }]}
      adjustsFontSizeToFit
      numberOfLines={1}
    >
      {displayCount}
    </Text>
  );

  return (
    <Screen>
      <ConnectionBanner />
      <AchievementToast
        achievement={toastAchievement}
        onDismiss={() => setToastAchievement(null)}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Top Bar: Today total + streak, sound toggle ───────────── */}
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.todayLabel, { color: colors.textSecondary }]}>Today</Text>
              <Text style={[styles.todayCount, serifStyle, { color: '#ffffff' }]}>
                {todayTotal.toLocaleString()}
              </Text>
              {currentStreak > 0 && (
                <View style={styles.streakRow}>
                  <Flame size={14} color="#fb923c" />
                  <Text style={{ color: '#fb923c', fontSize: 12, fontWeight: '500' }}>
                    {currentStreak} day streak
                  </Text>
                </View>
              )}
            </View>
            <Pressable
              onPress={() => setSoundEnabled(!soundEnabled)}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: 'rgba(30, 41, 59, 0.30)',
                  borderColor: 'rgba(255,255,255,0.05)',
                },
              ]}
            >
              {soundEnabled ? (
                <Volume2 size={18} color={colors.gold} />
              ) : (
                <VolumeX size={18} color={colors.textSecondary} />
              )}
            </Pressable>
          </View>

          {/* ── Hijri date + Post-Salah row ─────────────────────────────── */}
          <View style={styles.hijriRow}>
            <View style={{ position: 'relative' }}>
              <Pressable
                onPress={() => setShowPrayerSelector(!showPrayerSelector)}
                style={[
                  styles.prayerPill,
                  {
                    backgroundColor: prayerMode ? 'rgba(245,158,11,0.20)' : 'rgba(30, 41, 59, 0.30)',
                    borderColor: prayerMode ? 'rgba(245,158,11,0.30)' : 'rgba(255,255,255,0.05)',
                  },
                ]}
              >
                <Layers
                  size={14}
                  color={prayerMode ? colors.gold : colors.textSecondary}
                />
                <Text
                  style={{
                    color: prayerMode ? colors.gold : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: '500',
                  }}
                >
                  {prayerLabel}
                </Text>
                <ChevronDown size={12} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={12} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 12, fontWeight: '600' }}>
                  {hijri.formatted}
                </Text>
                {specialDay && (
                  <Text
                    style={{
                      color: '#6ee7b7',
                      fontSize: 10,
                      fontWeight: '700',
                      backgroundColor: 'rgba(16,185,129,0.20)',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                      overflow: 'hidden',
                    }}
                  >
                    {specialDay.name}
                  </Text>
                )}
              </View>
              {voluntaryFast.isFastDay && (
                <Text style={{ color: colors.gold, fontSize: 10, marginTop: 2 }}>
                  🌙 {voluntaryFast.reason}
                </Text>
              )}
              {upcomingDays.length > 0 && !specialDay && (
                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>
                  Next: <Text style={{ color: colors.success }}>{upcomingDays[0].name}</Text> in{' '}
                  {upcomingDays[0].daysUntil} days
                </Text>
              )}
            </View>
          </View>

          {/* ── Main Counter ───────────────────────────────────────────── */}
          <View style={styles.counterArea}>
            <View
              style={[
                styles.counterCircle,
                { width: RING_SIZE, height: RING_SIZE },
              ]}
            >
              {/* thin progress ring around the button */}
              <View
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
              >
                <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}>
                  <SvgCircle
                    cx={RING_VIEWBOX / 2}
                    cy={RING_VIEWBOX / 2}
                    r={RING_RADIUS}
                    stroke={WEB_SLATE_800}
                    strokeWidth={RING_STROKE}
                    fill="none"
                  />
                  <SvgCircle
                    cx={RING_VIEWBOX / 2}
                    cy={RING_VIEWBOX / 2}
                    r={RING_RADIUS}
                    stroke={WEB_GOLD_500}
                    strokeWidth={6}
                    strokeOpacity={0.15}
                    fill="none"
                    strokeLinecap="round"
                    rotation={-90}
                    originX={RING_VIEWBOX / 2}
                    originY={RING_VIEWBOX / 2}
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={
                      RING_CIRCUMFERENCE * (1 - Math.min(100, progress) / 100)
                    }
                  />
                  <SvgCircle
                    cx={RING_VIEWBOX / 2}
                    cy={RING_VIEWBOX / 2}
                    r={RING_RADIUS}
                    stroke={WEB_GOLD_500}
                    strokeWidth={RING_STROKE}
                    fill="none"
                    strokeLinecap="round"
                    rotation={-90}
                    originX={RING_VIEWBOX / 2}
                    originY={RING_VIEWBOX / 2}
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={
                      RING_CIRCUMFERENCE * (1 - Math.min(100, progress) / 100)
                    }
                  />
                </Svg>
              </View>

              {/* the button */}
              <View style={[styles.button, ripple && styles.buttonPressed]}>
                <Pressable
                  onPress={handleTap}
                  onLongPress={() => {
                    setManualCount('');
                    setShowManualEntry(true);
                  }}
                  delayLongPress={800}
                  style={({ pressed }) => [
                    styles.buttonInner,
                    { transform: [{ scale: pressed || ripple ? 0.98 : 1 }] },
                  ]}
                >
                  {/* Inner Ring Glow */}
                  <View
                    style={[styles.innerRing, { borderColor: 'rgba(255,255,255,0.05)' }]}
                  />
                  {/* Gold Accent Ring */}
                  <View
                    style={[
                      styles.accentRing,
                      { borderColor: 'rgba(245,158,11,0.10)' },
                    ]}
                  />
                  {/* Ripple */}
                  {ripple && (
                    <View style={[styles.ripple, { backgroundColor: 'rgba(251,191,36,0.10)' }]} />
                  )}
                  <View style={styles.buttonContent}>
                    {counterContent}
                    <Text
                      style={[
                        styles.dhikrLabel,
                        { color: colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {displayLabel}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* Cycle / Goal indicator */}
            {!progressMode && !multiMode && (
              <View style={styles.cycleRow}>
                <Text
                  style={{
                    color: WEB_SLATE_400,
                    fontSize: 12,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    fontWeight: '500',
                  }}
                >
                  {activeTarget ? 'Goal' : 'Cycle'}
                </Text>
                <View style={[styles.cycleLine, { backgroundColor: WEB_SLATE_700 }]} />
                <Text style={{ color: WEB_GOLD_500, fontSize: 12, fontWeight: '600' }}>
                  {activeTarget
                    ? `${activeTarget.currentCount}/${activeTarget.targetCount}`
                    : `${count % 33}/33`}
                </Text>
              </View>
            )}
          </View>

          {/* ── Prayer / multi pills ───────────────────────────────────── */}
          {progressMode && (
            <View style={styles.pillSection}>
              <Pressable
                onPress={() => setShowAdhkarList(!showAdhkarList)}
                style={styles.adhkarToggleRow}
              >
                <Text style={{ color: WEB_SLATE_500, fontSize: 10 }}>
                  {showAdhkarList ? 'Hide' : 'Show'} adhkar list
                </Text>
                {showAdhkarList ? (
                  <ChevronUp size={12} color={WEB_SLATE_500} />
                ) : (
                  <ChevronDown size={12} color={WEB_SLATE_500} />
                )}
              </Pressable>
              {showAdhkarList && (
                <View style={styles.pillsWrap}>
                  {prayerAdhkar.map((item, idx) => {
                    const c = prayerCounts[idx] || 0;
                    const done = c >= item.target;
                    const active = idx === activeAdhkarIndex;
                    return (
                      <Pressable
                        key={`${item.title}-${idx}`}
                        onPress={() => setActiveAdhkarIndex(idx)}
                        style={[
                        styles.pill,
                          {
                            backgroundColor: active
                              ? 'rgba(245,158,11,0.20)'
                              : done
                                ? 'rgba(16,185,129,0.10)'
                                : 'rgba(30, 41, 59, 0.30)',
                            borderColor: active
                              ? 'rgba(245,158,11,0.30)'
                              : done
                                ? 'rgba(16,185,129,0.20)'
                                : 'rgba(255,255,255,0.05)',
                          },
                        ]}
                      >
                        {done && <Check size={10} color={colors.success} />}
                        <Text style={{ color: colors.textSecondary, fontSize: 10, maxWidth: 110 }} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                          {c}/{item.target}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {multiMode && (
            <View style={styles.pillSection}>
              <View style={styles.pillsWrap}>
                {MULTI_PRESET.map((item, idx) => {
                  const done = multiCounts[idx] >= item.target;
                  return (
                    <Pressable
                      key={item.name}
                      onPress={() => setActiveCounterIndex(idx)}
                      style={[
                        styles.multiTab,
                        {
                          backgroundColor:
                            activeCounterIndex === idx ? 'rgba(245,158,11,0.20)' : 'rgba(30, 41, 59, 0.30)',
                          borderColor:
                            activeCounterIndex === idx ? 'rgba(245,158,11,0.30)' : 'rgba(255,255,255,0.05)',
                        },
                      ]}
                    >
                      <Text style={{ color: 'rgba(251,191,36,0.80)', fontSize: 10 }}>{item.arabic}</Text>
                      <Text
                        style={{
                          color: done ? WEB_EMERALD_400 : WEB_SLATE_300,
                          fontSize: 14,
                          fontWeight: '700',
                        }}
                      >
                        {multiCounts[idx]}/{item.target}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Reset */}
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [
              styles.resetBtn,
              pressed && { backgroundColor: 'rgba(30, 41, 59, 0.30)' },
            ]}
          >
            <RotateCcw size={14} color={WEB_SLATE_500} />
            <Text
              style={{
                color: WEB_SLATE_500,
                fontSize: 12,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                fontWeight: '500',
              }}
            >
              Reset
            </Text>
          </Pressable>

          {/* ── Daily Prayer Tracker (bottom) ──────────────────────────── */}
          <View style={styles.dailyTracker}>
            {PRAYERS.map((prayer) => {
              const isCompleted = completedPrayers.has(prayer.id);
              const isActive = prayerMode === prayer.id;
              return (
                <Pressable
                  key={prayer.id}
                  onPress={() => handleSelectPrayer(prayer.id)}
                  style={[
                    styles.trackerChip,
                    {
                      backgroundColor: isActive
                        ? 'rgba(245,158,11,0.20)'
                        : isCompleted
                          ? 'rgba(16,185,129,0.10)'
                          : 'rgba(30, 41, 59, 0.30)',
                      borderColor: isActive
                        ? 'rgba(245,158,11,0.30)'
                        : isCompleted
                          ? 'rgba(16,185,129,0.20)'
                          : 'rgba(255,255,255,0.05)',
                    },
                  ]}
                >
                  <Text style={{ color: WEB_SLATE_300, fontSize: 10 }}>
                    {prayer.arabicName}
                  </Text>
                  {isCompleted ? (
                    <Check size={12} color={WEB_EMERALD_400} />
                  ) : (
                    <Circle
                      size={12}
                      color={isActive ? colors.gold : WEB_SLATE_500}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Post-Salah prayer selector dropdown */}
      <Modal visible={showPrayerSelector} transparent animationType="fade">
        <Pressable
          style={[styles.menuOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          onPress={() => setShowPrayerSelector(false)}
        >
          <View
            style={[
              styles.menuCard,
              {
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.gold,
              },
            ]}
          >
            {PRAYERS.map((prayer) => {
              const active = prayerMode === prayer.id;
              return (
                <Pressable
                  key={prayer.id}
                  onPress={() => handleSelectPrayer(prayer.id)}
                  style={[
                    styles.menuItem,
                    active && { backgroundColor: colors.goldMuted },
                  ]}
                >
                  <Text style={{ fontSize: 16, color: colors.text, writingDirection: 'rtl' }}>
                    {prayer.arabicName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: active ? colors.gold : colors.textSecondary,
                    }}
                  >
                    {prayer.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Manual entry modal */}
      <Modal visible={showManualEntry} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Card style={{ marginHorizontal: 32, alignItems: 'center' }}>
            <Title style={{ fontSize: 20, textAlign: 'center' }}>
              Add Count Manually
            </Title>
            <Subtitle style={{ textAlign: 'center' }}>
              Enter the amount to add to{' '}
              <Text style={{ color: colors.gold, fontWeight: '700' }}>
                {multiMode ? MULTI_PRESET[activeCounterIndex].name : activeTarget?.title ?? 'today'}
              </Text>
            </Subtitle>
            <TextInput
              value={manualCount}
              onChangeText={setManualCount}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              style={[
                styles.manualInput,
                { backgroundColor: colors.inputBg },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => setShowManualEntry(false)}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.inputBg }]}
              >
                <Text style={{ color: colors.gold, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleManualSubmit}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.gold }]}
              >
                <Text style={{ color: '#020617', fontWeight: '700' }}>Add</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Completion modal */}
      <Modal visible={showCompletion} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Card style={{ marginHorizontal: 32, alignItems: 'center' }}>
            <View
              style={[
                styles.completeBadge,
                { backgroundColor: 'rgba(16,185,129,0.2)' },
              ]}
            >
              <Check size={32} color={colors.success} />
            </View>
            <Title style={{ fontSize: 22, textAlign: 'center', marginTop: 8 }}>
              MashAllah! 🎉
            </Title>
            <Subtitle style={{ textAlign: 'center' }}>
              You have completed all adhkar for{' '}
              <Text style={{ color: colors.gold, fontWeight: '700' }}>{activePrayerName}</Text>{' '}
              prayer
            </Subtitle>
            <View
              style={[
                styles.completedBox,
                { backgroundColor: colors.inputBg },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                <Text style={{ color: colors.success, fontWeight: '700' }}>
                  {prayerAdhkar.length}
                </Text>{' '}
                adhkar completed
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => {
                  shareProgress({
                    title: `${activePrayerName} Adhkar`,
                    count: displayCount,
                    targetCount: displayTarget,
                    completedAt: new Date(),
                    streak: currentStreak,
                    totalLifetime: totalCount
                  });
                }}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.inputBg }]}
              >
                <Text style={{ color: colors.gold, fontWeight: '700' }}>Share</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowCompletion(false)}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.gold }]}
              >
                <Text style={{ color: '#020617', fontWeight: '700' }}>Continue</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                setShowCompletion(false);
                setPrayerMode(null);
              }}
              style={styles.doneBtn}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                Done
              </Text>
            </Pressable>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function StatPill() {
  return null;
}

const serifStyle = { fontFamily: FONTS.serif } as const;

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 32,
    paddingBottom: 120,
    paddingTop: 48,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  todayLabel: {
    fontSize: 14,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontFamily: FONTS.serif,
  },
  todayCount: {
    fontSize: 30,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: FONTS.serif,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  hijriRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  prayerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  counterArea: {
    alignItems: 'center',
    marginTop: 20,
  },
  counterCircle: {
    position: 'relative',
  },
  button: {
    position: 'absolute',
    top: (RING_SIZE - BUTTON_SIZE) / 2,
    left: (RING_SIZE - BUTTON_SIZE) / 2,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WEB_SLATE_800,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#050812',
    shadowOffset: { width: 20, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 60,
    elevation: 10,
  },
  buttonPressed: {
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
  },
  buttonInner: {
    width: '100%',
    height: '100%',
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: (BUTTON_SIZE - 16) / 2,
    borderWidth: 1,
  },
  accentRing: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderRadius: (BUTTON_SIZE - 48) / 2,
    borderWidth: 1,
  },
  ripple: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    borderRadius: BUTTON_SIZE / 2,
  },
  buttonContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dhikrArabic: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  dhikrArabicSm: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  bigCount: {
    fontSize: 72,
    letterSpacing: -3,
    marginVertical: 6,
  },
  bigCountSingle: {
    fontSize: 96,
    letterSpacing: -4,
    marginVertical: 6,
  },
  targetText: {
    fontSize: 12,
    color: WEB_SLATE_500,
  },
  dhikrLabel: {
    fontSize: 12,
    letterSpacing: 3.6,
    textTransform: 'uppercase',
    fontWeight: '500',
    marginTop: 8,
  },
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  cycleLine: {
    width: 32,
    height: 1,
  },
  pillSection: {
    alignItems: 'center',
    marginTop: 18,
  },
  adhkarToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  multiTab: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 24,
    marginTop: 16,
  },
  dailyTracker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 18,
  },
  trackerChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
  menuOverlay: {
    flex: 1,
  },
  menuCard: {
    position: 'absolute',
    top: 30,
    left: 16,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 180,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  completeBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionBox: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  completedBox: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  doneBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  manualInput: {
    marginTop: 16,
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    textAlign: 'center',
    color: '#fff',
  },
});