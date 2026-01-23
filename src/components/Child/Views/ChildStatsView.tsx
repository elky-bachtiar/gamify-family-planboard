import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, CheckCircle, Flame, TrendingUp, Calendar } from 'lucide-react';
import { getSupabaseClient } from '../../../lib/supabase';
import { useFamily } from '../../../contexts/FamilyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { LevelProgress } from '../Gamification/LevelProgress';
import { StreakDisplay } from '../Gamification/StreakDisplay';
import { StreakFreezeShop } from '../StreakFreezeShop';
import type { PointsHistory, FamilyMember } from '../../../types';

interface WeekStats {
  tasksCompleted: number;
  pointsEarned: number;
  daysActive: number;
}

export function ChildStatsView() {
  const { t, i18n } = useTranslation('gamification');
  const { currentMember } = useFamily();
  const { family } = useAuth();
  const [recentPoints, setRecentPoints] = useState<PointsHistory[]>([]);
  const [weekStats, setWeekStats] = useState<WeekStats>({
    tasksCompleted: 0,
    pointsEarned: 0,
    daysActive: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentMember || !family) return;

      try {
        const supabase = getSupabaseClient();

        // Get last 7 days date
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Fetch recent points history
        const { data: pointsData, error: pointsError } = await supabase
          .from('points_history')
          .select('*')
          .eq('member_id', currentMember.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (pointsError) throw pointsError;
        const typedPointsData = (pointsData || []) as PointsHistory[];
        setRecentPoints(typedPointsData);

        // Fetch this week's completed tasks
        const { data: weekTasks, error: weekError } = await supabase
          .from('tasks')
          .select('completed_at')
          .eq('assigned_to', currentMember.id)
          .eq('status', 'completed')
          .gte('completed_at', weekAgo.toISOString());

        if (weekError) throw weekError;

        // Type assertion for pre-existing schema issue
        type TaskWithCompletedAt = { completed_at: string | null };
        const typedWeekTasks = (weekTasks || []) as TaskWithCompletedAt[];

        // Calculate week stats
        const tasksCompleted = typedWeekTasks.length;
        const pointsEarned = typedPointsData
          .filter((p) => p.created_at && new Date(p.created_at) >= weekAgo)
          .reduce((sum, p) => sum + p.points, 0);

        // Count unique days with completed tasks
        const uniqueDays = new Set(
          typedWeekTasks.map((t) => t.completed_at?.split('T')[0]).filter(Boolean)
        );

        setWeekStats({
          tasksCompleted,
          pointsEarned,
          daysActive: uniqueDays.size,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [currentMember?.id, family?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!currentMember) return null;

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Level Progress */}
      <LevelProgress
        totalPoints={currentMember.total_points ?? 0}
        currentLevel={currentMember.current_level ?? 1}
      />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-amber-500" fill="currentColor" />
            <span className="text-sm font-medium text-gray-600">
              {t('child.statsView.totalPoints')}
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {(currentMember.total_points ?? 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-medium text-gray-600">
              {t('child.statsView.currentStreak')}
            </span>
          </div>
          <StreakDisplay
            streakDays={currentMember.current_streak ?? 0}
            size="md"
            showLabel={true}
            member={currentMember as FamilyMember}
            showGracePeriod={true}
          />
        </div>
      </div>

      {/* Streak Freeze Shop */}
      <StreakFreezeShop
        onPurchase={() => {
          // Refresh could be handled here if needed
        }}
      />

      {/* This Week Section */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-gray-900">{t('child.statsView.thisWeek')}</h3>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-green-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{weekStats.tasksCompleted}</p>
            <p className="text-xs text-gray-500">{t('child.statsView.tasksDone')}</p>
          </div>

          <div>
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-amber-100 rounded-full">
              <Star className="w-5 h-5 text-amber-600" fill="currentColor" />
            </div>
            <p className="text-xl font-bold text-gray-900">{weekStats.pointsEarned}</p>
            <p className="text-xs text-gray-500">{t('child.statsView.pointsEarned')}</p>
          </div>

          <div>
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-blue-100 rounded-full">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{weekStats.daysActive}</p>
            <p className="text-xs text-gray-500">{t('child.statsView.activeDays')}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-4">{t('child.statsView.recentActivity')}</h3>

        {recentPoints.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {t('child.statsView.noActivity')}
          </p>
        ) : (
          <div className="space-y-3">
            {recentPoints.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.reason}</p>
                  <p className="text-xs text-gray-500">
                    {entry.created_at &&
                      new Date(entry.created_at).toLocaleDateString(i18n.language, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-1 font-bold ${
                    entry.points >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                  <span>
                    {entry.points >= 0 ? '+' : ''}
                    {entry.points}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
