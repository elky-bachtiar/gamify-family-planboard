import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, Tag, X } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';
import type { TaskWithMember } from '../types';
import { TaskCard } from './TaskCard';
import { TaskModal, type TaskInitialValues } from './TaskModal';
import { TaskDetailModal } from './TaskDetailModal';

export function WeeklyCalendar() {
  const { t, i18n } = useTranslation(['tasks', 'common']);
  const { currentMember } = useFamily();
  const { family, isAdmin } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [tasks, setTasks] = useState<TaskWithMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<TaskWithMember | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [copyTaskInitialValues, setCopyTaskInitialValues] = useState<TaskInitialValues | undefined>(undefined);

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  function getWeekDays(startDate: Date): Date[] {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  }

  function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const weekDays = getWeekDays(currentWeekStart);

  const loadTasks = async () => {
    if (!currentMember || !family) return;

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);

    const supabase = getSupabaseClient();
    let query = supabase
      .from('tasks')
      .select('*, family_members!assigned_to(*)')
      .eq('family_id', family.id)
      .eq('is_archived', false)
      .gte('due_date', formatLocalDate(currentWeekStart))
      .lte('due_date', formatLocalDate(weekEnd))
      .order('due_datetime');

    if (!isAdmin) {
      // Non-admins see their tasks + unassigned tasks
      query = query.or(`assigned_to.eq.${currentMember.id},assigned_to.is.null`);
    }

    const { data, error } = await query;

    console.log('[WeeklyCalendar] Task query result:', { data, error, currentMember: currentMember?.id, family: family?.id });

    if (error) {
      console.error('Error loading tasks:', error);
      return;
    }

    setTasks(data as TaskWithMember[]);
  };

  useEffect(() => {
    loadTasks();

    const supabase = getSupabaseClient();
    const subscription = supabase
      .channel('tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadTasks();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentMember, currentWeekStart, family, isAdmin]);

  const previousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const nextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const today = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  // Extract unique tags from all tasks
  const allTags = Array.from(
    new Set(tasks.flatMap(task => task.associated_items || []))
  ).sort();

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const clearTagFilter = () => {
    setSelectedTags([]);
  };

  const getTasksForDay = (date: Date): TaskWithMember[] => {
    const dateStr = formatLocalDate(date);
    let filteredTasks = tasks.filter(task => task.due_date === dateStr);

    // Apply tag filter if any tags are selected
    if (selectedTags.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        task.associated_items?.some(item => selectedTags.includes(item))
      );
    }

    return filteredTasks;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const openModalForDate = (date: Date) => {
    setSelectedDate(formatLocalDate(date));
    setIsModalOpen(true);
  };

  const handleTaskClick = (task: TaskWithMember) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  const handleCopyTask = (initialValues: TaskInitialValues, defaultDate: string) => {
    setCopyTaskInitialValues(initialValues);
    setSelectedDate(defaultDate);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setCopyTaskInitialValues(undefined);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {isAdmin ? t('common:navigation.familyBoard') : t('tasks:calendar.weeklyView')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={previousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={today}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('common:time.today')}
            </button>
            <button
              onClick={nextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Tag className="w-4 h-4" />
              {t('tasks:calendar.filterByTag', 'Filter:')}
            </span>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={clearTagFilter}
                className="px-2 py-1 rounded text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                {t('common:buttons.clear', 'Clear')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {weekDays.map((day) => {
          const dayTasks = getTasksForDay(day);
          const completedCount = dayTasks.filter(t => t.status === 'completed').length;
          const totalCount = dayTasks.length;

          return (
            <div
              key={day.toISOString()}
              className={`bg-white min-h-[200px] ${isToday(day) ? 'bg-blue-50' : ''}`}
            >
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase">
                      {day.toLocaleDateString(i18n.language, { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-semibold ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>
                      {day.getDate()}
                    </div>
                  </div>
                  <button
                    onClick={() => openModalForDate(day)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title={t('tasks:calendar.addTask')}
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-600 h-4">
                  {totalCount > 0 ? `${completedCount}/${totalCount} ${t('gamification:stats.completed').toLowerCase()}` : '\u00A0'}
                </div>
              </div>

              <div className="p-2 space-y-2">
                {dayTasks.map(task => (
                  <TaskCard key={task.id} task={task} onUpdate={loadTasks} onTaskClick={handleTaskClick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onTaskCreated={loadTasks}
        defaultDate={selectedDate}
        initialValues={copyTaskInitialValues}
      />

      <TaskDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        task={selectedTask}
        onTaskUpdated={loadTasks}
        onCopyTask={handleCopyTask}
      />
    </div>
  );
}
