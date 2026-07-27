import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Trash2, Trophy, Target as TargetIcon, Lock } from 'lucide-react-native';
import safeStorage from '@/lib/storage';

import { useTheme } from '@/context/ThemeContext';
import { Screen, Card, Title, Subtitle, Chip } from '@/components/ui';
import { useTargets, useAchievements } from '@/hooks/useDatabase';
import { addTarget, deleteTarget } from '@/lib/db';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { ADHKAR_PRESETS } from '@/lib/adhkar';
import { KEYS } from '@/hooks/useSettings';

export default function TargetsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const targets = useTargets();
  const unlocked = useAchievements();
  const [tab, setTab] = useState<'goals' | 'badges'>('goals');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [targetCount, setTargetCount] = useState('');

  const active = targets.filter((t) => t.status === 'active');
  const completed = targets.filter((t) => t.status === 'completed');
  const unlockedMap = new Map(unlocked.map((a) => [a.achievementId, a.unlockedAt]));

  const handleAdd = async () => {
    if (!title.trim() || !targetCount) return;
    await addTarget({
      title: title.trim(),
      targetCount: parseInt(targetCount, 10),
      currentCount: 0,
      createdAt: new Date().toISOString(),
      status: 'active',
      reminderType: 'one-off',
    });
    setTitle('');
    setTargetCount('');
    setShowForm(false);
  };

  const handleSelect = async (id: number, currentCount: number) => {
    await safeStorage.setItem(
      KEYS.counterState,
      JSON.stringify({ count: currentCount, targetId: id })
    );
    router.push('/');
  };

  const handleDelete = (id: number) => {
    Alert.alert('Delete goal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteTarget(id),
      },
    ]);
  };

  const quickPresets = ADHKAR_PRESETS.slice(0, 4);

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View>
              <Title>Goals & Badges</Title>
              <Subtitle>
                {unlocked.length}/{ACHIEVEMENTS.length} badges unlocked
              </Subtitle>
            </View>
            {tab === 'goals' && (
              <Pressable
                onPress={() => setShowForm(true)}
                style={[styles.addBtn, { backgroundColor: colors.gold }]}
              >
                <Plus size={22} color="#020617" />
              </Pressable>
            )}
          </View>

          <View style={styles.tabs}>
            <Chip label="Goals" active={tab === 'goals'} onPress={() => setTab('goals')} />
            <Chip label="Badges" active={tab === 'badges'} onPress={() => setTab('badges')} />
          </View>

          {tab === 'goals' ? (
            <View style={{ gap: 12, marginTop: 16 }}>
              {active.length === 0 && completed.length === 0 ? (
                <Card>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                    No goals yet. Create one to track your dhikr targets.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {quickPresets.map((p) => (
                      <Pressable
                        key={p.title}
                        onPress={async () => {
                          await addTarget({
                            title: p.title,
                            targetCount: p.target,
                            currentCount: 0,
                            createdAt: new Date().toISOString(),
                            status: 'active',
                          });
                        }}
                        style={[
                          styles.presetChip,
                          { backgroundColor: colors.goldMuted, borderColor: colors.gold },
                        ]}
                      >
                        <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '600' }}>
                          {p.title} ×{p.target}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              ) : null}

              {active.map((t) => {
                const pct = Math.min(100, (t.currentCount / t.targetCount) * 100);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => handleSelect(t.id, t.currentCount)}
                    style={[
                      styles.goalCard,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    ]}
                  >
                    <View style={styles.goalTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                          {t.title}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                          {t.currentCount} / {t.targetCount}
                        </Text>
                      </View>
                      <Pressable onPress={() => handleDelete(t.id)} hitSlop={12}>
                        <Trash2 size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                    <View style={[styles.bar, { backgroundColor: colors.inputBg }]}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: colors.gold },
                        ]}
                      />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                      Tap to count · {Math.round(pct)}%
                    </Text>
                  </Pressable>
                );
              })}

              {completed.length > 0 && (
                <>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontWeight: '600',
                      marginTop: 8,
                    }}
                  >
                    Completed
                  </Text>
                  {completed.map((t) => (
                    <View
                      key={t.id}
                      style={[
                        styles.goalCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.success,
                          opacity: 0.85,
                        },
                      ]}
                    >
                      <View style={styles.goalTop}>
                        <Trophy size={18} color={colors.success} />
                        <Text
                          style={{
                            color: colors.text,
                            fontWeight: '600',
                            flex: 1,
                            marginLeft: 8,
                          }}
                        >
                          {t.title}
                        </Text>
                        <Text style={{ color: colors.success, fontSize: 12 }}>
                          {t.targetCount}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : (
            <View style={styles.badgeGrid}>
              {ACHIEVEMENTS.map((a) => {
                const isUnlocked = unlockedMap.has(a.id);
                return (
                  <View
                    key={a.id}
                    style={[
                      styles.badge,
                      {
                        backgroundColor: colors.card,
                        borderColor: isUnlocked ? colors.gold : colors.cardBorder,
                        opacity: isUnlocked ? 1 : 0.55,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 28 }}>{isUnlocked ? a.icon : '🔒'}</Text>
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: '700',
                        fontSize: 12,
                        textAlign: 'center',
                        marginTop: 6,
                      }}
                      numberOfLines={2}
                    >
                      {a.title}
                    </Text>
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 10,
                        textAlign: 'center',
                        marginTop: 4,
                      }}
                      numberOfLines={2}
                    >
                      {a.description}
                    </Text>
                    {!isUnlocked && (
                      <Lock
                        size={12}
                        color={colors.textMuted}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showForm} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Card style={{ marginHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TargetIcon size={20} color={colors.gold} />
              <Title style={{ fontSize: 20 }}>New goal</Title>
            </View>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. SubhanAllah"
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
              value={targetCount}
              onChangeText={setTargetCount}
              placeholder="Target count"
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
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => setShowForm(false)}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.inputBg }]}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleAdd}
                style={[styles.modalBtn, { flex: 1, backgroundColor: colors.gold }]}
              >
                <Text style={{ color: '#020617', fontWeight: '700' }}>Create</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
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
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  goalCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  goalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  badge: {
    width: '47%',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 120,
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
