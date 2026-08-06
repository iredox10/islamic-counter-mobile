import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Text from './AppText';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Trophy, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { type Achievement } from '@/lib/achievements';

interface AchievementToastProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  const { colors } = useTheme();

  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.gold,
          shadowColor: colors.gold,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.goldMuted }]}>
        <Text style={styles.emojiIcon}>{achievement.icon}</Text>
      </View>
      
      <View style={styles.textContainer}>
        <View style={styles.headerRow}>
          <Trophy size={14} color={colors.gold} />
          <Text style={[styles.badgeLabel, { color: colors.gold }]}>
            ACHIEVEMENT UNLOCKED!
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{achievement.title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {achievement.description}
        </Text>
      </View>

      <Pressable onPress={onDismiss} style={styles.dismissBtn}>
        <X size={18} color={colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emojiIcon: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    marginTop: 1,
  },
  dismissBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
