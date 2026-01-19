import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Lock } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';
import { useFamily } from '../../../contexts/FamilyContext';
import { useAuth } from '../../../contexts/AuthContext';
import type { AchievementWithEarned } from '../../../types';

export function ChildBadgesView() {
  const { t, i18n } = useTranslation('gamification');
  const { currentMember } = useFamily();
  const { family } = useAuth();
  const [achievements, setAchievements] = useState<AchievementWithEarned[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAchievements = async () => {
      if (!currentMember || !family) return;

      try {
        const supabase = getSupabaseClient();

        // Fetch all achievements (global + family-specific)
        const { data: allAchievements, error: achievementsError } = await supabase
          .from('achievements')
          .select('*')
          .or(`family_id.is.null,family_id.eq.${family.id}`);

        if (achievementsError) throw achievementsError;

        // Type assertion for pre-existing schema issue
        type AchievementRow = {
          id: string;
          name: string;
          description: string;
          icon: string;
          condition_type: string;
          condition_value: number;
          family_id: string | null;
          is_custom: boolean;
          created_by_member_id: string | null;
          created_at: string;
        };
        const typedAchievements = (allAchievements || []) as AchievementRow[];

        // Fetch earned achievements for this member
        const { data: earnedAchievements, error: earnedError } = await supabase
          .from('user_achievements')
          .select('achievement_id, earned_at')
          .eq('member_id', currentMember.id);

        if (earnedError) throw earnedError;

        // Create a map of earned achievements (with type assertion for pre-existing schema issue)
        type EarnedAchievement = { achievement_id: string; earned_at: string };
        const earnedData = (earnedAchievements || []) as EarnedAchievement[];
        const earnedMap = new Map(
          earnedData.map(ea => [ea.achievement_id, ea.earned_at])
        );

        // Combine achievements with earned status
        const achievementsWithEarned: AchievementWithEarned[] = typedAchievements.map(a => ({
          ...a,
          condition_type: a.condition_type as AchievementWithEarned['condition_type'],
          earned: earnedMap.has(a.id),
          earned_at: earnedMap.get(a.id),
        }));

        // Sort: earned first, then by name
        achievementsWithEarned.sort((a, b) => {
          if (a.earned && !b.earned) return -1;
          if (!a.earned && b.earned) return 1;
          return a.name.localeCompare(b.name);
        });

        setAchievements(achievementsWithEarned);
      } catch (error) {
        console.error('Error fetching achievements:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAchievements();
  }, [currentMember?.id, family?.id]);

  const earnedCount = achievements.filter(a => a.earned).length;
  const totalCount = achievements.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900">{t('child.badges.title')}</h2>
        </div>
        <span className="text-sm font-medium text-gray-500">
          {t('child.badges.unlockedCount', { unlocked: earnedCount, total: totalCount })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Badges grid */}
      {achievements.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('child.badges.noBadges')}</h3>
          <p className="text-gray-500 text-sm">{t('child.badges.noBadgesHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {achievements.map(achievement => (
            <div
              key={achievement.id}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                achievement.earned
                  ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-sm'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              {/* Lock icon for unearned */}
              {!achievement.earned && (
                <div className="absolute top-2 right-2">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
              )}

              {/* Badge icon */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-2 ${
                  achievement.earned ? 'bg-white shadow-sm' : 'bg-gray-100'
                }`}
              >
                {achievement.icon}
              </div>

              {/* Badge info */}
              <h3 className={`font-bold text-sm mb-1 ${
                achievement.earned ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {achievement.name}
              </h3>
              <p className="text-xs text-gray-500 line-clamp-2">
                {achievement.description}
              </p>

              {/* Earned date */}
              {achievement.earned && achievement.earned_at && (
                <p className="text-xs text-purple-600 mt-2 font-medium">
                  {t('child.badges.earned', { date: new Date(achievement.earned_at).toLocaleDateString(i18n.language) })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
