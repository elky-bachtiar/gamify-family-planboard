import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Calendar, Star, Skull } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { getSupabaseClient } from '../../lib/supabase';
import { getOverdueWeeklyTasks, applyWeeklyTaskPenalty } from '../../lib/gamification';
import type { Task, FamilyMember } from '../../types';

type TaskWithAssignee = Task & {
  assignee: FamilyMember | null;
};

interface MissedWeeklyTasksSectionProps {
  onPenaltyApplied?: () => void;
  compact?: boolean;
}

export function MissedWeeklyTasksSection({ onPenaltyApplied, compact = false }: MissedWeeklyTasksSectionProps) {
  const { t } = useTranslation(['admin', 'common']);
  const { family, familyMember, refreshAuth } = useAuth();
  const { familyMembers } = useFamily();
  const [missedTasks, setMissedTasks] = useState<TaskWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [confirmingTask, setConfirmingTask] = useState<TaskWithAssignee | null>(null);

  const loadMissedTasks = async () => {
    if (!family?.id) return;

    setLoading(true);
    const tasks = await getOverdueWeeklyTasks(family.id);

    const tasksWithAssignees = tasks.map(task => ({
      ...task,
      assignee: familyMembers.find(m => m.id === task.assigned_to) || null
    }));

    setMissedTasks(tasksWithAssignees);
    setLoading(false);
  };

  useEffect(() => {
    loadMissedTasks();

    // Subscribe to task changes
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('missed-weekly-tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `family_id=eq.${family?.id}`
        },
        () => {
          loadMissedTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [family?.id, familyMembers]);

  const handleApplyPenalty = async (task: TaskWithAssignee) => {
    if (!familyMember) return;

    setProcessingTaskId(task.id);
    setConfirmingTask(null);

    const result = await applyWeeklyTaskPenalty(task, familyMember);

    if (result.success) {
      loadMissedTasks();
      refreshAuth();
      onPenaltyApplied?.();
    }

    setProcessingTaskId(null);
  };

  const calculatePenalty = (pointValue: number) => {
    return Math.floor(pointValue / 2);
  };

  if (loading) {
    return null;
  }

  if (missedTasks.length === 0) {
    return null;
  }

  return (
    <div className={compact ? '' : 'mt-6'}>
      <div className="flex items-center gap-2 mb-3">
        <Skull className="w-4 h-4 text-red-500" />
        <h3 className="text-sm font-medium text-gray-700">
          {t('admin:missedWeeklyTasks.title')} ({missedTasks.length})
        </h3>
      </div>

      <div className="space-y-2">
        {missedTasks.map((task) => {
          const penalty = calculatePenalty(task.point_value);
          const isProcessing = processingTaskId === task.id;

          return (
            <div
              key={task.id}
              className="p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                  {task.assignee && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      {t('admin:missedWeeklyTasks.assignedTo', { name: task.assignee.name })}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {task.due_date}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
                      <Star className="w-3 h-3" />
                      {task.point_value} {t('common:labels.points')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                      <AlertTriangle className="w-3 h-3" />
                      -{penalty} {t('common:labels.points')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmingTask(task)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? t('admin:missedWeeklyTasks.applying') : t('admin:missedWeeklyTasks.applyPenalty')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Skull className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('admin:missedWeeklyTasks.confirmTitle')}
              </h3>
            </div>

            <p className="text-gray-600 mb-4">
              {t('admin:missedWeeklyTasks.confirmMessage', {
                name: confirmingTask.assignee?.name || t('common:labels.unknown'),
                penalty: calculatePenalty(confirmingTask.point_value)
              })}
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-900">{confirmingTask.title}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t('admin:missedWeeklyTasks.originalPoints', { points: confirmingTask.point_value })}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingTask(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                onClick={() => handleApplyPenalty(confirmingTask)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                {t('admin:missedWeeklyTasks.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
