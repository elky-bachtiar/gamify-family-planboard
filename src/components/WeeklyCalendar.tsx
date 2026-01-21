import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, Tag, X, CalendarDays } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { getSupabaseClient } from '../lib/supabase';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';
import type { TaskWithMember, FamilyObject } from '../types';
import { SortableTaskCard } from './SortableTaskCard';
import { ReorderRecurringTaskDialog } from './ReorderRecurringTaskDialog';
import { TaskModal, type TaskInitialValues } from './TaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import {
  updateTaskSortOrder,
  updateRecurringGroupSortOrder,
  getFutureRecurringTaskCount,
  getNewSortOrderForPosition,
} from '../lib/taskOrdering';

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
  const [familyObjects, setFamilyObjects] = useState<FamilyObject[]>([]);

  // Drag and drop state
  const [reorderDialogTask, setReorderDialogTask] = useState<TaskWithMember | null>(null);
  const [pendingReorder, setPendingReorder] = useState<{ taskId: string; newSortOrder: number } | null>(null);
  const [futureTaskCount, setFutureTaskCount] = useState(0);
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  function getISOWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Set to nearest Thursday: current date + 4 - current day number (make Sunday = 7)
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    // Get first day of year
    const yearStart = new Date(d.getFullYear(), 0, 1);
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  }

  function isCurrentWeek(weekStart: Date): boolean {
    const todayWeekStart = getWeekStart(new Date());
    return weekStart.toDateString() === todayWeekStart.toDateString();
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
      .order('sort_order', { ascending: true })
      .order('due_datetime', { ascending: true });

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

  const loadFamilyObjects = async () => {
    if (!family) return;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('family_objects')
      .select('*')
      .eq('family_id', family.id)
      .order('name');

    if (error) {
      console.error('Error loading family objects:', error);
      return;
    }

    setFamilyObjects(data || []);
  };

  // Get image URL for a tag/object name
  const getObjectImage = (tagName: string): string | null => {
    const obj = familyObjects.find(o => o.name.toLowerCase() === tagName.toLowerCase());
    return obj?.image_url || null;
  };

  useEffect(() => {
    loadTasks();
    loadFamilyObjects();

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

  // Get weekly tasks for the current week
  const getWeeklyTasks = (): TaskWithMember[] => {
    let weeklyTasks = tasks.filter(task => task.is_weekly_task);

    // Apply tag filter if any tags are selected
    if (selectedTags.length > 0) {
      weeklyTasks = weeklyTasks.filter(task =>
        task.associated_items?.some(item => selectedTags.includes(item))
      );
    }

    // Sort by sort_order
    return weeklyTasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  };

  const getTasksForDay = (date: Date): TaskWithMember[] => {
    const dateStr = formatLocalDate(date);
    // Exclude weekly tasks from daily view (they're shown in the floating section)
    let filteredTasks = tasks.filter(task => task.due_date === dateStr && !task.is_weekly_task);

    // Apply tag filter if any tags are selected
    if (selectedTags.length > 0) {
      filteredTasks = filteredTasks.filter(task =>
        task.associated_items?.some(item => selectedTags.includes(item))
      );
    }

    // Sort by sort_order
    return filteredTasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const activeTask = tasks.find(t => t.id === active.id);
    const overTask = tasks.find(t => t.id === over.id);

    if (!activeTask || !overTask) return;

    // Get tasks for the day of the dragged task
    const dayTasks = getTasksForDay(new Date(activeTask.due_date));
    const oldIndex = dayTasks.findIndex(t => t.id === active.id);
    const newIndex = dayTasks.findIndex(t => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Calculate the new sort order
    const newSortOrder = getNewSortOrderForPosition(dayTasks, activeTask.id, newIndex);

    // Check if this is a recurring task
    if (activeTask.recurring_task_group_id) {
      // Show dialog for recurring task
      setPendingReorder({ taskId: activeTask.id, newSortOrder });
      setReorderDialogTask(activeTask);

      // Get count of future tasks
      const count = await getFutureRecurringTaskCount(
        activeTask.recurring_task_group_id,
        activeTask.due_date
      );
      setFutureTaskCount(count);
    } else {
      // Non-recurring task: update directly
      await updateTaskSortOrder(activeTask.id, newSortOrder);
      loadTasks();
    }
  };

  const handleReorderSingle = async () => {
    if (!pendingReorder) return;

    setIsReordering(true);
    await updateTaskSortOrder(pendingReorder.taskId, pendingReorder.newSortOrder);
    setIsReordering(false);
    setReorderDialogTask(null);
    setPendingReorder(null);
    loadTasks();
  };

  const handleReorderAllFuture = async () => {
    if (!pendingReorder || !reorderDialogTask?.recurring_task_group_id) return;

    setIsReordering(true);
    await updateRecurringGroupSortOrder(
      reorderDialogTask.recurring_task_group_id,
      pendingReorder.newSortOrder,
      reorderDialogTask.due_date
    );
    setIsReordering(false);
    setReorderDialogTask(null);
    setPendingReorder(null);
    loadTasks();
  };

  const handleReorderDialogClose = () => {
    setReorderDialogTask(null);
    setPendingReorder(null);
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
              {isCurrentWeek(currentWeekStart)
                ? t('common:time.today')
                : t('common:time.weekNumber', { week: getISOWeekNumber(currentWeekStart) })}
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
            {allTags.map(tag => {
              const imageUrl = getObjectImage(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={tag}
                      className="w-4 h-4 rounded object-cover"
                    />
                  )}
                  {tag}
                </button>
              );
            })}
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {weekDays.map((day, dayIndex) => {
            const dayTasks = getTasksForDay(day);
            const weeklyTasks = getWeeklyTasks();
            const allDayTasks = [...dayTasks, ...weeklyTasks];
            const completedCount = allDayTasks.filter(t => t.status === 'completed').length;
            const totalCount = allDayTasks.length;

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

                {/* Weekly Tasks Section - only show on first day with compact view, or show individual cards on each day */}
                {weeklyTasks.length > 0 && (
                  <div className="mx-2 mt-2 p-2 bg-purple-50 border border-dashed border-purple-200 rounded-lg">
                    {dayIndex === 0 && (
                      <div className="flex items-center gap-1 mb-2">
                        <CalendarDays className="w-3 h-3 text-purple-600" />
                        <span className="text-xs font-medium text-purple-700">
                          {t('tasks:calendar.weeklyTasks')}
                        </span>
                      </div>
                    )}
                    <div className="space-y-1">
                      {weeklyTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => handleTaskClick(task)}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                            task.status === 'completed'
                              ? 'bg-purple-100/50 text-purple-400 line-through'
                              : 'bg-white/60 hover:bg-white text-purple-900'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            task.status === 'completed' ? 'bg-green-500' : 'bg-purple-400'
                          }`} />
                          <span className="text-xs truncate flex-1">{task.title}</span>
                          {task.status === 'completed' && (
                            <span className="text-[10px] text-green-600 font-medium">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-2 pl-8 space-y-2">
                  <SortableContext
                    items={dayTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {dayTasks.map(task => (
                      <SortableTaskCard
                        key={task.id}
                        task={task}
                        onUpdate={loadTasks}
                        onTaskClick={handleTaskClick}
                        isDragEnabled={isAdmin}
                      />
                    ))}
                  </SortableContext>
                </div>
              </div>
            );
          })}
        </div>
      </DndContext>

      <ReorderRecurringTaskDialog
        isOpen={reorderDialogTask !== null}
        onClose={handleReorderDialogClose}
        onReorderSingle={handleReorderSingle}
        onReorderAllFuture={handleReorderAllFuture}
        taskTitle={reorderDialogTask?.title ?? ''}
        futureTaskCount={futureTaskCount}
        isUpdating={isReordering}
      />

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
