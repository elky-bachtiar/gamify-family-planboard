import { describe, it, expect } from 'vitest';
import {
  calculateNewSortOrder,
  getNewSortOrderForPosition,
} from './taskOrdering';

describe('calculateNewSortOrder', () => {
  it('returns midpoint between two tasks', () => {
    const beforeTask = { sort_order: 1000 };
    const afterTask = { sort_order: 2000 };
    expect(calculateNewSortOrder(beforeTask, afterTask)).toBe(1500);
  });

  it('returns value between 0 and first task when no before task', () => {
    const afterTask = { sort_order: 2000 };
    // When beforeTask is null, beforeOrder = 0
    // afterOrder = 2000
    // Result = floor((0 + 2000) / 2) = 1000
    expect(calculateNewSortOrder(null, afterTask)).toBe(1000);
  });

  it('returns value after last task when no after task', () => {
    const beforeTask = { sort_order: 1000 };
    // When afterTask is null, afterOrder = beforeOrder + GAP * 2 = 1000 + 2000 = 3000
    // Result = floor((1000 + 3000) / 2) = 2000
    expect(calculateNewSortOrder(beforeTask, null)).toBe(2000);
  });

  it('returns default value when both tasks are null', () => {
    // beforeOrder = 0, afterOrder = 0 + GAP * 2 = 2000
    // Result = floor((0 + 2000) / 2) = 1000
    expect(calculateNewSortOrder(null, null)).toBe(1000);
  });

  it('handles tasks with null sort_order', () => {
    const beforeTask = { sort_order: null as unknown as number };
    const afterTask = { sort_order: 2000 };
    // beforeOrder = 0 (fallback)
    // Result = floor((0 + 2000) / 2) = 1000
    expect(calculateNewSortOrder(beforeTask, afterTask)).toBe(1000);
  });

  it('handles negative sort orders', () => {
    const beforeTask = { sort_order: -1000 };
    const afterTask = { sort_order: 1000 };
    expect(calculateNewSortOrder(beforeTask, afterTask)).toBe(0);
  });

  it('returns integer value (floors the result)', () => {
    const beforeTask = { sort_order: 1000 };
    const afterTask = { sort_order: 1001 };
    // (1000 + 1001) / 2 = 1000.5, floor = 1000
    expect(calculateNewSortOrder(beforeTask, afterTask)).toBe(1000);
  });
});

describe('getNewSortOrderForPosition', () => {
  const createTask = (id: string, sortOrder: number) => ({
    id,
    sort_order: sortOrder,
  });

  it('returns correct sort order when moving to beginning', () => {
    const tasks = [
      createTask('1', 1000),
      createTask('2', 2000),
      createTask('3', 3000),
    ];
    // Moving task '3' to position 0
    // Other tasks: ['1', '2'] sorted by sort_order
    // beforeTask = null (index 0 - 1 = -1)
    // afterTask = task '1' (index 0)
    // Result = calculateNewSortOrder(null, {sort_order: 1000}) = 500
    const result = getNewSortOrderForPosition(tasks, '3', 0);
    expect(result).toBe(500);
  });

  it('returns correct sort order when moving to end', () => {
    const tasks = [
      createTask('1', 1000),
      createTask('2', 2000),
      createTask('3', 3000),
    ];
    // Moving task '1' to position 2 (end)
    // Other tasks: ['2', '3'] sorted by sort_order
    // beforeTask = task '3' (index 1, which is newIndex - 1 = 2 - 1 = 1)
    // afterTask = null (index 2 >= otherTasks.length)
    // Result = calculateNewSortOrder({sort_order: 3000}, null) = 4000
    const result = getNewSortOrderForPosition(tasks, '1', 2);
    expect(result).toBe(4000);
  });

  it('returns correct sort order when moving to middle', () => {
    const tasks = [
      createTask('1', 1000),
      createTask('2', 2000),
      createTask('3', 3000),
    ];
    // Moving task '3' to position 1
    // Other tasks: ['1', '2'] sorted by sort_order
    // beforeTask = task '1' (index 0)
    // afterTask = task '2' (index 1)
    // Result = calculateNewSortOrder({sort_order: 1000}, {sort_order: 2000}) = 1500
    const result = getNewSortOrderForPosition(tasks, '3', 1);
    expect(result).toBe(1500);
  });

  it('handles unsorted input tasks', () => {
    const tasks = [
      createTask('1', 3000), // Out of order
      createTask('2', 1000),
      createTask('3', 2000),
    ];
    // Moving task '1' to position 1
    // Other tasks: ['2', '3'] sorted by sort_order = [{id:'2', sort_order:1000}, {id:'3', sort_order:2000}]
    // beforeTask = task '2' (index 0)
    // afterTask = task '3' (index 1)
    // Result = calculateNewSortOrder({sort_order: 1000}, {sort_order: 2000}) = 1500
    const result = getNewSortOrderForPosition(tasks, '1', 1);
    expect(result).toBe(1500);
  });

  it('handles single task list', () => {
    const tasks = [createTask('1', 1000)];
    // Moving task '1' to position 0
    // Other tasks: [] (empty after filtering)
    // beforeTask = null
    // afterTask = null
    // Result = calculateNewSortOrder(null, null) = 1000
    const result = getNewSortOrderForPosition(tasks, '1', 0);
    expect(result).toBe(1000);
  });

  it('handles two task list - swap positions', () => {
    const tasks = [
      createTask('1', 1000),
      createTask('2', 2000),
    ];
    // Moving task '1' to position 1 (after task '2')
    // Other tasks: ['2']
    // beforeTask = task '2' (index 0)
    // afterTask = null (index 1 >= otherTasks.length)
    // Result = calculateNewSortOrder({sort_order: 2000}, null) = 3000
    const result = getNewSortOrderForPosition(tasks, '1', 1);
    expect(result).toBe(3000);
  });

  it('handles tasks with null sort_order', () => {
    const tasks = [
      { id: '1', sort_order: null as unknown as number },
      createTask('2', 2000),
    ];
    // Moving task '2' to position 0
    // Other tasks: ['1'] with sort_order null
    // beforeTask = null (newIndex - 1 = -1)
    // afterTask = task '1' (sort_order: null → falls back to beforeOrder + GAP*2 = 2000)
    // Result = floor((0 + 2000) / 2) = 1000
    const result = getNewSortOrderForPosition(tasks, '2', 0);
    expect(result).toBe(1000);
  });
});
