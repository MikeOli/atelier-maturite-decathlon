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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      card_consensus: {
        Row: {
          card_id: string
          created_at: string
          session_id: string
          updated_at: string
          value: number
        }
        Insert: {
          card_id: string
          created_at?: string
          session_id: string
          updated_at?: string
          value: number
        }
        Update: {
          card_id?: string
          created_at?: string
          session_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_consensus_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_consensus_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "session_current_card"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "card_consensus_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_current_card"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "card_consensus_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_consensus_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          archived: boolean
          bullets: Json
          created_at: string
          deck_id: string
          id: string
          order_index: number
          theme: string
          title: string
        }
        Insert: {
          archived?: boolean
          bullets?: Json
          created_at?: string
          deck_id: string
          id?: string
          order_index: number
          theme: string
          title: string
        }
        Update: {
          archived?: boolean
          bullets?: Json
          created_at?: string
          deck_id?: string
          id?: string
          order_index?: number
          theme?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          admin_id: string
          created_at: string
          description: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          avatar_key: string
          avatar_label: string
          client_token: string
          created_at: string
          id: string
          session_id: string
        }
        Insert: {
          avatar_key: string
          avatar_label: string
          client_token?: string
          created_at?: string
          id?: string
          session_id: string
        }
        Update: {
          avatar_key?: string
          avatar_label?: string
          client_token?: string
          created_at?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_current_card"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_live_state: {
        Row: {
          current_card_id: string | null
          session_id: string
          updated_at: string
          votes_revealed: boolean
        }
        Insert: {
          current_card_id?: string | null
          session_id: string
          updated_at?: string
          votes_revealed?: boolean
        }
        Update: {
          current_card_id?: string | null
          session_id?: string
          updated_at?: string
          votes_revealed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "session_live_state_current_card_id_fkey"
            columns: ["current_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_live_state_current_card_id_fkey"
            columns: ["current_card_id"]
            isOneToOne: false
            referencedRelation: "session_current_card"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "session_live_state_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "session_current_card"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_live_state_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "session_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_live_state_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          admin_id: string
          ai_synthesis: Json | null
          created_at: string
          current_card_id: string | null
          deck_id: string
          duration_minutes: number
          facilitator_token: string
          id: string
          status: string
          team_name: string
          transcript_draft: string | null
          transcription_enabled: boolean
          votes_revealed: boolean
        }
        Insert: {
          admin_id: string
          ai_synthesis?: Json | null
          created_at?: string
          current_card_id?: string | null
          deck_id: string
          duration_minutes: number
          facilitator_token?: string
          id?: string
          status?: string
          team_name: string
          transcript_draft?: string | null
          transcription_enabled?: boolean
          votes_revealed?: boolean
        }
        Update: {
          admin_id?: string
          ai_synthesis?: Json | null
          created_at?: string
          current_card_id?: string | null
          deck_id?: string
          duration_minutes?: number
          facilitator_token?: string
          id?: string
          status?: string
          team_name?: string
          transcript_draft?: string | null
          transcription_enabled?: boolean
          votes_revealed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sessions_current_card_id_fkey"
            columns: ["current_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_current_card_id_fkey"
            columns: ["current_card_id"]
            isOneToOne: false
            referencedRelation: "session_current_card"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "sessions_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          card_id: string
          created_at: string
          id: string
          participant_id: string
          session_id: string
          updated_at: string
          value: number
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          participant_id: string
          session_id: string
          updated_at?: string
          value: number
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          participant_id?: string
          session_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "session_current_card"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "votes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_current_card"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      session_current_card: {
        Row: {
          bullets: Json | null
          card_id: string | null
          session_id: string | null
          theme: string | null
          title: string | null
        }
        Relationships: []
      }
      session_public_info: {
        Row: {
          created_at: string | null
          current_card_id: string | null
          deck_description: string | null
          deck_name: string | null
          duration_minutes: number | null
          id: string | null
          status: string | null
          team_name: string | null
          transcription_enabled: boolean | null
          votes_revealed: boolean | null
        }
        Insert: {
          created_at?: string | null
          current_card_id?: string | null
          deck_description?: string | null
          deck_name?: string | null
          duration_minutes?: number | null
          id?: string | null
          status?: string | null
          team_name?: string | null
          transcription_enabled?: boolean | null
          votes_revealed?: boolean | null
        }
        Update: {
          created_at?: string | null
          current_card_id?: string | null
          deck_description?: string | null
          deck_name?: string | null
          duration_minutes?: number | null
          id?: string | null
          status?: string | null
          team_name?: string | null
          transcription_enabled?: boolean | null
          votes_revealed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_current_card_id_fkey"
            columns: ["current_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_current_card_id_fkey"
            columns: ["current_card_id"]
            isOneToOne: false
            referencedRelation: "session_current_card"
            referencedColumns: ["card_id"]
          },
        ]
      }
    }
    Functions: {
      close_session_as_facilitator: {
        Args: {
          p_ai_synthesis?: Json | null
          p_facilitator_token: string
          p_session_id: string
        }
        Returns: undefined
      }
      get_session_synthesis_as_facilitator: {
        Args: { p_facilitator_token: string; p_session_id: string }
        Returns: {
          bullets: Json | null
          card_id: string | null
          consensus_value: number | null
          theme: string | null
          title: string | null
          transcript_draft: string | null
        }[]
      }
      get_my_vote: {
        Args: {
          p_card_id: string
          p_client_token: string
          p_participant_id: string
          p_session_id: string
        }
        Returns: number
      }
      get_session_by_facilitator_token: {
        Args: { p_facilitator_token: string }
        Returns: {
          created_at: string
          duration_minutes: number
          id: string
          status: string
          team_name: string
          transcript_draft: string | null
          transcription_enabled: boolean
        }[]
      }
      get_voters_for_card: {
        Args: { p_card_id: string; p_session_id: string }
        Returns: { avatar_key: string; avatar_label: string }[]
      }
      go_to_next_card_as_facilitator: {
        Args: { p_facilitator_token: string; p_session_id: string }
        Returns: string
      }
      reveal_votes_as_facilitator: {
        Args: { p_facilitator_token: string; p_session_id: string }
        Returns: undefined
      }
      set_card_consensus_as_facilitator: {
        Args: {
          p_card_id: string
          p_facilitator_token: string
          p_session_id: string
          p_value: number
        }
        Returns: undefined
      }
      reorder_cards: {
        Args: { p_card_ids: string[]; p_deck_id: string }
        Returns: undefined
      }
      set_transcription_enabled_as_facilitator: {
        Args: {
          p_enabled: boolean
          p_facilitator_token: string
          p_session_id: string
        }
        Returns: undefined
      }
      sync_transcript_draft_as_facilitator: {
        Args: { p_facilitator_token: string; p_session_id: string; p_text: string }
        Returns: undefined
      }
      start_session_as_facilitator: {
        Args: { p_facilitator_token: string; p_session_id: string }
        Returns: string
      }
      submit_vote: {
        Args: {
          p_card_id: string
          p_client_token: string
          p_participant_id: string
          p_session_id: string
          p_value: number
        }
        Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
