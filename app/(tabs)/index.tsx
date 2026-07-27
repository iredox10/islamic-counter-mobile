import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
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
} from 'lucide-react-native';
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
import { gregorianToHijri, getSpecialDay } from '@/lib/hijri';
import {
  PRAYERS,
  getPrayerAdhkar,
  type PrayerName,
  type AdhkarItem,
} from '@/lib/adhkar';
import { checkAchievements, type Achievement } from '@/lib/achievements';
import { getTarget } from '@/lib/db';
import { playTapSound, playCompletionSound } from '@/lib/sounds';
import { useAchievementTracker } from '@/lib/useAchievementTracker';
import { shareProgress } from '@/lib/share';
import { AchievementToast } from '@/components/AchievementToast';

const MULTI_PRESET = [
  { name: 'SubhanAllah', arabic: 'سُبْحَانَ اللَّهِ', target: 33 },
  { name: 'Alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', target: 33 },
  { name: 'Allahu Akbar', arabic: 'اللَّهُ أَكْبَرُ', target: 33 },
];

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
  const [multiMode, setMultiMode] = useBooleanSetting(KEYS.multiMode, false);
  const [multiCounts, setMultiCounts] = useJsonSetting(KEYS.multiCounter, [0, 0, 0]);
  const [autoReset] = useBooleanSetting(KEYS.autoReset, false);

  const [activeCounterIndex, setActiveCounterIndex] = useState(0);
  const [prayerMode, setPrayerMode] = useState<PrayerName | null>(null);
  const [prayerAdhkar, setPrayerAdhkar] = useState<AdhkarItem[]>([]);
  const [prayerCounts, setPrayerCounts] = useState<number[]>([]);
  const [activeAdhkarIndex, setActiveAdhkarIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState('');
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
  const totalCount = useMemo(
    () => logs.reduce((a, l) => a + l.count, 0),
    [logs]
  );
  const uniqueDates = useMemo(
    () => [...new Set(logs.map((l) => l.dateStr))],
    [logs]
  );
  const { currentStreak } = calculateStreak(uniqueDates);
  const completedGoals = targets.filter((t) => t.status === 'completed').length;

  useAchievementTracker(totalCount, currentStreak, completedGoals, sessionCount.count);

  const hijri = gregorianToHijri(new Date());
  const specialDay = getSpecialDay(hijri);

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
    displayTarget > 0
      ? Math.min(100, (displayCount / displayTarget) * 100)
      : 0;

  const displayLabel = prayerMode && prayerAdhkar[activeAdhkarIndex]
    ? prayerAdhkar[activeAdhkarIndex].title
    : multiMode
      ? MULTI_PRESET[activeCounterIndex].name
      : activeTarget?.title ?? 'Dhikr';

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
        if (nextCurrent >= t.targetCount) patch.status = 'completed';
        await updateTarget(activeTargetId, patch);
      }
    }

    await checkAndUnlock(newCount);
  };

  const handleReset = () => {
    Alert.alert('Reset counter?', 'Session count will be set to 0.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setSessionCount({ count: 0, targetId: activeTargetId });
          setMultiCounts([0, 0, 0]);
          setActiveCounterIndex(0);
          if (prayerMode) {
            setPrayerCounts(prayerAdhkar.map(() => 0));
            setActiveAdhkarIndex(0);
          }
        },
      },
    ]);
  };

  const applyManual = () => {
    const n = parseInt(manualValue, 10);
    if (!n || n < 0) return;
    setSessionCount({ count: n, targetId: activeTargetId });
    setShowManual(false);
    setManualValue('');
  };

  const completedPrayers = new Set(prayerCompletions.map((p) => p.prayer));

  return (
    <Screen>
      <AchievementToast
        achievement={toastAchievement}
        onDismiss={() => setToastAchievement(null)}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Title style={{ fontSize: 24 }}>Tasbih</Title>
              <Subtitle>
                {hijri.formatted}
                {specialDay ? ` · ${specialDay.name}` : ''}
              </Subtitle>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setSoundEnabled(!soundEnabled)}
                style={[styles.iconBtn, { backgroundColor: colors.inputBg }]}
              >
                {soundEnabled ? (
                  <Volume2 size={18} color={colors.gold} />
                ) : (
                  <VolumeX size={18} color={colors.textMuted} />
                )}
              </Pressable>
              <Pressable
                onPress={handleReset}
                style={[styles.iconBtn, { backgroundColor: colors.inputBg }]}
              >
                <RotateCcw size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatPill
              icon={<Flame size={14} color={colors.gold} />}
              label={`${currentStreak} day streak`}
              colors={colors}
            />
            <StatPill
              icon={<Calendar size={14} color={colors.gold} />}
              label={`Today ${todayTotal}`}
              colors={colors}
            />
          </View>

          {/* Prayer tracker */}
          <View style={styles.prayerRow}>
            {PRAYERS.map((p) => {
              const done = completedPrayers.has(p.id);
              const active = prayerMode === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    setPrayerMode(prayerMode === p.id ? null : p.id)
                  }
                  style={[
                    styles.prayerChip,
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
                  <Text style={{ color: colors.textSecondary, fontSize: 10 }}>
                    {p.arabicName}
                  </Text>
                  {done ? (
                    <Check size={12} color={colors.success} />
                  ) : (
                    <Circle
                      size={12}
                      color={active ? colors.gold : colors.textMuted}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Mode toggle */}
          <Pressable
            onPress={() => {
              setMultiMode(!multiMode);
              setPrayerMode(null);
            }}
            style={[
              styles.modeToggle,
              {
                backgroundColor: multiMode ? colors.goldMuted : colors.inputBg,
                borderColor: multiMode ? colors.gold : colors.cardBorder,
              },
            ]}
          >
            <Layers size={16} color={multiMode ? colors.gold : colors.textMuted} />
            <Text
              style={{
                color: multiMode ? colors.gold : colors.textSecondary,
                fontWeight: '600',
                fontSize: 13,
              }}
            >
              Multi-counter (33×3)
            </Text>
          </Pressable>

          {/* Multi counter tabs */}
          {multiMode && !prayerMode && (
            <View style={styles.multiTabs}>
              {MULTI_PRESET.map((item, i) => (
                <Pressable
                  key={item.name}
                  onPress={() => setActiveCounterIndex(i)}
                  style={[
                    styles.multiTab,
                    {
                      backgroundColor:
                        activeCounterIndex === i ? colors.goldMuted : colors.inputBg,
                      borderColor:
                        activeCounterIndex === i ? colors.gold : colors.cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        activeCounterIndex === i ? colors.gold : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    {multiCounts[i]}/{item.target}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Counter ring */}
          <Pressable
            onPress={handleTap}
            onLongPress={() => setShowManual(true)}
            style={styles.counterWrap}
          >
            <View
              style={[
                styles.ringOuter,
                {
                  borderColor: colors.gold,
                  backgroundColor: ripple ? colors.goldMuted : 'transparent',
                },
              ]}
            >
              <View
                style={[
                  styles.ringInner,
                  {
                    borderColor: colors.cardBorder,
                    backgroundColor: colors.card,
                  },
                ]}
              >
                <Text style={[styles.countNum, { color: colors.gold }]}>
                  {displayCount}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  / {displayTarget}
                </Text>
                <View
                  style={[
                    styles.progressBar,
                    { backgroundColor: colors.inputBg },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progress}%`,
                        backgroundColor: colors.gold,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
            <Text style={[styles.tapHint, { color: colors.textMuted }]}>
              Tap to count · Hold for manual entry
            </Text>
          </Pressable>

          {/* Current dhikr info */}
          <Card style={{ marginTop: 8 }}>
            <Text
              style={{
                color: colors.gold,
                fontSize: 18,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {displayLabel}
            </Text>
            {displayArabic ? (
              <Text
                style={{
                  color: colors.text,
                  fontSize: 22,
                  textAlign: 'center',
                  marginTop: 8,
                  writingDirection: 'rtl',
                }}
              >
                {displayArabic}
              </Text>
            ) : null}
            {activeTarget && !multiMode && !prayerMode ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                Goal: {activeTarget.currentCount}/{activeTarget.targetCount}
              </Text>
            ) : null}
          </Card>

          {/* Prayer adhkar list */}
          {prayerMode && prayerAdhkar.length > 0 && (
            <View style={{ marginTop: 16, gap: 8 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                {PRAYERS.find((p) => p.id === prayerMode)?.name} Adhkar
              </Text>
              {prayerAdhkar.map((item, i) => {
                const c = prayerCounts[i] || 0;
                const done = c >= item.target;
                const active = i === activeAdhkarIndex;
                return (
                  <Pressable
                    key={`${item.title}-${i}`}
                    onPress={() => setActiveAdhkarIndex(i)}
                    style={[
                      styles.adhkarRow,
                      {
                        backgroundColor: active ? colors.goldMuted : colors.card,
                        borderColor: active
                          ? colors.gold
                          : done
                            ? colors.success
                            : colors.cardBorder,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: '600',
                          fontSize: 14,
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {c}/{item.target}
                      </Text>
                    </View>
                    {done ? (
                      <Check size={18} color={colors.success} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Completion modal */}
      <Modal visible={showCompletion} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Card style={{ marginHorizontal: 32, alignItems: 'center' }}>
            <Text style={{ fontSize: 40 }}>✨</Text>
            <Title style={{ fontSize: 22, textAlign: 'center', marginTop: 8 }}>
              Masha&apos;Allah!
            </Title>
            <Subtitle style={{ textAlign: 'center' }}>
              You completed {prayerMode} adhkar
            </Subtitle>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => {
                  shareProgress({
                    title: `${prayerMode} Adhkar`,
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
          </Card>
        </View>
      </Modal>

      {/* Manual entry */}
      <Modal visible={showManual} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Card style={{ marginHorizontal: 24 }}>
            <Title style={{ fontSize: 20 }}>Set count</Title>
            <TextInput
              value={manualValue}
              onChangeText={setManualValue}
              keyboardType="number-pad"
              placeholder="Enter number"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.cardBorder,
                },
              ]}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Pressable
                onPress={() => setShowManual(false)}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.inputBg }]}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={applyManual}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.gold }]}
              >
                <Text style={{ color: '#020617', fontWeight: '700' }}>Apply</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function StatPill({
  icon,
  label,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  colors: { inputBg: string; textSecondary: string };
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: colors.inputBg }]}>
      {icon}
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  prayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 4,
  },
  prayerChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  multiTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  multiTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  counterWrap: {
    alignItems: 'center',
    marginVertical: 16,
  },
  ringOuter: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countNum: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -2,
  },
  progressBar: {
    width: 100,
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  tapHint: {
    marginTop: 12,
    fontSize: 12,
  },
  adhkarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
  modalBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});
