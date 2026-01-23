import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Circle,
  Star,
  Trash2,
  Sparkles,
  UserPlus,
  Clock,
  Repeat,
  Tag,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { completeTask } from '../lib/gamification';
import { getSupabaseClient } from '../lib/supabase';
import { PRIORITY_CONFIG } from '../types';
import type { TaskWithMember } from '../types';
import { DeleteTaskConfirmModal } from './DeleteTaskConfirmModal';

interface TaskCardProps {
  task: TaskWithMember;
  onUpdate: () => void;
  onTaskClick?: (task: TaskWithMember) => void;
}

export function TaskCard({ task, onUpdate, onTaskClick }: TaskCardProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const { isAdmin } = useAuth();
  const { currentMember } = useFamily();
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isCompleted = task.status === 'completed';
  const isPendingApproval = task.status === 'pending_approval';
  const priorityConfig =
    PRIORITY_CONFIG[(task.priority ?? 'medium') as keyof typeof PRIORITY_CONFIG];
  const isUnassigned = !task.assigned_to;
  const isAssignedToOther = task.assigned_to && task.assigned_to !== currentMember?.id;
  const assignee = task.family_members;

  const handleComplete = async () => {
    if (!currentMember || isCompleted || isPendingApproval) return;

    setIsCompleting(true);
    const result = await completeTask(task, currentMember, isAdmin);

    if (result.success) {
      if (isAdmin) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2000);
      }
      onUpdate();
    }

    setIsCompleting(false);
  };

  const handleClaim = async () => {
    if (!currentMember || !isUnassigned) return;

    setIsClaiming(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('tasks')
      .update({ assigned_to: currentMember.id })
      .eq('id', task.id);

    if (!error) {
      onUpdate();
    }
    setIsClaiming(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirmed = () => {
    setShowDeleteModal(false);
    onUpdate();
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    onTaskClick?.(task);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`relative p-3 rounded-lg border-2 transition-all cursor-pointer ${
        isCompleted
          ? 'bg-green-50 border-green-200 opacity-75'
          : isPendingApproval
            ? 'bg-yellow-50 border-yellow-200'
            : isUnassigned
              ? 'bg-gray-50 border-dashed border-gray-300 hover:border-blue-400'
              : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      {showCelebration && (
        <div className="absolute inset-0 flex items-center justify-center bg-yellow-50 bg-opacity-90 rounded-lg animate-pulse z-10">
          <Sparkles className="w-12 h-12 text-yellow-500" />
        </div>
      )}

      <div className="flex items-start gap-2">
        <button
          onClick={handleComplete}
          disabled={isCompleted || isCompleting || isPendingApproval}
          className={`flex-shrink-0 mt-0.5 transition-colors ${
            isCompleted
              ? 'text-green-500'
              : isPendingApproval
                ? 'text-yellow-500'
                : 'text-gray-400 hover:text-blue-500'
          }`}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5" fill="currentColor" />
          ) : isPendingApproval ? (
            <Clock className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`text-sm font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}
            >
              {task.title}
            </h3>
            {!isCompleted && (
              <button
                onClick={handleDeleteClick}
                className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {task.description && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${priorityConfig.color}`}
            >
              {t(`tasks:priority.${task.priority}`)}
            </span>

            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <Star className="w-3 h-3" fill="currentColor" />
              {task.point_value}
            </span>

            {task.recurring_task_group_id && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700"
                title="Recurring task"
              >
                <Repeat className="w-3 h-3" />
              </span>
            )}

            {isPendingApproval && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                <Clock className="w-3 h-3" />
                {t('tasks:card.awaitingApproval')}
              </span>
            )}

            {isAssignedToOther && assignee && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: assignee.color ?? '#3b82f6' }}
              >
                {assignee.name}
              </span>
            )}

            {isUnassigned && !isCompleted && !isPendingApproval && (
              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
              >
                <UserPlus className="w-3 h-3" />
                {isClaiming ? t('tasks:card.claiming') : t('tasks:card.claim')}
              </button>
            )}

            {task.associated_items && task.associated_items.length > 0 && (
              <>
                {task.associated_items.slice(0, 2).map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                  >
                    <Tag className="w-3 h-3" />
                    {item}
                  </span>
                ))}
                {task.associated_items.length > 2 && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                    +{task.associated_items.length - 2}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <DeleteTaskConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        task={task}
        onDeleted={handleDeleteConfirmed}
      />
    </div>
  );
}
