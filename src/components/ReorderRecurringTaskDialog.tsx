import { useTranslation } from 'react-i18next';
import { X, Repeat, GripVertical } from 'lucide-react';

interface ReorderRecurringTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReorderSingle: () => void;
  onReorderAllFuture: () => void;
  taskTitle: string;
  futureTaskCount: number;
  isUpdating: boolean;
}

export function ReorderRecurringTaskDialog({
  isOpen,
  onClose,
  onReorderSingle,
  onReorderAllFuture,
  taskTitle,
  futureTaskCount,
  isUpdating,
}: ReorderRecurringTaskDialogProps) {
  const { t } = useTranslation(['tasks', 'common']);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <GripVertical className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">{t('tasks:recurringReorder.title')}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-gray-700 mb-4">
            {t('tasks:recurringReorder.partOfSeries', { title: taskTitle })}
          </p>

          <div className="space-y-3">
            <button
              onClick={onReorderSingle}
              disabled={isUpdating}
              className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="font-medium text-gray-900 group-hover:text-blue-700">{t('tasks:recurringReorder.reorderSingleTitle')}</div>
              <div className="text-sm text-gray-500 mt-1">
                {t('tasks:recurringReorder.reorderSingleDescription')}
              </div>
            </button>

            <button
              onClick={onReorderAllFuture}
              disabled={isUpdating}
              className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="font-medium text-gray-900 group-hover:text-purple-700 flex items-center gap-2">
                {t('tasks:recurringReorder.reorderAllFutureTitle')}
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  {t('tasks:recurringReorder.reorderAllFutureBadge', { count: futureTaskCount })}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {t('tasks:recurringReorder.reorderAllFutureDescription')}
              </div>
            </button>
          </div>

          {isUpdating && (
            <div className="mt-4 flex items-center justify-center text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600 mr-2"></div>
              {t('tasks:recurringReorder.updating')}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common:buttons.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
