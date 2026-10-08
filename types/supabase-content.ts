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
      channels: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      episodes: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          episode_number: number
          id: string
          is_free: boolean | null
          thumbnail_url: string | null
          title: string | null
          title_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          episode_number: number
          id?: string
          is_free?: boolean | null
          thumbnail_url?: string | null
          title?: string | null
          title_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          episode_number?: number
          id?: string
          is_free?: boolean | null
          thumbnail_url?: string | null
          title?: string | null
          title_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_media: {
        Row: {
          aspect_ratio: string | null
          asset_ref: string | null
          created_at: string | null
          duration_seconds: number | null
          episode_id: string
          hls_url: string | null
          id: string
          mp4_url: string | null
          provider: string
          status: string
          updated_at: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          asset_ref?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          episode_id: string
          hls_url?: string | null
          id?: string
          mp4_url?: string | null
          provider?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          asset_ref?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          episode_id?: string
          hls_url?: string | null
          id?: string
          mp4_url?: string | null
          provider?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episode_media_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      titles: {
        Row: {
          channel_code: string
          channel_id: string | null
          channel_name: string
          created_at: string | null
          genre: string
          id: string
          poster_url: string
          rating: number | null
          release_year: number | null
          slug: string
          status: string
          synopsis: string
          tags: string[] | null
          title: string
          total_episodes: number
          episodes_available: number
          updated_at: string | null
          views_count: number | null
          banner_url?: string | null
          hero_tagline?: string | null
          featured_rank?: number | null
        }
        Insert: {
          channel_code: string
          channel_id?: string | null
          channel_name: string
          created_at?: string | null
          genre: string
          id?: string
          poster_url: string
          rating?: number | null
          release_year?: number | null
          slug: string
          status?: string
          synopsis: string
          tags?: string[] | null
          title: string
          total_episodes?: number
          episodes_available?: number
          updated_at?: string | null
          views_count?: number | null
          banner_url?: string | null
          hero_tagline?: string | null
          featured_rank?: number | null
        }
        Update: {
          channel_code?: string
          channel_id?: string | null
          channel_name?: string
          created_at?: string | null
          genre?: string
          id?: string
          poster_url?: string
          rating?: number | null
          release_year?: number | null
          slug?: string
          status?: string
          synopsis?: string
          tags?: string[] | null
          title?: string
          total_episodes?: number
          episodes_available?: number
          updated_at?: string | null
          views_count?: number | null
          banner_url?: string | null
          hero_tagline?: string | null
          featured_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "titles_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_distinct_genres: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      get_popular_tags: {
        Args: {
          limit_count?: number
        }
        Returns: {
          tag: string
          count: number
        }[]
      }
      get_taxonomy_counts: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      search_dramas: {
        Args: {
          query_text?: string | null
          filter_genre?: string | null
          filter_channel_id?: string | null
          filter_tags?: string[] | null
          sort_by?: string | null
          page_offset?: number | null
          page_limit?: number | null
        }
        Returns: {
          channel_code: string
          channel_id: string | null
          channel_name: string
          created_at: string | null
          episodes_available: number
          genre: string
          id: string
          poster_url: string
          rating: number | null
          release_year: number | null
          slug: string
          status: string
          synopsis: string
          tags: string[] | null
          title: string
          total_count: number
          total_episodes: number
          updated_at: string | null
          views_count: number | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  content: Database["public"]
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
