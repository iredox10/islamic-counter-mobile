import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Share,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Sun,
  Moon,
  Monitor,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Volume2,
  Bell,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import { Screen, Card, Title, Subtitle } from '@/components/ui';
import { useBooleanSetting, KEYS } from '@/hooks/useSettings';
import {
  getStoredReminders,
  saveReminders,
  updateReminder,
  type DailyReminder,
} from '@/lib/reminders';
import { clearAllData, exportAllData, importAndMergeData } from '@/lib/db';
import {
  requestNotificationPermissions,
  scheduleLocalReminder,
  cancelLocalReminder,
} from '@/lib/pushNotifications';
import {
  getSelectedSound,
  setSelectedSound,
  playCompletionSound,
  SOUND_OPTIONS,
  type NotificationSound,
} from '@/lib/sounds';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, theme, setTheme, resolvedTheme } = useTheme();
  const [soundEnabled, setSoundEnabled] = useBooleanSetting(KEYS.sound, false);
  const [autoReset, setAutoReset] = useBooleanSetting(KEYS.autoReset, false);
  const [reminders, setReminders] = useState<DailyReminder[]>([]);
  const [selectedSound, setSelectedSoundState] = useState<NotificationSound>('default');
  const [timePickerFor, setTimePickerFor] = useState<string | null>(null);

  useEffect(() => {
    getStoredReminders().then(setReminders);
    getSelectedSound().then(setSelectedSoundState);
  }, []);

  const themeOptions: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
    { value: 'dark', label: 'Dark', icon: <Moon size={18} color={theme === 'dark' ? colors.gold : colors.textMuted} /> },
    { value: 'light', label: 'Light', icon: <Sun size={18} color={theme === 'light' ? colors.gold : colors.textMuted} /> },
    { value: 'system', label: 'System', icon: <Monitor size={18} color={theme === 'system' ? colors.gold : colors.textMuted} /> },
  ];

  const toggleReminder = async (id: string) => {
    const reminder = reminders.find((r) => r.id === id);
    const targetState = !reminder?.enabled;
    if (targetState) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          'Permission needed',
          'Enable notifications for Islamic Counter in your device settings to receive daily reminders.'
        );
        return;
      }
    }
    const updated = updateReminder(reminders, id, {
      enabled: targetState,
    });
    setReminders(updated);
    await saveReminders(updated);
    const updatedReminder = updated.find((r) => r.id === id);
    if (!updatedReminder) return;
    if (targetState) {
      await scheduleLocalReminder(updatedReminder).catch((e) =>
        console.warn('scheduleLocalReminder failed', e)
      );
    } else {
      await cancelLocalReminder(updatedReminder).catch((e) =>
        console.warn('cancelLocalReminder failed', e)
      );
    }
  };

  const handleTimeChange = async (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed' || !selected || !timePickerFor) {
      setTimePickerFor(null);
      return;
    }
    const time = `${String(selected.getHours()).padStart(2, '0')}:${String(
      selected.getMinutes()
    ).padStart(2, '0')}`;
    const updated = updateReminder(reminders, timePickerFor, { time });
    setReminders(updated);
    saveReminders(updated);
    const reminder = updated.find((r) => r.id === timePickerFor);
    if (reminder?.enabled) {
      await scheduleLocalReminder(reminder).catch((e) =>
        console.warn('scheduleLocalReminder failed', e)
      );
    }
    setTimePickerFor(null);
  };

  const handleSoundSelect = async (sound: NotificationSound) => {
    setSelectedSoundState(sound);
    await setSelectedSound(sound);
    if (sound !== 'none') {
      playCompletionSound(sound);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      await Share.share({
        message: data,
        title: 'Islamic Counter Backup',
      });
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  };

  const handleImportPrompt = () => {
    Alert.prompt(
      'Import Backup',
      'Paste your database backup JSON string below:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Smart Merge',
          onPress: async (json?: string) => {
            if (!json) return;
            const res = await importAndMergeData(json, 'merge');
            Alert.alert(res.success ? 'Success' : 'Import Error', res.message);
          },
        },
        {
          text: 'Replace All',
          style: 'destructive',
          onPress: async (json?: string) => {
            if (!json) return;
            const res = await importAndMergeData(json, 'replace');
            Alert.alert(res.success ? 'Success' : 'Import Error', res.message);
          },
        },
      ],
      'plain-text'
    );
  };

  const handleClear = () => {
    Alert.alert(
      'Clear all data?',
      'This deletes all counts, goals, progress, and achievements. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear everything',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            Alert.alert('Done', 'All data has been cleared.');
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Title>Settings</Title>
          <Subtitle>Preferences & data</Subtitle>

          {/* Theme */}
          <Section title="Appearance" colors={colors}>
            <View style={styles.themeRow}>
              {themeOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setTheme(opt.value)}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor:
                        theme === opt.value ? colors.goldMuted : colors.inputBg,
                      borderColor:
                        theme === opt.value ? colors.gold : colors.cardBorder,
                    },
                  ]}
                >
                  {opt.icon}
                  <Text
                    style={{
                      color: theme === opt.value ? colors.gold : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: '600',
                      marginTop: 6,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
              Currently: {resolvedTheme}
            </Text>
          </Section>

          {/* Counter prefs */}
          <Section title="Counter" colors={colors}>
            <Row
              icon={<Volume2 size={18} color={colors.gold} />}
              label="Sound on tap"
              colors={colors}
              right={
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ true: colors.gold, false: colors.inputBg }}
                  thumbColor="#fff"
                />
              }
            />
            <Row
              icon={<RefreshCw size={18} color={colors.gold} />}
              label="Auto-reset at midnight"
              colors={colors}
              right={
                <Switch
                  value={autoReset}
                  onValueChange={setAutoReset}
                  trackColor={{ true: colors.gold, false: colors.inputBg }}
                  thumbColor="#fff"
                />
              }
            />
          </Section>

          {/* Reminders */}
          <Section title="Reminders" colors={colors}>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
              Configure daily Adhkar reminders for Salah times and morning/evening sessions.
            </Text>
            {reminders.map((r) => (
              <View key={r.id} style={styles.reminderRow}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => setTimePickerFor(r.id)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Bell size={18} color={r.enabled ? colors.gold : colors.textMuted} />
                    <Text style={{ color: colors.text, fontSize: 15, marginLeft: 10, flex: 1 }}>
                      {r.name}
                    </Text>
                    <View style={[styles.timeChip, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                      <Clock size={12} color={colors.gold} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                        {r.time}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 28, marginTop: 2 }}>
                    {r.message}
                  </Text>
                </Pressable>
                <Switch
                  value={r.enabled}
                  onValueChange={() => toggleReminder(r.id)}
                  trackColor={{ true: colors.gold, false: colors.inputBg }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </Section>

          {/* Notification Sound */}
          <Section title="Notification Sound" colors={colors}>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
              Played when a counter reaches its goal or a reminder fires.
            </Text>
            {SOUND_OPTIONS.map((sound) => {
              const active = selectedSound === sound.id;
              return (
                <Pressable
                  key={sound.id}
                  onPress={() => handleSoundSelect(sound.id)}
                  style={[
                    styles.soundRow,
                    {
                      backgroundColor: active ? colors.goldMuted : colors.inputBg,
                      borderColor: active ? colors.gold : colors.cardBorder,
                    },
                  ]}
                >
                  <Volume2 size={18} color={active ? colors.gold : colors.textMuted} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: active ? colors.gold : colors.text, fontSize: 14, fontWeight: '600' }}>
                      {sound.name}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {sound.description}
                    </Text>
                  </View>
                  {active ? <CheckCircle2 size={18} color={colors.gold} /> : null}
                </Pressable>
              );
            })}
          </Section>

          {/* Data */}
          <Section title="Data" colors={colors}>
            <Pressable onPress={handleExport}>
              <Row
                icon={<Download size={18} color={colors.gold} />}
                label="Export backup"
                colors={colors}
              />
            </Pressable>
            <Pressable onPress={handleImportPrompt}>
              <Row
                icon={<Upload size={18} color={colors.gold} />}
                label="Import backup (Smart Merge / Replace)"
                colors={colors}
              />
            </Pressable>
            <Pressable onPress={() => router.push('/admin' as any)}>
              <Row
                icon={<ShieldCheck size={18} color={colors.gold} />}
                label="Admin Portal & Cloud Sync"
                colors={colors}
              />
            </Pressable>
            <Pressable onPress={handleClear}>
              <Row
                icon={<Trash2 size={18} color={colors.danger} />}
                label="Clear all data"
                colors={colors}
                danger
              />
            </Pressable>
          </Section>

          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            Tasbih · Islamic Counter{'\n'}
            React Native · Expo
          </Text>
        </ScrollView>

        {timePickerFor && Platform.OS !== 'web' ? (
          <DateTimePicker
            value={(() => {
              const [h, m] = (reminders.find((r) => r.id === timePickerFor)?.time ?? '06:00')
                .split(':')
                .map(Number);
              const d = new Date();
              d.setHours(h, m, 0, 0);
              return d;
            })()}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        ) : null}
      </SafeAreaView>
    </Screen>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: { text: string };
}) {
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>
        {title}
      </Text>
      <Card style={{ gap: 4, paddingVertical: 8 }}>{children}</Card>
    </View>
  );
}

function Row({
  icon,
  label,
  colors,
  right,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  colors: { text: string; textSecondary: string; danger: string };
  right?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <View style={styles.row}>
      {icon}
      <Text
        style={{
          flex: 1,
          color: danger ? colors.danger : colors.text,
          fontSize: 15,
          marginLeft: 12,
        }}
      >
        {label}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 8,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
});
