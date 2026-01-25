import { getSupabaseClient } from './supabase';
import type { Json } from './database.types';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'points_awarded'
  | 'points_deducted'
  | 'complete'
  | 'login'
  | 'logout';

export type AuditEntityType =
  | 'task'
  | 'member'
  | 'family'
  | 'points'
  | 'achievement'
  | 'message'
  | 'reward';

/**
 * Log an audit event to the audit_logs table.
 * Silently fails if logging fails to avoid blocking main operations.
 */
export async function logAudit(
  familyId: string,
  actorId: string,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string,
  details?: Json
): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    await supabase.from('audit_logs').insert({
      family_id: familyId,
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details ?? null,
    });
  } catch (error) {
    // Log to console but don't throw - audit logging should never break the main operation
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Convenience function for logging task-related events
 */
export async function logTaskAudit(
  familyId: string,
  actorId: string,
  action: AuditAction,
  taskId: string,
  taskTitle: string,
  additionalDetails?: { [key: string]: Json | undefined }
): Promise<void> {
  await logAudit(familyId, actorId, action, 'task', taskId, {
    title: taskTitle,
    ...additionalDetails,
  });
}

/**
 * Convenience function for logging member-related events
 */
export async function logMemberAudit(
  familyId: string,
  actorId: string,
  action: AuditAction,
  memberId: string,
  memberName: string,
  additionalDetails?: { [key: string]: Json | undefined }
): Promise<void> {
  await logAudit(familyId, actorId, action, 'member', memberId, {
    name: memberName,
    ...additionalDetails,
  });
}

/**
 * Convenience function for logging points-related events
 */
export async function logPointsAudit(
  familyId: string,
  actorId: string,
  action: 'points_awarded' | 'points_deducted',
  memberId: string,
  points: number,
  reason: string
): Promise<void> {
  await logAudit(familyId, actorId, action, 'points', memberId, {
    points,
    reason,
  });
}
