import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  getCorsHeaders,
  checkRateLimit,
  rateLimitedResponse,
  getClientId,
  RATE_LIMITS,
  errorResponse,
  successResponse,
} from '../_shared/security.ts';

/**
 * Export Family Data Edge Function (GDPR Compliance)
 *
 * Exports all family data as a JSON file for GDPR compliance.
 * Only admins can export family data.
 *
 * Includes:
 * - Family settings
 * - All family members (without sensitive fields like pin_hash)
 * - All tasks (current and historical)
 * - Points history
 * - Achievements and earned achievements
 * - Messages
 * - Weekly goals and earnings
 * - Reward redemptions
 * - Audit logs
 *
 * Security:
 * - Only admins can export family data
 * - Rate limited (expensive operation)
 * - Exports are logged to audit trail
 */
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Rate limiting - this is an expensive operation
    const clientId = getClientId(req);
    const rateLimitKey = `export-family-data:${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['export-family-data']);

    if (!rateLimit.allowed) {
      return rateLimitedResponse(corsHeaders, rateLimit.resetIn);
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401, corsHeaders);
    }

    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create client with user's token to verify authentication
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return errorResponse('Unauthorized', 401, corsHeaders);
    }

    // Verify user is admin of a family
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('family_members')
      .select('id, family_id, is_admin, name')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminData) {
      return errorResponse('User is not a family member', 403, corsHeaders);
    }

    if (!adminData.is_admin) {
      return errorResponse('Only admins can export family data', 403, corsHeaders);
    }

    const familyId = adminData.family_id;

    // Fetch all family data
    const [
      familyResult,
      membersResult,
      tasksResult,
      taskHistoryResult,
      pointsHistoryResult,
      achievementsResult,
      userAchievementsResult,
      messagesResult,
      weeklyGoalsResult,
      weeklyEarningsResult,
      redemptionsResult,
      auditLogsResult,
      familyObjectsResult,
    ] = await Promise.all([
      // Family settings
      supabaseAdmin
        .from('families')
        .select('id, name, invite_code, parent_invite_code, point_to_money_rate, minimum_redemption, weekly_target_points, weekly_target_bonus, color_palette, default_language, created_at')
        .eq('id', familyId)
        .single(),

      // Family members (excluding sensitive data)
      supabaseAdmin
        .from('family_members')
        .select('id, name, email, avatar_url, color, total_points, current_level, current_streak, role, is_admin, is_pin_user, birthdate, created_at')
        .eq('family_id', familyId),

      // Current tasks
      supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('family_id', familyId),

      // Task history
      supabaseAdmin
        .from('task_history')
        .select('*')
        .eq('family_id', familyId),

      // Points history
      supabaseAdmin
        .from('points_history')
        .select('*')
        .eq('family_id', familyId),

      // Achievements (global + family custom)
      supabaseAdmin
        .from('achievements')
        .select('*')
        .or(`family_id.is.null,family_id.eq.${familyId}`),

      // User achievements
      supabaseAdmin
        .from('user_achievements')
        .select('*, achievements(*)')
        .in('member_id', (await supabaseAdmin.from('family_members').select('id').eq('family_id', familyId)).data?.map(m => m.id) || []),

      // Messages
      supabaseAdmin
        .from('messages')
        .select('*')
        .eq('family_id', familyId),

      // Weekly goals
      supabaseAdmin
        .from('weekly_goals')
        .select('*')
        .eq('family_id', familyId),

      // Weekly earnings
      supabaseAdmin
        .from('weekly_earnings')
        .select('*')
        .eq('family_id', familyId),

      // Reward redemptions
      supabaseAdmin
        .from('reward_redemptions')
        .select('*')
        .eq('family_id', familyId),

      // Audit logs
      supabaseAdmin
        .from('audit_logs')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(1000),

      // Family objects
      supabaseAdmin
        .from('family_objects')
        .select('*')
        .eq('family_id', familyId),
    ]);

    // Build export object
    const exportData = {
      exported_at: new Date().toISOString(),
      exported_by: adminData.name,
      family: familyResult.data,
      members: membersResult.data || [],
      tasks: {
        current: tasksResult.data || [],
        history: taskHistoryResult.data || [],
      },
      points_history: pointsHistoryResult.data || [],
      achievements: {
        available: achievementsResult.data || [],
        earned: userAchievementsResult.data || [],
      },
      messages: messagesResult.data || [],
      weekly_data: {
        goals: weeklyGoalsResult.data || [],
        earnings: weeklyEarningsResult.data || [],
      },
      reward_redemptions: redemptionsResult.data || [],
      audit_logs: auditLogsResult.data || [],
      family_objects: familyObjectsResult.data || [],
    };

    // Update last export timestamp
    await supabaseAdmin
      .from('families')
      .update({
        last_data_export_at: new Date().toISOString(),
        last_data_export_by: adminData.id,
      })
      .eq('id', familyId);

    // Log the export action
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        family_id: familyId,
        actor_id: adminData.id,
        action: 'data_export',
        entity_type: 'family',
        entity_id: familyId,
        details: {
          exported_at: new Date().toISOString(),
          record_counts: {
            members: (membersResult.data || []).length,
            tasks: (tasksResult.data || []).length,
            points_history: (pointsHistoryResult.data || []).length,
            messages: (messagesResult.data || []).length,
          },
        },
      });

    return successResponse(exportData, corsHeaders);
  } catch (error) {
    console.error('Error:', error);
    return errorResponse('Internal server error', 500, corsHeaders);
  }
});
