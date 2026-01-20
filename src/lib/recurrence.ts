import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

type TaskInsert = Database['public']['Tables']['tasks']['Insert'];

export type RecurrencePattern = 'daily' | 'weekly' | 'specific_days' | null;

export interface RecurrenceConfig {
  pattern: RecurrencePattern;
  days: number[]; // [0-6] for Sun-Sat (used for specific_days)
  endDate: Date;
  startDate: Date;
}

export interface TaskTemplate {
  title: string;
  description?: string;
  assigned_to?: string | null;
  due_datetime?: string | null;
  start_datetime?: string | null;
  priority: 'low' | 'medium' | 'high';
  point_value: number;
  created_by?: string | null;
  family_id?: string | null;
  associated_items?: string[];
}

const MAX_INSTANCES = 365;

/**
 * Generate an array of dates based on the recurrence configuration
 */
export function generateRecurrenceDates(config: RecurrenceConfig): Date[] {
  const { pattern, days, endDate, startDate } = config;
  const dates: Date[] = [];

  if (!pattern || !endDate) return dates;

  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Validate end date is after start date
  if (end <= current) return dates;

  while (current <= end && dates.length < MAX_INSTANCES) {
    const dayOfWeek = current.getDay();

    switch (pattern) {
      case 'daily':
        dates.push(new Date(current));
        break;

      case 'weekly':
        // Same weekday as start date
        if (dayOfWeek === startDate.getDay()) {
          dates.push(new Date(current));
        }
        break;

      case 'specific_days':
        // Check if current day is in the selected days array
        if (days.includes(dayOfWeek)) {
          dates.push(new Date(current));
        }
        break;
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Count the number of task instances that will be created
 */
export function countRecurringInstances(config: RecurrenceConfig): number {
  return generateRecurrenceDates(config).length;
}

/**
 * Generate task objects for batch insert based on recurrence configuration
 */
export function generateRecurringTaskInstances(
  template: TaskTemplate,
  config: RecurrenceConfig,
  groupId: string
): TaskInsert[] {
  const dates = generateRecurrenceDates(config);

  return dates.map((date) => {
    // Format date as YYYY-MM-DD for due_date
    const dueDate = date.toISOString().split('T')[0];

    // If template has a due_datetime, preserve the time portion but update the date
    let dueDatetime: string | null = null;
    if (template.due_datetime) {
      const templateDateTime = new Date(template.due_datetime);
      const newDateTime = new Date(date);
      newDateTime.setHours(
        templateDateTime.getHours(),
        templateDateTime.getMinutes(),
        templateDateTime.getSeconds()
      );
      dueDatetime = newDateTime.toISOString();
    }

    // If template has a start_datetime, preserve the time portion but update the date
    let startDatetime: string | null = null;
    if (template.start_datetime) {
      const templateStartTime = new Date(template.start_datetime);
      const newStartDateTime = new Date(date);
      newStartDateTime.setHours(
        templateStartTime.getHours(),
        templateStartTime.getMinutes(),
        templateStartTime.getSeconds()
      );
      startDatetime = newStartDateTime.toISOString();
    }

    return {
      title: template.title,
      description: template.description ?? '',
      assigned_to: template.assigned_to,
      due_date: dueDate,
      due_datetime: dueDatetime,
      start_datetime: startDatetime,
      priority: template.priority,
      point_value: template.point_value,
      created_by: template.created_by,
      family_id: template.family_id,
      status: 'pending' as const,
      recurrence_pattern: config.pattern,
      recurrence_days: config.pattern === 'specific_days' ? config.days : null,
      recurrence_end_date: config.endDate.toISOString().split('T')[0],
      recurring_task_group_id: groupId,
      associated_items: template.associated_items ?? [],
    };
  });
}

/**
 * Get human-readable description of recurrence pattern
 */
export function getRecurrenceDescription(
  pattern: RecurrencePattern,
  days?: number[]
): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  switch (pattern) {
    case 'daily':
      return 'Every day';
    case 'weekly':
      return 'Every week';
    case 'specific_days':
      if (!days || days.length === 0) return 'No days selected';
      const selectedDays = days.sort((a, b) => a - b).map(d => dayNames[d]);
      return `Every ${selectedDays.join(', ')}`;
    default:
      return 'One time';
  }
}

/**
 * Validate recurrence configuration
 */
export function validateRecurrenceConfig(config: RecurrenceConfig): string | null {
  const { pattern, days, endDate, startDate } = config;

  if (!pattern) return null; // No recurrence is valid

  if (!endDate) {
    return 'End date is required for recurring tasks';
  }

  if (endDate <= startDate) {
    return 'End date must be after start date';
  }

  // Check max duration (1 year)
  const oneYearFromStart = new Date(startDate);
  oneYearFromStart.setFullYear(oneYearFromStart.getFullYear() + 1);
  if (endDate > oneYearFromStart) {
    return 'Recurring tasks can be created for at most 1 year';
  }

  if (pattern === 'specific_days' && (!days || days.length === 0)) {
    return 'At least one day must be selected';
  }

  return null; // Valid
}

/**
 * Count future recurring tasks in a group (non-completed, due_date >= today)
 */
export async function countFutureRecurringTasks(
  supabase: SupabaseClient<Database>,
  groupId: string
): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('recurring_task_group_id', groupId)
    .gte('due_date', today)
    .neq('status', 'completed');

  if (error) {
    console.error('Error counting future recurring tasks:', error);
    return 0;
  }

  return count ?? 0;
}
