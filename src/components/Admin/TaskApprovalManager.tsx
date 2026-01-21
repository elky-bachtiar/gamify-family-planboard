import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Clock, Star, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { useAchievementNotification } from '../../contexts/AchievementNotificationContext';
import { getSupabaseClient } from '../../lib/supabase';
import { approveTask, rejectTask } from '../../lib/gamification';
import { MissedWeeklyTasksSection } from './MissedWeeklyTasksSection';
import { PRIORITY_CONFIG } from '../../types';
import type { Task, FamilyMember } from '../../types';

type TaskWithCompleter = Task & {
  completer: FamilyMember | null;
};

type TaskWithCreator = Task & {
  creator: FamilyMember | null;
};

export function TaskApprovalManager() {
  const { t } = useTranslation(['admin', 'tasks', 'gamification']);
  const { family, familyMember } = useAuth();
  const { familyMembers } = useFamily();
  const { showAchievements } = useAchievementNotification();
  const [pendingTasks, setPendingTasks] = useState<TaskWithCompleter[]>([]);
  const [pendingCreationTasks, setPendingCreationTasks] = useState<TaskWithCreator[]>([]);
  const [recentlyApproved, setRecentlyApproved] = useState<TaskWithCompleter[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [editedPointValues, setEditedPointValues] = useState<Record<string, number>>({});

  const loadTasks = async () => {
    if (!family?.id) return;

    const supabase = getSupabaseClient();

    // Load tasks pending creation approval (child-created tasks awaiting parent approval)
    const { data: pendingCreation, error: pendingCreationError } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', family.id)
      .eq('creation_approved', false)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (pendingCreationError) {
      console.error('Error loading pending creation tasks:', pendingCreationError);
    } else {
      const tasksWithCreators = (pendingCreation || []).map(task => ({
        ...task,
        creator: familyMembers.find(m => m.id === task.created_by) || null
      }));
      setPendingCreationTasks(tasksWithCreators);
      // Initialize edited point values
      const pointValues: Record<string, number> = {};
      tasksWithCreators.forEach(task => {
        pointValues[task.id] = task.point_value;
      });
      setEditedPointValues(prev => ({ ...prev, ...pointValues }));
    }

    // Load pending approval tasks (completion approvals)
    const { data: pending, error: pendingError } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', family.id)
      .eq('status', 'pending_approval')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (pendingError) {
      console.error('Error loading pending tasks:', pendingError);
    } else {
      const tasksWithCompleters = (pending || []).map(task => ({
        ...task,
        completer: familyMembers.find(m => m.id === task.completed_by) || null
      }));
      setPendingTasks(tasksWithCompleters);
    }

    // Load recently approved tasks (last 5)
    const { data: approved, error: approvedError } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', family.id)
      .eq('status', 'completed')
      .not('approved_at', 'is', null)
      .eq('is_archived', false)
      .order('approved_at', { ascending: false })
      .limit(5);

    if (approvedError) {
      console.error('Error loading approved tasks:', approvedError);
    } else {
      const tasksWithCompleters = (approved || []).map(task => ({
        ...task,
        completer: familyMembers.find(m => m.id === task.completed_by) || null
      }));
      setRecentlyApproved(tasksWithCompleters);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTasks();

    // Subscribe to task changes
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('task-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `family_id=eq.${family?.id}`
        },
        () => {
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [family?.id, familyMembers]);

  const handleApprove = async (task: Task) => {
    if (!familyMember) return;

    setProcessingTaskId(task.id);
    const result = await approveTask(task, familyMember);
    if (result.success) {
      loadTasks();
      // Show achievement notifications if any were earned
      if (result.newAchievements && result.newAchievements.length > 0) {
        showAchievements(result.newAchievements);
      }
    }
    setProcessingTaskId(null);
  };

  const handleReject = async (task: Task) => {
    setProcessingTaskId(task.id);
    const result = await rejectTask(task);
    if (result.success) {
      loadTasks();
    }
    setProcessingTaskId(null);
  };

  // Approve a task creation (child-created task)
  const handleApproveCreation = async (task: Task) => {
    if (!familyMember) return;

    setProcessingTaskId(task.id);
    const supabase = getSupabaseClient();

    // Get the edited point value (or original if not edited)
    const pointValue = editedPointValues[task.id] ?? task.point_value;

    // Type assertion needed due to Supabase client type inference issues
    const { error } = await (supabase.from('tasks') as unknown as {
      update: (values: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: Error | null }> };
    }).update({
      creation_approved: true,
      creation_approved_by: familyMember.id,
      creation_approved_at: new Date().toISOString(),
      point_value: pointValue,
    }).eq('id', task.id);

    if (error) {
      console.error('Error approving task creation:', error);
    } else {
      loadTasks();
    }
    setProcessingTaskId(null);
  };

  // Reject (delete) a task creation
  const handleRejectCreation = async (task: Task) => {
    setProcessingTaskId(task.id);
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);

    if (error) {
      console.error('Error rejecting task creation:', error);
    } else {
      loadTasks();
    }
    setProcessingTaskId(null);
  };

  // Handle point value change for a task
  const handlePointValueChange = (taskId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditedPointValues(prev => ({ ...prev, [taskId]: numValue }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* New Task Requests (Creation Approvals) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-medium text-gray-700">
            {t('admin:approvals.newTaskRequests')} ({pendingCreationTasks.length})
          </h3>
        </div>

        {pendingCreationTasks.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center bg-gray-50 rounded-lg">
            {t('admin:approvals.noNewTaskRequests')}
          </p>
        ) : (
          <div className="space-y-2">
            {pendingCreationTasks.map((task) => {
              const isProcessing = processingTaskId === task.id;
              const pointValue = editedPointValues[task.id] ?? task.point_value;

              return (
                <div
                  key={task.id}
                  className="p-3 bg-orange-50 border border-orange-200 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                      )}
                      {task.creator && (
                        <p className="text-xs text-gray-600 mt-1">
                          {t('admin:approvals.createdBy', { name: task.creator.name })}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">{t('admin:approvals.points')}:</span>
                          <input
                            type="number"
                            value={pointValue}
                            onChange={(e) => handlePointValueChange(task.id, e.target.value)}
                            className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleApproveCreation(task)}
                        disabled={isProcessing}
                        className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                        title={t('admin:approvals.approveButton')}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRejectCreation(task)}
                        disabled={isProcessing}
                        className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                        title={t('admin:approvals.rejectButton')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Completion Approvals */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-medium text-gray-700">
            {t('admin:approvals.pendingApprovals')} ({pendingTasks.length})
          </h3>
        </div>

        {pendingTasks.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center bg-gray-50 rounded-lg">
            {t('admin:approvals.noPending')}
          </p>
        ) : (
          <div className="space-y-2">
            {pendingTasks.map((task) => {
              const priorityConfig = PRIORITY_CONFIG[task.priority];
              const isProcessing = processingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                      {task.completer && (
                        <p className="text-xs text-gray-600 mt-1">
                          {t('admin:approvals.submittedBy', { name: task.completer.name })}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${priorityConfig.color}`}
                        >
                          {t(`tasks:priority.${task.priority}`)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                          <Star className="w-3 h-3" fill="currentColor" />
                          {task.point_value}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleApprove(task)}
                        disabled={isProcessing}
                        className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                        title={t('admin:approvals.approveButton')}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleReject(task)}
                        disabled={isProcessing}
                        className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                        title={t('admin:approvals.rejectButton')}
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Missed Weekly Tasks Section */}
      <MissedWeeklyTasksSection onPenaltyApplied={loadTasks} />

      {recentlyApproved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-medium text-gray-700">{t('gamification:stats.completed')}</h3>
          </div>
          <div className="space-y-2">
            {recentlyApproved.map((task) => (
              <div
                key={task.id}
                className="p-2 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{task.title}</span>
                    {task.completer && (
                      <span
                        className="text-xs px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: task.completer.color }}
                      >
                        {task.completer.name}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                    <Star className="w-3 h-3" fill="currentColor" />
                    +{task.point_value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
