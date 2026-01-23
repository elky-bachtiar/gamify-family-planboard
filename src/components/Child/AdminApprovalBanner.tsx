import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Star,
  Trash2,
  ChevronDown,
  ChevronUp,
  Minus,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useFamily } from '../../contexts/FamilyContext';
import { useAchievementNotification } from '../../contexts/AchievementNotificationContext';
import { getSupabaseClient } from '../../lib/supabase';
import {
  approveTask,
  rejectTask,
  getOverdueWeeklyTasks,
  awardManualPoints,
} from '../../lib/gamification';
import { MissedWeeklyTasksSection } from '../Admin/MissedWeeklyTasksSection';
import { PRIORITY_CONFIG } from '../../types';
import type { Task, FamilyMember } from '../../types';

type TaskWithCompleter = Task & {
  completer: FamilyMember | null;
};

type TaskWithCreator = Task & {
  creator: FamilyMember | null;
};

export function AdminApprovalBanner() {
  const { t } = useTranslation(['admin', 'tasks', 'common']);
  const { family, familyMember, isAdmin, refreshAuth } = useAuth();
  const { familyMembers } = useFamily();
  const { showAchievements } = useAchievementNotification();
  const [pendingTasks, setPendingTasks] = useState<TaskWithCompleter[]>([]);
  const [pendingCreationTasks, setPendingCreationTasks] = useState<TaskWithCreator[]>([]);
  const [missedWeeklyTasksCount, setMissedWeeklyTasksCount] = useState(0);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [editedPointValues, setEditedPointValues] = useState<Record<string, number>>({});
  const [isExpanded, setIsExpanded] = useState(false);

  // Point deduction state
  const [deductMemberId, setDeductMemberId] = useState('');
  const [deductPoints, setDeductPoints] = useState('');
  const [deductReason, setDeductReason] = useState('');
  const [isDeducting, setIsDeducting] = useState(false);
  const [deductSuccess, setDeductSuccess] = useState(false);
  const [showDeductConfirm, setShowDeductConfirm] = useState(false);

  const totalPending = pendingTasks.length + pendingCreationTasks.length + missedWeeklyTasksCount;

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
      const tasksWithCreators = (pendingCreation || []).map((task) => ({
        ...task,
        creator: familyMembers.find((m) => m.id === task.created_by) || null,
      }));
      setPendingCreationTasks(tasksWithCreators);
      // Initialize edited point values
      const pointValues: Record<string, number> = {};
      tasksWithCreators.forEach((task) => {
        pointValues[task.id] = task.point_value ?? 0;
      });
      setEditedPointValues((prev) => ({ ...prev, ...pointValues }));
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
      const tasksWithCompleters = (pending || []).map((task) => ({
        ...task,
        completer: familyMembers.find((m) => m.id === task.completed_by) || null,
      }));
      setPendingTasks(tasksWithCompleters);
    }

    // Load missed weekly tasks count
    const missedTasks = await getOverdueWeeklyTasks(family.id);
    setMissedWeeklyTasksCount(missedTasks.length);
  };

  useEffect(() => {
    if (!isAdmin) return;

    loadTasks();

    // Subscribe to task changes
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('child-view-approvals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `family_id=eq.${family?.id}`,
        },
        () => {
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [family?.id, familyMembers, isAdmin]);

  // Approval handlers for completion
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

  // Approval handlers for creation
  const handleApproveCreation = async (task: Task) => {
    if (!familyMember) return;

    setProcessingTaskId(task.id);
    const supabase = getSupabaseClient();

    const pointValue = editedPointValues[task.id] ?? task.point_value;

    const { error } = await (
      supabase.from('tasks') as unknown as {
        update: (values: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: Error | null }>;
        };
      }
    )
      .update({
        creation_approved: true,
        creation_approved_by: familyMember.id,
        creation_approved_at: new Date().toISOString(),
        point_value: pointValue,
      })
      .eq('id', task.id);

    if (error) {
      console.error('Error approving task creation:', error);
    } else {
      loadTasks();
    }
    setProcessingTaskId(null);
  };

  const handleRejectCreation = async (task: Task) => {
    setProcessingTaskId(task.id);
    const supabase = getSupabaseClient();

    const { error } = await supabase.from('tasks').delete().eq('id', task.id);

    if (error) {
      console.error('Error rejecting task creation:', error);
    } else {
      loadTasks();
    }
    setProcessingTaskId(null);
  };

  const handlePointValueChange = (taskId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setEditedPointValues((prev) => ({ ...prev, [taskId]: numValue }));
    }
  };

  // Point deduction handlers
  const handleDeductSubmit = () => {
    const pointValue = parseInt(deductPoints, 10);
    if (isNaN(pointValue) || pointValue <= 0 || !deductMemberId || !deductReason.trim()) {
      return;
    }
    setShowDeductConfirm(true);
  };

  const handleDeductConfirm = async () => {
    if (!familyMember) return;

    setIsDeducting(true);
    setShowDeductConfirm(false);

    const pointValue = parseInt(deductPoints, 10);
    const actualPoints = -Math.abs(pointValue);

    const result = await awardManualPoints(deductMemberId, actualPoints, deductReason.trim());

    if (result.success) {
      setDeductSuccess(true);
      setDeductMemberId('');
      setDeductPoints('');
      setDeductReason('');
      refreshAuth();
      setTimeout(() => setDeductSuccess(false), 3000);
    }

    setIsDeducting(false);
  };

  // Filter members for deduction (exclude current admin)
  const deductableMembers = familyMembers.filter((m) => m.id !== familyMember?.id);
  const selectedDeductMember = familyMembers.find((m) => m.id === deductMemberId);

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="mx-4 mt-4">
      {/* Collapsed banner */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-3 shadow-md flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <span className="font-medium">{t('admin:panel.title')}</span>
          {totalPending > 0 && (
            <span className="bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full text-sm font-bold">
              {totalPending}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-2 bg-white rounded-xl shadow-md p-4 space-y-4">
          {/* New Task Requests (Creation Approvals) */}
          {pendingCreationTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-medium text-gray-700">
                  {t('admin:approvals.newTaskRequests')} ({pendingCreationTasks.length})
                </h3>
              </div>
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
                          {task.creator && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              {t('admin:approvals.createdBy', { name: task.creator.name })}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500">
                              {t('admin:approvals.points')}:
                            </span>
                            <input
                              type="number"
                              value={pointValue}
                              onChange={(e) => handlePointValueChange(task.id, e.target.value)}
                              className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                              min="0"
                            />
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
            </div>
          )}

          {/* Pending Completion Approvals */}
          {pendingTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <h3 className="text-sm font-medium text-gray-700">
                  {t('admin:approvals.pendingApprovals')} ({pendingTasks.length})
                </h3>
              </div>
              <div className="space-y-2">
                {pendingTasks.map((task) => {
                  const priorityConfig =
                    PRIORITY_CONFIG[(task.priority ?? 'medium') as keyof typeof PRIORITY_CONFIG];
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
                            <p className="text-xs text-gray-600 mt-0.5">
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
            </div>
          )}

          {/* Missed Weekly Tasks Section */}
          {missedWeeklyTasksCount > 0 && (
            <MissedWeeklyTasksSection onPenaltyApplied={loadTasks} compact />
          )}

          {/* Point Deduction Section */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Minus className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-medium text-gray-700">{t('admin:manualPoints.title')}</h3>
            </div>

            <div className="space-y-2">
              {/* Member Select */}
              <select
                value={deductMemberId}
                onChange={(e) => setDeductMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">{t('admin:manualPoints.selectPlaceholder')}</option>
                {deductableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.total_points} {t('common:labels.points')})
                  </option>
                ))}
              </select>

              {/* Points and Reason in row */}
              <div className="flex gap-2">
                <input
                  type="number"
                  value={deductPoints}
                  onChange={(e) => setDeductPoints(e.target.value)}
                  placeholder={t('admin:manualPoints.pointsPlaceholder')}
                  min="1"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <input
                  type="text"
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                  placeholder={t('admin:manualPoints.reasonPlaceholder')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Success Message */}
              {deductSuccess && (
                <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 p-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  {t('admin:manualPoints.success')}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleDeductSubmit}
                disabled={isDeducting || !deductMemberId || !deductPoints || !deductReason.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Minus className="w-4 h-4" />
                {isDeducting
                  ? t('admin:manualPoints.submitting')
                  : t('admin:manualPoints.submitButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deduction Confirmation Modal */}
      {showDeductConfirm && selectedDeductMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('admin:manualPoints.confirmTitle')}
              </h3>
            </div>

            <p className="text-gray-600 mb-4">
              {t('admin:manualPoints.confirmMessage', {
                name: selectedDeductMember.name,
                points: Math.abs(parseInt(deductPoints, 10) || 0),
              })}
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{t('admin:manualPoints.reasonLabel')}:</span>{' '}
                {deductReason}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeductConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                onClick={handleDeductConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                {t('admin:manualPoints.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
