import React, { useEffect, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import Text from '@/components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Sun,
  Moon,
  Hand,
  Bed,
  Sparkles,
  ChevronRight,
  Check,
  ChevronLeft,
  History,
  Flame,
  Languages,
  Timer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import Svg, {
  Circle as SvgCircle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { format } from 'date-fns';

import { useTheme } from '@/context/ThemeContext';
import { Screen, Card, Title, Subtitle } from '@/components/ui';
import { useCollectionProgress } from '@/hooks/useDatabase';
import { setCollectionProgress } from '@/lib/db';
import {
  ADHKAR_COLLECTIONS,
  type AdhkarCollection,
} from '@/lib/adhkar';
import {
  startAdhkarSession,
  recordDhikrCompletion,
  endAdhkarSession,
  cancelAdhkarSession,
  getStreak,
  getCurrentSession,
} from '@/lib/adhkarTracking';
import type { AdhkarStreak } from '@/lib/types';
import { FONTS } from '@/lib/fonts';

const AZKAR_BUTTON = 288; // web: w-72 h-72 rounded-full button
const AZKAR_RADIUS = 47; // web: viewBox 0 0 100 100, ring r=47
const AZKAR_STROKE = 4; // web: strokeWidth 4
const AZKAR_CIRCUMFERENCE = 2 * Math.PI * AZKAR_RADIUS; // 295.31
const WEB_GOLD_400 = '#fbbf24'; // web gold-400 (count number)
const WEB_GOLD_500 = '#f59e0b'; // web gold-500 (progress ring)
const WEB_SLATE_800 = '#1e293b'; // web midnight-800 (button top gradient)
const WEB_SLATE_950 = '#020617'; // web midnight-950 (button bottom gradient)
const WEB_SLATE_400 = '#94a3b8'; // web slate-400 (/ target, subtitle)
const WEB_WHITE_5 = 'rgba(255,255,255,0.05)'; // web border-white/5

const categoryIcons: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  morning: Sun,
  evening: Moon,
  'post-prayer': Hand,
  sleep: Bed,
  general: Sparkles,
};

const categoryColors: Record<string, string> = {
  morning: '#fbbf24',
  evening: '#818cf8',
  'post-prayer': '#34d399',
  sleep: '#c084fc',
  general: '#D4AF37',
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export default function CollectionsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const progress = useCollectionProgress(todayStr);

  const [selected, setSelected] = useState<AdhkarCollection | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showAdhkarList, setShowAdhkarList] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [streak, setStreak] = useState<AdhkarStreak | null>(null);
  const [duration, setDuration] = useState(0);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    if (!sessionStarted) {
      setDuration(0);
      return;
    }
    const id = setInterval(() => {
      const session = getCurrentSession();
      if (session) {
        setDuration(Math.floor((Date.now() - session.startedAt.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStarted]);

  const getProgress = (collectionId: string, itemIndex: number) => {
    const rec = progress.find(
      (p) => p.collectionId === collectionId && p.itemIndex === itemIndex
    );
    return rec?.currentCount ?? 0;
  };

  const getCompletion = (collection: AdhkarCollection) => {
    let completed = 0;
    let total = 0;
    collection.items.forEach((item, index) => {
      total += item.target;
      completed += Math.min(getProgress(collection.id, index), item.target);
    });
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const openCollection = async (collection: AdhkarCollection) => {
    setSelected(collection);
    setActiveIndex(null);
    setShowAdhkarList(true);
    setSessionStarted(false);
    setDuration(0);
    const s = await getStreak(collection.id);
    setStreak(s ?? null);
  };

  const startItem = async (index: number) => {
    if (!selected) return;
    if (!sessionStarted) {
      startAdhkarSession({
        collectionId: selected.id,
        collectionName: selected.title,
        totalItems: selected.items.length,
      });
      setSessionStarted(true);
    }
    setActiveIndex(index);
    setItemCount(getProgress(selected.id, index));
  };

  const handleIncrement = async () => {
    if (!selected || activeIndex === null) return;
    const item = selected.items[activeIndex];
    const next = itemCount + 1;
    setItemCount(next);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setCollectionProgress(selected.id, activeIndex, next, todayStr);

    if (next >= item.target) {
      recordDhikrCompletion(item.title, item.arabic, next, item.target);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const allDone = selected.items.every((it, i) => {
        const c = i === activeIndex ? next : getProgress(selected.id, i);
        return c >= it.target;
      });

      if (allDone) {
        await endAdhkarSession(true);
        setSessionStarted(false);
        setShowDone(true);
      } else if (activeIndex < selected.items.length - 1) {
        const nextIdx = activeIndex + 1;
        setActiveIndex(nextIdx);
        setItemCount(getProgress(selected.id, nextIdx));
      }
    }
  };

  const leaveCollection = async () => {
    if (getCurrentSession()) {
      await endAdhkarSession(false);
    }
    cancelAdhkarSession();
    setSelected(null);
    setActiveIndex(null);
    setSessionStarted(false);
    setDuration(0);
  };

  // Active counting view
  if (selected && activeIndex !== null) {
    const item = selected.items[activeIndex];
    const pct = Math.min(100, (itemCount / item.target) * 100);
    const canShowList = showAdhkarList;

    return (
      <Screen>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.activeHeader}>
            <Pressable onPress={() => setActiveIndex(null)} style={styles.backBtn}>
              <ChevronLeft size={24} color={colors.text} />
            </Pressable>
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
              {activeIndex + 1}/{selected.items.length}
            </Text>
            <Pressable onPress={() => setShowTranslation((v) => !v)}>
              <Text style={{ color: colors.gold, fontSize: 13, fontWeight: '600' }}>
                {showTranslation ? 'Hide' : 'Show'} meaning
              </Text>
            </Pressable>
          </View>

          {(sessionStarted && duration > 0) || (streak && streak.currentStreak > 0) ? (
            <View style={styles.activeInfoRow}>
              {sessionStarted && duration > 0 ? (
                <View style={[styles.infoPill, { backgroundColor: colors.inputBg }]}>
                  <Timer size={12} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {formatDuration(duration)}
                  </Text>
                </View>
              ) : null}
              {streak && streak.currentStreak > 0 ? (
                <View style={[styles.infoPill, { backgroundColor: colors.inputBg }]}>
                  <Flame size={12} color={colors.gold} />
                  <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '600' }}>
                    {streak.currentStreak} day streak
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.activeBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.contextLine, { color: colors.textMuted }]}>
                {selected.title} • {activeIndex + 1}/{selected.items.length}
              </Text>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
              {item.arabic ? (
                <Text style={[styles.arabic, { color: colors.gold }]}>{item.arabic}</Text>
              ) : null}
              {showTranslation ? (
                <Text style={[styles.meaning, { color: colors.textSecondary }]}>
                  {item.meaning}
                </Text>
              ) : null}
            </View>

            {showTranslation && item.virtue ? (
              <View style={styles.virtueBox}>
                <Text style={{ color: colors.success, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                  ✨ {item.virtue}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleIncrement}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <View style={styles.ringArea}>
                <Svg
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                  width={AZKAR_BUTTON}
                  height={AZKAR_BUTTON}
                  viewBox={`0 0 100 100`}
                >
                  <Defs>
                    <SvgLinearGradient
                      id="azkarBtnGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <Stop offset="0" stopColor={WEB_SLATE_800} />
                      <Stop offset="1" stopColor={WEB_SLATE_950} />
                    </SvgLinearGradient>
                  </Defs>
                  <SvgCircle cx={50} cy={50} r={50} fill="url(#azkarBtnGrad)" />
                  <SvgCircle
                    cx={50}
                    cy={50}
                    r={AZKAR_RADIUS}
                    stroke="rgba(30,41,59,0.5)"
                    strokeWidth={AZKAR_STROKE}
                    fill="none"
                  />
                  <SvgCircle
                    cx={50}
                    cy={50}
                    r={AZKAR_RADIUS}
                    stroke={WEB_GOLD_500}
                    strokeWidth={AZKAR_STROKE}
                    fill="none"
                    strokeLinecap="round"
                    rotation={-90}
                    originX={50}
                    originY={50}
                    strokeDasharray={AZKAR_CIRCUMFERENCE}
                    strokeDashoffset={AZKAR_CIRCUMFERENCE * (1 - pct / 100)}
                  />
                </Svg>
                <View style={styles.countOuter}>
                  <Text style={[styles.countNum, { color: WEB_GOLD_400 }]}>
                    {itemCount}
                  </Text>
                  <Text style={{ color: WEB_SLATE_400, fontSize: 16, marginTop: 8 }}>
                    / {item.target}
                  </Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setShowAdhkarList(!canShowList)}
              style={styles.listToggle}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {canShowList ? 'Hide' : 'Show'} adhkar list
              </Text>
              {canShowList ? (
                <ChevronUp size={14} color={colors.textMuted} />
              ) : (
                <ChevronDown size={14} color={colors.textMuted} />
              )}
            </Pressable>

            {canShowList ? (
              <View style={styles.pillsWrap}>
                {selected.items.map((it, idx) => {
                  const p = getProgress(selected.id, idx);
                  const complete = p >= it.target;
                  const isActive = idx === activeIndex;
                  return (
                    <Pressable
                      key={`${it.title}-${idx}`}
                      onPress={() => {
                        setActiveIndex(idx);
                        setItemCount(p);
                      }}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: isActive
                            ? colors.goldMuted
                            : complete
                              ? 'rgba(16,185,129,0.1)'
                              : colors.inputBg,
                          borderColor: isActive
                            ? colors.gold
                            : complete
                              ? colors.success
                              : colors.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isActive
                            ? colors.gold
                            : complete
                              ? colors.success
                              : colors.textSecondary,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {it.title.length > 10 ? `${it.title.substring(0, 10)}…` : it.title}
                      </Text>
                      {complete ? <Check size={12} color={colors.success} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Screen>
    );
  }

  // Collection detail
  if (selected) {
    return (
      <Screen>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.activeHeader}>
              <Pressable onPress={leaveCollection} style={styles.backBtn}>
                <ChevronLeft size={20} color={WEB_SLATE_400} />
                <Text style={{ fontFamily: FONTS.sansBold, fontSize: 14, color: WEB_SLATE_400 }}>
                  Back
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => router.push('/history')}
              style={styles.historyLink}
            >
              <History size={15} color={colors.gold} />
              <Text style={{ color: colors.gold, fontSize: 13, fontWeight: '600' }}>
                View History
              </Text>
            </Pressable>

            <View style={styles.titleRow}>
              <View
                style={[
                  styles.catChip,
                  { backgroundColor: `${categoryColors[selected.category] ?? colors.gold}1A` },
                ]}
              >
                {(() => {
                  const Icon = categoryIcons[selected.category] ?? Sparkles;
                  return (
                    <Icon size={24} color={categoryColors[selected.category] ?? colors.gold} />
                  );
                })()}
              </View>
              <View style={{ flex: 1 }}>
                <Title style={{ fontSize: 24 }}>{selected.title}</Title>
                <Subtitle style={{ color: WEB_SLATE_400, fontSize: 14 }}>{selected.description}</Subtitle>
              </View>
              <Pressable
                onPress={() => setShowTranslation((v) => !v)}
                style={[styles.iconBtn, { backgroundColor: showTranslation ? colors.goldMuted : colors.inputBg }]}
              >
                <Languages size={18} color={showTranslation ? colors.gold : colors.textMuted} />
              </Pressable>
            </View>

            {streak && streak.currentStreak > 0 ? (
              <View
                style={[
                  styles.streakBanner,
                  { backgroundColor: colors.goldMuted, borderColor: colors.gold },
                ]}
              >
                <Flame size={16} color={colors.gold} />
                <Text style={{ color: colors.gold, fontWeight: '600' }}>
                  {streak.currentStreak} day streak
                </Text>
              </View>
            ) : null}

            <View style={{ gap: 8, marginTop: 16 }}>
              {selected.items.map((item, index) => {
                const c = getProgress(selected.id, index);
                const done = c >= item.target;
                return (
                  <Pressable
                    key={`${item.title}-${index}`}
                    onPress={() => startItem(index)}
                    style={[
                      styles.itemRow,
                      {
                        backgroundColor: done ? colors.goldMuted : colors.card,
                        borderColor: done ? colors.gold : colors.cardBorder,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemTitleRow}>
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                          {index + 1}.
                        </Text>
                        <Text
                          style={{
                            color: done ? colors.gold : colors.text,
                            fontWeight: '600',
                          }}
                        >
                          {item.title}
                        </Text>
                        {done ? <Check size={14} color={colors.gold} /> : null}
                      </View>
                      {item.arabic ? (
                        <Text style={[styles.itemArabic, { color: colors.gold }]}>
                          {item.arabic}
                        </Text>
                      ) : null}
                      {showTranslation ? (
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                          {item.meaning}
                        </Text>
                      ) : null}
                      <View style={[styles.bar, { backgroundColor: colors.inputBg, marginTop: 8 }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${Math.min(100, (c / item.target) * 100)}%`,
                              backgroundColor: colors.gold,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text
                      style={{
                        color: done ? colors.gold : colors.textSecondary,
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                    >
                      {Math.min(c, item.target)} / {item.target}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>

        <Modal visible={showDone} transparent animationType="fade">
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <Card style={{ marginHorizontal: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 40 }}>🌙</Text>
              <Title style={{ fontSize: 22, marginTop: 8, textAlign: 'center' }}>
                Collection complete
              </Title>
              <Subtitle style={{ textAlign: 'center' }}>
                May Allah accept your dhikr
              </Subtitle>
              <Pressable
                onPress={() => {
                  setShowDone(false);
                  leaveCollection();
                }}
                style={[styles.doneBtn, { backgroundColor: colors.gold }]}
              >
                <Text style={{ color: '#020617', fontWeight: '700' }}>Done</Text>
              </Pressable>
            </Card>
          </View>
        </Modal>
      </Screen>
    );
  }

  // List view
  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.listHeader}>
            <View>
              <Title style={{ fontSize: 30 }}>Adhkar</Title>
              <Subtitle style={{ color: WEB_SLATE_400 }}>
                Morning, Evening & Daily Supplications
              </Subtitle>
            </View>
            <Pressable
              onPress={() => router.push('/history')}
              style={[styles.historyBtn, { backgroundColor: colors.inputBg }]}
            >
              <History size={18} color={colors.gold} />
            </Pressable>
          </View>

          <View style={{ gap: 12, marginTop: 20 }}>
            {ADHKAR_COLLECTIONS.map((collection) => {
              const Icon = categoryIcons[collection.category] ?? Sparkles;
              const accent = categoryColors[collection.category] ?? colors.gold;
              const pct = getCompletion(collection);

              return (
                <Pressable
                  key={collection.id}
                  onPress={() => openCollection(collection)}
                  style={[
                    styles.collectionCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                    },
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
                    <Icon size={22} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
                      {collection.title}
                    </Text>
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {collection.description}
                    </Text>
                    <View style={[styles.bar, { backgroundColor: colors.inputBg, marginTop: 8 }]}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${pct}%`, backgroundColor: accent },
                        ]}
                      />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                      {pct}% · {collection.items.length} items
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 32,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  catChip: {
    padding: 12,
    borderRadius: 12,
  },
  iconBtn: {
    height: 40,
    width: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemArabic: {
    fontSize: 17,
    textAlign: 'left',
    marginTop: 6,
    lineHeight: 28,
    writingDirection: 'rtl',
  },
  activeBody: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  contextLine: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  itemTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  arabic: {
    fontSize: 24,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 40,
    writingDirection: 'rtl',
  },
  meaning: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  virtueBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  ringArea: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
    width: AZKAR_BUTTON,
    height: AZKAR_BUTTON,
    borderRadius: AZKAR_BUTTON / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: WEB_WHITE_5,
    shadowColor: '#050812',
    shadowOffset: { width: 20, height: 20 },
    shadowOpacity: 0.8,
    shadowRadius: 60,
    elevation: 10,
    backgroundColor: WEB_SLATE_800,
  },
  countOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  countNum: {
    fontSize: 96,
    letterSpacing: -4,
    fontWeight: '700',
    fontFamily: FONTS.serif,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  listToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
  doneBtn: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
});