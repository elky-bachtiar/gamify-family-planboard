import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Target, TrendingUp } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';

export function StatsOverview() {
  const { t } = useTranslation('gamification');
  const { currentMember } = useFamily();
  const { family, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    weeklyPoints: 0,
  });

  useEffect(() => {
    if (currentMember && family) {
      loadStats();
    }
  }, [currentMember, family, isAdmin]);

  const loadStats = async () => {
    if (!currentMember || !family) return;

    const supabase = getSupabaseClient();
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('family_id', family.id)
      .eq('is_archived', false);

    if (!isAdmin) {
      // Non-admins see their tasks + unassigned tasks
      query = query.or(`assigned_to.eq.${currentMember.id},assigned_to.is.null`);
    }

    const { data: allTasks } = await query;

    const completedTasks = allTasks?.filter(t => t.status === 'completed').length || 0;
    const pendingTasks = allTasks?.filter(t => t.status !== 'completed').length || 0;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const { data: weeklyPointsData } = await supabase
      .from('points_history')
      .select('points')
      .eq('family_id', family.id)
      .eq('member_id', currentMember.id)
      .gte('created_at', weekStart.toISOString());

    const weeklyPoints = weeklyPointsData?.reduce((sum, p) => sum + p.points, 0) || 0;

    setStats({
      totalTasks: allTasks?.length || 0,
      completedTasks,
      pendingTasks,
      weeklyPoints,
    });
  };

  const completionRate = stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const statCards = [
    {
      label: t('stats.totalTasks'),
      value: stats.totalTasks,
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: t('stats.completed'),
      value: stats.completedTasks,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: t('stats.pending'),
      value: stats.pendingTasks,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: t('stats.weeklyPoints'),
      value: stats.weeklyPoints,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        {isAdmin ? t('stats.familyStats') : t('stats.yourStats')}
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat) => (
          <div key={stat.label} className={`p-4 rounded-lg ${stat.bgColor}`}>
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {stats.totalTasks > 0 && (
        <div>
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>{t('stats.completionRate')}</span>
            <span className="font-semibold">{completionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
