import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Lock } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';
import type { AchievementWithEarned } from '../types';

export function Achievements() {
  const { t, i18n } = useTranslation('gamification');
  const { currentMember } = useFamily();
  const { family } = useAuth();
  const [achievements, setAchievements] = useState<AchievementWithEarned[]>([]);

  useEffect(() => {
    if (currentMember && family) {
      loadAchievements();

      const supabase = getSupabaseClient();
      const subscription = supabase
        .channel('achievements_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_achievements' }, () => {
          loadAchievements();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [currentMember, family]);

  const loadAchievements = async () => {
    if (!currentMember || !family) return;

    const supabase = getSupabaseClient();
    const { data: allAchievements } = await supabase
      .from('achievements')
      .select('*')
      .or(`family_id.is.null,family_id.eq.${family.id}`)
      .order('condition_value');

    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('member_id', currentMember.id);

    if (allAchievements) {
      const earnedIds = new Set(userAchievements?.map(ua => ua.achievement_id) || []);
      const earnedMap = new Map(
        userAchievements?.map(ua => [ua.achievement_id, ua.earned_at]) || []
      );

      const achievementsWithStatus: AchievementWithEarned[] = allAchievements.map(achievement => ({
        ...achievement,
        earned: earnedIds.has(achievement.id),
        earned_at: earnedMap.get(achievement.id),
      }));

      setAchievements(achievementsWithStatus);
    }
  };

  const earnedCount = achievements.filter(a => a.earned).length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Award className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900">{t('achievements.title')}</h2>
        </div>
        <div className="text-sm text-gray-600">
          {t('achievements.unlocked', { count: earnedCount, total: achievements.length })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`relative p-4 rounded-lg border-2 transition-all ${
              achievement.earned
                ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                : 'bg-gray-50 border-gray-200 opacity-60'
            }`}
          >
            {!achievement.earned && (
              <div className="absolute top-2 right-2">
                <Lock className="w-4 h-4 text-gray-400" />
              </div>
            )}

            <div className="text-center">
              <div className="text-4xl mb-2">{achievement.icon}</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                {achievement.name}
              </h3>
              <p className="text-xs text-gray-600">{achievement.description}</p>

              {achievement.earned && achievement.earned_at && (
                <div className="mt-2 text-xs text-purple-600 font-medium">
                  {t('achievements.earned', { date: formatDate(achievement.earned_at) })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {achievements.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {t('achievements.noAchievements')}
        </div>
      )}
    </div>
  );
}
