import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Star,
  CheckCircle,
  Flame,
  TrendingUp,
  Calendar,
  Trophy,
  ThumbsUp,
  Gift,
  AlertTriangle,
  Clock,
} from 'lucide-react';
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

interface AllTimeStats {
  tasksCompleted: number;
  longestStreak: number;
}

interface ActivityItem {
  id: string;
  type: 'completed' | 'approved' | 'bonus' | 'penalty' | 'pending';
  title: string;
  timestamp: string;
  points?: number;
}

export function ChildStatsView() {
  const { t, i18n } = useTranslation('gamification');
  const { currentMember } = useFamily();
  const { family } = useAuth();
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [weekStats, setWeekStats] = useState<WeekStats>({
    tasksCompleted: 0,
    pointsEarned: 0,
    daysActive: 0,
  });
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats>({
    tasksCompleted: 0,
    longestStreak: 0,
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

        // Fetch recent points history (approvals, bonuses, penalties)
        const { data: pointsData, error: pointsError } = await supabase
          .from('points_history')
          .select('*')
          .eq('member_id', currentMember.id)
          .order('created_at', { ascending: false })
          .limit(15);

        if (pointsError) throw pointsError;
        const typedPointsData = (pointsData || []) as PointsHistory[];

        // Fetch recent tasks completed by this user (including pending approval)
        const { data: recentTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id, title, status, completed_at, approved_at, point_value')
          .eq('completed_by', currentMember.id)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(15);

        if (tasksError) throw tasksError;

        // Build activity feed
        const activities: ActivityItem[] = [];

        // Add task completion events (when user marked task as done)
        for (const task of recentTasks || []) {
          if (task.completed_at) {
            activities.push({
              id: `task-completed-${task.id}`,
              type: task.status === 'pending_approval' ? 'pending' : 'completed',
              title: task.title,
              timestamp: task.completed_at,
              points: task.point_value ?? 0,
            });
          }
        }

        // Add approval/bonus/penalty events from points history
        for (const point of typedPointsData) {
          const isApproval = point.reason?.startsWith('Completed:');
          const isBonus = point.reason?.startsWith('Bonus:');

          // Extract title from reason
          let title = point.reason || '';
          if (isApproval) {
            title = title.replace('Completed:', '').trim();
          } else if (isBonus) {
            title = title.replace('Bonus:', '').trim();
          } else {
            title = title.replace('Straf:', '').trim();
          }

          activities.push({
            id: `points-${point.id}`,
            type: isApproval ? 'approved' : isBonus ? 'bonus' : 'penalty',
            title,
            timestamp: point.created_at || '',
            points: point.points,
          });
        }

        // Sort by timestamp descending and take first 15
        activities.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setRecentActivities(activities.slice(0, 15));

        // Fetch this week's completed tasks:
        // - Tasks assigned to me that are completed
        // - OR unassigned tasks that I completed (claimed from pool)
        const { data: weekTasks, error: weekError } = await supabase
          .from('tasks')
          .select('completed_at')
          .eq('status', 'completed')
          .gte('completed_at', weekAgo.toISOString())
          .or(
            `assigned_to.eq.${currentMember.id},and(assigned_to.is.null,completed_by.eq.${currentMember.id})`
          );

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

        // Fetch all-time completed tasks count:
        // - Tasks assigned to me that are completed
        // - OR unassigned tasks that I completed (claimed from pool)
        const { count: allTimeTasksCount, error: allTimeError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .or(
            `assigned_to.eq.${currentMember.id},and(assigned_to.is.null,completed_by.eq.${currentMember.id})`
          );

        if (allTimeError) throw allTimeError;

        // Best streak is the highest of current streak or last streak value (before loss)
        const bestStreak = Math.max(
          currentMember.current_streak ?? 0,
          currentMember.last_streak_value ?? 0
        );

        setAllTimeStats({
          tasksCompleted: allTimeTasksCount || 0,
          longestStreak: bestStreak,
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

      {/* All Time Section */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-gray-900">{t('child.statsView.allTime')}</h3>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-purple-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{allTimeStats.tasksCompleted}</p>
            <p className="text-xs text-gray-500">{t('child.statsView.tasksDone')}</p>
          </div>

          <div>
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-amber-100 rounded-full">
              <Star className="w-5 h-5 text-amber-600" fill="currentColor" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {(currentMember.total_points ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{t('child.statsView.pointsEarned')}</p>
          </div>

          <div>
            <div className="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-orange-100 rounded-full">
              <Flame className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{allTimeStats.longestStreak}</p>
            <p className="text-xs text-gray-500">{t('child.statsView.longestStreak')}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-4">{t('child.statsView.recentActivity')}</h3>

        {recentActivities.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {t('child.statsView.noActivity')}
          </p>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((activity) => {
              // Get icon, color, and label based on type
              const getActivityConfig = () => {
                switch (activity.type) {
                  case 'completed':
                    return {
                      icon: <CheckCircle className="w-4 h-4 text-blue-500" />,
                      bgColor: 'bg-blue-100',
                      textColor: 'text-blue-600',
                      label: t('child.statsView.activityCompleted'),
                      showPoints: false,
                    };
                  case 'pending':
                    return {
                      icon: <Clock className="w-4 h-4 text-amber-500" />,
                      bgColor: 'bg-amber-100',
                      textColor: 'text-amber-600',
                      label: t('child.statsView.activityPending'),
                      showPoints: false,
                    };
                  case 'approved':
                    return {
                      icon: <ThumbsUp className="w-4 h-4 text-green-500" />,
                      bgColor: 'bg-green-100',
                      textColor: 'text-green-600',
                      label: t('child.statsView.activityApproved'),
                      showPoints: true,
                    };
                  case 'bonus':
                    return {
                      icon: <Gift className="w-4 h-4 text-purple-500" />,
                      bgColor: 'bg-purple-100',
                      textColor: 'text-purple-600',
                      label: t('child.statsView.activityBonus'),
                      showPoints: true,
                    };
                  case 'penalty':
                    return {
                      icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
                      bgColor: 'bg-red-100',
                      textColor: 'text-red-600',
                      label: t('child.statsView.activityPenalty'),
                      showPoints: true,
                    };
                  default:
                    return {
                      icon: <Star className="w-4 h-4 text-gray-500" />,
                      bgColor: 'bg-gray-100',
                      textColor: 'text-gray-600',
                      label: '',
                      showPoints: true,
                    };
                }
              };

              const config = getActivityConfig();

              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
                >
                  {/* Activity icon */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor}`}
                  >
                    {config.icon}
                  </div>

                  {/* Activity details */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${config.textColor}`}>{config.label}</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{activity.title}</p>
                    <p className="text-xs text-gray-500">
                      {activity.timestamp &&
                        new Date(activity.timestamp).toLocaleDateString(i18n.language, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                    </p>
                  </div>

                  {/* Points (only for approval events) */}
                  {config.showPoints && activity.points !== undefined && (
                    <div
                      className={`flex items-center gap-1 font-bold flex-shrink-0 ${
                        activity.points >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
                      <span>
                        {activity.points >= 0 ? '+' : ''}
                        {activity.points}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
