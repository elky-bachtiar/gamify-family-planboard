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
export type WeeklyEarnings = Database['public']['Tables']['weekly_earnings']['Row'];
export type FamilyObject = Database['public']['Tables']['family_objects']['Row'];
export type DeductionDispute = Database['public']['Tables']['deduction_disputes']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

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

export type DeductionDisputeWithDetails = DeductionDispute & {
  points_history: PointsHistory | null;
  created_by_member: FamilyMember | null;
  resolved_by_member: FamilyMember | null;
};

export type PointsHistoryWithMember = PointsHistory & {
  family_members: FamilyMember | null;
};

// Palette types and data
export type PaletteKey =
  | 'default'
  | 'soft'
  | 'vintage'
  | 'retro'
  | 'neon'
  | 'summer'
  | 'fall'
  | 'winter'
  | 'spring'
  | 'happy'
  | 'kids';

export interface ColorPalette {
  name: string;
  colors: string[];
}

export const COLOR_PALETTES: Record<PaletteKey, ColorPalette> = {
  default: {
    name: 'Default',
    colors: [
      '#3B82F6', // blue
      '#EF4444', // red
      '#10B981', // green
      '#F59E0B', // amber
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#14B8A6', // teal
      '#F97316', // orange
    ],
  },
  soft: {
    name: 'Soft Pastels',
    colors: [
      '#FFD1DC', // pastel pink
      '#BFEFFF', // baby blue
      '#B5EAD7', // soft mint
      '#E4C1F9', // light lavender
      '#FFDAC1', // soft peach
      '#FFFFD1', // pastel yellow
      '#B0E0A8', // pastel green
      '#FFB7C5', // soft coral
    ],
  },
  vintage: {
    name: 'Vintage',
    colors: [
      '#B07154', // terracotta
      '#D0C195', // tan
      '#876445', // brown
      '#EEC373', // golden
      '#665541', // dark brown
      '#E6D1AB', // cream
      '#8F7A65', // taupe
      '#573C41', // dark puce
    ],
  },
  retro: {
    name: 'Retro',
    colors: [
      '#FF6B6B', // coral red
      '#4ECDC4', // teal
      '#FFE66D', // yellow
      '#95E1D3', // mint
      '#F38181', // salmon
      '#AA96DA', // lavender
      '#FCBAD3', // pink
      '#A8D8EA', // sky blue
    ],
  },
  neon: {
    name: 'Neon',
    colors: [
      '#FF00C2', // magenta
      '#00ECFF', // cyan
      '#74EE15', // green
      '#FFE700', // yellow
      '#F000FF', // pink
      '#001EFF', // blue
      '#FF8800', // orange
      '#00FF9F', // mint
    ],
  },
  summer: {
    name: 'Summer',
    colors: [
      '#FF6F61', // coral
      '#40E0D0', // turquoise
      '#FFD93D', // sunny yellow
      '#FF598F', // hot pink
      '#00BFAF', // teal
      '#FFA500', // orange
      '#87CEEB', // sky blue
      '#98FF98', // mint
    ],
  },
  fall: {
    name: 'Fall',
    colors: [
      '#B7410E', // rust
      '#CC5404', // burnt orange
      '#F5BD25', // golden
      '#8B0000', // deep red
      '#945703', // golden brown
      '#6E7F49', // olive
      '#D26D38', // cocoa
      '#325E3C', // hunter green
    ],
  },
  winter: {
    name: 'Winter',
    colors: [
      '#3F7EB3', // steel blue
      '#6BA7CC', // iceberg
      '#AEDBF0', // blizzard blue
      '#C2C2C2', // silver
      '#2377A4', // lapis lazuli
      '#50A3C6', // maximum blue
      '#DADADD', // platinum
      '#79C0D7', // aero
    ],
  },
  spring: {
    name: 'Spring',
    colors: [
      '#94DE8B', // light green
      '#B19CD9', // light purple
      '#F4A8CF', // lavender pink
      '#FDFD96', // pastel yellow
      '#B6E7B9', // celadon
      '#E784C6', // persian pink
      '#C4E66A', // mindaro
      '#BAC953', // yellow green
    ],
  },
  happy: {
    name: 'Happy',
    colors: [
      '#FF9A55', // orange
      '#FFEA6C', // yellow
      '#54FFFB', // cyan
      '#E7B2FF', // lavender
      '#89FFCC', // mint
      '#FF598F', // pink
      '#FFD93D', // gold
      '#6BCB77', // green
    ],
  },
  kids: {
    name: 'Kids',
    colors: [
      '#35D461', // UFO green
      '#F9E104', // vivid yellow
      '#F99D07', // orange
      '#882FF6', // blue-violet
      '#37B6F6', // picton blue
      '#FF5994', // pink
      '#FF9668', // peach
      '#84FF9F', // light green
    ],
  },
};

// Keep COLORS for backward compatibility - defaults to 'default' palette
export const COLORS = COLOR_PALETTES.default.colors;

// Helper function to get colors for a palette
export function getPaletteColors(paletteKey: PaletteKey | string): string[] {
  const key = paletteKey as PaletteKey;
  return COLOR_PALETTES[key]?.colors || COLOR_PALETTES.default.colors;
}

export const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'bg-gray-500', points: 5 },
  medium: { label: 'Medium', color: 'bg-blue-500', points: 10 },
  high: { label: 'High', color: 'bg-red-500', points: 20 },
};

export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 1500, 2000, 3000, 4500, 6000, 8000, 10000];

export function calculateLevel(points: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

export function getPointsForNextLevel(currentPoints: number): {
  current: number;
  next: number;
  progress: number;
} {
  const level = calculateLevel(currentPoints);
  const currentLevelThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextLevelThreshold =
    LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

  const pointsInLevel = currentPoints - currentLevelThreshold;
  const pointsNeeded = nextLevelThreshold - currentLevelThreshold;
  const progress = (pointsInLevel / pointsNeeded) * 100;

  return {
    current: pointsInLevel,
    next: nextLevelThreshold,
    progress: Math.min(progress, 100),
  };
}
