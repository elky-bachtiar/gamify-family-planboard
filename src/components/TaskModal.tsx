import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CalendarDays } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';
import { PRIORITY_CONFIG } from '../types';
import { RecurrenceSelector } from './RecurrenceSelector';
import { TagInput } from './TagInput';
import type { RecurrencePattern } from '../lib/recurrence';
import { generateRecurringTaskInstances, validateRecurrenceConfig } from '../lib/recurrence';

export interface TaskInitialValues {
  title?: string;
  description?: string;
  assignedTo?: string;
  priority?: 'low' | 'medium' | 'high';
  dueTime?: string;
  startTime?: string;
  associatedItems?: string[];
  recurrencePattern?: RecurrencePattern;
  recurrenceDays?: number[];
  recurrenceEndDate?: string;
  isWeeklyTask?: boolean;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  defaultDate?: string;
  initialValues?: TaskInitialValues;
}

export function TaskModal({ isOpen, onClose, onTaskCreated, defaultDate, initialValues }: TaskModalProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const { currentMember, familyMembers } = useFamily();
  const { family, isAdmin } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('12:00');
  const [startTime, setStartTime] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isCreating, setIsCreating] = useState(false);

  // Recurrence state (admin only)
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>(null);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

  // Tags/Associated items state
  const [associatedItems, setAssociatedItems] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Weekly task state (admin only)
  const [isWeeklyTask, setIsWeeklyTask] = useState(false);

  // Fetch available tags from family tasks
  useEffect(() => {
    async function fetchTags() {
      if (!family) return;

      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('associated_items')
          .eq('family_id', family.id)
          .not('associated_items', 'is', null);

        if (error) throw error;

        // Extract unique tags from all tasks and sort by frequency
        const tagCounts = new Map<string, number>();
        (data as Array<{ associated_items: string[] | null }> | null)?.forEach((task) => {
          const items = task.associated_items;
          items?.forEach((tag) => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        });

        // Sort by frequency (most used first)
        const sortedTags = Array.from(tagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([tag]) => tag);

        setAvailableTags(sortedTags);
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    }

    if (isOpen) {
      fetchTags();
    }
  }, [family, isOpen]);

  useEffect(() => {
    if (defaultDate) {
      setDueDate(defaultDate);
    }
    if (currentMember) {
      setAssignedTo(currentMember.id);
    }
  }, [defaultDate, currentMember]);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setDueDate(defaultDate || '');
      setDueTime('12:00');
      setStartTime('');
      setPriority('medium');
      setAssignedTo(currentMember?.id || '');
      setRecurrencePattern(null);
      setRecurrenceDays([]);
      setRecurrenceEndDate('');
      setAssociatedItems([]);
      setIsWeeklyTask(false);
    } else if (initialValues) {
      // Apply initial values when modal opens (for copy functionality)
      if (initialValues.title) setTitle(initialValues.title);
      if (initialValues.description) setDescription(initialValues.description);
      if (initialValues.assignedTo !== undefined) setAssignedTo(initialValues.assignedTo);
      if (initialValues.priority) setPriority(initialValues.priority);
      if (initialValues.dueTime) setDueTime(initialValues.dueTime);
      if (initialValues.startTime) setStartTime(initialValues.startTime);
      if (initialValues.associatedItems) setAssociatedItems(initialValues.associatedItems);
      if (initialValues.recurrencePattern !== undefined) setRecurrencePattern(initialValues.recurrencePattern);
      if (initialValues.recurrenceDays) setRecurrenceDays(initialValues.recurrenceDays);
      if (initialValues.recurrenceEndDate) setRecurrenceEndDate(initialValues.recurrenceEndDate);
      if (initialValues.isWeeklyTask !== undefined) setIsWeeklyTask(initialValues.isWeeklyTask);
    }
  }, [isOpen, initialValues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember || !family || !title.trim() || !dueDate) return;

    // Validate recurrence configuration if enabled
    if (recurrencePattern) {
      const recurrenceConfig = {
        pattern: recurrencePattern,
        days: recurrenceDays,
        endDate: new Date(recurrenceEndDate),
        startDate: new Date(dueDate),
      };

      const validationError = validateRecurrenceConfig(recurrenceConfig);
      if (validationError) {
        alert(t('tasks:modal.errors.noRecurrenceTasks'));
        return;
      }
    }

    setIsCreating(true);

    try {
      const dueDatetime = `${dueDate}T${dueTime}:00`;
      const startDatetime = startTime ? `${dueDate}T${startTime}:00` : null;

      if (recurrencePattern && recurrenceEndDate) {
        // Generate and insert recurring task instances
        const groupId = crypto.randomUUID();
        const recurrenceConfig = {
          pattern: recurrencePattern,
          days: recurrenceDays,
          endDate: new Date(recurrenceEndDate),
          startDate: new Date(dueDate),
        };

        const taskInstances = generateRecurringTaskInstances(
          {
            title: title.trim(),
            description: description.trim(),
            assigned_to: assignedTo || null,
            due_datetime: dueDatetime,
            start_datetime: startDatetime,
            priority,
            point_value: PRIORITY_CONFIG[priority].points,
            created_by: currentMember.id,
            family_id: family.id,
            associated_items: associatedItems,
          },
          recurrenceConfig,
          groupId
        );

        if (taskInstances.length === 0) {
          alert(t('tasks:modal.errors.noRecurrenceTasks'));
          setIsCreating(false);
          return;
        }

        const { error } = await supabase.from('tasks').insert(taskInstances);
        if (error) throw error;
      } else {
        // Single task creation
        // For weekly tasks, set due_date to the Sunday of the selected week
        let effectiveDueDate = dueDate;
        if (isWeeklyTask) {
          const selectedDate = new Date(dueDate);
          const dayOfWeek = selectedDate.getDay();
          const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
          const weekEnd = new Date(selectedDate);
          weekEnd.setDate(selectedDate.getDate() + daysUntilSunday);
          effectiveDueDate = weekEnd.toISOString().split('T')[0];
        }

        const effectiveDueDatetime = `${effectiveDueDate}T${dueTime}:00`;

        const { error } = await supabase.from('tasks').insert({
          title: title.trim(),
          description: description.trim(),
          assigned_to: assignedTo || null,
          due_date: effectiveDueDate,
          due_datetime: effectiveDueDatetime,
          start_datetime: startDatetime,
          priority,
          point_value: PRIORITY_CONFIG[priority].points,
          created_by: currentMember.id,
          family_id: family.id,
          associated_items: associatedItems,
          is_weekly_task: isWeeklyTask,
        });

        if (error) throw error;
      }

      onTaskCreated();
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      alert(t('tasks:modal.errors.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{t('tasks:modal.createTitle')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              {t('tasks:modal.titleLabel')}
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tasks:modal.titlePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              {t('tasks:modal.descriptionLabel')}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tasks:modal.descriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 mb-1">
              {t('tasks:modal.assigneeLabel')}
            </label>
            <select
              id="assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
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
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                {t('tasks:modal.dueDateLabel')}
              </label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label htmlFor="dueTime" className="block text-sm font-medium text-gray-700 mb-1">
                {t('tasks:modal.dueTimeLabel')}
              </label>
              <input
                id="dueTime"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {isAdmin && (
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                {t('tasks:modal.startTimeLabel')}
              </label>
              <input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('tasks:modal.startTimePlaceholder')}
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('tasks:modal.startTimeHint')}
              </p>
            </div>
          )}

          {/* Weekly task checkbox (admin only) */}
          {isAdmin && dueDate && !recurrencePattern && (
            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <input
                id="isWeeklyTask"
                type="checkbox"
                checked={isWeeklyTask}
                onChange={(e) => setIsWeeklyTask(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <div className="flex-1">
                <label htmlFor="isWeeklyTask" className="flex items-center gap-2 text-sm font-medium text-gray-900 cursor-pointer">
                  <CalendarDays className="w-4 h-4 text-purple-600" />
                  {t('tasks:weeklyTask.label')}
                </label>
                <p className="mt-0.5 text-xs text-gray-600">
                  {t('tasks:weeklyTask.hint')}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('tasks:modal.priorityLabel')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PRIORITY_CONFIG) as Array<'low' | 'medium' | 'high'>).map((p) => {
                const config = PRIORITY_CONFIG[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      priority === p
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900 capitalize">{t(`tasks:priority.${p}`)}</div>
                    <div className="text-xs text-gray-600">{config.points} {t('tasks:modal.pts')}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('tasks:modal.tagsLabel', 'Tags/Objects')}
            </label>
            <TagInput
              tags={associatedItems}
              onTagsChange={setAssociatedItems}
              placeholder={t('tasks:modal.tagsPlaceholder', 'e.g., dishwasher, kitchen')}
              availableTags={availableTags}
              showRecentTags={true}
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('tasks:modal.tagsHint', 'Press Enter or comma to add a tag')}
            </p>
          </div>

          {/* Recurrence selector (admin only, not available for weekly tasks) */}
          {isAdmin && dueDate && !isWeeklyTask && (
            <RecurrenceSelector
              pattern={recurrencePattern}
              onPatternChange={setRecurrencePattern}
              selectedDays={recurrenceDays}
              onDaysChange={setRecurrenceDays}
              endDate={recurrenceEndDate}
              onEndDateChange={setRecurrenceEndDate}
              startDate={new Date(dueDate)}
            />
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('common:buttons.cancel')}
            </button>
            <button
              type="submit"
              disabled={isCreating || !title.trim() || !dueDate || (recurrencePattern !== null && !recurrenceEndDate)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isCreating ? t('tasks:modal.creating') : t('tasks:modal.createButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
