import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text as RNNativeText,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
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
import { LinearGradient } from 'expo-linear-gradient';
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
import { playTapSound, playCompletionSound } from '@/lib/sounds';
import { cancelGoalReminders, scheduleGoalReminders } from '@/lib/goalReminders';
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
        playCompletionSound('bell');
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
          await cancelGoalReminders(t);
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
              await cancelGoalReminders(t);
              await scheduleGoalReminders({ ...t, currentCount: 0, status: 'active' as const });
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
        style={[styles.dhikrArabic, { color: colors.gold, writingDirection: 'rtl' }]}
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
      <Text style={[styles.dhikrArabic, { color: colors.gold, writingDirection: 'rtl' }]}>
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
      style={[styles.bigCount, serifStyle, { color: colors.gold }]}
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
              <Text style={[styles.todayLabel, { color: colors.textMuted }]}>Today</Text>
              <Text style={[styles.todayCount, serifStyle, { color: colors.text }]}>
                {todayTotal.toLocaleString()}
              </Text>
              {currentStreak > 0 && (
                <View style={styles.streakRow}>
                  <Flame size={14} color="#fbbf24" />
                  <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '600' }}>
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
                  backgroundColor: colors.inputBg,
                  borderColor: colors.cardBorder,
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
                    backgroundColor: prayerMode ? colors.goldMuted : colors.inputBg,
                    borderColor: prayerMode ? colors.gold : colors.cardBorder,
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
                    fontWeight: '600',
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
                      color: colors.success,
                      fontSize: 10,
                      fontWeight: '700',
                      backgroundColor: 'rgba(16,185,129,0.2)',
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
            {/* thin progress ring around the button */}
            <View
              pointerEvents="none"
              style={[
                styles.ringSvgWrap,
                { width: RING_SIZE, height: RING_SIZE },
              ]}
            >
              <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}>
                <SvgCircle
                  cx={RING_VIEWBOX / 2}
                  cy={RING_VIEWBOX / 2}
                  r={RING_RADIUS}
                  stroke={colors.cardBorder}
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                <SvgCircle
                  cx={RING_VIEWBOX / 2}
                  cy={RING_VIEWBOX / 2}
                  r={RING_RADIUS}
                  stroke={colors.gold}
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

              {/* the button */}
              <LinearGradient
                colors={['#1e293b', '#020617']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.button, ripple && styles.buttonPressed]}
              >
                <Pressable
                  onPress={handleTap}
                  style={({ pressed }) => [
                    styles.buttonInner,
                    { transform: [{ scale: pressed || ripple ? 0.98 : 1 }] },
                  ]}
                >
                  {/* Inner Ring Glow */}
                  <View
                    style={[styles.innerRing, { borderColor: colors.cardBorder }]}
                  />
                  {/* Gold Accent Ring */}
                  <View
                    style={[
                      styles.accentRing,
                      { borderColor: colors.goldMuted },
                    ]}
                  />
                  {/* Ripple */}
                  {ripple && (
                    <View style={[styles.ripple, { backgroundColor: colors.goldMuted }]} />
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
              </LinearGradient>
            </View>

            {/* Cycle / Goal indicator */}
            {!progressMode && !multiMode && (
              <View style={styles.cycleRow}>
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    fontWeight: '600',
                  }}
                >
                  {activeTarget ? 'Goal' : 'Cycle'}
                </Text>
                <View style={[styles.cycleLine, { backgroundColor: colors.cardBorder }]} />
                <Text style={{ color: colors.gold, fontSize: 11, fontWeight: '700' }}>
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
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                  {showAdhkarList ? 'Hide' : 'Show'} adhkar list
                </Text>
                {showAdhkarList ? (
                  <ChevronUp size={12} color={colors.textMuted} />
                ) : (
                  <ChevronDown size={12} color={colors.textMuted} />
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
                              ? colors.goldMuted
                              : done
                                ? 'rgba(16,185,129,0.12)'
                                : colors.inputBg,
                            borderColor: active
                              ? colors.gold
                              : done
                                ? colors.success
                                : colors.cardBorder,
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
                            activeCounterIndex === idx ? colors.goldMuted : colors.inputBg,
                          borderColor:
                            activeCounterIndex === idx ? colors.gold : colors.cardBorder,
                        },
                      ]}
                    >
                      <Text style={{ color: colors.gold, fontSize: 10 }}>{item.arabic}</Text>
                      <Text
                        style={{
                          color: done ? colors.success : colors.textSecondary,
                          fontSize: 12,
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
              pressed && { backgroundColor: colors.inputBg },
            ]}
          >
            <RotateCcw size={14} color={colors.textSecondary} />
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                fontWeight: '600',
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
                        ? colors.goldMuted
                        : isCompleted
                          ? 'rgba(16,185,129,0.12)'
                          : colors.inputBg,
                      borderColor: isActive
                        ? colors.gold
                        : isCompleted
                          ? colors.success
                          : colors.cardBorder,
                    },
                  ]}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 10 }}>
                    {prayer.arabicName}
                  </Text>
                  {isCompleted ? (
                    <Check size={12} color={colors.success} />
                  ) : (
                    <Circle
                      size={12}
                      color={isActive ? colors.gold : colors.textMuted}
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
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  todayLabel: {
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '600',
    fontFamily: FONTS.serif,
  },
  todayCount: {
    fontSize: 34,
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
  ringSvgWrap: {
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
    shadowColor: '#000',
    shadowOffset: { width: 20, height: 20 },
    shadowOpacity: 0.6,
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
  bigCount: {
    fontSize: 72,
    letterSpacing: -3,
    marginVertical: 6,
  },
  targetText: {
    fontSize: 14,
  },
  dhikrLabel: {
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: 10,
  },
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  multiTab: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 18,
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
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
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
});