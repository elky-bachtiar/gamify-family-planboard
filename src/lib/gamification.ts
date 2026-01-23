import { getSupabaseClient } from './supabase';
import { calculateLevel } from '../types';
import type { FamilyMember, Task } from '../types';

export async function completeTask(task: Task, member: FamilyMember, isAdmin: boolean = false) {
  try {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    if (isAdmin) {
      // Admin completing task: immediate completion with points
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: now,
          completed_by: member.id,
          approved_by: member.id,
          approved_at: now,
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      const { error: pointsError } = await supabase.from('points_history').insert({
        member_id: member.id,
        points: task.point_value ?? 0,
        reason: `Completed: ${task.title}`,
        task_id: task.id,
        family_id: member.family_id,
      });

      if (pointsError) throw pointsError;

      const newTotalPoints = (member.total_points ?? 0) + (task.point_value ?? 0);
      const newLevel = calculateLevel(newTotalPoints);

      const { error: memberError } = await supabase
        .from('family_members')
        .update({
          total_points: newTotalPoints,
          current_level: newLevel,
        })
        .eq('id', member.id);

      if (memberError) throw memberError;

      const newAchievements = await checkAndAwardAchievements(member.id);
      return { success: true, newAchievements };
    } else {
      // Non-admin completing task: requires approval
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'pending_approval',
          completed_by: member.id,
        })
        .eq('id', task.id);

      if (taskError) throw taskError;
    }

    return { success: true };
  } catch (error) {
    console.error('Error completing task:', error);
    return { success: false, error };
  }
}

export async function approveTask(task: Task, approver: FamilyMember) {
  try {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // Get the member who completed the task
    if (!task.completed_by) {
      throw new Error('Task has no completer');
    }

    const { data: completer, error: completerError } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', task.completed_by)
      .single();

    if (completerError || !completer) throw completerError || new Error('Completer not found');

    // Update task to completed
    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: now,
        approved_by: approver.id,
        approved_at: now,
      })
      .eq('id', task.id);

    if (taskError) throw taskError;

    // Award points to the completer
    const { error: pointsError } = await supabase.from('points_history').insert({
      member_id: completer.id,
      points: task.point_value ?? 0,
      reason: `Completed: ${task.title}`,
      task_id: task.id,
      family_id: completer.family_id,
    });

    if (pointsError) throw pointsError;

    const newTotalPoints = (completer.total_points ?? 0) + (task.point_value ?? 0);
    const newLevel = calculateLevel(newTotalPoints);

    const { error: memberError } = await supabase
      .from('family_members')
      .update({
        total_points: newTotalPoints,
        current_level: newLevel,
      })
      .eq('id', completer.id);

    if (memberError) throw memberError;

    const newAchievements = await checkAndAwardAchievements(completer.id);

    return { success: true, newAchievements };
  } catch (error) {
    console.error('Error approving task:', error);
    return { success: false, error };
  }
}

export async function rejectTask(task: Task) {
  try {
    const supabase = getSupabaseClient();

    // Reset task to pending
    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        status: 'pending',
        completed_by: null,
      })
      .eq('id', task.id);

    if (taskError) throw taskError;

    return { success: true };
  } catch (error) {
    console.error('Error rejecting task:', error);
    return { success: false, error };
  }
}

export interface NewlyAwardedAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export async function checkAndAwardAchievements(
  memberId: string
): Promise<NewlyAwardedAchievement[]> {
  const newlyAwarded: NewlyAwardedAchievement[] = [];

  try {
    const supabase = getSupabaseClient();
    const { data: member } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (!member || !member.family_id) return newlyAwarded;

    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', member.family_id)
      .eq('assigned_to', memberId)
      .eq('status', 'completed')
      .eq('is_archived', false);

    const tasksCount = completedTasks?.length || 0;

    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .or(`family_id.is.null,family_id.eq.${member.family_id}`);

    const { data: earnedAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('member_id', memberId);

    const earnedIds = new Set(earnedAchievements?.map((a) => a.achievement_id) || []);

    // Check for Perfect Week achievement
    const hasPerfectWeek = member.family_id
      ? await checkPerfectWeek(memberId, member.family_id)
      : false;

    for (const achievement of achievements || []) {
      if (earnedIds.has(achievement.id)) continue;

      let shouldAward = false;

      switch (achievement.condition_type) {
        case 'first_task':
          shouldAward = tasksCount >= 1;
          break;
        case 'tasks_count':
          shouldAward = tasksCount >= (achievement.condition_value ?? 0);
          break;
        case 'points_total':
          shouldAward = (member.total_points ?? 0) >= (achievement.condition_value ?? 0);
          break;
        case 'streak_days':
          shouldAward = (member.current_streak ?? 0) >= (achievement.condition_value ?? 0);
          break;
        case 'perfect_week':
          shouldAward = hasPerfectWeek;
          break;
      }

      if (shouldAward) {
        await supabase.from('user_achievements').insert({
          member_id: memberId,
          achievement_id: achievement.id,
        });

        // Add to newly awarded list for notifications
        newlyAwarded.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon ?? '🏆',
        });
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
  }

  return newlyAwarded;
}

/**
 * Check if a member has completed all their tasks for the current week
 * Perfect Week = All assigned tasks for this week are completed
 */
async function checkPerfectWeek(memberId: string, familyId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    // Get the start and end of the current week (Monday to Sunday)
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    // Get all tasks assigned to this member for this week
    const { data: weekTasks, error } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('family_id', familyId)
      .eq('assigned_to', memberId)
      .eq('is_archived', false)
      .gte('due_date', mondayStr)
      .lte('due_date', sundayStr);

    if (error) throw error;

    // If no tasks this week, no perfect week
    if (!weekTasks || weekTasks.length === 0) return false;

    // Check if ALL tasks are completed
    const allCompleted = weekTasks.every((task) => task.status === 'completed');

    // Need at least 3 tasks completed for Perfect Week to be meaningful
    const completedCount = weekTasks.filter((t) => t.status === 'completed').length;

    return allCompleted && completedCount >= 3;
  } catch (error) {
    console.error('Error checking perfect week:', error);
    return false;
  }
}

export async function updateStreak(memberId: string) {
  try {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const { data: member } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (!member || !member.family_id) return;

    const { data: todayTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', member.family_id)
      .eq('assigned_to', memberId)
      .eq('due_date', today)
      .eq('status', 'completed')
      .eq('is_archived', false);

    const { data: yesterdayTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', member.family_id)
      .eq('assigned_to', memberId)
      .eq('due_date', yesterday)
      .eq('status', 'completed')
      .eq('is_archived', false);

    let newStreak = member.current_streak ?? 0;

    if (todayTasks && todayTasks.length > 0) {
      if (yesterdayTasks && yesterdayTasks.length > 0) {
        newStreak = (member.current_streak ?? 0) + 1;
      } else {
        newStreak = 1;
      }

      await supabase
        .from('family_members')
        .update({ current_streak: newStreak })
        .eq('id', memberId);

      await checkAndAwardAchievements(memberId);
    }
  } catch (error) {
    console.error('Error updating streak:', error);
  }
}

/**
 * Award manual points (positive or negative) to a family member
 * Used by admins to give bonus points or deduct points for behavior
 */
export async function awardManualPoints(
  memberId: string,
  points: number,
  reason: string
): Promise<{ success: boolean; error?: unknown }> {
  try {
    const supabase = getSupabaseClient();

    // Get the member to update
    const { data: member, error: memberError } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      throw memberError || new Error('Member not found');
    }

    // Format reason with prefix for negative points
    const formattedReason = points < 0 ? `Straf: ${reason}` : `Bonus: ${reason}`;

    // Add points history entry
    const { error: pointsError } = await supabase.from('points_history').insert({
      member_id: memberId,
      points: points,
      reason: formattedReason,
      family_id: member.family_id,
    });

    if (pointsError) throw pointsError;

    // Calculate new total points (minimum 0)
    const newTotalPoints = Math.max(0, (member.total_points ?? 0) + points);
    const newLevel = calculateLevel(newTotalPoints);

    // Update member points and level
    const { error: updateError } = await supabase
      .from('family_members')
      .update({
        total_points: newTotalPoints,
        current_level: newLevel,
      })
      .eq('id', memberId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Error awarding manual points:', error);
    return { success: false, error };
  }
}

/**
 * Get the start of the current week (Monday 00:00:00)
 */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get overdue weekly tasks that have not been completed
 * A weekly task is overdue if: due_date < current week Monday AND status in ('pending', 'pending_approval')
 */
export async function getOverdueWeeklyTasks(familyId: string): Promise<Task[]> {
  try {
    const supabase = getSupabaseClient();
    const weekStart = getWeekStart();
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('family_id', familyId)
      .eq('is_weekly_task', true)
      .eq('is_archived', false)
      .not('assigned_to', 'is', null) // Only tasks that are assigned
      .lt('due_date', weekStartStr) // Due date is before this week
      .in('status', ['pending', 'pending_approval']);

    if (error) throw error;

    return tasks || [];
  } catch (error) {
    console.error('Error getting overdue weekly tasks:', error);
    return [];
  }
}

/**
 * Apply penalty for a missed weekly task
 * Penalty is -50% of the task's point value
 */
export async function applyWeeklyTaskPenalty(
  task: Task,
  appliedBy: FamilyMember
): Promise<{ success: boolean; penaltyPoints?: number; error?: unknown }> {
  try {
    const supabase = getSupabaseClient();

    if (!task.assigned_to) {
      throw new Error('Task has no assignee');
    }

    // Get the assigned member
    const { data: member, error: memberError } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', task.assigned_to)
      .single();

    if (memberError || !member) {
      throw memberError || new Error('Member not found');
    }

    // Calculate penalty (-50% of task points)
    const penaltyPoints = Math.floor((task.point_value ?? 0) / 2) * -1;

    // Mark task as completed (with penalty applied)
    const now = new Date().toISOString();
    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: now,
        completed_by: task.assigned_to,
        approved_by: appliedBy.id,
        approved_at: now,
      })
      .eq('id', task.id);

    if (taskError) throw taskError;

    // Add negative points history entry
    const { error: pointsError } = await supabase.from('points_history').insert({
      member_id: task.assigned_to,
      points: penaltyPoints,
      reason: `Straf: Weektaak niet voltooid - ${task.title}`,
      task_id: task.id,
      family_id: member.family_id,
    });

    if (pointsError) throw pointsError;

    // Update member points (minimum 0)
    const newTotalPoints = Math.max(0, (member.total_points ?? 0) + penaltyPoints);
    const newLevel = calculateLevel(newTotalPoints);

    const { error: updateError } = await supabase
      .from('family_members')
      .update({
        total_points: newTotalPoints,
        current_level: newLevel,
      })
      .eq('id', task.assigned_to);

    if (updateError) throw updateError;

    return { success: true, penaltyPoints };
  } catch (error) {
    console.error('Error applying weekly task penalty:', error);
    return { success: false, error };
  }
}
