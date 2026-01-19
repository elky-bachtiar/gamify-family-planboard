import type { Database } from '../lib/database.types';

export type Family = Database['public']['Tables']['families']['Row'];
export type FamilyMember = Database['public']['Tables']['family_members']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type Achievement = Database['public']['Tables']['achievements']['Row'];
export type UserAchievement = Database['public']['Tables']['user_achievements']['Row'];
export type PointsHistory = Database['public']['Tables']['points_history']['Row'];
export type WeeklyGoal = Database['public']['Tables']['weekly_goals']['Row'];
export type ManualPointsAward = Database['public']['Tables']['manual_points_awards']['Row'];
export type RewardRedemption = Database['public']['Tables']['reward_redemptions']['Row'];
export type TaskHistory = Database['public']['Tables']['task_history']['Row'];

export type TaskWithMember = Task & {
  family_members: FamilyMember | null;
};

export type AchievementWithEarned = Achievement & {
  earned: boolean;
  earned_at?: string;
};

export type RedemptionWithMember = RewardRedemption & {
  family_members: FamilyMember | null;
};

export const COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'bg-gray-500', points: 5 },
  medium: { label: 'Medium', color: 'bg-blue-500', points: 10 },
  high: { label: 'High', color: 'bg-red-500', points: 20 },
};

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1500, 2000, 3000, 4500, 6000, 8000, 10000
];

export function calculateLevel(points: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

export function getPointsForNextLevel(currentPoints: number): { current: number; next: number; progress: number } {
  const level = calculateLevel(currentPoints);
  const currentLevelThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

  const pointsInLevel = currentPoints - currentLevelThreshold;
  const pointsNeeded = nextLevelThreshold - currentLevelThreshold;
  const progress = (pointsInLevel / pointsNeeded) * 100;

  return {
    current: pointsInLevel,
    next: nextLevelThreshold,
    progress: Math.min(progress, 100),
  };
}
