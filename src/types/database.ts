export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      cast_search_checkpoint: {
        Row: {
          fid: number
          id: number
          timestamp: string
        }
        Insert: {
          fid: number
          id?: number
          timestamp?: string
        }
        Update: {
          fid?: number
          id?: number
          timestamp?: string
        }
        Relationships: []
      }
      daily_tip_allocation: {
        Row: {
          address: string | null
          allocation_date: string
          amount: number
          created_at: string
          display_name: string | null
          fid: number
          pfp_url: string | null
          username: string | null
        }
        Insert: {
          address?: string | null
          allocation_date: string
          amount: number
          created_at?: string
          display_name?: string | null
          fid: number
          pfp_url?: string | null
          username?: string | null
        }
        Update: {
          address?: string | null
          allocation_date?: string
          amount?: number
          created_at?: string
          display_name?: string | null
          fid?: number
          pfp_url?: string | null
          username?: string | null
        }
        Relationships: []
      }
      tip: {
        Row: {
          allocation_date: string
          amount: number
          cast_hash: string
          cast_text: string | null
          casted_at: string
          from_fid: number
          id: number
          indexed_at: string
          is_valid: boolean | null
          to_fid: number
        }
        Insert: {
          allocation_date: string
          amount: number
          cast_hash: string
          cast_text?: string | null
          casted_at: string
          from_fid: number
          id?: number
          indexed_at?: string
          is_valid?: boolean | null
          to_fid: number
        }
        Update: {
          allocation_date?: string
          amount?: number
          cast_hash?: string
          cast_text?: string | null
          casted_at?: string
          from_fid?: number
          id?: number
          indexed_at?: string
          is_valid?: boolean | null
          to_fid?: number
        }
        Relationships: []
      }
    }
    Views: {
      distinct_fids: {
        Row: {
          fid: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      allocation_date_summary: {
        Args: {
          input_date?: string
          input_fid?: number | null
        }
        Returns: {
          fid: number
          allocation_date: string
          amount_allocated: number
          amount_sent: number
          amount_received: number
          amount_remaining: number
          num_sent: number
          num_received: number
          username: string
          display_name: string
          pfp_url: string
          address: string
        }[]
      }
      validate_tips: {
        Args: Record<PropertyKey, never>
        Returns: boolean
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

