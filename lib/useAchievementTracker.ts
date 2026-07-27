import { useEffect, useRef } from 'react';
import { checkAchievements, ACHIEVEMENTS, type Achievement } from './achievements';
import { gregorianToHijri, getSpecialDay } from './hijri';
import { getUnlockedAchievements, unlockAchievement } from './db';

export function useAchievementTracker(
  totalCount: number,
  currentStreak: number,
  completedGoals: number,
  sessionCount: number
) {
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (totalCount === 0 && sessionCount === 0) return;
    if (isCheckingRef.current) return;

    const runCheck = async () => {
      isCheckingRef.current = true;
      try {
        const unlockedIds = await getUnlockedAchievements();

        const now = new Date();
        const hour = now.getHours();
        const dayOfWeek = now.getDay();
        
        const hijri = gregorianToHijri(now);
        const specialDay = getSpecialDay(hijri);

        const timeContext = {
          isFajr: hour >= 4 && hour < 7,
          isAfterIsha: hour >= 20 || hour < 4,
          isFriday: dayOfWeek === 5,
          isRamadan: hijri.month === 9,
          isEid: specialDay?.name.includes('Eid') ?? false,
        };

        const newlyUnlocked: Achievement[] = checkAchievements(
          totalCount,
          currentStreak,
          completedGoals,
          sessionCount,
          timeContext,
          unlockedIds.map((u) => u.achievementId)
        );

        for (const item of newlyUnlocked) {
          await unlockAchievement(item.id);
        }
      } catch (e) {
        console.error('Failed to run achievement tracker:', e);
      } finally {
        isCheckingRef.current = false;
      }
    };

    runCheck();
  }, [totalCount, currentStreak, completedGoals, sessionCount]);
}

export function getProgressTowardsNext(
  achievementId: string,
  current: number
): { current: number; target: number; percent: number } | null {
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return null;
  
  return {
    current,
    target: achievement.requirement,
    percent: Math.min(100, Math.round((current / achievement.requirement) * 100))
  };
}
