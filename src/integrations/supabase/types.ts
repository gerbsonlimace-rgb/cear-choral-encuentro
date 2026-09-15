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
          password_change_candidate_fingerprint: string | null
          password_change_operation_kind: string | null
          password_change_operation_previous_required: boolean | null
          password_change_operation_stage: string | null
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
          password_change_candidate_fingerprint?: string | null
          password_change_operation_kind?: string | null
          password_change_operation_previous_required?: boolean | null
          password_change_operation_stage?: string | null
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
          password_change_candidate_fingerprint?: string | null
          password_change_operation_kind?: string | null
          password_change_operation_previous_required?: boolean | null
          password_change_operation_stage?: string | null
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
      coroapp_event_sources: {
        Row: {
          event_id: string
          event_name: string
          public_url: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          event_id: string
          event_name: string
          public_url: string
          sort_order: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          event_id?: string
          event_name?: string
          public_url?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      event_activities: {
        Row: {
          activity_date: string
          category: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          qr_version: number
          radius_meters: number | null
          requires_qr: boolean
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
          verify_location: boolean
        }
        Insert: {
          activity_date: string
          category: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          qr_version?: number
          radius_meters?: number | null
          requires_qr?: boolean
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
          verify_location?: boolean
        }
        Update: {
          activity_date?: string
          category?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          qr_version?: number
          radius_meters?: number | null
          requires_qr?: boolean
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
          verify_location?: boolean
        }
        Relationships: []
      }
      event_activity_attendances: {
        Row: {
          accuracy_meters: number | null
          activity_id: string
          checked_in_at: string
          distance_meters: number | null
          id: string
          latitude: number | null
          longitude: number | null
          participant_account_id: string
          position_collected_at: string | null
          qr_version: number
          registration_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          activity_id: string
          checked_in_at?: string
          distance_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          participant_account_id: string
          position_collected_at?: string | null
          qr_version: number
          registration_id: string
        }
        Update: {
          accuracy_meters?: number | null
          activity_id?: string
          checked_in_at?: string
          distance_meters?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          participant_account_id?: string
          position_collected_at?: string | null
          qr_version?: number
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_activity_attendances_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "event_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_activity_attendances_participant_account_id_fkey"
            columns: ["participant_account_id"]
            isOneToOne: false
            referencedRelation: "participant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_activity_attendances_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          mime_type: string
          original_file_name: string
          size_bytes: number
          storage_path: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          mime_type?: string
          original_file_name: string
          size_bytes: number
          storage_path: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          mime_type?: string
          original_file_name?: string
          size_bytes?: number
          storage_path?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      event_notices: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          is_published: boolean
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          is_published?: boolean
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          is_published?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
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
      participant_access_events: {
        Row: {
          admin_user_id: string | null
          created_at: string
          error_code: string | null
          event_type: string
          id: string
          participant_account_id: string | null
          registration_id: string
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          error_code?: string | null
          event_type: string
          id?: string
          participant_account_id?: string | null
          registration_id: string
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          error_code?: string | null
          event_type?: string
          id?: string
          participant_account_id?: string | null
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participant_access_events_participant_account_id_fkey"
            columns: ["participant_account_id"]
            isOneToOne: false
            referencedRelation: "participant_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participant_access_events_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      participant_accounts: {
        Row: {
          access_status: string
          created_at: string
          id: string
          last_error_code: string | null
          provisioned_at: string | null
          provisioning_claim_id: string | null
          provisioning_started_at: string | null
          registration_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_status?: string
          created_at?: string
          id?: string
          last_error_code?: string | null
          provisioned_at?: string | null
          provisioning_claim_id?: string | null
          provisioning_started_at?: string | null
          registration_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_status?: string
          created_at?: string
          id?: string
          last_error_code?: string | null
          provisioned_at?: string | null
          provisioning_claim_id?: string | null
          provisioning_started_at?: string | null
          registration_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participant_accounts_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
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
      sponsors: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_path: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_path?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_choir_regent_admin_password_candidate_operation: {
        Args: {
          p_candidate_fingerprint: string
          p_membership_id: string
          p_operation_hash: string
          p_user_id: string
        }
        Returns: boolean
      }
      claim_choir_regent_password_candidate_operation: {
        Args: {
          p_candidate_fingerprint: string
          p_membership_id: string
          p_operation_hash: string
          p_user_id: string
        }
        Returns: boolean
      }
      claim_choir_regent_password_operation: {
        Args: {
          p_membership_id: string
          p_operation_hash: string
          p_operation_kind: string
          p_user_id: string
        }
        Returns: boolean
      }
      claim_participant_provisioning: {
        Args: { p_claim_id: string; p_registration_id: string }
        Returns: boolean
      }
      delete_admin_registration: {
        Args: { p_admin_user_id: string; p_registration_id: string }
        Returns: string
      }
      finish_choir_regent_password_operation: {
        Args: {
          p_membership_id: string
          p_operation_hash: string
          p_operation_kind: string
          p_user_id: string
        }
        Returns: boolean
      }
      increment_event_activity_qr_version: {
        Args: { p_activity_id: string }
        Returns: {
          activity_date: string
          category: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          latitude: number | null
          location: string | null
          longitude: number | null
          qr_version: number
          radius_meters: number | null
          requires_qr: boolean
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
          verify_location: boolean
        }
        SetofOptions: {
          from: "*"
          to: "event_activities"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_choir_regent_admin_password_operation_retryable: {
        Args: {
          p_candidate_fingerprint: string
          p_membership_id: string
          p_operation_hash: string
          p_user_id: string
        }
        Returns: boolean
      }
      mark_choir_regent_password_operation_retryable: {
        Args: {
          p_candidate_fingerprint: string
          p_membership_id: string
          p_operation_hash: string
          p_user_id: string
        }
        Returns: boolean
      }
      record_event_activity_attendance: {
        Args: {
          p_accuracy_meters?: number
          p_activity_id: string
          p_latitude?: number
          p_longitude?: number
          p_participant_account_id: string
          p_position_collected_at?: string
          p_qr_version: number
          p_registration_id: string
        }
        Returns: {
          activity_title: string
          checked_in_at: string
          distance_meters: number
          status: string
        }[]
      }
      release_choir_regent_admin_password_candidate_operation: {
        Args: {
          p_candidate_fingerprint: string
          p_expected_stage: string
          p_membership_id: string
          p_operation_hash: string
          p_user_id: string
        }
        Returns: boolean
      }
      release_choir_regent_password_candidate_operation: {
        Args: {
          p_expected_stage: string
          p_membership_id: string
          p_operation_hash: string
          p_user_id: string
        }
        Returns: boolean
      }
      release_choir_regent_password_operation: {
        Args: {
          p_membership_id: string
          p_operation_hash: string
          p_operation_kind: string
          p_user_id: string
        }
        Returns: boolean
      }
      replace_active_choir_regent: {
        Args: {
          p_choir_id: string
          p_email: string
          p_granted_by: string
          p_name: string
          p_user_id: string
        }
        Returns: {
          choir_id: string
          email: string
          granted_at: string
          granted_by: string
          id: string
          name: string
          password_change_candidate_fingerprint: string | null
          password_change_operation_kind: string | null
          password_change_operation_previous_required: boolean | null
          password_change_operation_stage: string | null
          password_change_required: boolean
          password_change_retry_token_hash: string | null
          revoked_at: string | null
          revoked_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "choir_regents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_coroapp_event_sources: {
        Args: { p_admin_user_id: string; p_sources: Json }
        Returns: {
          event_id: string
          event_name: string
          public_url: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "coroapp_event_sources"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      verify_choir_regent_password_operation_candidate: {
        Args: {
          p_candidate_fingerprint: string
          p_membership_id: string
          p_operation_hash: string
          p_user_id: string
        }
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
