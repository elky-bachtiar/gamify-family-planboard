import { useState } from 'react';
import { CheckCircle2, Circle, Star, Trash2, Sparkles, UserPlus } from 'lucide-react';
import { useFamily } from '../contexts/FamilyContext';
import { completeTask } from '../lib/gamification';
import { supabase } from '../lib/supabase';
import { PRIORITY_CONFIG } from '../types';
import type { TaskWithMember } from '../types';

interface TaskCardProps {
  task: TaskWithMember;
  onUpdate: () => void;
}

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  const { currentMember } = useFamily();
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const isCompleted = task.status === 'completed';
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const isUnassigned = !task.assigned_to;
  const isAssignedToOther = task.assigned_to && task.assigned_to !== currentMember?.id;
  const assignee = task.family_members;

  const handleComplete = async () => {
    if (!currentMember || isCompleted) return;

    setIsCompleting(true);
    const result = await completeTask(task, currentMember);

    if (result.success) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);
      onUpdate();
    }

    setIsCompleting(false);
  };

  const handleClaim = async () => {
    if (!currentMember || !isUnassigned) return;

    setIsClaiming(true);
    const { error } = await supabase
      .from('tasks')
      .update({ assigned_to: currentMember.id })
      .eq('id', task.id);

    if (!error) {
      onUpdate();
    }
    setIsClaiming(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);

    if (!error) {
      onUpdate();
    }
  };

  return (
    <div
      className={`relative p-3 rounded-lg border-2 transition-all ${
        isCompleted
          ? 'bg-green-50 border-green-200 opacity-75'
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
          disabled={isCompleted || isCompleting}
          className={`flex-shrink-0 mt-0.5 transition-colors ${
            isCompleted ? 'text-green-500' : 'text-gray-400 hover:text-blue-500'
          }`}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5" fill="currentColor" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`text-sm font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
              {task.title}
            </h3>
            {!isCompleted && (
              <button
                onClick={handleDelete}
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
              {task.priority}
            </span>

            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <Star className="w-3 h-3" fill="currentColor" />
              {task.point_value}
            </span>

            {isAssignedToOther && assignee && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: assignee.color }}
              >
                {assignee.name}
              </span>
            )}

            {isUnassigned && !isCompleted && (
              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
              >
                <UserPlus className="w-3 h-3" />
                {isClaiming ? 'Claiming...' : 'Claim'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
