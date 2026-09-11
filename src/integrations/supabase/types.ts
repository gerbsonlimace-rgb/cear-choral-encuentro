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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_access_events: {
        Row: {
          admin_user_id: string
          created_at: string
          event_type: string
          id: string
          payment_status_filter: string | null
          result_count: number
          search_used: boolean
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          event_type: string
          id?: string
          payment_status_filter?: string | null
          result_count: number
          search_used: boolean
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payment_status_filter?: string | null
          result_count?: number
          search_used?: boolean
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      choir_regents: {
        Row: {
          choir_id: string
          email: string
          granted_at: string
          granted_by: string
          id: string
          name: string
          password_change_operation_kind: string | null
          password_change_operation_previous_required: boolean | null
          password_change_required: boolean
          password_change_retry_token_hash: string | null
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        Insert: {
          choir_id: string
          email: string
          granted_at?: string
          granted_by: string
          id?: string
          name: string
          password_change_operation_kind?: string | null
          password_change_operation_previous_required?: boolean | null
          password_change_required?: boolean
          password_change_retry_token_hash?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id: string
        }
        Update: {
          choir_id?: string
          email?: string
          granted_at?: string
          granted_by?: string
          id?: string
          name?: string
          password_change_operation_kind?: string | null
          password_change_operation_previous_required?: boolean | null
          password_change_required?: boolean
          password_change_retry_token_hash?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "choir_regents_choir_id_fkey"
            columns: ["choir_id"]
            isOneToOne: false
            referencedRelation: "choirs"
            referencedColumns: ["id"]
          },
        ]
      }
      choirs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          uses_promotional_price: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          uses_promotional_price?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          uses_promotional_price?: boolean
        }
        Relationships: []
      }
      event_registration_settings: {
        Row: {
          created_at: string
          id: boolean
          promotional_price_cents: number | null
          shirt_price_cents: number | null
          standard_price_cents: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          promotional_price_cents?: number | null
          shirt_price_cents?: number | null
          standard_price_cents?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          promotional_price_cents?: number | null
          shirt_price_cents?: number | null
          standard_price_cents?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          amount_cents: number | null
          birth_date: string
          checkout_url: string | null
          choir_id: string | null
          choir_name: string
          city: string | null
          cpf: string | null
          created_at: string
          diocese: string
          email: string | null
          id: string
          include_shirt: boolean
          infinitepay_invoice_slug: string | null
          infinitepay_transaction_nsu: string | null
          installments: number | null
          institution: string | null
          name: string
          observations: string | null
          order_nsu: string | null
          paid_amount_cents: number | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          phone: string
          photo_path: string | null
          pricing_type: string | null
          receipt_url: string | null
          registration_price_cents: number | null
          role: string | null
          shirt_price_cents: number | null
          shirt_size: string | null
          standard_price_cents: number | null
          voice_part: string | null
        }
        Insert: {
          amount_cents?: number | null
          birth_date: string
          checkout_url?: string | null
          choir_id?: string | null
          choir_name: string
          city?: string | null
          cpf?: string | null
          created_at?: string
          diocese: string
          email?: string | null
          id?: string
          include_shirt?: boolean
          infinitepay_invoice_slug?: string | null
          infinitepay_transaction_nsu?: string | null
          installments?: number | null
          institution?: string | null
          name: string
          observations?: string | null
          order_nsu?: string | null
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          phone: string
          photo_path?: string | null
          pricing_type?: string | null
          receipt_url?: string | null
          registration_price_cents?: number | null
          role?: string | null
          shirt_price_cents?: number | null
          shirt_size?: string | null
          standard_price_cents?: number | null
          voice_part?: string | null
        }
        Update: {
          amount_cents?: number | null
          birth_date?: string
          checkout_url?: string | null
          choir_id?: string | null
          choir_name?: string
          city?: string | null
          cpf?: string | null
          created_at?: string
          diocese?: string
          email?: string | null
          id?: string
          include_shirt?: boolean
          infinitepay_invoice_slug?: string | null
          infinitepay_transaction_nsu?: string | null
          installments?: number | null
          institution?: string | null
          name?: string
          observations?: string | null
          order_nsu?: string | null
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          phone?: string
          photo_path?: string | null
          pricing_type?: string | null
          receipt_url?: string | null
          registration_price_cents?: number | null
          role?: string | null
          shirt_price_cents?: number | null
          shirt_size?: string | null
          standard_price_cents?: number | null
          voice_part?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_choir_id_fkey"
            columns: ["choir_id"]
            isOneToOne: false
            referencedRelation: "choirs"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_complement_payments: {
        Row: {
          amount_cents: number
          checkout_url: string | null
          choir_id: string
          created_at: string
          id: string
          infinitepay_invoice_slug: string | null
          infinitepay_transaction_nsu: string | null
          initiated_as: string
          initiated_by: string
          initiated_by_name: string
          installments: number | null
          order_nsu: string
          paid_amount_cents: number | null
          paid_at: string | null
          payment_method: string | null
          receipt_url: string | null
          registration_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          checkout_url?: string | null
          choir_id: string
          created_at?: string
          id?: string
          infinitepay_invoice_slug?: string | null
          infinitepay_transaction_nsu?: string | null
          initiated_as: string
          initiated_by: string
          initiated_by_name: string
          installments?: number | null
          order_nsu: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          registration_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          checkout_url?: string | null
          choir_id?: string
          created_at?: string
          id?: string
          infinitepay_invoice_slug?: string | null
          infinitepay_transaction_nsu?: string | null
          initiated_as?: string
          initiated_by?: string
          initiated_by_name?: string
          installments?: number | null
          order_nsu?: string
          paid_amount_cents?: number | null
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          registration_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_complement_payments_choir_id_fkey"
            columns: ["choir_id"]
            isOneToOne: false
            referencedRelation: "choirs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_complement_payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_choir_regent_password_operation: {
        Args: {
          p_membership_id: string;
          p_operation_hash: string;
          p_operation_kind: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      finish_choir_regent_password_operation: {
        Args: {
          p_membership_id: string;
          p_operation_hash: string;
          p_operation_kind: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      release_choir_regent_password_operation: {
        Args: {
          p_membership_id: string;
          p_operation_hash: string;
          p_operation_kind: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      replace_active_choir_regent: {
        Args: {
          p_choir_id: string
          p_email: string
          p_granted_by: string
          p_name: string
          p_user_id: string
        }
        Returns: Database["public"]["Tables"]["choir_regents"]["Row"]
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
