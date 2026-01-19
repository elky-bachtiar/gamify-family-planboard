import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, Star, Clock } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import { useFamily } from '../../contexts/FamilyContext';
import { useAuth } from '../../contexts/AuthContext';

interface ChildCreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  defaultTitle?: string;
}

export function ChildCreateTaskModal({ isOpen, onClose, onTaskCreated, defaultTitle }: ChildCreateTaskModalProps) {
  const { t } = useTranslation(['gamification', 'common', 'tasks']);
  const { currentMember } = useFamily();
  const { family } = useAuth();
  const [title, setTitle] = useState(defaultTitle || '');
  const [description, setDescription] = useState('');
  const [dueTime, setDueTime] = useState('18:00');
  const [isCreating, setIsCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset form when modal closes, or update title when defaultTitle changes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setDueTime('18:00');
      setShowSuccess(false);
    } else if (defaultTitle) {
      setTitle(defaultTitle);
    }
  }, [isOpen, defaultTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember || !family || !title.trim()) return;

    setIsCreating(true);

    try {
      const supabase = getSupabaseClient();
      const today = new Date().toISOString().split('T')[0];
      const dueDatetime = `${today}T${dueTime}:00`;

      // Create task with default points (parents will approve/adjust)
      // Task created by child is auto-assigned to them
      // Set creation_approved to false so parent must approve before task becomes active
      // Type assertion needed due to Supabase client type inference issues
      const { error } = await (supabase.from('tasks') as unknown as {
        insert: (values: Record<string, unknown>) => Promise<{ error: Error | null }>;
      }).insert({
        title: title.trim(),
        description: description.trim() || null,
        assigned_to: currentMember.id,
        due_date: today,
        due_datetime: dueDatetime,
        priority: 'medium', // Default priority
        point_value: 10, // Default points - parents can adjust when approving
        created_by: currentMember.id,
        family_id: family.id,
        creation_approved: false, // Requires parent approval
      });

      if (error) throw error;

      // Show success message
      setShowSuccess(true);
      onTaskCreated();

      // Auto-close after showing success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  // Success view after task is created
  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center animate-fade-in">
        <div className="bg-white w-full max-w-lg rounded-t-3xl animate-slide-up safe-area-bottom">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {t('gamification:child.taskModal.sentForApproval')}
            </h2>
            <p className="text-gray-600">
              {t('gamification:child.taskModal.parentWillReview')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-t-3xl animate-slide-up safe-area-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900">{t('gamification:child.taskModal.createTitle')}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
            <Star className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" />
            <p className="text-sm text-blue-700">
              {t('gamification:child.completion.earnPoints', { points: 10 })}
            </p>
          </div>

          {/* Task Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              {t('gamification:child.taskModal.whatToDo')}
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('gamification:child.taskModal.placeholder')}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              {t('tasks:modal.descriptionLabel')}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tasks:modal.descriptionPlaceholder')}
              rows={2}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          {/* Due Time */}
          <div>
            <label htmlFor="dueTime" className="block text-sm font-medium text-gray-700 mb-2">
              {t('tasks:modal.dueTimeLabel')}
            </label>
            <input
              id="dueTime"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-lg
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-medium
                hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              {t('common:buttons.cancel')}
            </button>
            <button
              type="submit"
              disabled={isCreating || !title.trim()}
              className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-bold
                hover:bg-blue-600 active:scale-[0.98] transition-all
                disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isCreating ? t('gamification:child.taskModal.creating') : t('gamification:child.taskModal.createButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
