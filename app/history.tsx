import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import Text from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, BookOpen } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';

import { useTheme } from '@/context/ThemeContext';
import { Screen, Card, Title, Subtitle } from '@/components/ui';
import { useAdhkarSessions, useAdhkarJournal } from '@/hooks/useDatabase';
import { formatDuration } from '@/lib/utils';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const sessions = useAdhkarSessions();
  const journal = useAdhkarJournal();

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 50),
    [sessions]
  );

  const sortedJournal = useMemo(
    () =>
      [...journal]
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
        .slice(0, 100),
    [journal]
  );

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <View>
            <Title style={{ fontSize: 22 }}>History</Title>
            <Subtitle>Sessions & journal</Subtitle>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={[styles.section, { color: colors.text }]}>Sessions</Text>
          {sortedSessions.length === 0 ? (
            <Card>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                No adhkar sessions yet. Complete a collection to see history here.
              </Text>
            </Card>
          ) : (
            sortedSessions.map((s) => (
              <Card key={s.id} style={{ marginBottom: 10 }}>
                <View style={styles.sessionTop}>
                  <BookOpen size={16} color={colors.gold} />
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: '700',
                      flex: 1,
                      marginLeft: 8,
                    }}
                  >
                    {s.collectionName}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {format(parseISO(s.startedAt), 'MMM d')}
                  </Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>
                  {s.completedItems}/{s.totalItems} items · {s.totalCounts} counts ·{' '}
                  {formatDuration(s.durationSeconds)}
                </Text>
              </Card>
            ))
          )}

          <Text style={[styles.section, { color: colors.text, marginTop: 20 }]}>
            Journal
          </Text>
          {sortedJournal.length === 0 ? (
            <Card>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                Completed dhikr entries will appear here.
              </Text>
            </Card>
          ) : (
            sortedJournal.map((j) => (
              <View
                key={j.id}
                style={[
                  styles.journalRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {j.dhikrName}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {j.collectionName} · {j.dateStr}
                  </Text>
                </View>
                <Text style={{ color: colors.gold, fontWeight: '700' }}>
                  {j.count}/{j.target}
                </Text>
              </View>
            ))
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
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
  },
  section: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  journalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
});
