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
          approved_at: now
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      const { error: pointsError } = await supabase
        .from('points_history')
        .insert({
          member_id: member.id,
          points: task.point_value,
          reason: `Completed: ${task.title}`,
          task_id: task.id,
          family_id: member.family_id,
        });

      if (pointsError) throw pointsError;

      const newTotalPoints = member.total_points + task.point_value;
      const newLevel = calculateLevel(newTotalPoints);

      const { error: memberError } = await supabase
        .from('family_members')
        .update({
          total_points: newTotalPoints,
          current_level: newLevel,
        })
        .eq('id', member.id);

      if (memberError) throw memberError;

      await checkAndAwardAchievements(member.id);
    } else {
      // Non-admin completing task: requires approval
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'pending_approval',
          completed_by: member.id
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
        approved_at: now
      })
      .eq('id', task.id);

    if (taskError) throw taskError;

    // Award points to the completer
    const { error: pointsError } = await supabase
      .from('points_history')
      .insert({
        member_id: completer.id,
        points: task.point_value,
        reason: `Completed: ${task.title}`,
        task_id: task.id,
        family_id: completer.family_id,
      });

    if (pointsError) throw pointsError;

    const newTotalPoints = completer.total_points + task.point_value;
    const newLevel = calculateLevel(newTotalPoints);

    const { error: memberError } = await supabase
      .from('family_members')
      .update({
        total_points: newTotalPoints,
        current_level: newLevel,
      })
      .eq('id', completer.id);

    if (memberError) throw memberError;

    await checkAndAwardAchievements(completer.id);

    return { success: true };
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
        completed_by: null
      })
      .eq('id', task.id);

    if (taskError) throw taskError;

    return { success: true };
  } catch (error) {
    console.error('Error rejecting task:', error);
    return { success: false, error };
  }
}

export async function checkAndAwardAchievements(memberId: string) {
  try {
    const supabase = getSupabaseClient();
    const { data: member } = await supabase
      .from('family_members')
      .select('*')
      .eq('id', memberId)
      .single();

    if (!member) return;

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

    const earnedIds = new Set(earnedAchievements?.map(a => a.achievement_id) || []);

    for (const achievement of achievements || []) {
      if (earnedIds.has(achievement.id)) continue;

      let shouldAward = false;

      switch (achievement.condition_type) {
        case 'first_task':
          shouldAward = tasksCount >= 1;
          break;
        case 'tasks_count':
          shouldAward = tasksCount >= achievement.condition_value;
          break;
        case 'points_total':
          shouldAward = member.total_points >= achievement.condition_value;
          break;
        case 'streak_days':
          shouldAward = member.current_streak >= achievement.condition_value;
          break;
      }

      if (shouldAward) {
        await supabase
          .from('user_achievements')
          .insert({
            member_id: memberId,
            achievement_id: achievement.id,
          });
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
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

    if (!member) return;

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

    let newStreak = member.current_streak;

    if (todayTasks && todayTasks.length > 0) {
      if (yesterdayTasks && yesterdayTasks.length > 0) {
        newStreak = member.current_streak + 1;
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
