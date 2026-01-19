import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFamily } from '../contexts/FamilyContext';
import { useAuth } from '../contexts/AuthContext';
import type { TaskWithMember } from '../types';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';

export function WeeklyCalendar() {
  const { currentMember } = useFamily();
  const { family } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [tasks, setTasks] = useState<TaskWithMember[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

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

  const weekDays = getWeekDays(currentWeekStart);

  const loadTasks = async () => {
    if (!currentMember || !family) return;

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);

    const { data, error } = await supabase
      .from('tasks')
      .select('*, family_members(*)')
      .eq('family_id', family.id)
      .eq('assigned_to', currentMember.id)
      .eq('is_archived', false)
      .gte('due_date', currentWeekStart.toISOString().split('T')[0])
      .lte('due_date', weekEnd.toISOString().split('T')[0])
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
      .channel('tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        loadTasks();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentMember, currentWeekStart]);

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

  const getTasksForDay = (date: Date): TaskWithMember[] => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter(task => task.due_date === dateStr);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const openModalForDate = (date: Date) => {
    setSelectedDate(date.toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Weekly Tasks</h2>
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
              Today
            </button>
            <button
              onClick={nextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
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
