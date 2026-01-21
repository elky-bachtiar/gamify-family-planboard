import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, RefreshCw, Plus, Sparkles, CalendarDays } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChildTaskCard } from './ChildTaskCard';
import type { TaskWithMember } from '../../types';

// Quick task suggestion keys mapped to emojis and default titles
const quickTaskSuggestionKeys = [
  { emoji: '📚', key: 'read', defaultTitle: 'Read for 20 minutes' },
  { emoji: '🧹', key: 'clean', defaultTitle: 'Clean my room' },
  { emoji: '🏃', key: 'exercise', defaultTitle: 'Exercise for 15 minutes' },
  { emoji: '🎨', key: 'create', defaultTitle: 'Do something creative' },
  { emoji: '🎮', key: 'learn', defaultTitle: 'Practice a new skill' },
  { emoji: '🐕', key: 'petCare', defaultTitle: 'Take care of pets' },
];

interface TodayTaskListProps {
  onTaskClick: (task: TaskWithMember) => void;
  onCreateTask?: (defaultTitle?: string) => void;
}

export function TodayTaskList({ onTaskClick, onCreateTask }: TodayTaskListProps) {
  const { t, i18n } = useTranslation('gamification');
  const { currentMember } = useFamily();
  const { family } = useAuth();
  const [tasks, setTasks] = useState<TaskWithMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Calculate the Sunday of the current week (for weekly tasks)
  const getWeekSunday = (): string => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + daysUntilSunday);
    return sunday.toISOString().split('T')[0];
  };

  const weekSunday = getWeekSunday();

  const fetchTasks = async (showRefresh = false) => {
    if (!currentMember || !family) return;

    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const supabase = getSupabaseClient();

      // Fetch tasks for today OR overdue unassigned pending tasks from previous days
      // OR weekly tasks for the current week
      // Use explicit foreign key hint to avoid ambiguity
      const { data, error } = await supabase
        .from('tasks')
        .select('*, family_members!assigned_to(*)')
        .eq('family_id', family.id)
        .eq('is_archived', false)
        .or(
          // Today's tasks (assigned to child or unassigned, non-weekly)
          `and(due_date.eq.${today},is_weekly_task.eq.false,or(assigned_to.eq.${currentMember.id},assigned_to.is.null)),` +
          // Overdue unassigned pending tasks from previous days (non-weekly)
          `and(due_date.lt.${today},assigned_to.is.null,status.eq.pending,is_weekly_task.eq.false),` +
          // Weekly tasks for the current week (assigned to child or unassigned)
          `and(is_weekly_task.eq.true,due_date.eq.${weekSunday},or(assigned_to.eq.${currentMember.id},assigned_to.is.null))`
        )
        .order('due_datetime', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    // Subscribe to task changes for the family
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('child-tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `family_id=eq.${family?.id}`,
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentMember?.id, family?.id, today]);

  // Separate tasks by status and assignment
  // Only show tasks that are creation_approved (or where creation_approved is undefined for backward compat)
  const approvedTasks = tasks.filter(t => t.creation_approved !== false);

  // Separate weekly tasks from daily tasks
  const weeklyTasks = approvedTasks.filter(t => t.is_weekly_task);
  const dailyApprovedTasks = approvedTasks.filter(t => !t.is_weekly_task);

  // Weekly tasks - separate by status
  const pendingWeeklyTasks = weeklyTasks.filter(t => t.status === 'pending' || t.status === 'pending_approval');
  const completedWeeklyTasks = weeklyTasks.filter(t => t.status === 'completed');

  const myPendingTasks = dailyApprovedTasks.filter(t => t.status === 'pending' && t.assigned_to === currentMember?.id);

  // Filter available (unassigned) tasks:
  // - Hide tasks that haven't reached their start_datetime yet
  // - Hide tasks that are past their due_datetime + 1 hour
  const now = new Date();
  const oneHourMs = 60 * 60 * 1000;
  const availableTasks = dailyApprovedTasks.filter(t => {
    if (t.status !== 'pending' || t.assigned_to !== null) return false;

    // If task has a start_datetime, only show if current time >= start time
    if (t.start_datetime) {
      const startTime = new Date(t.start_datetime);
      if (now < startTime) {
        return false; // Task hasn't started yet
      }
    }

    // If task has a due_datetime, check if it's more than 1 hour past
    if (t.due_datetime) {
      const dueTime = new Date(t.due_datetime);
      if (dueTime.getTime() + oneHourMs < now.getTime()) {
        return false; // Task is expired (more than 1 hour past due time)
      }
    }
    return true;
  });

  const pendingApprovalTasks = dailyApprovedTasks.filter(t => t.status === 'pending_approval');
  const completedTasks = dailyApprovedTasks.filter(t => t.status === 'completed');

  // Tasks created by child that are waiting for parent approval
  const pendingCreationTasks = tasks.filter(
    t => t.creation_approved === false && t.created_by === currentMember?.id
  );

  // Progress only counts tasks assigned to the child
  const myTasks = tasks.filter(t => t.assigned_to === currentMember?.id);
  const totalTasks = myTasks.length;
  const doneTasks = myTasks.filter(t => t.status === 'completed').length;
  const progressPercent = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  // Format today's date
  const formatDate = () => {
    return new Date().toLocaleDateString(i18n.language, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      {/* Date header with refresh */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <span className="font-medium text-gray-700">{formatDate()}</span>
        </div>
        <button
          onClick={() => fetchTasks(true)}
          disabled={isRefreshing}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Progress summary */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">{t('child.taskList.todaysProgress')}</span>
          <span className="text-sm font-bold text-gray-900">{t('child.taskList.done', { done: doneTasks, total: totalTasks })}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progressPercent === 100
                ? 'bg-gradient-to-r from-green-400 to-green-500'
                : 'bg-gradient-to-r from-blue-400 to-blue-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {progressPercent === 100 && totalTasks > 0 && (
          <p className="text-center text-green-600 font-medium mt-2 text-sm">
            {t('child.taskList.allDone')}
          </p>
        )}
      </div>

      {/* Task lists */}
      {tasks.length === 0 ? (
        <div className="text-center py-8 px-4">
          {/* Animated floating star */}
          <div className="text-7xl mb-6 animate-float inline-block">
            🌟
          </div>

          {/* Fun heading */}
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            {t('child.taskList.emptyState.title')}
          </h3>

          {/* Encouraging text */}
          <p className="text-gray-600 mb-6">
            {t('child.taskList.emptyState.subtitle')}
          </p>

          {/* Quick task suggestions */}
          {onCreateTask && (
            <>
              <p className="text-sm text-gray-500 mb-3 font-medium">{t('child.taskList.emptyState.quickIdeas')}</p>
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {quickTaskSuggestionKeys.map(suggestion => (
                  <button
                    key={suggestion.key}
                    onClick={() => onCreateTask(suggestion.defaultTitle)}
                    className="px-4 py-2 bg-white border-2 border-gray-200 rounded-full
                      text-sm font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50
                      hover:text-blue-700 transition-all active:scale-95 shadow-sm"
                  >
                    {suggestion.emoji} {t(`child.taskList.suggestions.${suggestion.key}`)}
                  </button>
                ))}
              </div>

              {/* Main CTA button */}
              <button
                onClick={() => onCreateTask()}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500
                  text-white px-6 py-3 rounded-xl font-bold text-lg shadow-lg
                  hover:shadow-xl hover:from-blue-600 hover:to-purple-600
                  active:scale-95 transition-all"
              >
                <Sparkles className="w-5 h-5" />
                {t('child.taskList.emptyState.createOwn')}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending creation tasks (waiting for parent) */}
          {pendingCreationTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">
                {t('child.taskList.sections.waitingForParent', { count: pendingCreationTasks.length })}
              </h3>
              <div className="space-y-3">
                {pendingCreationTasks.map(task => (
                  <ChildTaskCard key={task.id} task={task} onClick={onTaskClick} isPendingCreation />
                ))}
              </div>
            </div>
          )}

          {/* Weekly Tasks Section */}
          {weeklyTasks.length > 0 && (
            <div className="bg-purple-50 border border-dashed border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
                  {t('tasks:calendar.weeklyTasks')}
                </h3>
              </div>
              <div className="space-y-3">
                {pendingWeeklyTasks.map(task => (
                  <ChildTaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    isWeeklyTask
                  />
                ))}
                {completedWeeklyTasks.map(task => (
                  <ChildTaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    isWeeklyTask
                  />
                ))}
              </div>
            </div>
          )}

          {/* My pending tasks */}
          {myPendingTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {t('child.taskList.sections.myTasks', { count: myPendingTasks.length })}
              </h3>
              <div className="space-y-3">
                {myPendingTasks.map(task => (
                  <ChildTaskCard key={task.id} task={task} onClick={onTaskClick} />
                ))}
              </div>
            </div>
          )}

          {/* Available tasks to claim */}
          {availableTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">
                {t('child.taskList.sections.available', { count: availableTasks.length })}
              </h3>
              <div className="space-y-3">
                {availableTasks.map(task => (
                  <ChildTaskCard
                    key={task.id}
                    task={task}
                    onClick={onTaskClick}
                    isClaimable
                    isOverdue={task.due_date !== null && task.due_date < today}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pending approval */}
          {pendingApprovalTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-600 uppercase tracking-wide mb-3">
                {t('child.taskList.sections.waitingApproval', { count: pendingApprovalTasks.length })}
              </h3>
              <div className="space-y-3">
                {pendingApprovalTasks.map(task => (
                  <ChildTaskCard key={task.id} task={task} onClick={onTaskClick} />
                ))}
              </div>
            </div>
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-600 uppercase tracking-wide mb-3">
                {t('child.taskList.sections.completed', { count: completedTasks.length })}
              </h3>
              <div className="space-y-3">
                {completedTasks.map(task => (
                  <ChildTaskCard key={task.id} task={task} onClick={onTaskClick} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      {onCreateTask && tasks.length > 0 && (
        <button
          onClick={() => onCreateTask()}
          className="fixed bottom-24 right-4 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg
            flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all z-30"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}
    </div>
  );
}
