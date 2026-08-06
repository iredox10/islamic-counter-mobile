import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import Text from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FONTS } from '@/lib/fonts';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format, differenceInDays } from 'date-fns';
import {
  Plus,
  Trash2,
  Trophy,
  Target as TargetIcon,
  Lock,
  Star,
  Clock,
  Repeat,
  Share2,
  PlayCircle,
} from 'lucide-react-native';
import safeStorage from '@/lib/storage';

import { useTheme } from '@/context/ThemeContext';
import { Screen, Card, Title, Chip, GoldButton } from '@/components/ui';
import { useTargets, useAchievements } from '@/hooks/useDatabase';
import { addTarget, deleteTarget } from '@/lib/db';
import { ACHIEVEMENTS, type Achievement } from '@/lib/achievements';
import { ADHKAR_PRESETS } from '@/lib/adhkar';
import { KEYS } from '@/hooks/useSettings';
import { shareProgress } from '@/lib/share';
import type { Target } from '@/lib/types';
import {
  scheduleGoalReminders,
  cancelGoalReminders,
} from '@/lib/goalReminders';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GAP_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
];
const CATEGORY_SECTIONS: { title: string; categories: Achievement['category'][] }[] = [
  { title: 'Count Milestones', categories: ['count'] },
  { title: 'Streak Mastery', categories: ['streak'] },
  { title: 'Goal Achiever', categories: ['goal'] },
  { title: 'Special Moments', categories: ['time', 'special'] },
  { title: 'Prayer Commitment', categories: ['prayer'] },
];

export default function TargetsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const targets = useTargets();
  const unlocked = useAchievements();
  const [tab, setTab] = useState<'goals' | 'badges'>('goals');
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [reminderType, setReminderType] = useState<'one-off' | 'recurring'>('one-off');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [reminderGap, setReminderGap] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [picker, setPicker] = useState<{
    field: 'start' | 'deadline' | 'time';
    mode: 'date' | 'time';
  } | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  const active = targets.filter((t) => t.status === 'active');
  const completed = targets.filter((t) => t.status === 'completed');
  const unlockedMap = new Map(unlocked.map((a) => [a.achievementId, a.unlockedAt]));

  const resetForm = () => {
    setTitle('');
    setTargetCount('');
    setStartTime(null);
    setDeadline(null);
    setReminderGap(null);
    setReminderTime(null);
    setSelectedDays([]);
    setPicker(null);
    setTempDate(null);
  };

  const toggleDay = (index: number) => {
    setSelectedDays((prev) =>
      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index]
    );
  };

  const openPicker = (field: 'start' | 'deadline') => {
    const value = field === 'deadline' ? (deadline ?? new Date()) : (startTime ?? new Date());
    if (value.getTime() <= new Date().getTime() && field === 'deadline') {
      value.setDate(value.getDate() + 1);
    }
    setTempDate(null);
    setPicker({ field, mode: 'date' });
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed' || !selected) {
      setPicker(null);
      setTempDate(null);
      return;
    }
    if (picker?.field === 'time') {
      setReminderTime(selected);
      setPicker(null);
      return;
    }
    if (picker?.mode === 'date') {
      setTempDate(selected);
      setPicker({ ...picker, mode: 'time' });
      return;
    }
    const base = tempDate ?? new Date();
    const merged = new Date(base);
    merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    if (picker?.field === 'deadline') setDeadline(merged);
    else setStartTime(merged);
    setTempDate(null);
    setPicker(null);
  };

  const handleAdd = async () => {
    if (!title.trim() || !targetCount) return;
    const num = parseInt(targetCount, 10);
    if (isNaN(num) || num <= 0) return;

    const payload: Partial<Target> = {
      title: title.trim(),
      targetCount: num,
      currentCount: 0,
      deadline: deadline ? deadline.toISOString() : undefined,
      createdAt: new Date().toISOString(),
      status: 'active',
      reminderType,
    };
    if (reminderType === 'one-off') {
      payload.startTime = (startTime ?? new Date()).toISOString();
      payload.reminderGap = reminderGap ?? undefined;
    } else {
      payload.frequency = frequency;
      payload.reminderTime = reminderTime ? format(reminderTime, 'HH:mm') : undefined;
      payload.reminderDays = frequency === 'weekly' ? selectedDays : undefined;
    }

    const created = await addTarget(payload as Omit<Target, 'id'>);
    await scheduleGoalReminders(created);
    resetForm();
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
    const target = targets.find((t) => t.id === id);
    Alert.alert('Delete goal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (target) await cancelGoalReminders(target);
          await deleteTarget(id);
        },
      },
    ]);
  };

  const handleShare = (t: Target) => {
    shareProgress({
      title: t.title,
      count: t.currentCount,
      targetCount: t.targetCount,
      completedAt: new Date(),
    });
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Title>Goals &amp; Badges</Title>
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
            <Chip
              label={`Badges ${unlocked.length}/${ACHIEVEMENTS.length}`}
              active={tab === 'badges'}
              onPress={() => setTab('badges')}
            />
          </View>

          {tab === 'goals' ? (
            <View style={{ gap: 12, marginTop: 16 }}>
              {active.length === 0 && (
                <Card>
                  <Trophy size={36} color={colors.textMuted} style={styles.emptyIcon} />
                  <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                    No active goals
                  </Text>
                </Card>
              )}

              {active.map((t) => {
                const pct = Math.min(100, (t.currentCount / t.targetCount) * 100);
                const daysLeft = t.deadline
                  ? differenceInDays(new Date(t.deadline), new Date())
                  : null;
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
                        <View style={styles.goalTitleRow}>
                          <Text
                            style={{
                              color: colors.text,
                              fontWeight: '700',
                              fontSize: 16,
                              flexShrink: 1,
                            }}
                          >
                            {t.title}
                          </Text>
                          <PlayCircle size={14} color={colors.gold} style={{ opacity: 0.7 }} />
                        </View>
                        <View style={styles.metaRow}>
                          <View
                            style={[
                              styles.pill,
                              { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                            ]}
                          >
                            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                              {t.targetCount.toLocaleString()}
                            </Text>
                          </View>
                          {daysLeft !== null && (
                            <View style={styles.metaItem}>
                              <Clock
                                size={10}
                                color={daysLeft < 3 ? colors.danger : colors.textMuted}
                              />
                              <Text
                                style={{
                                  color: daysLeft < 3 ? colors.danger : colors.textMuted,
                                  fontSize: 11,
                                }}
                              >
                                {daysLeft} days left
                              </Text>
                            </View>
                          )}
                          {t.reminderType === 'recurring' && t.reminderTime && (
                            <View
                              style={[
                                styles.pill,
                                { backgroundColor: colors.goldMuted, borderColor: 'transparent' },
                              ]}
                            >
                              <Repeat size={10} color={colors.gold} />
                              <Text style={{ color: colors.gold, fontSize: 11 }}>
                                {t.frequency === 'daily' ? 'Daily' : 'Weekly'} {t.reminderTime}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.goalActions}>
                        {pct >= 50 && (
                          <Pressable onPress={() => handleShare(t)} hitSlop={10} style={styles.actionBtn}>
                            <Share2 size={16} color={colors.textSecondary} />
                          </Pressable>
                        )}
                        <Pressable onPress={() => handleDelete(t.id)} hitSlop={10} style={styles.actionBtn}>
                          <Trash2 size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={[styles.bar, { backgroundColor: colors.inputBg }]}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: colors.gold },
                        ]}
                      />
                    </View>
                    <View style={styles.barLabels}>
                      <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                        {t.currentCount.toLocaleString()} done
                      </Text>
                      <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                        {Math.round(pct)}%
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {completed.length > 0 && (
                <>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', marginTop: 8 }}>
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
                          {t.targetCount.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : (
            <View style={{ marginTop: 16, gap: 20 }}>
              <Card>
                <View style={styles.overviewTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={[styles.trophyBox, { backgroundColor: colors.goldMuted }]}>
                      <Trophy size={20} color={colors.gold} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                        {unlocked.length} / {ACHIEVEMENTS.length}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textMuted }}>
                        Achievements Unlocked
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontWeight: '800', fontSize: 14, color: colors.gold }}>
                    {Math.round((unlocked.length / ACHIEVEMENTS.length) * 100)}%
                  </Text>
                </View>
                <View style={[styles.bar, { backgroundColor: colors.inputBg }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%`,
                        backgroundColor: colors.gold,
                      },
                    ]}
                  />
                </View>
              </Card>

              {CATEGORY_SECTIONS.map((section) => {
                const items = ACHIEVEMENTS.filter((a) =>
                  section.categories.includes(a.category)
                );
                if (items.length === 0) return null;
                return (
                  <View key={section.title}>
                    <Text style={[styles.sectionTitle, { color: colors.gold }]}>
                      {section.title}
                    </Text>
                    <View style={styles.badgeGrid}>
                      {items.map((a) => {
                        const unlockedAt = unlockedMap.get(a.id);
                        const isUnlocked = !!unlockedAt;
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
                            <Text style={{ fontSize: 26, opacity: isUnlocked ? 1 : 0.45 }}>
                              {a.icon}
                            </Text>
                            <Text
                              style={{
                                color: isUnlocked ? colors.text : colors.textSecondary,
                                fontWeight: '700',
                                fontSize: 11,
                                textAlign: 'center',
                                marginTop: 6,
                              }}
                              numberOfLines={2}
                            >
                              {a.title}
                            </Text>
                            {isUnlocked ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 }}>
                                <Star size={10} color={colors.gold} />
                                <Text style={{ fontSize: 9, color: colors.gold }}>
                                  {format(new Date(unlockedAt), 'MMM d, yyyy')}
                                </Text>
                              </View>
                            ) : (
                              <Lock size={10} color={colors.textMuted} style={{ marginTop: 5 }} />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showForm} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <Card style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TargetIcon size={20} color={colors.gold} />
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
                    New Goal
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                >
                  {ADHKAR_PRESETS.map((p) => (
                    <Pressable
                      key={p.title}
                      onPress={() => {
                        setTitle(p.title);
                        setTargetCount(p.target.toString());
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
                </ScrollView>

                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Goal Title (e.g. 1000 Salawat)"
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

                <View
                  style={[
                    styles.formSection,
                    { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                  ]}
                >
                  <View style={styles.toggleRow}>
                    <Pressable
                      onPress={() => setReminderType('one-off')}
                      style={[
                        styles.toggleBtn,
                        reminderType === 'one-off' && { backgroundColor: colors.goldMuted },
                      ]}
                    >
                      <Clock
                        size={14}
                        color={reminderType === 'one-off' ? colors.gold : colors.textMuted}
                      />
                      <Text
                        style={{
                          color:
                            reminderType === 'one-off' ? colors.gold : colors.textMuted,
                          fontSize: 12,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        One-Time
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setReminderType('recurring')}
                      style={[
                        styles.toggleBtn,
                        reminderType === 'recurring' && { backgroundColor: colors.goldMuted },
                      ]}
                    >
                      <Repeat
                        size={14}
                        color={reminderType === 'recurring' ? colors.gold : colors.textMuted}
                      />
                      <Text
                        style={{
                          color:
                            reminderType === 'recurring' ? colors.gold : colors.textMuted,
                          fontSize: 12,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        Recurring
                      </Text>
                    </Pressable>
                  </View>

                  {reminderType === 'one-off' ? (
                    <>
                      <View style={styles.row2}>
                        <DateTimeField
                          label="Start Time"
                          value={startTime}
                          placeholder="Now"
                          onPress={() => openPicker('start')}
                        />
                        <DateTimeField
                          label="Deadline"
                          value={deadline}
                          placeholder="Optional"
                          danger={!!deadline && deadline.getTime() < Date.now()}
                          onPress={() => openPicker('deadline')}
                        />
                      </View>
                      <View>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                          Remind if late
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                          {GAP_OPTIONS.map((g) => {
                            const selected = g.value === reminderGap;
                            return (
                              <Pressable
                                key={g.label}
                                onPress={() => setReminderGap(g.value)}
                                style={[
                                  styles.miniChip,
                                  {
                                    backgroundColor: selected ? colors.gold : colors.backgroundSecondary,
                                    borderColor: selected ? colors.gold : colors.cardBorder,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '700',
                                    color: selected ? '#020617' : colors.textSecondary,
                                  }}
                                >
                                  {g.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    </>
                  ) : (
                    <View style={{ gap: 12 }}>
                      <View style={styles.row2}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                            Frequency
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                            {(['daily', 'weekly'] as const).map((f) => {
                              const active = frequency === f;
                              return (
                                <Pressable
                                  key={f}
                                  onPress={() => setFrequency(f)}
                                  style={[
                                    styles.miniChip,
                                    {
                                      backgroundColor: active
                                        ? colors.gold
                                        : colors.backgroundSecondary,
                                      borderColor: active ? colors.gold : colors.cardBorder,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: '700',
                                      textTransform: 'capitalize',
                                      color: active ? '#020617' : colors.textSecondary,
                                    }}
                                  >
                                    {f}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                            Time
                          </Text>
                          <Pressable
                            onPress={() => setPicker({ field: 'time', mode: 'time' })}
                            style={[
                              styles.fieldBox,
                              {
                                backgroundColor: colors.backgroundSecondary,
                                borderColor: colors.cardBorder,
                              },
                            ]}
                          >
                            <Clock size={12} color={colors.gold} />
                            <Text
                              style={{
                                color: reminderTime ? colors.text : colors.textMuted,
                                fontSize: 12,
                              }}
                            >
                              {reminderTime ? format(reminderTime, 'HH:mm') : 'Set time'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      {frequency === 'weekly' && (
                        <View style={styles.daysRow}>
                          {WEEK_DAYS.map((day, i) => {
                            const selected = selectedDays.includes(i);
                            return (
                              <Pressable
                                key={day}
                                onPress={() => toggleDay(i)}
                                style={[
                                  styles.dayCircle,
                                  {
                                    backgroundColor: selected
                                      ? colors.gold
                                      : colors.backgroundSecondary,
                                    borderColor: selected ? colors.gold : colors.cardBorder,
                                  },
                                ]}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontWeight: '800',
                                    color: selected ? '#020617' : colors.textSecondary,
                                  }}
                                >
                                  {day.charAt(0)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <GoldButton label="Create Goal" onPress={handleAdd} />
                <Pressable
                  onPress={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Card>
        </View>

        {picker && (
          <DateTimePicker
            value={
              picker.field === 'deadline'
                ? (deadline ?? new Date())
                : picker.field === 'start'
                ? (startTime ?? new Date())
                : (reminderTime ?? new Date())
            }
            mode={picker.mode}
            is24Hour
            onChange={onPickerChange}
          />
        )}
      </Modal>
    </Screen>
  );
}

function DateTimeField({
  label,
  value,
  placeholder,
  onPress,
  danger,
}: {
  label: string;
  value: Date | null;
  placeholder: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[
          styles.fieldBox,
          { backgroundColor: colors.backgroundSecondary, borderColor: colors.cardBorder },
        ]}
      >
        <Clock size={12} color={danger ? colors.danger : colors.gold} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            color: danger
              ? colors.danger
              : value
              ? colors.text
              : colors.textMuted,
            fontSize: 12,
          }}
        >
          {value ? format(value, 'MMM d, HH:mm') : placeholder}
        </Text>
      </Pressable>
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  actionBtn: {
    padding: 6,
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
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyIcon: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  overviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trophyBox: {
    padding: 10,
    borderRadius: 12,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  modalCard: {
    marginHorizontal: 20,
    maxHeight: '88%',
  },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  formSection: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 6,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  miniChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});