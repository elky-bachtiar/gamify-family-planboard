import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, Target, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';

export function StatsOverview() {
  const { currentMember } = useFamily();
  const { family } = useAuth();
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
  }, [currentMember, family]);

  const loadStats = async () => {
    if (!currentMember || !family) return;

    const { data: allTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', family.id)
      .eq('assigned_to', currentMember.id)
      .eq('is_archived', false);

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
      label: 'Total Tasks',
      value: stats.totalTasks,
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Completed',
      value: stats.completedTasks,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Pending',
      value: stats.pendingTasks,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Weekly Points',
      value: stats.weeklyPoints,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Your Stats</h2>

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
            <span>Completion Rate</span>
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
