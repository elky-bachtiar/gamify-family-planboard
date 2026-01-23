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

// ============================================================================
// Streak Grace Period, Freeze, and Recovery Functions
// ============================================================================

const GRACE_PERIOD_HOURS = 24;
const RECOVERY_WINDOW_HOURS = 48;
const RECOVERY_MIN_TASK_POINTS = 20;
const STREAK_FREEZE_COST = 50;
const MAX_STREAK_FREEZES = 3;

/**
 * Check if a member is currently in a streak grace period
 * Grace period is 24 hours after the streak_grace_started_at timestamp
 */
export function isInStreakGracePeriod(member: FamilyMember): boolean {
  if (!member.streak_grace_started_at) return false;

  const graceStart = new Date(member.streak_grace_started_at);
  const graceEnd = new Date(graceStart.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);
  const now = new Date();

  return now < graceEnd;
}

/**
 * Get the remaining time in the grace period
 * Returns milliseconds remaining, or 0 if not in grace period
 */
export function getGracePeriodTimeRemaining(member: FamilyMember): number {
  if (!member.streak_grace_started_at) return 0;

  const graceStart = new Date(member.streak_grace_started_at);
  const graceEnd = new Date(graceStart.getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000);
  const now = new Date();

  const remaining = graceEnd.getTime() - now.getTime();
  return Math.max(0, remaining);
}

/**
 * Format remaining time as a human-readable string
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0m';

  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Check if a member can recover their streak
 * Recovery is possible within 48 hours of streak loss, with a 20+ point task
 */
export function canRecoverStreak(member: FamilyMember, taskPoints: number): boolean {
  // Must have a lost streak timestamp
  if (!member.streak_lost_at) return false;

  // Must have a previous streak value
  if (!member.last_streak_value || member.last_streak_value <= 1) return false;

  // Must not have already recovered
  if (member.streak_recovered) return false;

  // Task must be worth at least 20 points
  if (taskPoints < RECOVERY_MIN_TASK_POINTS) return false;

  // Must be within 48-hour recovery window
  const lostAt = new Date(member.streak_lost_at);
  const recoveryDeadline = new Date(lostAt.getTime() + RECOVERY_WINDOW_HOURS * 60 * 60 * 1000);
  const now = new Date();

  return now < recoveryDeadline;
}

/**
 * Get the remaining time in the recovery window
 */
export function getRecoveryWindowTimeRemaining(member: FamilyMember): number {
  if (!member.streak_lost_at) return 0;

  const lostAt = new Date(member.streak_lost_at);
  const recoveryDeadline = new Date(lostAt.getTime() + RECOVERY_WINDOW_HOURS * 60 * 60 * 1000);
  const now = new Date();

  const remaining = recoveryDeadline.getTime() - now.getTime();
  return Math.max(0, remaining);
}

/**
 * Recover a member's streak (restore to last value - 1)
 */
export async function recoverStreak(
  memberId: string
): Promise<{ success: boolean; newStreak?: number; error?: unknown }> {
  try {
    const supabase = getSupabaseClient();

    // Get member data
    const { data: member, error: memberError } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      throw memberError || new Error('Member not found');
    }

    // Validate recovery is possible
    if (!member.streak_lost_at || !member.last_streak_value || member.streak_recovered) {
      throw new Error('Streak recovery not available');
    }

    // Calculate recovered streak (last value - 1, minimum 1)
    const recoveredStreak = Math.max(1, member.last_streak_value - 1);

    // Update member
    const { error: updateError } = await supabase
      .from('family_members')
      .update({
        current_streak: recoveredStreak,
        streak_recovered: true,
        streak_grace_started_at: null, // Clear grace period
      })
      .eq('id', memberId);

    if (updateError) throw updateError;

    return { success: true, newStreak: recoveredStreak };
  } catch (error) {
    console.error('Error recovering streak:', error);
    return { success: false, error };
  }
}

/**
 * Use a streak freeze to prevent streak loss
 * Called automatically when grace period expires and member has freezes
 */
export async function consumeStreakFreeze(
  memberId: string
): Promise<{ success: boolean; freezesRemaining?: number; error?: unknown }> {
  try {
    const supabase = getSupabaseClient();

    // Get member data
    const { data: member, error: memberError } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      throw memberError || new Error('Member not found');
    }

    const currentFreezes = member.streak_freezes || 0;

    if (currentFreezes <= 0) {
      throw new Error('No streak freezes available');
    }

    // Use one freeze
    const newFreezes = currentFreezes - 1;

    const { error: updateError } = await supabase
      .from('family_members')
      .update({
        streak_freezes: newFreezes,
        streak_grace_started_at: null, // Clear grace period (freeze protects streak)
      })
      .eq('id', memberId);

    if (updateError) throw updateError;

    // Log the freeze usage
    await supabase.from('points_history').insert({
      member_id: memberId,
      points: 0,
      reason: 'Streak freeze used - streak protected!',
      family_id: member.family_id,
    });

    return { success: true, freezesRemaining: newFreezes };
  } catch (error) {
    console.error('Error using streak freeze:', error);
    return { success: false, error };
  }
}

/**
 * Start the grace period for a member (when they haven't completed a task today)
 */
export async function startGracePeriod(
  memberId: string
): Promise<{ success: boolean; error?: unknown }> {
  try {
    const supabase = getSupabaseClient();

    const { error: updateError } = await supabase
      .from('family_members')
      .update({
        streak_grace_started_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Error starting grace period:', error);
    return { success: false, error };
  }
}

/**
 * Handle streak loss (when grace period expires without task completion or freeze)
 */
export async function handleStreakLoss(
  memberId: string
): Promise<{ success: boolean; previousStreak?: number; error?: unknown }> {
  try {
    const supabase = getSupabaseClient();

    // Get member data
    const { data: member, error: memberError } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      throw memberError || new Error('Member not found');
    }

    const previousStreak = member.current_streak || 0;

    // Store the streak before losing it
    const { error: updateError } = await supabase
      .from('family_members')
      .update({
        last_streak_value: previousStreak,
        current_streak: 0,
        streak_lost_at: new Date().toISOString(),
        streak_recovered: false,
        streak_grace_started_at: null,
      })
      .eq('id', memberId);

    if (updateError) throw updateError;

    return { success: true, previousStreak };
  } catch (error) {
    console.error('Error handling streak loss:', error);
    return { success: false, error };
  }
}

/**
 * Enhanced streak update that handles grace period, freeze, and recovery
 * This should be called when a task is approved/completed
 */
export async function handleStreakOnTaskComplete(
  memberId: string,
  taskPoints: number
): Promise<{
  success: boolean;
  streakRecovered?: boolean;
  newStreak?: number;
  error?: unknown;
}> {
  try {
    const supabase = getSupabaseClient();

    // Get member data
    const { data: member, error: memberError } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      throw memberError || new Error('Member not found');
    }

    // Check if streak recovery is possible
    if (canRecoverStreak(member, taskPoints)) {
      const recoveryResult = await recoverStreak(memberId);
      if (recoveryResult.success) {
        return {
          success: true,
          streakRecovered: true,
          newStreak: recoveryResult.newStreak,
        };
      }
    }

    // Clear grace period if it was active (task completed in time)
    if (member.streak_grace_started_at) {
      await supabase
        .from('family_members')
        .update({ streak_grace_started_at: null })
        .eq('id', memberId);
    }

    // Regular streak update
    await updateStreak(memberId);

    // Get updated streak value
    const { data: updatedMember } = await supabase
      .from('family_members')
      .select('current_streak')
      .eq('id', memberId)
      .single();

    return {
      success: true,
      streakRecovered: false,
      newStreak: updatedMember?.current_streak || 0,
    };
  } catch (error) {
    console.error('Error handling streak on task complete:', error);
    return { success: false, error };
  }
}

/**
 * Check streak status for a member and handle grace period/loss if needed
 * This should be called periodically or on app load
 */
export async function checkStreakStatus(memberId: string): Promise<{
  status: 'active' | 'grace_period' | 'lost' | 'frozen';
  timeRemaining?: number;
  canRecover?: boolean;
  recoveryTimeRemaining?: number;
}> {
  try {
    const supabase = getSupabaseClient();

    const { data: member, error } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (error || !member) {
      return { status: 'lost' };
    }

    const currentStreak = member.current_streak || 0;

    // Check if in grace period
    if (isInStreakGracePeriod(member)) {
      return {
        status: 'grace_period',
        timeRemaining: getGracePeriodTimeRemaining(member),
      };
    }

    // Check if grace period expired
    if (member.streak_grace_started_at && !isInStreakGracePeriod(member)) {
      // Grace period expired - check for freeze
      if ((member.streak_freezes || 0) > 0) {
        // Auto-use freeze
        await consumeStreakFreeze(memberId);
        return { status: 'frozen' };
      } else {
        // No freeze available - lose streak
        await handleStreakLoss(memberId);
        const recoveryRemaining = getRecoveryWindowTimeRemaining({
          ...member,
          streak_lost_at: new Date().toISOString(),
        });
        return {
          status: 'lost',
          canRecover: true,
          recoveryTimeRemaining: recoveryRemaining,
        };
      }
    }

    // Check if in recovery window
    if (member.streak_lost_at && !member.streak_recovered) {
      const recoveryRemaining = getRecoveryWindowTimeRemaining(member);
      if (recoveryRemaining > 0) {
        return {
          status: 'lost',
          canRecover: true,
          recoveryTimeRemaining: recoveryRemaining,
        };
      }
    }

    // Normal active streak
    return { status: currentStreak > 0 ? 'active' : 'lost' };
  } catch (error) {
    console.error('Error checking streak status:', error);
    return { status: 'lost' };
  }
}

/**
 * Get streak freeze shop info for a member
 */
export function getStreakFreezeInfo(member: FamilyMember): {
  currentFreezes: number;
  maxFreezes: number;
  freezeCost: number;
  canPurchase: boolean;
} {
  const currentFreezes = member.streak_freezes || 0;
  const currentPoints = member.total_points || 0;

  return {
    currentFreezes,
    maxFreezes: MAX_STREAK_FREEZES,
    freezeCost: STREAK_FREEZE_COST,
    canPurchase: currentFreezes < MAX_STREAK_FREEZES && currentPoints >= STREAK_FREEZE_COST,
  };
}
