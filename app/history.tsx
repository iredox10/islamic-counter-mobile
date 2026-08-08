import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import Text from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  BookOpen,
  Calendar,
  Clock,
  Flame,
  Target,
  TrendingUp,
  Download,
} from 'lucide-react-native';
import { format, parseISO, isToday, isYesterday, subDays } from 'date-fns';

import { useTheme } from '@/context/ThemeContext';
import { Screen, Card, Title, Subtitle } from '@/components/ui';
import {
  useAdhkarSessions,
  useAdhkarJournal,
  useAdhkarStreaks,
} from '@/hooks/useDatabase';
import { getWeeklySummary, exportHistoryJSON } from '@/lib/adhkarTracking';
import { ADHKAR_COLLECTIONS } from '@/lib/adhkar';
import { formatDuration } from '@/lib/utils';
import type { AdhkarSession, AdhkarJournal } from '@/lib/types';

type Tab = 'sessions' | 'journal' | 'streaks';
type Range = '7d' | '30d' | 'all';

const RANGE_LIMITS: Record<Range, number> = {
  '7d': 50,
  '30d': 200,
  all: 1000,
};

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const sessions = useAdhkarSessions();
  const journal = useAdhkarJournal();
  const streaks = useAdhkarStreaks();

  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [timeRange, setTimeRange] = useState<Range>('7d');

  const rangeStart = useMemo(() => {
    if (timeRange === 'all') return null;
    return subDays(new Date(), timeRange === '7d' ? 6 : 29);
  }, [timeRange]);

  const filteredSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt)
    );
    if (!rangeStart) return sorted.slice(0, RANGE_LIMITS[timeRange]);
    return sorted
      .filter((s) => parseISO(s.startedAt) >= rangeStart)
      .slice(0, RANGE_LIMITS[timeRange]);
  }, [sessions, rangeStart, timeRange]);

  const filteredJournal = useMemo(() => {
    const sorted = [...journal].sort((a, b) =>
      b.completedAt.localeCompare(a.completedAt)
    );
    if (!rangeStart) return sorted.slice(0, RANGE_LIMITS[timeRange] * 5);
    return sorted
      .filter((j) => parseISO(j.completedAt) >= rangeStart)
      .slice(0, RANGE_LIMITS[timeRange] * 5);
  }, [journal, rangeStart, timeRange]);

  const weekly = useMemo(() => getWeeklySummary(), [sessions]);

  const activeDays = useMemo(
    () => weekly.days.filter((d) => d.sessionsCount > 0).length,
    [weekly]
  );

  const groupedSessions = useMemo(() => {
    const map = new Map<string, AdhkarSession[]>();
    for (const s of filteredSessions) {
      const list = map.get(s.dateStr) ?? [];
      list.push(s);
      map.set(s.dateStr, list);
    }
    return [...map.entries()];
  }, [filteredSessions]);

  const groupedJournal = useMemo(() => {
    const map = new Map<string, AdhkarJournal[]>();
    for (const j of filteredJournal) {
      const list = map.get(j.dateStr) ?? [];
      list.push(j);
      map.set(j.dateStr, list);
    }
    return [...map.entries()];
  }, [filteredJournal]);

  const handleExport = async () => {
    try {
      const json = exportHistoryJSON();
      const filename = `adhkar-history-${format(new Date(), 'yyyy-MM-dd')}.json`;
      await Share.share(
        { message: json, title: filename },
        { dialogTitle: 'Export adhkar history' }
      );
    } catch {
      // share cancelled
    }
  };

  const collectionName = (id: string) =>
    ADHKAR_COLLECTIONS.find((c) => c.id === id)?.title ?? id;

  const formatDate = (dateStr: string): string => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
    { id: 'sessions', label: 'Sessions', icon: BookOpen },
    { id: 'journal', label: 'Journal', icon: Calendar },
    { id: 'streaks', label: 'Streaks', icon: Flame },
  ];

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Title style={{ fontSize: 22 }}>Adhkar History</Title>
            <Subtitle>Track your adhkar journey</Subtitle>
          </View>
          <Pressable onPress={handleExport} style={[styles.iconBtn, { backgroundColor: colors.inputBg }]}>
            <Download size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {weekly.totalCounts > 0 || activeDays > 0 ? (
            <View>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                <TrendingUp size={14} color={colors.gold} /> This Week
              </Text>
              <View style={styles.weekGrid}>
                <Card style={styles.weekCard}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>Total Counts</Text>
                  <Text style={[styles.weekValue, { color: colors.gold }]}>
                    {weekly.totalCounts.toLocaleString()}
                  </Text>
                </Card>
                <Card style={styles.weekCard}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>Total Time</Text>
                  <Text style={[styles.weekValue, { color: colors.success }]}>
                    {formatDuration(weekly.totalDuration)}
                  </Text>
                </Card>
                <Card style={styles.weekCard}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>Sessions</Text>
                  <Text style={[styles.weekValue, { color: colors.tint }]}>
                    {weekly.totalSessions}
                  </Text>
                </Card>
                <Card style={styles.weekCard}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>Active Days</Text>
                  <Text style={[styles.weekValue, { color: '#fb923c' }]}>{activeDays}</Text>
                </Card>
              </View>
            </View>
          ) : null}

          {/* Time range */}
          <View style={styles.rangeRow}>
            {(['7d', '30d', 'all'] as Range[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setTimeRange(r)}
                style={[
                  styles.rangeBtn,
                  {
                    backgroundColor: timeRange === r ? colors.goldMuted : colors.inputBg,
                    borderColor: timeRange === r ? colors.gold : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: timeRange === r ? colors.gold : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All Time'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={[
                    styles.tabBtn,
                    {
                      backgroundColor: active ? colors.goldMuted : colors.inputBg,
                      borderColor: active ? colors.gold : 'transparent',
                    },
                  ]}
                >
                  <Icon size={14} color={active ? colors.gold : colors.textSecondary} />
                  <Text
                    style={{
                      color: active ? colors.gold : colors.textSecondary,
                      fontSize: 13,
                      fontWeight: '600',
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {activeTab === 'sessions' && (
            <View style={styles.section}>
              {groupedSessions.length === 0 ? (
                <Card>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                    No sessions recorded yet.{'\n'}Start an adhkar collection to track your
                    progress.
                  </Text>
                </Card>
              ) : (
                groupedSessions.map(([date, dateSessions]) => (
                  <View key={date} style={styles.dateGroup}>
                    <View style={styles.dateHeader}>
                      <Calendar size={14} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                        {formatDate(date)}
                      </Text>
                    </View>
                    {dateSessions.map((s) => {
                      const complete = s.completedItems === s.totalItems;
                      return (
                        <Card key={s.id} style={styles.sessionCard}>
                          <View style={styles.sessionTop}>
                            <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
                              {s.collectionName}
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                              {format(parseISO(s.startedAt), 'h:mm a')}
                            </Text>
                          </View>
                          <View style={styles.sessionMeta}>
                            <View style={styles.metaItem}>
                              <Clock size={12} color={colors.textSecondary} />
                              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                                {formatDuration(s.durationSeconds)}
                              </Text>
                            </View>
                            <View style={styles.metaItem}>
                              <Target size={12} color={colors.textSecondary} />
                              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                                {s.totalCounts} counts
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.badge,
                                {
                                  backgroundColor: complete
                                    ? 'rgba(16,185,129,0.2)'
                                    : 'rgba(245,158,11,0.2)',
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: complete ? colors.success : '#FBBF24',
                                  fontSize: 11,
                                  fontWeight: '700',
                                }}
                              >
                                {s.completedItems}/{s.totalItems} completed
                              </Text>
                            </View>
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'journal' && (
            <View style={styles.section}>
              {groupedJournal.length === 0 ? (
                <Card>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                    No journal entries yet.{'\n'}Complete adhkar to build your journal.
                  </Text>
                </Card>
              ) : (
                groupedJournal.map(([date, entries]) => (
                  <View key={date} style={styles.dateGroup}>
                    <View style={styles.dateHeader}>
                      <Calendar size={14} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                        {formatDate(date)}
                      </Text>
                    </View>
                    <Card style={{ padding: 0 }}>
                      {entries.map((j, idx) => (
                        <View
                          key={j.id}
                          style={[
                            styles.journalRow,
                            {
                              borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                              borderTopColor: colors.cardBorder,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: '600' }}>
                              {j.dhikrName}
                            </Text>
                            {j.dhikrArabic ? (
                              <Text
                                style={{
                                  color: colors.gold,
                                  fontSize: 15,
                                  marginTop: 2,
                                  writingDirection: 'rtl',
                                }}
                              >
                                {j.dhikrArabic}
                              </Text>
                            ) : null}
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                              {j.collectionName}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: colors.gold, fontSize: 16, fontWeight: '700' }}>
                              {j.count}/{j.target}
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                              {format(parseISO(j.completedAt), 'h:mm a')}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </Card>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'streaks' && (
            <View style={styles.section}>
              {streaks.length === 0 ? (
                <Card>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                    No streaks yet.{'\n'}Complete adhkar daily to build streaks.
                  </Text>
                </Card>
              ) : (
                streaks.map((streak) => (
                  <Card key={streak.id} style={styles.streakCard}>
                    <View style={styles.streakTitleRow}>
                      <View style={[styles.flameWrap, { backgroundColor: 'rgba(249,115,22,0.2)' }]}>
                        <Flame size={20} color="#F97316" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>
                          {collectionName(streak.collectionId)}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                          Last: {formatDate(streak.lastCompletedDate)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.streakStats}>
                      <View style={[styles.streakStat, { backgroundColor: colors.inputBg }]}>
                        <Text style={[styles.streakNum, { color: '#F97316' }]}>
                          {streak.currentStreak}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Current</Text>
                      </View>
                      <View style={[styles.streakStat, { backgroundColor: colors.inputBg }]}>
                        <Text style={[styles.streakNum, { color: colors.gold }]}>
                          {streak.longestStreak}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>Longest</Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  back: {
    padding: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
  },
  sectionLabel: {
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 10,
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  weekCard: {
    width: '48%',
    padding: 14,
  },
  weekValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  rangeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  section: {
    gap: 14,
  },
  dateGroup: {
    gap: 8,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionCard: {
    marginBottom: 0,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  streakCard: {
    padding: 16,
  },
  streakTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  flameWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakStats: {
    flexDirection: 'row',
    gap: 10,
  },
  streakStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  streakNum: {
    fontSize: 22,
    fontWeight: '700',
  },
});