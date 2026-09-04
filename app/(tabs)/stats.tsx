import React, { useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import Text from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subDays } from 'date-fns';
import { Plus, Flame, Check, Circle, ChevronDown, X } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { Screen, Card, Title, Subtitle, Chip } from '@/components/ui';
import {
  useLogs,
  useTargets,
  useDurations,
  usePrayerCompletions,
} from '@/hooks/useDatabase';
import { addLog } from '@/lib/db';
import { calculateStreak, formatDuration, todayStr } from '@/lib/utils';
import { PRAYERS } from '@/lib/adhkar';

type TimeRange = 'daily' | 'weekly';

export default function StatsScreen() {
  const { colors } = useTheme();
  const logs = useLogs();
  const targets = useTargets();
  const durations = useDurations();
  const prayerCompletions = usePrayerCompletions();
  const [range, setRange] = useState<TimeRange>('daily');
  const [selectedTargetId, setSelectedTargetId] = useState<number | 'all'>('all');
  const [showGoalFilter, setShowGoalFilter] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCount, setManualCount] = useState('');
  const [manualDate, setManualDate] = useState(todayStr());

  const selectedGoalName = useMemo(() => {
    if (selectedTargetId === 'all') return 'All Goals';
    const target = targets.find((t) => t.id === selectedTargetId);
    return target?.title ?? 'All Goals';
  }, [selectedTargetId, targets]);

  const filteredLogs = useMemo(
    () =>
      selectedTargetId === 'all'
        ? logs
        : logs.filter((l) => l.targetId === selectedTargetId),
    [logs, selectedTargetId]
  );

  const filteredDurations = useMemo(
    () =>
      selectedTargetId === 'all'
        ? durations
        : durations.filter((d) => d.targetId === selectedTargetId),
    [durations, selectedTargetId]
  );

  const chartData = useMemo(() => {
    const now = new Date();
    if (range === 'daily') {
      return Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(now, 6 - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const count = filteredLogs
          .filter((l) => l.dateStr === dateStr)
          .reduce((a, l) => a + l.count, 0);
        return { name: format(date, 'EEE'), dateStr, count };
      });
    }
    // weekly - last 8 weeks as simple 7-day buckets
    return Array.from({ length: 8 }).map((_, i) => {
      const end = subDays(now, (7 - i) * 7);
      const start = subDays(end, 6);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      const count = filteredLogs
        .filter((l) => l.dateStr >= startStr && l.dateStr <= endStr)
        .reduce((a, l) => a + l.count, 0);
      return { name: `W${i + 1}`, dateStr: endStr, count };
    });
  }, [filteredLogs, range]);

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);
  const totalCount = filteredLogs.reduce((a, l) => a + l.count, 0);
  const todayTotal = filteredLogs
    .filter((l) => l.dateStr === todayStr())
    .reduce((a, l) => a + l.count, 0);
  const totalSeconds = filteredDurations.reduce((a, d) => a + d.seconds, 0);

  const bestDayCount = filteredLogs.length > 0
    ? Math.max(0, ...Object.values(filteredLogs.reduce((acc: Record<string, number>, l) => {
        acc[l.dateStr] = (acc[l.dateStr] || 0) + l.count;
        return acc;
      }, {})))
    : 0;

  const uniqueDates = [...new Set(filteredLogs.map((l) => l.dateStr))];
  const { currentStreak, longestStreak } = calculateStreak(uniqueDates);

  const todayPrayers = new Set(
    prayerCompletions.filter((p) => p.dateStr === todayStr()).map((p) => p.prayer)
  );

  const prayerStreak = useMemo(() => {
    if (!prayerCompletions || prayerCompletions.length === 0) return 0;
    const allDates = [...new Set(prayerCompletions.map((c) => c.dateStr))].sort().reverse();
    let streak = 0;
    const today = todayStr();
    for (let i = 0; i < allDates.length; i++) {
      const expectedDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const dateCompletions = prayerCompletions.filter((c) => c.dateStr === expectedDate);
      const uniquePrayers = new Set(dateCompletions.map((c) => c.prayer));
      if (uniquePrayers.size === 5) {
        streak++;
      } else if (expectedDate !== today || i > 0) {
        break;
      }
    }
    return streak;
  }, [prayerCompletions]);

  const last7Days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }).map((_, i) => format(subDays(now, 6 - i), 'yyyy-MM-dd'));
  }, []);

  const prayerStatsByDay = useMemo(() => {
    return last7Days.map((dateStr) => {
      const dayCompletions = prayerCompletions.filter((c) => c.dateStr === dateStr);
      return {
        dateStr,
        dayName: format(new Date(dateStr + 'T00:00:00'), 'EEE'),
        isToday: dateStr === todayStr(),
        prayers: PRAYERS.map((p) => ({
          id: p.id,
          name: p.name,
          arabicName: p.arabicName,
          completed: dayCompletions.some((c) => c.prayer === p.id),
        })),
      };
    });
  }, [last7Days, prayerCompletions]);

  const handleManual = async () => {
    const count = parseInt(manualCount, 10);
    if (!count) return;
    await addLog({
      count,
      targetId: selectedTargetId === 'all' ? undefined : selectedTargetId,
      timestamp: new Date(manualDate).toISOString(),
      dateStr: manualDate,
    });
    setManualCount('');
    setShowManual(false);
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Title>Progress</Title>
              <Subtitle>Your dhikr journey</Subtitle>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => setShowGoalFilter(true)}
                style={[
                  styles.filterBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[styles.filterBtnText, { color: colors.text }]}
                >
                  {selectedGoalName}
                </Text>
                <ChevronDown size={14} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                onPress={() => setShowManual(true)}
                style={[styles.addBtn, { backgroundColor: colors.gold }]}
              >
                <Plus size={22} color="#020617" />
              </Pressable>
            </View>
          </View>

          {/* Top Summary cards */}
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Lifetime count"
              value={String(totalCount)}
              colors={colors}
            />
            <SummaryCard
              label="Time spent"
              value={formatDuration(totalSeconds)}
              colors={colors}
            />
            <SummaryCard
              label="Best day"
              value={String(bestDayCount)}
              colors={colors}
            />
            <SummaryCard
              label="Streak days"
              value={`${currentStreak}d`}
              colors={colors}
              icon={<Flame size={14} color={colors.gold} />}
            />
          </View>

          {/* Chart */}
          <View style={{ marginTop: 20 }}>
            <View style={styles.tabs}>
              <Chip
                label="7 days"
                active={range === 'daily'}
                onPress={() => setRange('daily')}
              />
              <Chip
                label="8 weeks"
                active={range === 'weekly'}
                onPress={() => setRange('weekly')}
              />
            </View>

            <Card style={{ marginTop: 12 }}>
              <View style={styles.chart}>
                {chartData.map((d) => {
                  const h = Math.max(4, (d.count / maxCount) * 120);
                  return (
                    <View key={d.dateStr + d.name} style={styles.barCol}>
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                        {d.count || ''}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: h,
                            backgroundColor:
                              d.count > 0 ? colors.gold : colors.inputBg,
                          },
                        ]}
                      />
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>
                        {d.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </View>

          {/* Prayer Streak Banner */}
          {prayerStreak > 0 && (
            <View
              style={[
                styles.streakBanner,
                {
                  backgroundColor: colors.card,
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                },
              ]}
            >
              <View
                style={[
                  styles.streakIconWrap,
                  { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
                ]}
              >
                <Flame size={24} color="#f59e0b" />
              </View>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={[styles.streakNumber, { color: colors.text }]}>
                  {prayerStreak}
                </Text>
                <Text style={[styles.streakSubtitle, { color: colors.textSecondary }]}>
                  day streak completing all 5 prayers
                </Text>
              </View>
            </View>
          )}

          {/* Prayer completions today */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
              Today&apos;s prayers
            </Text>
            <View style={styles.prayerGrid}>
              {PRAYERS.map((p) => {
                const done = todayPrayers.has(p.id);
                return (
                  <View
                    key={p.id}
                    style={[
                      styles.prayerCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: done ? colors.success : colors.cardBorder,
                      },
                    ]}
                  >
                    {done ? (
                      <Check size={16} color={colors.success} />
                    ) : (
                      <Circle size={16} color={colors.textMuted} />
                    )}
                    <Text
                      style={{
                        color: done ? colors.success : colors.textSecondary,
                        fontSize: 12,
                        fontWeight: '600',
                        marginTop: 6,
                      }}
                    >
                      {p.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Weekly Prayer Adhkar */}
          <View style={{ marginTop: 20 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
              Weekly Prayer Adhkar
            </Text>
            <Card style={{ marginTop: 12, padding: 14 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ minWidth: '100%' }}
              >
                <View style={{ flex: 1 }}>
                  {/* Header row */}
                  <View
                    style={[
                      styles.matrixHeaderRow,
                      { borderBottomColor: colors.cardBorder },
                    ]}
                  >
                    <View style={styles.matrixDayCol}>
                      <Text style={[styles.matrixHeaderText, { color: colors.textMuted }]}>
                        Day
                      </Text>
                    </View>
                    {PRAYERS.map((p) => (
                      <View key={p.id} style={styles.matrixPrayerCol}>
                        <Text
                          style={[styles.matrixHeaderText, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {p.arabicName}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* 7 day rows */}
                  {prayerStatsByDay.map((day, idx) => {
                    const isLast = idx === prayerStatsByDay.length - 1;
                    return (
                      <View
                        key={day.dateStr}
                        style={[
                          styles.matrixRow,
                          {
                            borderBottomWidth: isLast ? 0 : 1,
                            borderBottomColor: colors.cardBorder,
                            backgroundColor: day.isToday
                              ? (colors.goldMuted || 'rgba(245, 158, 11, 0.10)')
                              : 'transparent',
                          },
                        ]}
                      >
                        <View style={styles.matrixDayCol}>
                          <Text
                            style={[
                              styles.matrixDayText,
                              {
                                color: day.isToday ? colors.gold : colors.textSecondary,
                                fontWeight: day.isToday ? '700' : '500',
                              },
                            ]}
                          >
                            {day.dayName}
                          </Text>
                        </View>
                        {day.prayers.map((prayer) => (
                          <View key={prayer.id} style={styles.matrixPrayerCol}>
                            {prayer.completed ? (
                              <View
                                style={[
                                  styles.matrixCheckCircle,
                                  { backgroundColor: 'rgba(16, 185, 129, 0.20)' },
                                ]}
                              >
                                <Check size={12} color={colors.success} />
                              </View>
                            ) : (
                              <View style={styles.matrixIncompleteCircle}>
                                <Circle size={12} color={colors.textMuted} />
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </Card>
          </View>

          {/* Active goals snapshot */}
          {targets.filter((t) => t.status === 'active').length > 0 && (
            <View style={{ marginTop: 20, gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                Active goals
              </Text>
              {targets
                .filter((t) => t.status === 'active')
                .map((t) => {
                  const pct = Math.min(100, (t.currentCount / t.targetCount) * 100);
                  return (
                    <Card key={t.id}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>
                        {t.title}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                        {t.currentCount}/{t.targetCount} ({Math.round(pct)}%)
                      </Text>
                      <View
                        style={[
                          styles.progressTrack,
                          { backgroundColor: colors.inputBg, marginTop: 8 },
                        ]}
                      >
                        <View
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            backgroundColor: colors.gold,
                            borderRadius: 3,
                          }}
                        />
                      </View>
                    </Card>
                  );
                })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Goal Filter Modal */}
      <Modal visible={showGoalFilter} transparent animationType="fade">
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setShowGoalFilter(false)}
        >
          <Pressable
            style={styles.pickerBackdropTap}
            onPress={(e) => e.stopPropagation()}
          >
            <Card style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Title style={{ fontSize: 18 }}>Filter by Goal</Title>
                <Pressable
                  onPress={() => setShowGoalFilter(false)}
                  hitSlop={8}
                  style={[styles.closeBtn, { backgroundColor: colors.inputBg }]}
                >
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: 320 }}
                contentContainerStyle={{ gap: 8 }}
                showsVerticalScrollIndicator={false}
              >
                {/* All Goals option */}
                <Pressable
                  onPress={() => {
                    setSelectedTargetId('all');
                    setShowGoalFilter(false);
                  }}
                  style={[
                    styles.goalOption,
                    {
                      backgroundColor:
                        selectedTargetId === 'all'
                          ? colors.goldMuted
                          : colors.inputBg,
                      borderColor:
                        selectedTargetId === 'all'
                          ? colors.gold
                          : colors.cardBorder,
                    },
                  ]}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: selectedTargetId === 'all' ? '700' : '600',
                        color:
                          selectedTargetId === 'all'
                            ? colors.gold
                            : colors.text,
                      }}
                    >
                      All Goals
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      Combined statistics across all dhikr
                    </Text>
                  </View>
                  {selectedTargetId === 'all' && (
                    <Check size={18} color={colors.gold} />
                  )}
                </Pressable>

                {/* Individual targets */}
                {targets.map((t) => {
                  const isSelected = selectedTargetId === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        setSelectedTargetId(t.id);
                        setShowGoalFilter(false);
                      }}
                      style={[
                        styles.goalOption,
                        {
                          backgroundColor: isSelected
                            ? colors.goldMuted
                            : colors.inputBg,
                          borderColor: isSelected
                            ? colors.gold
                            : colors.cardBorder,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: isSelected ? '700' : '600',
                            color: isSelected ? colors.gold : colors.text,
                          }}
                          numberOfLines={1}
                        >
                          {t.title}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          {t.currentCount.toLocaleString()} / {t.targetCount.toLocaleString()} ({Math.round(Math.min(100, (t.currentCount / t.targetCount) * 100))}%)
                          {t.status !== 'active' ? ` • ${t.status}` : ''}
                        </Text>
                      </View>
                      {isSelected && (
                        <Check size={18} color={colors.gold} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Manual offline entry modal */}
      <Modal visible={showManual} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Card style={{ marginHorizontal: 20 }}>
            <Title style={{ fontSize: 20 }}>Add counts</Title>
            <Subtitle>Log dhikr you did offline</Subtitle>
            <TextInput
              value={manualCount}
              onChangeText={setManualCount}
              placeholder="Count"
              keyboardType="number-pad"
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
            <TextInput
              value={manualDate}
              onChangeText={setManualDate}
              placeholder="YYYY-MM-DD"
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
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => setShowManual(false)}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.inputBg }]}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleManual}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.gold }]}
              >
                <Text style={{ color: '#020617', fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function SummaryCard({
  label,
  value,
  colors,
  icon,
}: {
  label: string;
  value: string;
  colors: { card: string; cardBorder: string; text: string; textMuted: string; gold: string };
  icon?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon}
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
      </View>
      <Text style={{ color: colors.gold, fontSize: 22, fontWeight: '700', marginTop: 4 }}>
        {value}
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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 140,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  summaryCard: {
    width: '47%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 160,
    paddingTop: 8,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: 18,
    borderRadius: 6,
  },
  prayerGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  prayerCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
  pickerBackdropTap: {
    marginHorizontal: 20,
  },
  pickerCard: {
    maxHeight: 420,
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginTop: 20,
  },
  streakIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
  streakSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  matrixHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  matrixHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  matrixDayCol: {
    width: 48,
    justifyContent: 'center',
  },
  matrixDayText: {
    fontSize: 12,
  },
  matrixPrayerCol: {
    flex: 1,
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixIncompleteCircle: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
