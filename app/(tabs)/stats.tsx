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
import { Plus, Flame, Check, Circle } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { Screen, Card, Title, Subtitle, Chip } from '@/components/ui';
import {
  useLogs,
  useTargets,
  useDurations,
  usePrayerCompletions,
} from '@/hooks/useDatabase';
import { addLog, updateTarget, getTarget } from '@/lib/db';
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
  const [showManual, setShowManual] = useState(false);
  const [manualCount, setManualCount] = useState('');
  const [manualDate, setManualDate] = useState(todayStr());

  const chartData = useMemo(() => {
    const now = new Date();
    if (range === 'daily') {
      return Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(now, 6 - i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const count = logs
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
      const count = logs
        .filter((l) => l.dateStr >= startStr && l.dateStr <= endStr)
        .reduce((a, l) => a + l.count, 0);
      return { name: `W${i + 1}`, dateStr: endStr, count };
    });
  }, [logs, range]);

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);
  const totalCount = logs.reduce((a, l) => a + l.count, 0);
  const todayTotal = logs
    .filter((l) => l.dateStr === todayStr())
    .reduce((a, l) => a + l.count, 0);
  const uniqueDates = [...new Set(logs.map((l) => l.dateStr))];
  const { currentStreak, longestStreak } = calculateStreak(uniqueDates);
  const totalSeconds = durations.reduce((a, d) => a + d.seconds, 0);

  const todayPrayers = new Set(
    prayerCompletions.filter((p) => p.dateStr === todayStr()).map((p) => p.prayer)
  );

  const handleManual = async () => {
    const count = parseInt(manualCount, 10);
    if (!count) return;
    await addLog({
      count,
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
            <View>
              <Title>Progress</Title>
              <Subtitle>Your dhikr journey</Subtitle>
            </View>
            <Pressable
              onPress={() => setShowManual(true)}
              style={[styles.addBtn, { backgroundColor: colors.gold }]}
            >
              <Plus size={22} color="#020617" />
            </Pressable>
          </View>

          {/* Summary cards */}
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Today"
              value={String(todayTotal)}
              colors={colors}
            />
            <SummaryCard
              label="All time"
              value={String(totalCount)}
              colors={colors}
            />
            <SummaryCard
              label="Streak"
              value={`${currentStreak}d`}
              colors={colors}
              icon={<Flame size={14} color={colors.gold} />}
            />
            <SummaryCard
              label="Best streak"
              value={`${longestStreak}d`}
              colors={colors}
            />
          </View>

          <Card style={{ marginTop: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Total time counting
            </Text>
            <Text style={{ color: colors.gold, fontSize: 22, fontWeight: '700', marginTop: 4 }}>
              {formatDuration(totalSeconds)}
            </Text>
          </Card>

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
});
