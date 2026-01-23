import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Clock, Star, CheckCircle, Loader2, Hand, Undo2 } from 'lucide-react';
import { completeTask } from '../../lib/gamification';
import { getSupabaseClient } from '../../lib/supabase';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';
import type { TaskWithMember } from '../../types';

interface TaskCompletionModalProps {
  task: TaskWithMember;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (task: TaskWithMember, pointsEarned: number) => void;
  onClaimSuccess?: (task: TaskWithMember) => void;
  onUnclaimSuccess?: (task: TaskWithMember) => void;
}

export function TaskCompletionModal({
  task,
  isOpen,
  onClose,
  onComplete,
  onClaimSuccess,
  onUnclaimSuccess,
}: TaskCompletionModalProps) {
  const { t } = useTranslation('gamification');
  const { currentMember } = useFamily();
  const { isAdmin } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isPending = task.status === 'pending';
  const isPendingApproval = task.status === 'pending_approval';
  const isCompleted = task.status === 'completed';
  const isClaimable = isPending && task.assigned_to === null;
  // Task is unclaimable if it's pending, assigned to me, and was originally unassigned (no created_by match)
  const isUnclaimable =
    isPending && task.assigned_to === currentMember?.id && task.created_by !== currentMember?.id;

  // Format due time if available
  const formatDueTime = () => {
    if (!task.due_datetime) return null;
    const date = new Date(task.due_datetime);
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleComplete = async () => {
    if (!currentMember || !isPending) return;

    setIsSubmitting(true);

    try {
      // Use the completeTask function which handles the update properly
      const result = await completeTask(task, currentMember, isAdmin);

      if (!result.success) throw result.error;

      // Trigger completion celebration
      onComplete(task, task.point_value ?? 0);
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Failed to complete task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaimTask = async () => {
    if (!currentMember || !isClaimable) return;

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();

      // Claim the task by assigning it to the current member
      // Type assertion needed due to Supabase client type inference issues
      const { error } = await (
        supabase.from('tasks') as unknown as {
          update: (values: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<{ error: Error | null }>;
          };
        }
      )
        .update({ assigned_to: currentMember.id })
        .eq('id', task.id);

      if (error) throw error;

      // Create updated task with new assignment and notify parent for immediate UI refresh
      const updatedTask: TaskWithMember = {
        ...task,
        assigned_to: currentMember.id,
      };
      onClaimSuccess?.(updatedTask);
      onClose();
    } catch (error) {
      console.error('Error claiming task:', error);
      alert('Failed to claim task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnclaimTask = async () => {
    if (!currentMember || !isUnclaimable) return;

    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();

      // Unclaim the task by setting assigned_to back to null
      const { error } = await (
        supabase.from('tasks') as unknown as {
          update: (values: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<{ error: Error | null }>;
          };
        }
      )
        .update({ assigned_to: null })
        .eq('id', task.id);

      if (error) throw error;

      // Create updated task without assignment and notify parent for immediate UI refresh
      const updatedTask: TaskWithMember = {
        ...task,
        assigned_to: null,
      };
      onUnclaimSuccess?.(updatedTask);
      onClose();
    } catch (error) {
      console.error('Error unclaiming task:', error);
      alert('Failed to cancel claim. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dueTime = formatDueTime();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center">
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Task icon/emoji */}
        <div className="text-center px-6">
          <div className="text-6xl mb-4">
            {isCompleted ? '✅' : isPendingApproval ? '⏳' : isClaimable ? '🙋' : '📋'}
          </div>

          {/* Task title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{task.title}</h2>

          {/* Task description */}
          {task.description && <p className="text-gray-600 mb-6">{task.description}</p>}

          {/* Task info */}
          <div className="flex items-center justify-center gap-6 mb-8">
            {dueTime && (
              <div className="flex items-center gap-2 text-gray-500">
                <Clock className="w-5 h-5" />
                <span>{dueTime}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400" fill="currentColor" />
              <span className="font-bold text-amber-600">
                {t('points.value', { count: task.point_value ?? 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Action area */}
        <div className="p-6 bg-gray-50 rounded-b-2xl sm:rounded-b-2xl">
          {/* Claimable (unassigned) task - show claim button */}
          {isClaimable && (
            <>
              <button
                onClick={handleClaimTask}
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white
                  font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02]
                  transition-all duration-200 disabled:opacity-50 disabled:transform-none
                  flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    {t('child.completion.claiming')}
                  </>
                ) : (
                  <>
                    <Hand className="w-6 h-6" />
                    {t('child.completion.claimTask')}
                  </>
                )}
              </button>
              <p className="text-sm text-gray-500 text-center mt-3">
                {t('child.completion.earnPoints', { points: task.point_value })}
              </p>
            </>
          )}

          {/* Assigned pending task - show complete button and optional unclaim */}
          {isPending && !isClaimable && (
            <div className="space-y-3">
              <button
                onClick={handleComplete}
                disabled={isSubmitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-green-600 text-white
                  font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02]
                  transition-all duration-200 disabled:opacity-50 disabled:transform-none
                  flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    {t('child.completion.submitting')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6" />
                    {t('child.completion.imDone')}
                  </>
                )}
              </button>

              {/* Unclaim button - only for tasks that were claimed (not created by the child) */}
              {isUnclaimable && (
                <button
                  onClick={handleUnclaimTask}
                  disabled={isSubmitting}
                  className="w-full py-3 px-6 bg-gray-100 text-gray-600
                    font-medium text-sm rounded-xl hover:bg-gray-200
                    transition-all duration-200 disabled:opacity-50
                    flex items-center justify-center gap-2"
                >
                  <Undo2 className="w-4 h-4" />
                  {t('child.completion.unclaim')}
                </button>
              )}
            </div>
          )}

          {isPendingApproval && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full mb-2">
                <Clock className="w-5 h-5 animate-pulse" />
                <span className="font-medium">{t('child.completion.waitingApproval')}</span>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{t('child.celebration.approved')}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {t('child.completion.earnPoints', { points: task.point_value })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
