import type { Database as ContentDatabase } from "./supabase-content";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      custom_list_items: {
        Row: {
          added_at: string | null
          id: string
          list_id: string
          title_id?: string | null
          title_slug: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          list_id: string
          title_id?: string | null
          title_slug: string
        }
        Update: {
          added_at?: string | null
          id?: string
          list_id?: string
          title_id?: string | null
          title_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "custom_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_custom_list_items_title_id"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_lists: {
        Row: {
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          title_id?: string | null
          title_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title_id?: string | null
          title_slug: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title_id?: string | null
          title_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_favorites_title_id"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          role: string | null
          updated_at: string | null
          is_banned: boolean
          banned_until: string | null
          ban_reason: string | null
          coin_balance: number
          is_vip: boolean
          vip_expires_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
          is_banned?: boolean
          banned_until?: string | null
          ban_reason?: string | null
          coin_balance?: number
          is_vip?: boolean
          vip_expires_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
          is_banned?: boolean
          banned_until?: string | null
          ban_reason?: string | null
          coin_balance?: number
          is_vip?: boolean
          vip_expires_at?: string | null
        }
        Relationships: []
      }
      watch_history: {
        Row: {
          duration_seconds: number
          episode_number: number
          id: string
          position_seconds: number
          progress: number
          title_id?: string | null
          title_slug: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          duration_seconds?: number
          episode_number?: number
          id?: string
          position_seconds?: number
          progress?: number
          title_id?: string | null
          title_slug: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          duration_seconds?: number
          episode_number?: number
          id?: string
          position_seconds?: number
          progress?: number
          title_id?: string | null
          title_slug?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_watch_history_title_id"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          context: Json
          created_at: string
          email: string
          id: string
          message: string
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          category: string
          context?: Json
          created_at?: string
          email: string
          id?: string
          message: string
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          category?: string
          context?: Json
          created_at?: string
          email?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          user_id: string
          balance: number
          is_vip: boolean
          vip_expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          balance?: number
          is_vip?: boolean
          vip_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          balance?: number
          is_vip?: boolean
          vip_expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          balance_after: number
          transaction_type: string
          reference_id: string | null
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          balance_after: number
          transaction_type: string
          reference_id?: string | null
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          balance_after?: number
          transaction_type?: string
          reference_id?: string | null
          description?: string
          created_at?: string
        }
        Relationships: []
      }
      user_unlocked_episodes: {
        Row: {
          id: string
          user_id: string
          drama_id: string
          drama_slug: string
          episode_id: string
          episode_number: number
          coins_spent: number
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          drama_id: string
          drama_slug: string
          episode_id: string
          episode_number: number
          coins_spent?: number
          unlocked_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          drama_id?: string
          drama_slug?: string
          episode_id?: string
          episode_number?: number
          coins_spent?: number
          unlocked_at?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          id: string
          user_id: string
          streak_count: number
          last_checkin_date: string
          coins_awarded: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          streak_count?: number
          last_checkin_date?: string
          coins_awarded?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          streak_count?: number
          last_checkin_date?: string
          coins_awarded?: number
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_user_wallet: {
        Args: { p_user_id: string }
        Returns: Json
      }
      credit_wallet_coins: {
        Args: {
          p_user_id: string
          p_amount: number
          p_type: string
          p_ref_id?: string | null
          p_description?: string
        }
        Returns: Json
      }
      debit_wallet_coins: {
        Args: {
          p_user_id: string
          p_amount: number
          p_type: string
          p_ref_id?: string | null
          p_description?: string
        }
        Returns: Json
      }
      unlock_episode_with_coins: {
        Args: {
          p_user_id: string
          p_drama_id: string
          p_drama_slug: string
          p_episode_id: string
          p_episode_number: number
          p_cost?: number
        }
        Returns: Json
      }
      claim_daily_checkin: {
        Args: { p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  content: ContentDatabase["public"]
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
