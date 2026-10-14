
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_audit_log": {
                  Row: {
                    "action": string,"actor_email": string | null,"actor_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"entity_id": string,"entity_type": string,"id": string,"ip": string | null
                  }
                  Insert: {
                    "action": string,"actor_email"?: string | null,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id": string,"entity_type": string,"id"?: string,"ip"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_email"?: string | null,"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"id"?: string,"ip"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"app_settings": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"channels": {
                  Row: {
                    "avatar_url": string | null,"banner_url": string | null,"code": string,"created_at": string | null,"description": string | null,"id": string,"name": string,"slug": string,"updated_at": string | null
                  }
                  Insert: {
                    "avatar_url"?: string | null,"banner_url"?: string | null,"code": string,"created_at"?: string | null,"description"?: string | null,"id"?: string,"name": string,"slug": string,"updated_at"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"banner_url"?: string | null,"code"?: string,"created_at"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"coin_transactions": {
                  Row: {
                    "amount": number,"balance_after": number,"created_at": string,"description": string,"id": string,"reference_id": string | null,"transaction_type": string,"user_id": string
                  }
                  Insert: {
                    "amount": number,"balance_after": number,"created_at"?: string,"description": string,"id"?: string,"reference_id"?: string | null,"transaction_type": string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"balance_after"?: number,"created_at"?: string,"description"?: string,"id"?: string,"reference_id"?: string | null,"transaction_type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"custom_list_items": {
                  Row: {
                    "added_at": string | null,"id": string,"list_id": string,"title_slug": string
                  }
                  Insert: {
                    "added_at"?: string | null,"id"?: string,"list_id": string,"title_slug": string
                  }
                  Update: {
                    "added_at"?: string | null,"id"?: string,"list_id"?: string,"title_slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "custom_list_items_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "custom_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"custom_lists": {
                  Row: {
                    "created_at": string | null,"id": string,"title": string,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"title": string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"title"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"daily_checkins": {
                  Row: {
                    "coins_awarded": number,"created_at": string,"id": string,"last_checkin_date": string,"streak_count": number,"user_id": string
                  }
                  Insert: {
                    "coins_awarded"?: number,"created_at"?: string,"id"?: string,"last_checkin_date"?: string,"streak_count"?: number,"user_id": string
                  }
                  Update: {
                    "coins_awarded"?: number,"created_at"?: string,"id"?: string,"last_checkin_date"?: string,"streak_count"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"episode_media": {
                  Row: {
                    "aspect_ratio": string | null,"asset_ref": string | null,"created_at": string | null,"duration_seconds": number | null,"episode_id": string,"hls_url": string | null,"id": string,"mp4_url": string | null,"provider": string,"status": string,"updated_at": string | null
                  }
                  Insert: {
                    "aspect_ratio"?: string | null,"asset_ref"?: string | null,"created_at"?: string | null,"duration_seconds"?: number | null,"episode_id": string,"hls_url"?: string | null,"id"?: string,"mp4_url"?: string | null,"provider"?: string,"status"?: string,"updated_at"?: string | null
                  }
                  Update: {
                    "aspect_ratio"?: string | null,"asset_ref"?: string | null,"created_at"?: string | null,"duration_seconds"?: number | null,"episode_id"?: string,"hls_url"?: string | null,"id"?: string,"mp4_url"?: string | null,"provider"?: string,"status"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "episode_media_episode_id_fkey"
      columns: ["episode_id"]
isOneToOne: false
      referencedRelation: "episodes"
      referencedColumns: ["id"]
    }
                  ]
                },"episode_stats_daily": {
                  Row: {
                    "avg_completion": number,"completes": number,"created_at": string,"episode_number": number,"id": number,"starts": number,"stat_date": string,"title_slug": string,"unique_viewers": number,"updated_at": string
                  }
                  Insert: {
                    "avg_completion"?: number,"completes"?: number,"created_at"?: string,"episode_number": number,"id"?: number,"starts"?: number,"stat_date": string,"title_slug": string,"unique_viewers"?: number,"updated_at"?: string
                  }
                  Update: {
                    "avg_completion"?: number,"completes"?: number,"created_at"?: string,"episode_number"?: number,"id"?: number,"starts"?: number,"stat_date"?: string,"title_slug"?: string,"unique_viewers"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"episodes": {
                  Row: {
                    "created_at": string | null,"duration_seconds": number | null,"episode_number": number,"external_id": string | null,"external_source": string | null,"id": string,"is_free": boolean | null,"release_at": string | null,"thumbnail_url": string | null,"title": string | null,"title_id": string,"video_url": string | null
                  }
                  Insert: {
                    "created_at"?: string | null,"duration_seconds"?: number | null,"episode_number": number,"external_id"?: string | null,"external_source"?: string | null,"id"?: string,"is_free"?: boolean | null,"release_at"?: string | null,"thumbnail_url"?: string | null,"title"?: string | null,"title_id": string,"video_url"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"duration_seconds"?: number | null,"episode_number"?: number,"external_id"?: string | null,"external_source"?: string | null,"id"?: string,"is_free"?: boolean | null,"release_at"?: string | null,"thumbnail_url"?: string | null,"title"?: string | null,"title_id"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "episodes_title_id_fkey"
      columns: ["title_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string | null,"id": string,"title_slug": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"title_slug": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"title_slug"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"genres": {
                  Row: {
                    "created_at": string,"id": string,"is_visible": boolean,"name": string,"slug": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_visible"?: boolean,"name": string,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_visible"?: boolean,"name"?: string,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"import_jobs": {
                  Row: {
                    "actor_email": string | null,"actor_id": string | null,"completed_at": string | null,"created_at": string,"created_dramas": number,"created_episodes": number,"errors": NonNullable<Json>,"failed_records": number,"file_name": string | null,"id": string,"source_name": string,"status": string,"total_dramas": number,"total_episodes": number,"unchanged_records": number,"updated_at": string,"updated_dramas": number,"updated_episodes": number,"validation_report": NonNullable<Json>
                  }
                  Insert: {
                    "actor_email"?: string | null,"actor_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_dramas"?: number,"created_episodes"?: number,"errors"?: NonNullable<Json>,"failed_records"?: number,"file_name"?: string | null,"id"?: string,"source_name": string,"status"?: string,"total_dramas"?: number,"total_episodes"?: number,"unchanged_records"?: number,"updated_at"?: string,"updated_dramas"?: number,"updated_episodes"?: number,"validation_report"?: NonNullable<Json>
                  }
                  Update: {
                    "actor_email"?: string | null,"actor_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_dramas"?: number,"created_episodes"?: number,"errors"?: NonNullable<Json>,"failed_records"?: number,"file_name"?: string | null,"id"?: string,"source_name"?: string,"status"?: string,"total_dramas"?: number,"total_episodes"?: number,"unchanged_records"?: number,"updated_at"?: string,"updated_dramas"?: number,"updated_episodes"?: number,"validation_report"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"payment_orders": {
                  Row: {
                    "amount_minor": number,"created_at": string,"currency": string,"id": string,"package_id": string,"paid_at": string | null,"provider": string,"provider_payment_id": string | null,"provider_session_id": string | null,"status": string,"user_id": string
                  }
                  Insert: {
                    "amount_minor": number,"created_at"?: string,"currency"?: string,"id"?: string,"package_id": string,"paid_at"?: string | null,"provider": string,"provider_payment_id"?: string | null,"provider_session_id"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "amount_minor"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"package_id"?: string,"paid_at"?: string | null,"provider"?: string,"provider_payment_id"?: string | null,"provider_session_id"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payment_webhook_events": {
                  Row: {
                    "event_id": string,"provider": string,"received_at": string
                  }
                  Insert: {
                    "event_id": string,"provider": string,"received_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"playback_events": {
                  Row: {
                    "anon_id": string,"created_at": string,"duration_seconds": number | null,"episode_number": number,"event_type": string,"id": number,"occurred_at": string,"payload": Json | null,"platform": string,"position_seconds": number | null,"session_id": string,"title_slug": string,"user_id": string | null,"utm": Json | null
                  }
                  Insert: {
                    "anon_id": string,"created_at"?: string,"duration_seconds"?: number | null,"episode_number": number,"event_type": string,"id"?: number,"occurred_at"?: string,"payload"?: Json | null,"platform"?: string,"position_seconds"?: number | null,"session_id": string,"title_slug": string,"user_id"?: string | null,"utm"?: Json | null
                  }
                  Update: {
                    "anon_id"?: string,"created_at"?: string,"duration_seconds"?: number | null,"episode_number"?: number,"event_type"?: string,"id"?: number,"occurred_at"?: string,"payload"?: Json | null,"platform"?: string,"position_seconds"?: number | null,"session_id"?: string,"title_slug"?: string,"user_id"?: string | null,"utm"?: Json | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"ban_reason": string | null,"banned_until": string | null,"coin_balance": number,"created_at": string | null,"display_name": string | null,"id": string,"is_banned": boolean,"is_vip": boolean,"role": string | null,"updated_at": string | null,"vip_expires_at": string | null
                  }
                  Insert: {
                    "avatar_url"?: string | null,"ban_reason"?: string | null,"banned_until"?: string | null,"coin_balance"?: number,"created_at"?: string | null,"display_name"?: string | null,"id": string,"is_banned"?: boolean,"is_vip"?: boolean,"role"?: string | null,"updated_at"?: string | null,"vip_expires_at"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"ban_reason"?: string | null,"banned_until"?: string | null,"coin_balance"?: number,"created_at"?: string | null,"display_name"?: string | null,"id"?: string,"is_banned"?: boolean,"is_vip"?: boolean,"role"?: string | null,"updated_at"?: string | null,"vip_expires_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"support_tickets": {
                  Row: {
                    "admin_notes": string | null,"assigned_email": string | null,"assigned_to": string | null,"category": string,"context": NonNullable<Json>,"created_at": string,"email": string,"id": string,"message": string,"priority": string,"resolved_at": string | null,"resolved_by": string | null,"status": string,"subject": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "admin_notes"?: string | null,"assigned_email"?: string | null,"assigned_to"?: string | null,"category": string,"context"?: NonNullable<Json>,"created_at"?: string,"email": string,"id"?: string,"message": string,"priority"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"subject": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "admin_notes"?: string | null,"assigned_email"?: string | null,"assigned_to"?: string | null,"category"?: string,"context"?: NonNullable<Json>,"created_at"?: string,"email"?: string,"id"?: string,"message"?: string,"priority"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"subject"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"tags": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"title_stats_daily": {
                  Row: {
                    "avg_completion": number,"completes": number,"created_at": string,"ep1_to_ep2_rate": number,"id": number,"starts": number,"stat_date": string,"title_slug": string,"trending_score": number,"unique_viewers": number,"updated_at": string
                  }
                  Insert: {
                    "avg_completion"?: number,"completes"?: number,"created_at"?: string,"ep1_to_ep2_rate"?: number,"id"?: number,"starts"?: number,"stat_date": string,"title_slug": string,"trending_score"?: number,"unique_viewers"?: number,"updated_at"?: string
                  }
                  Update: {
                    "avg_completion"?: number,"completes"?: number,"created_at"?: string,"ep1_to_ep2_rate"?: number,"id"?: number,"starts"?: number,"stat_date"?: string,"title_slug"?: string,"trending_score"?: number,"unique_viewers"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"titles": {
                  Row: {
                    "banner_url": string | null,"channel_code": string,"channel_id": string | null,"channel_name": string,"created_at": string | null,"episodes_available": number,"external_id": string | null,"external_source": string | null,"featured_rank": number | null,"free_episodes_count": number,"genre": string,"genre_id": string | null,"has_been_published": boolean,"hero_tagline": string | null,"id": string,"poster_url": string,"publish_at": string | null,"rating": number | null,"release_year": number | null,"slug": string,"status": string,"synopsis": string,"tags": (string)[] | null,"title": string,"total_episodes": number,"updated_at": string | null,"views_count": number | null
                  }
                  Insert: {
                    "banner_url"?: string | null,"channel_code": string,"channel_id"?: string | null,"channel_name": string,"created_at"?: string | null,"episodes_available"?: number,"external_id"?: string | null,"external_source"?: string | null,"featured_rank"?: number | null,"free_episodes_count"?: number,"genre": string,"genre_id"?: string | null,"has_been_published"?: boolean,"hero_tagline"?: string | null,"id"?: string,"poster_url": string,"publish_at"?: string | null,"rating"?: number | null,"release_year"?: number | null,"slug": string,"status"?: string,"synopsis": string,"tags"?: (string)[] | null,"title": string,"total_episodes"?: number,"updated_at"?: string | null,"views_count"?: number | null
                  }
                  Update: {
                    "banner_url"?: string | null,"channel_code"?: string,"channel_id"?: string | null,"channel_name"?: string,"created_at"?: string | null,"episodes_available"?: number,"external_id"?: string | null,"external_source"?: string | null,"featured_rank"?: number | null,"free_episodes_count"?: number,"genre"?: string,"genre_id"?: string | null,"has_been_published"?: boolean,"hero_tagline"?: string | null,"id"?: string,"poster_url"?: string,"publish_at"?: string | null,"rating"?: number | null,"release_year"?: number | null,"slug"?: string,"status"?: string,"synopsis"?: string,"tags"?: (string)[] | null,"title"?: string,"total_episodes"?: number,"updated_at"?: string | null,"views_count"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "titles_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "titles_genre_id_fkey"
      columns: ["genre_id"]
isOneToOne: false
      referencedRelation: "genres"
      referencedColumns: ["id"]
    }
                  ]
                },"user_unlocked_episodes": {
                  Row: {
                    "coins_spent": number,"drama_id": string,"drama_slug": string,"episode_id": string,"episode_number": number,"id": string,"unlocked_at": string,"user_id": string
                  }
                  Insert: {
                    "coins_spent"?: number,"drama_id": string,"drama_slug": string,"episode_id": string,"episode_number": number,"id"?: string,"unlocked_at"?: string,"user_id": string
                  }
                  Update: {
                    "coins_spent"?: number,"drama_id"?: string,"drama_slug"?: string,"episode_id"?: string,"episode_number"?: number,"id"?: string,"unlocked_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"wallets": {
                  Row: {
                    "balance": number,"created_at": string,"is_vip": boolean,"updated_at": string,"user_id": string,"vip_expires_at": string | null
                  }
                  Insert: {
                    "balance"?: number,"created_at"?: string,"is_vip"?: boolean,"updated_at"?: string,"user_id": string,"vip_expires_at"?: string | null
                  }
                  Update: {
                    "balance"?: number,"created_at"?: string,"is_vip"?: boolean,"updated_at"?: string,"user_id"?: string,"vip_expires_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"watch_history": {
                  Row: {
                    "duration_seconds": number,"episode_number": number,"id": string,"position_seconds": number,"progress": number,"title_slug": string,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "duration_seconds"?: number,"episode_number"?: number,"id"?: string,"position_seconds"?: number,"progress"?: number,"title_slug": string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "duration_seconds"?: number,"episode_number"?: number,"id"?: string,"position_seconds"?: number,"progress"?: number,"title_slug"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "claim_daily_checkin":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"credit_wallet_coins":
{ Args: { "p_amount": number,"p_description"?: string,"p_ref_id"?: string,"p_type": string,"p_user_id": string }; Returns: Json
                           },
"debit_wallet_coins":
{ Args: { "p_amount": number,"p_description"?: string,"p_ref_id"?: string,"p_type": string,"p_user_id": string }; Returns: Json
                           },
"ensure_user_wallet":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"fulfill_payment_order":
{ Args: { "p_order_id": string,"p_provider_payment_id"?: string }; Returns: Json
                           },
"get_distinct_genres":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"get_popular_tags":
{ Args: { "limit_count"?: number }; Returns: {
              "count": number,"tag": string
            }[]
                           },
"get_taxonomy_counts":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"rollup_daily_playback_stats":
{ Args: { "target_date"?: string }; Returns: Json
                           },
"search_dramas":
{ Args: { "filter_channel_id"?: string,"filter_genre"?: string,"filter_tags"?: (string)[],"page_limit"?: number,"page_offset"?: number,"query_text"?: string,"sort_by"?: string }; Returns: {
              "channel_code": string,"channel_id": string,"channel_name": string,"created_at": string,"episodes_available": number,"genre": string,"id": string,"poster_url": string,"rating": number,"release_year": number,"slug": string,"status": string,"synopsis": string,"tags": (string)[],"title": string,"total_count": number,"total_episodes": number,"updated_at": string,"views_count": number
            }[]
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"taxonomy_counts":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"unlock_episode_with_coins":
{ Args: { "p_cost"?: number,"p_drama_id": string,"p_drama_slug": string,"p_episode_id": string,"p_episode_number": number,"p_user_id": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

