export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          condition_type: string;
          condition_value: number | null;
          created_at: string | null;
          created_by_member_id: string | null;
          description: string;
          family_id: string | null;
          icon: string | null;
          id: string;
          is_custom: boolean | null;
          name: string;
        };
        Insert: {
          condition_type: string;
          condition_value?: number | null;
          created_at?: string | null;
          created_by_member_id?: string | null;
          description: string;
          family_id?: string | null;
          icon?: string | null;
          id?: string;
          is_custom?: boolean | null;
          name: string;
        };
        Update: {
          condition_type?: string;
          condition_value?: number | null;
          created_at?: string | null;
          created_by_member_id?: string | null;
          description?: string;
          family_id?: string | null;
          icon?: string | null;
          id?: string;
          is_custom?: boolean | null;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'achievements_created_by_member_id_fkey';
            columns: ['created_by_member_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'achievements_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string | null;
          details: Json | null;
          entity_id: string | null;
          entity_type: string;
          family_id: string;
          id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          family_id: string;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          family_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'audit_logs_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      deduction_disputes: {
        Row: {
          created_at: string | null;
          created_by: string;
          evidence_urls: string[] | null;
          family_id: string;
          id: string;
          points_history_id: string;
          points_restored: number | null;
          reason: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by: string;
          evidence_urls?: string[] | null;
          family_id: string;
          id?: string;
          points_history_id: string;
          points_restored?: number | null;
          reason: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string;
          evidence_urls?: string[] | null;
          family_id?: string;
          id?: string;
          points_history_id?: string;
          points_restored?: number | null;
          reason?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'deduction_disputes_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'deduction_disputes_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'deduction_disputes_points_history_id_fkey';
            columns: ['points_history_id'];
            isOneToOne: true;
            referencedRelation: 'points_history';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'deduction_disputes_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
        ];
      };
      families: {
        Row: {
          color_palette: string | null;
          created_at: string | null;
          created_by: string | null;
          default_language: string | null;
          id: string;
          invite_code: string;
          last_data_export_at: string | null;
          last_data_export_by: string | null;
          minimum_redemption: number | null;
          name: string;
          parent_invite_code: string;
          point_to_money_rate: number | null;
          weekly_target_bonus: number | null;
          weekly_target_points: number | null;
        };
        Insert: {
          color_palette?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          default_language?: string | null;
          id?: string;
          invite_code: string;
          last_data_export_at?: string | null;
          last_data_export_by?: string | null;
          minimum_redemption?: number | null;
          name: string;
          parent_invite_code?: string;
          point_to_money_rate?: number | null;
          weekly_target_bonus?: number | null;
          weekly_target_points?: number | null;
        };
        Update: {
          color_palette?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          default_language?: string | null;
          id?: string;
          invite_code?: string;
          last_data_export_at?: string | null;
          last_data_export_by?: string | null;
          minimum_redemption?: number | null;
          name?: string;
          parent_invite_code?: string;
          point_to_money_rate?: number | null;
          weekly_target_bonus?: number | null;
          weekly_target_points?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'families_last_data_export_by_fkey';
            columns: ['last_data_export_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
        ];
      };
      family_members: {
        Row: {
          avatar_url: string | null;
          birthdate: string | null;
          child_invite_code: string | null;
          color: string | null;
          consent_given_at: string | null;
          consent_version: string | null;
          created_at: string | null;
          current_level: number | null;
          current_streak: number | null;
          disabled_at: string | null;
          disabled_by: string | null;
          email: string | null;
          family_id: string | null;
          id: string;
          is_admin: boolean | null;
          is_disabled: boolean | null;
          is_pin_user: boolean | null;
          last_streak_value: number | null;
          name: string;
          pin_hash: string | null;
          privacy_settings: Json | null;
          role: string | null;
          streak_freezes: number | null;
          streak_grace_started_at: string | null;
          streak_lost_at: string | null;
          streak_recovered: boolean | null;
          total_points: number | null;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          birthdate?: string | null;
          child_invite_code?: string | null;
          color?: string | null;
          consent_given_at?: string | null;
          consent_version?: string | null;
          created_at?: string | null;
          current_level?: number | null;
          current_streak?: number | null;
          disabled_at?: string | null;
          disabled_by?: string | null;
          email?: string | null;
          family_id?: string | null;
          id?: string;
          is_admin?: boolean | null;
          is_disabled?: boolean | null;
          is_pin_user?: boolean | null;
          last_streak_value?: number | null;
          name: string;
          pin_hash?: string | null;
          privacy_settings?: Json | null;
          role?: string | null;
          streak_freezes?: number | null;
          streak_grace_started_at?: string | null;
          streak_lost_at?: string | null;
          streak_recovered?: boolean | null;
          total_points?: number | null;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          birthdate?: string | null;
          child_invite_code?: string | null;
          color?: string | null;
          consent_given_at?: string | null;
          consent_version?: string | null;
          created_at?: string | null;
          current_level?: number | null;
          current_streak?: number | null;
          disabled_at?: string | null;
          disabled_by?: string | null;
          email?: string | null;
          family_id?: string | null;
          id?: string;
          is_admin?: boolean | null;
          is_disabled?: boolean | null;
          is_pin_user?: boolean | null;
          last_streak_value?: number | null;
          name?: string;
          pin_hash?: string | null;
          privacy_settings?: Json | null;
          role?: string | null;
          streak_freezes?: number | null;
          streak_grace_started_at?: string | null;
          streak_lost_at?: string | null;
          streak_recovered?: boolean | null;
          total_points?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'family_members_disabled_by_fkey';
            columns: ['disabled_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'family_members_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      family_objects: {
        Row: {
          created_at: string | null;
          family_id: string;
          id: string;
          image_url: string | null;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          family_id: string;
          id?: string;
          image_url?: string | null;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          family_id?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'family_objects_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      manual_points_awards: {
        Row: {
          awarded_by: string | null;
          created_at: string | null;
          family_id: string | null;
          id: string;
          member_id: string | null;
          points: number;
          reason: string;
        };
        Insert: {
          awarded_by?: string | null;
          created_at?: string | null;
          family_id?: string | null;
          id?: string;
          member_id?: string | null;
          points: number;
          reason: string;
        };
        Update: {
          awarded_by?: string | null;
          created_at?: string | null;
          family_id?: string | null;
          id?: string;
          member_id?: string | null;
          points?: number;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'manual_points_awards_awarded_by_fkey';
            columns: ['awarded_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manual_points_awards_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manual_points_awards_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          content: string;
          created_at: string | null;
          family_id: string;
          id: string;
          read_at: string | null;
          recipient_id: string | null;
          sender_id: string;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          family_id: string;
          id?: string;
          read_at?: string | null;
          recipient_id?: string | null;
          sender_id: string;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          family_id?: string;
          id?: string;
          read_at?: string | null;
          recipient_id?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
        ];
      };
      points_history: {
        Row: {
          created_at: string | null;
          evidence_urls: string[] | null;
          family_id: string | null;
          id: string;
          member_id: string | null;
          points: number;
          reason: string;
          task_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          evidence_urls?: string[] | null;
          family_id?: string | null;
          id?: string;
          member_id?: string | null;
          points: number;
          reason: string;
          task_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          evidence_urls?: string[] | null;
          family_id?: string | null;
          id?: string;
          member_id?: string | null;
          points?: number;
          reason?: string;
          task_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'points_history_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'points_history_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'points_history_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      reward_redemptions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string | null;
          family_id: string | null;
          id: string;
          member_id: string | null;
          money_amount: number;
          points_redeemed: number;
          status: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string | null;
          family_id?: string | null;
          id?: string;
          member_id?: string | null;
          money_amount: number;
          points_redeemed: number;
          status?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string | null;
          family_id?: string | null;
          id?: string;
          member_id?: string | null;
          money_amount?: number;
          points_redeemed?: number;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reward_redemptions_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reward_redemptions_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reward_redemptions_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
        ];
      };
      task_history: {
        Row: {
          archived_at: string | null;
          assigned_to: string | null;
          completed_at: string | null;
          description: string | null;
          due_datetime: string | null;
          family_id: string | null;
          id: string;
          original_task_id: string | null;
          point_value: number | null;
          priority: string | null;
          title: string;
        };
        Insert: {
          archived_at?: string | null;
          assigned_to?: string | null;
          completed_at?: string | null;
          description?: string | null;
          due_datetime?: string | null;
          family_id?: string | null;
          id?: string;
          original_task_id?: string | null;
          point_value?: number | null;
          priority?: string | null;
          title: string;
        };
        Update: {
          archived_at?: string | null;
          assigned_to?: string | null;
          completed_at?: string | null;
          description?: string | null;
          due_datetime?: string | null;
          family_id?: string | null;
          id?: string;
          original_task_id?: string | null;
          point_value?: number | null;
          priority?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'task_history_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'task_history_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
        ];
      };
      tasks: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          assigned_to: string | null;
          associated_items: string[] | null;
          associated_object_ids: string[] | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string | null;
          created_by: string | null;
          creation_approved: boolean | null;
          creation_approved_at: string | null;
          creation_approved_by: string | null;
          description: string | null;
          due_date: string;
          due_datetime: string | null;
          family_id: string | null;
          id: string;
          is_archived: boolean | null;
          is_weekly_task: boolean;
          point_value: number | null;
          priority: string | null;
          recurrence_days: number[] | null;
          recurrence_end_date: string | null;
          recurrence_pattern: string | null;
          recurring_task_group_id: string | null;
          rejected_at: string | null;
          rejected_by: string | null;
          rejection_reason: string | null;
          sort_order: number | null;
          start_datetime: string | null;
          status: string | null;
          title: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          assigned_to?: string | null;
          associated_items?: string[] | null;
          associated_object_ids?: string[] | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          creation_approved?: boolean | null;
          creation_approved_at?: string | null;
          creation_approved_by?: string | null;
          description?: string | null;
          due_date: string;
          due_datetime?: string | null;
          family_id?: string | null;
          id?: string;
          is_archived?: boolean | null;
          is_weekly_task?: boolean;
          point_value?: number | null;
          priority?: string | null;
          recurrence_days?: number[] | null;
          recurrence_end_date?: string | null;
          recurrence_pattern?: string | null;
          recurring_task_group_id?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          sort_order?: number | null;
          start_datetime?: string | null;
          status?: string | null;
          title: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          assigned_to?: string | null;
          associated_items?: string[] | null;
          associated_object_ids?: string[] | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          creation_approved?: boolean | null;
          creation_approved_at?: string | null;
          creation_approved_by?: string | null;
          description?: string | null;
          due_date?: string;
          due_datetime?: string | null;
          family_id?: string | null;
          id?: string;
          is_archived?: boolean | null;
          is_weekly_task?: boolean;
          point_value?: number | null;
          priority?: string | null;
          recurrence_days?: number[] | null;
          recurrence_end_date?: string | null;
          recurrence_pattern?: string | null;
          recurring_task_group_id?: string | null;
          rejected_at?: string | null;
          rejected_by?: string | null;
          rejection_reason?: string | null;
          sort_order?: number | null;
          start_datetime?: string | null;
          status?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tasks_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_completed_by_fkey';
            columns: ['completed_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_creation_approved_by_fkey';
            columns: ['creation_approved_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tasks_rejected_by_fkey';
            columns: ['rejected_by'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
        ];
      };
      user_achievements: {
        Row: {
          achievement_id: string | null;
          earned_at: string | null;
          id: string;
          member_id: string | null;
        };
        Insert: {
          achievement_id?: string | null;
          earned_at?: string | null;
          id?: string;
          member_id?: string | null;
        };
        Update: {
          achievement_id?: string | null;
          earned_at?: string | null;
          id?: string;
          member_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_achievements_achievement_id_fkey';
            columns: ['achievement_id'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_achievements_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
        ];
      };
      weekly_earnings: {
        Row: {
          bonus_earned: number | null;
          bonus_paid: boolean | null;
          created_at: string | null;
          family_id: string | null;
          id: string;
          member_id: string | null;
          points_earned: number | null;
          updated_at: string | null;
          week_start: string;
        };
        Insert: {
          bonus_earned?: number | null;
          bonus_paid?: boolean | null;
          created_at?: string | null;
          family_id?: string | null;
          id?: string;
          member_id?: string | null;
          points_earned?: number | null;
          updated_at?: string | null;
          week_start: string;
        };
        Update: {
          bonus_earned?: number | null;
          bonus_paid?: boolean | null;
          created_at?: string | null;
          family_id?: string | null;
          id?: string;
          member_id?: string | null;
          points_earned?: number | null;
          updated_at?: string | null;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weekly_earnings_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'weekly_earnings_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
        ];
      };
      weekly_goals: {
        Row: {
          completed: boolean | null;
          created_at: string | null;
          current_value: number | null;
          family_id: string | null;
          goal_type: string;
          id: string;
          member_id: string | null;
          target_value: number;
          week_start: string;
        };
        Insert: {
          completed?: boolean | null;
          created_at?: string | null;
          current_value?: number | null;
          family_id?: string | null;
          goal_type: string;
          id?: string;
          member_id?: string | null;
          target_value: number;
          week_start: string;
        };
        Update: {
          completed?: boolean | null;
          created_at?: string | null;
          current_value?: number | null;
          family_id?: string | null;
          goal_type?: string;
          id?: string;
          member_id?: string | null;
          target_value?: number;
          week_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'weekly_goals_family_id_fkey';
            columns: ['family_id'];
            isOneToOne: false;
            referencedRelation: 'families';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'weekly_goals_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'family_members';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_child_invite_code: { Args: never; Returns: string };
      generate_invite_code: { Args: never; Returns: string };
      get_current_member_id: { Args: never; Returns: string };
      get_my_family_id: { Args: never; Returns: string };
      get_user_family_id: { Args: never; Returns: string };
      is_family_admin: { Args: never; Returns: boolean };
      regenerate_parent_invite_code: {
        Args: { family_id_param: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
