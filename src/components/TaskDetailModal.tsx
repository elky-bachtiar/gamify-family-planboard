import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Calendar, Clock, Star, User, AlertCircle, CheckCircle2, Pencil, Save, Tag, Trash2, Copy } from 'lucide-react';
import { PRIORITY_CONFIG } from '../types';
import type { TaskWithMember } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../contexts/FamilyContext';
import { supabase } from '../lib/supabase';
import { TagInput } from './TagInput';
import { EditRecurringTaskDialog } from './EditRecurringTaskDialog';
import { DeleteTaskConfirmModal } from './DeleteTaskConfirmModal';
import { countFutureRecurringTasks } from '../lib/recurrence';
import type { TaskInitialValues } from './TaskModal';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskWithMember | null;
  onTaskUpdated?: () => void;
  onCopyTask?: (initialValues: TaskInitialValues, defaultDate: string) => void;
}

export function TaskDetailModal({ isOpen, onClose, task, onTaskUpdated, onCopyTask }: TaskDetailModalProps) {
  const { t, i18n } = useTranslation(['tasks', 'common']);
  const { isAdmin } = useAuth();
  const { familyMembers } = useFamily();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDueTime, setEditDueTime] = useState('12:00');
  const [editStartTime, setEditStartTime] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState<string>('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editAssociatedItems, setEditAssociatedItems] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Recurring task edit dialog state
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [futureTaskCount, setFutureTaskCount] = useState(0);
  const [pendingUpdate, setPendingUpdate] = useState<{
    title: string;
    description: string;
    assigned_to: string | null;
    due_date: string;
    due_datetime: string;
    start_datetime: string | null;
    priority: 'low' | 'medium' | 'high';
    point_value: number;
    associated_items: string[];
  } | null>(null);

  // Initialize edit state when task changes or edit mode starts
  useEffect(() => {
    if (task && isEditing) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setEditDueDate(task.due_date);
      // Extract time directly from ISO string to avoid timezone issues
      setEditDueTime(task.due_datetime ? task.due_datetime.split('T')[1]?.substring(0, 5) || '12:00' : '12:00');
      setEditStartTime(task.start_datetime ? task.start_datetime.split('T')[1]?.substring(0, 5) || '' : '');
      setEditAssignedTo(task.assigned_to || '');
      setEditPriority(task.priority);
      setEditAssociatedItems(task.associated_items || []);
    }
  }, [task, isEditing]);

  // Reset edit mode when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
    }
  }, [isOpen]);

  if (!isOpen || !task) return null;

  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const isCompleted = task.status === 'completed';
  const assignee = task.family_members;
  const canEdit = isAdmin && !isCompleted && task.status !== 'pending_approval';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(i18n.language, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (datetimeStr: string | null) => {
    if (!datetimeStr) return null;
    // Extract time directly from ISO string to avoid timezone conversion issues
    // Format: "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DDTHH:MM:SS+00:00"
    const timePart = datetimeStr.split('T')[1];
    if (!timePart) return null;
    const [hours, minutes] = timePart.split(':');
    return `${hours}:${minutes}`;
  };

  const handleSave = async () => {
    if (!task || !editTitle.trim() || !editDueDate) return;

    const dueDatetime = `${editDueDate}T${editDueTime}:00`;
    const startDatetime = editStartTime ? `${editDueDate}T${editStartTime}:00` : null;
    const updatePayload = {
      title: editTitle.trim(),
      description: editDescription.trim(),
      assigned_to: editAssignedTo || null,
      due_date: editDueDate,
      due_datetime: dueDatetime,
      start_datetime: startDatetime,
      priority: editPriority,
      point_value: PRIORITY_CONFIG[editPriority].points,
      associated_items: editAssociatedItems,
    };

    // If this is a recurring task, show the dialog
    if (task.recurring_task_group_id) {
      setPendingUpdate(updatePayload);
      const count = await countFutureRecurringTasks(supabase, task.recurring_task_group_id);
      setFutureTaskCount(count);
      setShowRecurringDialog(true);
      return;
    }

    // Otherwise, just update the single task
    await updateSingleTask(updatePayload);
  };

  const updateSingleTask = async (payload: typeof pendingUpdate) => {
    if (!task || !payload) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: payload.title,
          description: payload.description,
          assigned_to: payload.assigned_to,
          due_date: payload.due_date,
          due_datetime: payload.due_datetime,
          start_datetime: payload.start_datetime,
          priority: payload.priority,
          point_value: payload.point_value,
          associated_items: payload.associated_items,
        } as never)
        .eq('id', task.id);

      if (error) throw error;

      setIsEditing(false);
      setShowRecurringDialog(false);
      setPendingUpdate(null);
      onTaskUpdated?.();
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateAllFutureTasks = async () => {
    if (!task || !pendingUpdate || !task.recurring_task_group_id) return;
    setIsSaving(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      // First, fetch all future tasks to update their start_datetime individually
      if (pendingUpdate.start_datetime) {
        const { data: futureTasks, error: fetchError } = await supabase
          .from('tasks')
          .select('id, due_date')
          .eq('recurring_task_group_id', task.recurring_task_group_id)
          .gte('due_date', today)
          .neq('status', 'completed');

        if (fetchError) throw fetchError;

        // Extract the time portion from the new start_datetime
        const startTime = new Date(pendingUpdate.start_datetime).toTimeString().slice(0, 8);

        // Update each task's start_datetime by combining its due_date with the new start time
        if (futureTasks && futureTasks.length > 0) {
          const updates = futureTasks.map((t) => ({
            id: t.id,
            start_datetime: `${t.due_date}T${startTime}`,
          }));

          // Batch update start_datetime for all future tasks
          for (const update of updates) {
            const { error: updateError } = await supabase
              .from('tasks')
              .update({ start_datetime: update.start_datetime } as never)
              .eq('id', update.id);

            if (updateError) throw updateError;
          }
        }
      }

      // Update all future non-completed tasks in the group
      // Update: title, description, assigned_to, priority, point_value, associated_items
      // Keep per-instance: due_date, due_datetime
      // start_datetime is updated separately above to preserve each task's date
      const { error } = await supabase
        .from('tasks')
        .update({
          title: pendingUpdate.title,
          description: pendingUpdate.description,
          assigned_to: pendingUpdate.assigned_to,
          priority: pendingUpdate.priority,
          point_value: pendingUpdate.point_value,
          associated_items: pendingUpdate.associated_items,
        } as never)
        .eq('recurring_task_group_id', task.recurring_task_group_id)
        .gte('due_date', today)
        .neq('status', 'completed');

      if (error) throw error;

      setIsEditing(false);
      setShowRecurringDialog(false);
      setPendingUpdate(null);
      onTaskUpdated?.();
    } catch (error) {
      console.error('Error updating recurring tasks:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSingleFromDialog = () => {
    updateSingleTask(pendingUpdate);
  };

  const handleEditAllFutureFromDialog = () => {
    updateAllFutureTasks();
  };

  const handleCloseRecurringDialog = () => {
    setShowRecurringDialog(false);
    setPendingUpdate(null);
  };

  const handleStartEdit = () => {
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditDueDate(task.due_date);
    // Extract time directly from ISO string to avoid timezone issues
    setEditDueTime(task.due_datetime ? task.due_datetime.split('T')[1]?.substring(0, 5) || '12:00' : '12:00');
    setEditStartTime(task.start_datetime ? task.start_datetime.split('T')[1]?.substring(0, 5) || '' : '');
    setEditAssignedTo(task.assigned_to || '');
    setEditPriority(task.priority);
    setEditAssociatedItems(task.associated_items || []);
    setIsEditing(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirmed = () => {
    setShowDeleteModal(false);
    onClose();
    onTaskUpdated?.();
  };

  const handleCopyTask = () => {
    if (!task || !onCopyTask) return;

    const initialValues: TaskInitialValues = {
      title: task.title,
      description: task.description || '',
      assignedTo: task.assigned_to || '',
      priority: task.priority,
      // Extract time directly from ISO string to avoid timezone issues
      dueTime: task.due_datetime ? task.due_datetime.split('T')[1]?.substring(0, 5) || '12:00' : '12:00',
      startTime: task.start_datetime ? task.start_datetime.split('T')[1]?.substring(0, 5) || '' : '',
      associatedItems: task.associated_items || [],
    };

    onClose();
    onCopyTask(initialValues, task.due_date);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? t('tasks:modal.editTitle') : t('tasks:modal.viewTitle')}
          </h2>
          <div className="flex items-center gap-2">
            {isAdmin && !isEditing && onCopyTask && (
              <button
                onClick={handleCopyTask}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                title={t('tasks:detail.copyTask')}
              >
                <Copy className="w-5 h-5" />
              </button>
            )}
            {canEdit && !isEditing && (
              <button
                onClick={handleStartEdit}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title={t('tasks:detail.editTask')}
              >
                <Pencil className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {isEditing ? (
          // Edit form
          <div className="p-4 space-y-4">
            <div>
              <label htmlFor="editTitle" className="block text-sm font-medium text-gray-700 mb-1">
                {t('tasks:modal.titleLabel')}
              </label>
              <input
                id="editTitle"
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t('tasks:modal.titlePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="editDescription" className="block text-sm font-medium text-gray-700 mb-1">
                {t('tasks:modal.descriptionLabel')}
              </label>
              <textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('tasks:modal.descriptionPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label htmlFor="editAssignedTo" className="block text-sm font-medium text-gray-700 mb-1">
                {t('tasks:modal.assigneeLabel')}
              </label>
              <select
                id="editAssignedTo"
                value={editAssignedTo}
                onChange={(e) => setEditAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('tasks:modal.unassigned')}</option>
                {familyMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="editDueDate" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('tasks:modal.dueDateLabel')}
                </label>
                <input
                  id="editDueDate"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="editDueTime" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('tasks:modal.dueTimeLabel')}
                </label>
                <input
                  id="editDueTime"
                  type="time"
                  value={editDueTime}
                  onChange={(e) => setEditDueTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="editStartTime" className="block text-sm font-medium text-gray-700 mb-1">
                {t('tasks:modal.startTimeLabel')}
              </label>
              <input
                id="editStartTime"
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('tasks:modal.startTimeHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('tasks:detail.priority')}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PRIORITY_CONFIG) as Array<'low' | 'medium' | 'high'>).map((p) => {
                  const config = PRIORITY_CONFIG[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPriority(p)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        editPriority === p
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">{t(`tasks:priority.${p}`)}</div>
                      <div className="text-xs text-gray-600">{config.points} {t('tasks:modal.pts')}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('tasks:detail.tagsObjects')}
              </label>
              <TagInput
                tags={editAssociatedItems}
                onTagsChange={setEditAssociatedItems}
                placeholder={t('tasks:detail.tagsPlaceholder')}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('tasks:detail.tagsHint')}
              </p>
            </div>
          </div>
        ) : (
          // View mode
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-start gap-3">
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-gray-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className={`text-lg font-semibold ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {task.title}
                  </h3>
                  {isCompleted && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 mt-1">
                      {t('tasks:status.completed')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {task.description && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">{t('tasks:detail.description')}</label>
                <p className="text-gray-700">{task.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">{t('tasks:detail.dueDate')}</label>
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{formatDate(task.due_date)}</span>
                </div>
              </div>
              {task.due_datetime && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('tasks:detail.dueTime')}</label>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{formatTime(task.due_datetime)}</span>
                  </div>
                </div>
              )}
            </div>

            {task.start_datetime && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">{t('tasks:detail.startTime')}</label>
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{formatTime(task.start_datetime)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">{t('tasks:detail.priority')}</label>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium text-white ${priorityConfig.color}`}
                >
                  {t(`tasks:priority.${task.priority}`)}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">{t('tasks:detail.points')}</label>
                <div className="flex items-center gap-2 text-amber-600">
                  <Star className="w-4 h-4" fill="currentColor" />
                  <span className="font-semibold">{t('tasks:detail.pointsValue', { count: task.point_value })}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">{t('tasks:detail.assignedTo')}</label>
              {assignee ? (
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: assignee.color }}
                  >
                    {assignee.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-gray-700">{assignee.name}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <User className="w-4 h-4" />
                  <span>{t('tasks:detail.unassigned')}</span>
                </div>
              )}
            </div>

            {task.associated_items && task.associated_items.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">{t('tasks:detail.tagsObjects')}</label>
                <div className="flex flex-wrap gap-2">
                  {task.associated_items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
                    >
                      <Tag className="w-3 h-3" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {task.completed_at && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">{t('tasks:detail.completedAt')}</label>
                <p className="text-gray-700 text-sm">
                  {new Date(task.completed_at).toLocaleString(i18n.language)}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="p-4 border-t border-gray-200">
          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !editTitle.trim() || !editDueDate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                <Save className="w-4 h-4" />
                {isSaving ? t('tasks:detail.saving') : t('tasks:detail.saveChanges')}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {canEdit && (
                <button
                  onClick={handleDeleteClick}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('tasks:delete.deleteTask')}
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                {t('tasks:detail.close')}
              </button>
            </div>
          )}
        </div>
      </div>

      <EditRecurringTaskDialog
        isOpen={showRecurringDialog}
        onClose={handleCloseRecurringDialog}
        onEditSingle={handleEditSingleFromDialog}
        onEditAllFuture={handleEditAllFutureFromDialog}
        taskTitle={task.title}
        futureTaskCount={futureTaskCount}
        isUpdating={isSaving}
      />

      <DeleteTaskConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        task={task}
        onDeleted={handleDeleteConfirmed}
      />
    </div>
  );
}
