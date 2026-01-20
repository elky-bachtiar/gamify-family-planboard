import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, Repeat } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { countFutureRecurringTasks } from '../lib/recurrence';
import type { TaskWithMember } from '../types';

interface DeleteTaskConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskWithMember | null;
  onDeleted: () => void;
}

export function DeleteTaskConfirmModal({ isOpen, onClose, task, onDeleted }: DeleteTaskConfirmModalProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const [isDeleting, setIsDeleting] = useState(false);
  const [futureTaskCount, setFutureTaskCount] = useState(0);
  const [showRecurringOptions, setShowRecurringOptions] = useState(false);

  useEffect(() => {
    const checkRecurring = async () => {
      if (isOpen && task?.recurring_task_group_id) {
        const count = await countFutureRecurringTasks(supabase, task.recurring_task_group_id);
        setFutureTaskCount(count);
        setShowRecurringOptions(count > 1);
      } else {
        setShowRecurringOptions(false);
        setFutureTaskCount(0);
      }
    };

    checkRecurring();
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleDeleteSingle = async () => {
    if (!task) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      onDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllFuture = async () => {
    if (!task?.recurring_task_group_id) return;

    setIsDeleting(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('recurring_task_group_id', task.recurring_task_group_id)
        .gte('due_date', today)
        .neq('status', 'completed');

      if (error) throw error;

      onDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting recurring tasks:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center gap-3 p-6 border-b border-gray-200">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {t('tasks:delete.confirmTitle')}
            </h2>
            {showRecurringOptions && (
              <div className="flex items-center gap-1 mt-1 text-sm text-purple-600">
                <Repeat className="w-4 h-4" />
                <span>{t('tasks:delete.recurringTask')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-700 mb-4">
            {showRecurringOptions
              ? t('tasks:delete.recurringMessage', { title: task.title })
              : t('tasks:delete.confirmMessage', { title: task.title })}
          </p>

          {showRecurringOptions && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-purple-800">
                {t('tasks:delete.futureTasksInfo', { count: futureTaskCount })}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {showRecurringOptions ? (
              <>
                <button
                  onClick={handleDeleteSingle}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('tasks:delete.deleteThisOnly')}
                </button>
                <button
                  onClick={handleDeleteAllFuture}
                  disabled={isDeleting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                >
                  <Repeat className="w-4 h-4" />
                  {isDeleting
                    ? t('tasks:delete.deleting')
                    : t('tasks:delete.deleteAllFuture', { count: futureTaskCount })}
                </button>
              </>
            ) : (
              <button
                onClick={handleDeleteSingle}
                disabled={isDeleting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? t('tasks:delete.deleting') : t('tasks:delete.deleteTask')}
              </button>
            )}

            <button
              onClick={onClose}
              disabled={isDeleting}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {t('common:buttons.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
