export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          invite_code: string
          parent_invite_code: string
          point_to_money_rate: number
          minimum_redemption: number
          weekly_target_points: number
          weekly_target_bonus: number
          color_palette: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          invite_code: string
          parent_invite_code?: string
          point_to_money_rate?: number
          minimum_redemption?: number
          weekly_target_points?: number
          weekly_target_bonus?: number
          color_palette?: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          parent_invite_code?: string
          point_to_money_rate?: number
          minimum_redemption?: number
          weekly_target_points?: number
          weekly_target_bonus?: number
          color_palette?: string
          created_at?: string
          created_by?: string | null
        }
      }
      family_members: {
        Row: {
          id: string
          name: string
          email: string | null
          avatar_url: string | null
          color: string
          total_points: number
          current_level: number
          current_streak: number
          role: 'parent' | 'child'
          family_id: string | null
          user_id: string | null
          is_admin: boolean
          pin_hash: string | null
          child_invite_code: string | null
          is_pin_user: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          avatar_url?: string | null
          color?: string
          total_points?: number
          current_level?: number
          current_streak?: number
          role?: 'parent' | 'child'
          family_id?: string | null
          user_id?: string | null
          is_admin?: boolean
          pin_hash?: string | null
          child_invite_code?: string | null
          is_pin_user?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          avatar_url?: string | null
          color?: string
          total_points?: number
          current_level?: number
          current_streak?: number
          role?: 'parent' | 'child'
          family_id?: string | null
          user_id?: string | null
          is_admin?: boolean
          pin_hash?: string | null
          child_invite_code?: string | null
          is_pin_user?: boolean
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string
          assigned_to: string | null
          due_date: string
          due_datetime: string | null
          start_datetime: string | null
          priority: 'low' | 'medium' | 'high'
          status: 'pending' | 'in_progress' | 'pending_approval' | 'completed'
          point_value: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          family_id: string | null
          is_archived: boolean
          completed_by: string | null
          approved_by: string | null
          approved_at: string | null
          recurrence_pattern: 'daily' | 'weekly' | 'specific_days' | null
          recurrence_days: number[] | null
          recurrence_end_date: string | null
          recurring_task_group_id: string | null
          associated_items: string[]
          creation_approved: boolean
          creation_approved_by: string | null
          creation_approved_at: string | null
          sort_order: number
        }
        Insert: {
          id?: string
          title: string
          description?: string
          assigned_to?: string | null
          due_date?: string
          due_datetime?: string | null
          start_datetime?: string | null
          priority?: 'low' | 'medium' | 'high'
          status?: 'pending' | 'in_progress' | 'pending_approval' | 'completed'
          point_value?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          family_id?: string | null
          is_archived?: boolean
          completed_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          recurrence_pattern?: 'daily' | 'weekly' | 'specific_days' | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurring_task_group_id?: string | null
          associated_items?: string[]
          creation_approved?: boolean
          creation_approved_by?: string | null
          creation_approved_at?: string | null
          sort_order?: number
        }
        Update: {
          id?: string
          title?: string
          description?: string
          assigned_to?: string | null
          due_date?: string
          due_datetime?: string | null
          start_datetime?: string | null
          priority?: 'low' | 'medium' | 'high'
          status?: 'pending' | 'in_progress' | 'pending_approval' | 'completed'
          point_value?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          family_id?: string | null
          is_archived?: boolean
          completed_by?: string | null
          approved_by?: string | null
          approved_at?: string | null
          recurrence_pattern?: 'daily' | 'weekly' | 'specific_days' | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurring_task_group_id?: string | null
          associated_items?: string[]
          creation_approved?: boolean
          creation_approved_by?: string | null
          creation_approved_at?: string | null
          sort_order?: number
        }
      }
      achievements: {
        Row: {
          id: string
          name: string
          description: string
          icon: string
          condition_type: 'first_task' | 'tasks_count' | 'points_total' | 'streak_days' | 'perfect_week'
          condition_value: number
          family_id: string | null
          is_custom: boolean
          created_by_member_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          icon?: string
          condition_type: 'first_task' | 'tasks_count' | 'points_total' | 'streak_days' | 'perfect_week'
          condition_value?: number
          family_id?: string | null
          is_custom?: boolean
          created_by_member_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          icon?: string
          condition_type?: 'first_task' | 'tasks_count' | 'points_total' | 'streak_days' | 'perfect_week'
          condition_value?: number
          family_id?: string | null
          is_custom?: boolean
          created_by_member_id?: string | null
          created_at?: string
        }
      }
      user_achievements: {
        Row: {
          id: string
          member_id: string
          achievement_id: string
          earned_at: string
        }
        Insert: {
          id?: string
          member_id: string
          achievement_id: string
          earned_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          achievement_id?: string
          earned_at?: string
        }
      }
      points_history: {
        Row: {
          id: string
          member_id: string
          points: number
          reason: string
          task_id: string | null
          family_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          member_id: string
          points: number
          reason: string
          task_id?: string | null
          family_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          points?: number
          reason?: string
          task_id?: string | null
          family_id?: string | null
          created_at?: string
        }
      }
      weekly_goals: {
        Row: {
          id: string
          member_id: string
          week_start: string
          goal_type: 'tasks_completed' | 'points_earned'
          target_value: number
          current_value: number
          completed: boolean
          family_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          member_id: string
          week_start: string
          goal_type: 'tasks_completed' | 'points_earned'
          target_value: number
          current_value?: number
          completed?: boolean
          family_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          member_id?: string
          week_start?: string
          goal_type?: 'tasks_completed' | 'points_earned'
          target_value?: number
          current_value?: number
          completed?: boolean
          family_id?: string | null
          created_at?: string
        }
      }
      manual_points_awards: {
        Row: {
          id: string
          family_id: string | null
          member_id: string | null
          awarded_by: string | null
          points: number
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          family_id?: string | null
          member_id?: string | null
          awarded_by?: string | null
          points: number
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string | null
          member_id?: string | null
          awarded_by?: string | null
          points?: number
          reason?: string
          created_at?: string
        }
      }
      reward_redemptions: {
        Row: {
          id: string
          family_id: string | null
          member_id: string | null
          points_redeemed: number
          money_amount: number
          status: 'pending' | 'approved' | 'paid' | 'rejected'
          approved_by: string | null
          created_at: string
          approved_at: string | null
        }
        Insert: {
          id?: string
          family_id?: string | null
          member_id?: string | null
          points_redeemed: number
          money_amount: number
          status?: 'pending' | 'approved' | 'paid' | 'rejected'
          approved_by?: string | null
          created_at?: string
          approved_at?: string | null
        }
        Update: {
          id?: string
          family_id?: string | null
          member_id?: string | null
          points_redeemed?: number
          money_amount?: number
          status?: 'pending' | 'approved' | 'paid' | 'rejected'
          approved_by?: string | null
          created_at?: string
          approved_at?: string | null
        }
      }
      task_history: {
        Row: {
          id: string
          original_task_id: string | null
          family_id: string | null
          title: string
          description: string
          assigned_to: string | null
          due_datetime: string | null
          priority: string | null
          point_value: number | null
          completed_at: string | null
          archived_at: string
        }
        Insert: {
          id?: string
          original_task_id?: string | null
          family_id?: string | null
          title: string
          description?: string
          assigned_to?: string | null
          due_datetime?: string | null
          priority?: string | null
          point_value?: number | null
          completed_at?: string | null
          archived_at?: string
        }
        Update: {
          id?: string
          original_task_id?: string | null
          family_id?: string | null
          title?: string
          description?: string
          assigned_to?: string | null
          due_datetime?: string | null
          priority?: string | null
          point_value?: number | null
          completed_at?: string | null
          archived_at?: string
        }
      }
      weekly_earnings: {
        Row: {
          id: string
          family_id: string | null
          member_id: string | null
          week_start: string
          points_earned: number
          bonus_earned: number
          bonus_paid: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id?: string | null
          member_id?: string | null
          week_start: string
          points_earned?: number
          bonus_earned?: number
          bonus_paid?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string | null
          member_id?: string | null
          week_start?: string
          points_earned?: number
          bonus_earned?: number
          bonus_paid?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
