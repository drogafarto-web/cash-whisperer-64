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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          initial_balance: number
          name: string
          type: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          initial_balance?: number
          name: string
          type?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          initial_balance?: number
          name?: string
          type?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_closings: {
        Row: {
          account_id: string
          actual_balance: number
          closed_by: string
          created_at: string
          date: string
          difference: number
          envelope_id: string | null
          expected_balance: number
          id: string
          notes: string | null
          unit_id: string | null
        }
        Insert: {
          account_id: string
          actual_balance: number
          closed_by: string
          created_at?: string
          date: string
          difference: number
          envelope_id?: string | null
          expected_balance: number
          id?: string
          notes?: string | null
          unit_id?: string | null
        }
        Update: {
          account_id?: string
          actual_balance?: number
          closed_by?: string
          created_at?: string
          date?: string
          difference?: number
          envelope_id?: string | null
          expected_balance?: number
          id?: string
          notes?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_closings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          entra_fator_r: boolean | null
          id: string
          is_informal: boolean | null
          name: string
          recurrence_type: string | null
          tax_group: string | null
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          entra_fator_r?: boolean | null
          id?: string
          is_informal?: boolean | null
          name: string
          recurrence_type?: string | null
          tax_group?: string | null
          type: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          entra_fator_r?: boolean | null
          id?: string
          is_informal?: boolean | null
          name?: string
          recurrence_type?: string | null
          tax_group?: string | null
          type?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_type: string
          id: string
          ocr_data: Json | null
          transaction_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_type: string
          id?: string
          ocr_data?: Json | null
          transaction_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          ocr_data?: Json | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          created_at: string | null
          file_name: string
          id: string
          imported_by: string
          imported_records: number
          period_end: string | null
          period_start: string | null
          skipped_records: number
          total_records: number
          unit_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          id?: string
          imported_by: string
          imported_records?: number
          period_end?: string | null
          period_start?: string | null
          skipped_records?: number
          total_records?: number
          unit_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          id?: string
          imported_by?: string
          imported_records?: number
          period_end?: string | null
          period_start?: string | null
          skipped_records?: number
          total_records?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imports_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          created_at: string
          default_category_id: string | null
          expected_amount: number | null
          id: string
          is_recurring: boolean
          name: string
          notes: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_category_id?: string | null
          expected_amount?: number | null
          id?: string
          is_recurring?: boolean
          name: string
          notes?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_category_id?: string | null
          expected_amount?: number | null
          id?: string
          is_recurring?: boolean
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          category: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      tax_config: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          iss_aliquota: number
          notas: string | null
          regime_atual: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          iss_aliquota?: number
          notas?: string | null
          regime_atual?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          iss_aliquota?: number
          notas?: string | null
          regime_atual?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_config_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_parameters: {
        Row: {
          ano: number
          cbs_aliquota: number
          cofins_cumulativo: number
          cofins_nao_cumulativo: number
          created_at: string
          csll_aliquota: number
          ibs_aliquota: number
          id: string
          irpj_adicional: number
          irpj_adicional_limite: number
          irpj_aliquota: number
          pis_cumulativo: number
          pis_nao_cumulativo: number
          presuncao_servicos: number
          reducao_saude: number
          simples_anexo3_faixas: Json
          simples_anexo5_faixas: Json
        }
        Insert: {
          ano?: number
          cbs_aliquota?: number
          cofins_cumulativo?: number
          cofins_nao_cumulativo?: number
          created_at?: string
          csll_aliquota?: number
          ibs_aliquota?: number
          id?: string
          irpj_adicional?: number
          irpj_adicional_limite?: number
          irpj_aliquota?: number
          pis_cumulativo?: number
          pis_nao_cumulativo?: number
          presuncao_servicos?: number
          reducao_saude?: number
          simples_anexo3_faixas?: Json
          simples_anexo5_faixas?: Json
        }
        Update: {
          ano?: number
          cbs_aliquota?: number
          cofins_cumulativo?: number
          cofins_nao_cumulativo?: number
          created_at?: string
          csll_aliquota?: number
          ibs_aliquota?: number
          id?: string
          irpj_adicional?: number
          irpj_adicional_limite?: number
          irpj_aliquota?: number
          pis_cumulativo?: number
          pis_nao_cumulativo?: number
          presuncao_servicos?: number
          reducao_saude?: number
          simples_anexo3_faixas?: Json
          simples_anexo5_faixas?: Json
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          approved_at: string | null
          approved_by: string | null
          category_id: string
          competencia_ano: number | null
          competencia_mes: number | null
          created_at: string
          created_by: string
          date: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          partner_id: string | null
          payment_method: string
          rejection_reason: string | null
          revenue_source: string | null
          status: string
          type: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          competencia_ano?: number | null
          competencia_mes?: number | null
          created_at?: string
          created_by: string
          date: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          partner_id?: string | null
          payment_method: string
          rejection_reason?: string | null
          revenue_source?: string | null
          status?: string
          type: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          competencia_ano?: number | null
          competencia_mes?: number | null
          created_at?: string
          created_by?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          partner_id?: string | null
          payment_method?: string
          rejection_reason?: string | null
          revenue_source?: string | null
          status?: string
          type?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_unit: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "secretaria" | "contabilidade" | "gestor_unidade"
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
  public: {
    Enums: {
      app_role: ["admin", "secretaria", "contabilidade", "gestor_unidade"],
    },
  },
} as const
