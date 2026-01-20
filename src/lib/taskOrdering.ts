import { getSupabaseClient } from './supabase';
import type { Task } from '../types';

const SORT_ORDER_GAP = 1000;

/**
 * Calculate new sort order between two tasks using fractional indexing.
 * Returns a value between beforeTask and afterTask sort orders.
 */
export function calculateNewSortOrder(
  beforeTask: Pick<Task, 'sort_order'> | null,
  afterTask: Pick<Task, 'sort_order'> | null
): number {
  const beforeOrder = beforeTask?.sort_order ?? 0;
  const afterOrder = afterTask?.sort_order ?? beforeOrder + SORT_ORDER_GAP * 2;

  // Calculate midpoint
  return Math.floor((beforeOrder + afterOrder) / 2);
}

/**
 * Update the sort order of a single task
 */
export async function updateTaskSortOrder(
  taskId: string,
  newSortOrder: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('tasks')
    .update({ sort_order: newSortOrder })
    .eq('id', taskId);

  if (error) {
    console.error('Error updating task sort order:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update the sort order of all non-completed future tasks in a recurring group.
 * This is called when user chooses "all future" option for a recurring task.
 */
export async function updateRecurringGroupSortOrder(
  groupId: string,
  newSortOrder: number,
  fromDate: string
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  const supabase = getSupabaseClient();

  // Update all non-completed tasks in the group from the given date onwards
  const { data, error } = await supabase
    .from('tasks')
    .update({ sort_order: newSortOrder })
    .eq('recurring_task_group_id', groupId)
    .gte('due_date', fromDate)
    .neq('status', 'completed')
    .select('id');

  if (error) {
    console.error('Error updating recurring group sort order:', error);
    return { success: false, error: error.message };
  }

  return { success: true, updatedCount: data?.length ?? 0 };
}

/**
 * Get the count of future non-completed tasks in a recurring group
 */
export async function getFutureRecurringTaskCount(
  groupId: string,
  fromDate: string
): Promise<number> {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('recurring_task_group_id', groupId)
    .gte('due_date', fromDate)
    .neq('status', 'completed');

  if (error) {
    console.error('Error counting future recurring tasks:', error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Reorder tasks in a list and return the new sort order for the moved task.
 * Used when dragging a task to a new position within the same day.
 */
export function getNewSortOrderForPosition<T extends Pick<Task, 'id' | 'sort_order'>>(
  tasks: T[],
  movedTaskId: string,
  newIndex: number
): number {
  // Filter out the moved task to get the reference positions
  const otherTasks = tasks.filter(t => t.id !== movedTaskId);

  // Sort by current sort_order
  otherTasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Determine before and after tasks at the new position
  const beforeTask = newIndex > 0 ? otherTasks[newIndex - 1] : null;
  const afterTask = newIndex < otherTasks.length ? otherTasks[newIndex] : null;

  return calculateNewSortOrder(beforeTask, afterTask);
}
