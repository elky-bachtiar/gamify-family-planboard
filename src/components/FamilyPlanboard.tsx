import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, Filter, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';
import type { TaskWithMember } from '../types';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';

type StatusFilter = 'all' | 'pending' | 'pending_approval' | 'completed';
type AssigneeFilter = 'all' | 'unassigned' | string; // string = member ID

export function FamilyPlanboard() {
  const { t } = useTranslation('tasks');
  const { currentMember, familyMembers } = useFamily();
  const { family } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [tasks, setTasks] = useState<TaskWithMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

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

    // Fetch ALL family tasks (no assigned_to filter)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, family_members!assigned_to(*)')
      .eq('family_id', family.id)
      .eq('is_archived', false)
      .gte('due_date', formatLocalDate(currentWeekStart))
      .lte('due_date', formatLocalDate(weekEnd))
      .order('due_datetime');

    if (error) {
      console.error('Error loading tasks:', error);
      return;
    }

    setTasks(data as TaskWithMember[]);
  };

  useEffect(() => {
    loadTasks();

    const subscription = supabase
      .channel('family_planboard_tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadTasks();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentMember, currentWeekStart, family]);

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

  // Apply filters to tasks
  const filterTasks = (taskList: TaskWithMember[]): TaskWithMember[] => {
    return taskList.filter(task => {
      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }

      // Assignee filter
      if (assigneeFilter === 'unassigned') {
        if (task.assigned_to !== null) return false;
      } else if (assigneeFilter !== 'all') {
        if (task.assigned_to !== assigneeFilter) return false;
      }

      return true;
    });
  };

  const getTasksForDay = (date: Date): TaskWithMember[] => {
    const dateStr = formatLocalDate(date);
    const dayTasks = tasks.filter(task => task.due_date === dateStr);
    return filterTasks(dayTasks);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const openModalForDate = (date: Date) => {
    setSelectedDate(formatLocalDate(date));
    setIsModalOpen(true);
  };

  // Check if any filters are active
  const hasActiveFilters = statusFilter !== 'all' || assigneeFilter !== 'all';

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-gray-900">{t('planboard.title')}</h2>
          <div className="flex items-center gap-2">
            {/* Filter toggle button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${
                hasActiveFilters
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title={t('filters.status')}
            >
              <Filter className="w-5 h-5" />
              {hasActiveFilters && (
                <span className="text-xs font-medium">
                  {(statusFilter !== 'all' ? 1 : 0) + (assigneeFilter !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>

            <div className="w-px h-6 bg-gray-200" />

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
              {t('planboard.today')}
            </button>
            <button
              onClick={nextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter controls */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
            {/* Status filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{t('filters.status')}:</span>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 pr-8 text-sm
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                >
                  <option value="all">{t('filters.all')}</option>
                  <option value="pending">{t('filters.pending')}</option>
                  <option value="pending_approval">{t('filters.pendingApproval')}</option>
                  <option value="completed">{t('filters.completed')}</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Assignee filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{t('filters.assignee')}:</span>
              <div className="relative">
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value as AssigneeFilter)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 pr-8 text-sm
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                >
                  <option value="all">{t('filters.all')}</option>
                  <option value="unassigned">{t('filters.unassigned')}</option>
                  {familyMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setAssigneeFilter('all');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                {t('filters.all')} &times;
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {weekDays.map((day) => {
          const dayTasks = getTasksForDay(day);
          const allDayTasks = tasks.filter(t => t.due_date === formatLocalDate(day));
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
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-semibold ${isToday(day) ? 'text-blue-600' : 'text-gray-900'}`}>
                      {day.getDate()}
                    </div>
                  </div>
                  <button
                    onClick={() => openModalForDate(day)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    title="Add task"
                  >
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                {totalCount > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    {completedCount}/{totalCount} completed
                  </div>
                )}
              </div>

              <div className="p-2 space-y-2">
                {dayTasks.map(task => (
                  <TaskCard key={task.id} task={task} onUpdate={loadTasks} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTaskCreated={loadTasks}
        defaultDate={selectedDate}
      />
    </div>
  );
}
