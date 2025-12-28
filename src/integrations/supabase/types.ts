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
      accounting_audit_logs: {
        Row: {
          ano: number
          categoria: string
          comentario: string | null
          created_at: string | null
          created_by: string | null
          id: string
          mes: number
          status: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          categoria: string
          comentario?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes: number
          status?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          categoria?: string
          comentario?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          mes?: number
          status?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_audit_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_competence_data: {
        Row: {
          ano: number
          created_at: string | null
          darf_valor: number | null
          darf_vencimento: string | null
          das_valor: number | null
          das_vencimento: string | null
          encargos: number | null
          fgts_valor: number | null
          fgts_vencimento: string | null
          gps_valor: number | null
          gps_vencimento: string | null
          id: string
          informado_em: string | null
          informado_por: string | null
          inss_valor: number | null
          inss_vencimento: string | null
          iss_valor: number | null
          iss_vencimento: string | null
          mes: number
          num_funcionarios: number | null
          prolabore: number | null
          receita_observacoes: string | null
          receita_outras: number | null
          receita_servicos: number | null
          status: string | null
          total_folha: number | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          darf_valor?: number | null
          darf_vencimento?: string | null
          das_valor?: number | null
          das_vencimento?: string | null
          encargos?: number | null
          fgts_valor?: number | null
          fgts_vencimento?: string | null
          gps_valor?: number | null
          gps_vencimento?: string | null
          id?: string
          informado_em?: string | null
          informado_por?: string | null
          inss_valor?: number | null
          inss_vencimento?: string | null
          iss_valor?: number | null
          iss_vencimento?: string | null
          mes: number
          num_funcionarios?: number | null
          prolabore?: number | null
          receita_observacoes?: string | null
          receita_outras?: number | null
          receita_servicos?: number | null
          status?: string | null
          total_folha?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          darf_valor?: number | null
          darf_vencimento?: string | null
          das_valor?: number | null
          das_vencimento?: string | null
          encargos?: number | null
          fgts_valor?: number | null
          fgts_vencimento?: string | null
          gps_valor?: number | null
          gps_vencimento?: string | null
          id?: string
          informado_em?: string | null
          informado_por?: string | null
          inss_valor?: number | null
          inss_vencimento?: string | null
          iss_valor?: number | null
          iss_vencimento?: string | null
          mes?: number
          num_funcionarios?: number | null
          prolabore?: number | null
          receita_observacoes?: string | null
          receita_outras?: number | null
          receita_servicos?: number | null
          status?: string | null
          total_folha?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_competence_data_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_competence_documents: {
        Row: {
          ano: number
          categoria: string
          created_at: string | null
          created_by: string | null
          descricao: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mes: number
          mime_type: string | null
          ocr_data: Json | null
          ocr_status: string | null
          unit_id: string | null
        }
        Insert: {
          ano: number
          categoria: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mes: number
          mime_type?: string | null
          ocr_data?: Json | null
          ocr_status?: string | null
          unit_id?: string | null
        }
        Update: {
          ano?: number
          categoria?: string
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mes?: number
          mime_type?: string | null
          ocr_data?: Json | null
          ocr_status?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_competence_documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_contacts: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          email: string
          empresa: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          email: string
          empresa?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          empresa?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      accounting_documents: {
        Row: {
          ano: number
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mes: number
          mime_type: string | null
          observacoes: string | null
          ocr_data: Json | null
          ocr_status: string | null
          status: string | null
          tipo_documento: string
          token_id: string | null
          updated_at: string | null
          updated_by: string | null
          valor_documento: number | null
          vinculado_a: string | null
          vinculado_id: string | null
        }
        Insert: {
          ano: number
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mes: number
          mime_type?: string | null
          observacoes?: string | null
          ocr_data?: Json | null
          ocr_status?: string | null
          status?: string | null
          tipo_documento: string
          token_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_documento?: number | null
          vinculado_a?: string | null
          vinculado_id?: string | null
        }
        Update: {
          ano?: number
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mes?: number
          mime_type?: string | null
          observacoes?: string | null
          ocr_data?: Json | null
          ocr_status?: string | null
          status?: string | null
          tipo_documento?: string
          token_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_documento?: number | null
          vinculado_a?: string | null
          vinculado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "accounting_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_documents_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "accounting_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_email_logs: {
        Row: {
          contact_id: string | null
          email_to: string
          error_message: string | null
          id: string
          sent_at: string | null
          status: string | null
          subject: string
          token_id: string | null
        }
        Insert: {
          contact_id?: string | null
          email_to: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          subject: string
          token_id?: string | null
        }
        Update: {
          contact_id?: string | null
          email_to?: string
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_email_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "accounting_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_email_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "accounting_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_lab_documents: {
        Row: {
          ano: number
          created_at: string | null
          created_by: string | null
          descricao: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mes: number
          mime_type: string | null
          submission_id: string | null
          tipo: string
          unit_id: string | null
          valor: number | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mes: number
          mime_type?: string | null
          submission_id?: string | null
          tipo: string
          unit_id?: string | null
          valor?: number | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mes?: number
          mime_type?: string | null
          submission_id?: string | null
          tipo?: string
          unit_id?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_lab_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "accounting_lab_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_lab_documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_lab_submissions: {
        Row: {
          ano: number
          created_at: string | null
          enviado_em: string | null
          enviado_por: string | null
          id: string
          mes: number
          observacoes: string | null
          recebido_em: string | null
          recebido_por: string | null
          receita_outras_lab: number | null
          receita_servicos_lab: number | null
          status: string | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          id?: string
          mes: number
          observacoes?: string | null
          recebido_em?: string | null
          recebido_por?: string | null
          receita_outras_lab?: number | null
          receita_servicos_lab?: number | null
          status?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          id?: string
          mes?: number
          observacoes?: string | null
          recebido_em?: string | null
          recebido_por?: string | null
          receita_outras_lab?: number | null
          receita_servicos_lab?: number | null
          status?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_lab_submissions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_settings: {
        Row: {
          historico_fim_ano: number
          historico_fim_mes: number
          historico_inicio_ano: number
          historico_inicio_mes: number
          id: string
          reminder_day: number
          reminder_hour: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          historico_fim_ano?: number
          historico_fim_mes?: number
          historico_inicio_ano?: number
          historico_inicio_mes?: number
          id?: string
          reminder_day?: number
          reminder_hour?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          historico_fim_ano?: number
          historico_fim_mes?: number
          historico_inicio_ano?: number
          historico_inicio_mes?: number
          id?: string
          reminder_day?: number
          reminder_hour?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      accounting_tokens: {
        Row: {
          ano: number | null
          ano_fim: number | null
          ano_inicio: number | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          mes: number | null
          mes_fim: number | null
          mes_inicio: number | null
          tipo: string
          token: string
          used_at: string | null
        }
        Insert: {
          ano?: number | null
          ano_fim?: number | null
          ano_inicio?: number | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          mes?: number | null
          mes_fim?: number | null
          mes_inicio?: number | null
          tipo?: string
          token: string
          used_at?: string | null
        }
        Update: {
          ano?: number | null
          ano_fim?: number | null
          ano_inicio?: number | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          mes?: number | null
          mes_fim?: number | null
          mes_inicio?: number | null
          tipo?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "accounting_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_number: string | null
          account_type: string | null
          active: boolean
          agency: string | null
          created_at: string
          description: string | null
          holder_document: string | null
          holder_name: string | null
          id: string
          initial_balance: number
          institution: string | null
          institution_code: string | null
          is_default: boolean | null
          name: string
          type: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          created_at?: string
          description?: string | null
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          initial_balance?: number
          institution?: string | null
          institution_code?: string | null
          is_default?: boolean | null
          name: string
          type?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          active?: boolean
          agency?: string | null
          created_at?: string
          description?: string | null
          holder_document?: string | null
          holder_name?: string | null
          id?: string
          initial_balance?: number
          institution?: string | null
          institution_code?: string | null
          is_default?: boolean | null
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
      alert_preferences: {
        Row: {
          created_at: string | null
          email_fator_r_alerta: boolean | null
          email_fator_r_critico: boolean | null
          frequencia: string | null
          id: string
          limite_alerta_preventivo: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_fator_r_alerta?: boolean | null
          email_fator_r_critico?: boolean | null
          frequencia?: string | null
          id?: string
          limite_alerta_preventivo?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_fator_r_alerta?: boolean | null
          email_fator_r_critico?: boolean | null
          frequencia?: string | null
          id?: string
          limite_alerta_preventivo?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      card_fee_config: {
        Row: {
          active: boolean
          created_at: string
          fee_percent: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          fee_percent?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          fee_percent?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_audit_log: {
        Row: {
          action: string
          amount: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          target_count: number | null
          target_id: string | null
          target_type: string | null
          unit_id: string
          user_id: string
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_count?: number | null
          target_id?: string | null
          target_type?: string | null
          unit_id: string
          user_id: string
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_count?: number | null
          target_id?: string | null
          target_type?: string | null
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_audit_log_unit_id_fkey"
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
      cash_envelopes: {
        Row: {
          cash_total: number
          closure_id: string | null
          conferencia_checkbox: boolean
          counted_cash: number | null
          created_at: string
          created_by: string | null
          difference: number | null
          expected_cash: number | null
          id: string
          justificativa: string | null
          label_printed_at: string | null
          label_printed_by: string | null
          lis_codes: string[]
          lis_codes_count: number | null
          reprint_count: number
          status: string
          unit_id: string | null
        }
        Insert: {
          cash_total?: number
          closure_id?: string | null
          conferencia_checkbox?: boolean
          counted_cash?: number | null
          created_at?: string
          created_by?: string | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          justificativa?: string | null
          label_printed_at?: string | null
          label_printed_by?: string | null
          lis_codes?: string[]
          lis_codes_count?: number | null
          reprint_count?: number
          status?: string
          unit_id?: string | null
        }
        Update: {
          cash_total?: number
          closure_id?: string | null
          conferencia_checkbox?: boolean
          counted_cash?: number | null
          created_at?: string
          created_by?: string | null
          difference?: number | null
          expected_cash?: number | null
          id?: string
          justificativa?: string | null
          label_printed_at?: string | null
          label_printed_by?: string | null
          lis_codes?: string[]
          lis_codes_count?: number | null
          reprint_count?: number
          status?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_envelopes_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "lis_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_envelopes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_alerts: {
        Row: {
          alert_type: string | null
          created_at: string | null
          id: string
          projected_balance: number | null
          resolved_at: string | null
          resolved_by: string | null
          unit_id: string | null
          week_start: string
        }
        Insert: {
          alert_type?: string | null
          created_at?: string | null
          id?: string
          projected_balance?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          unit_id?: string | null
          week_start: string
        }
        Update: {
          alert_type?: string | null
          created_at?: string | null
          id?: string
          projected_balance?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          unit_id?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_alerts_unit_id_fkey"
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
      convenio_import_sessions: {
        Row: {
          created_at: string
          file_name: string
          id: string
          imported_by: string
          period_end: string | null
          period_start: string | null
          providers_count: number | null
          total_records: number | null
          unit_id: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          imported_by: string
          period_end?: string | null
          period_start?: string | null
          providers_count?: number | null
          total_records?: number | null
          unit_id?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          imported_by?: string
          period_end?: string | null
          period_start?: string | null
          providers_count?: number | null
          total_records?: number | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convenio_import_sessions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio_production_reports: {
        Row: {
          amount: number
          company_name: string | null
          created_at: string
          exam_date: string
          exam_list: string | null
          id: string
          import_session_id: string | null
          is_particular: boolean
          lis_code: string
          patient_name: string | null
          provider_name: string
          report_filename: string | null
          report_period_end: string | null
          report_period_start: string | null
          row_index: number | null
          unit_id: string | null
        }
        Insert: {
          amount?: number
          company_name?: string | null
          created_at?: string
          exam_date: string
          exam_list?: string | null
          id?: string
          import_session_id?: string | null
          is_particular?: boolean
          lis_code: string
          patient_name?: string | null
          provider_name: string
          report_filename?: string | null
          report_period_end?: string | null
          report_period_start?: string | null
          row_index?: number | null
          unit_id?: string | null
        }
        Update: {
          amount?: number
          company_name?: string | null
          created_at?: string
          exam_date?: string
          exam_list?: string | null
          id?: string
          import_session_id?: string | null
          is_particular?: boolean
          lis_code?: string
          patient_name?: string | null
          provider_name?: string
          report_filename?: string | null
          report_period_end?: string | null
          report_period_start?: string | null
          row_index?: number | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convenio_production_reports_import_session_id_fkey"
            columns: ["import_session_id"]
            isOneToOne: false
            referencedRelation: "convenio_import_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_production_reports_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios: {
        Row: {
          active: boolean
          codigo: string | null
          created_at: string
          id: string
          nome: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nome: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          codigo?: string | null
          created_at?: string
          id?: string
          nome?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_cash_closings: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          counted_at: string | null
          counted_by: string | null
          counted_cash: number | null
          created_at: string
          date: string
          difference: number | null
          envelope_id: string | null
          expected_cash: number
          id: string
          label_emitted_at: string | null
          label_sequence: number | null
          lis_closure_id: string
          lis_codes_count: number | null
          notes: string | null
          selected_lis_item_ids: string[] | null
          status: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          counted_at?: string | null
          counted_by?: string | null
          counted_cash?: number | null
          created_at?: string
          date: string
          difference?: number | null
          envelope_id?: string | null
          expected_cash?: number
          id?: string
          label_emitted_at?: string | null
          label_sequence?: number | null
          lis_closure_id: string
          lis_codes_count?: number | null
          notes?: string | null
          selected_lis_item_ids?: string[] | null
          status?: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          counted_at?: string | null
          counted_by?: string | null
          counted_cash?: number | null
          created_at?: string
          date?: string
          difference?: number | null
          envelope_id?: string | null
          expected_cash?: number
          id?: string
          label_emitted_at?: string | null
          label_sequence?: number | null
          lis_closure_id?: string
          lis_codes_count?: number | null
          notes?: string | null
          selected_lis_item_ids?: string[] | null
          status?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_cash_closings_lis_closure_id_fkey"
            columns: ["lis_closure_id"]
            isOneToOne: false
            referencedRelation: "lis_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_cash_closings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
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
      fator_r_alerts: {
        Row: {
          ajuste_sugerido: number | null
          created_at: string | null
          economia_potencial: number | null
          email_enviado: boolean | null
          email_enviado_em: string | null
          fator_r_anterior: number | null
          fator_r_atual: number
          id: string
          tipo_alerta: string
          unit_id: string | null
          user_id: string
        }
        Insert: {
          ajuste_sugerido?: number | null
          created_at?: string | null
          economia_potencial?: number | null
          email_enviado?: boolean | null
          email_enviado_em?: string | null
          fator_r_anterior?: number | null
          fator_r_atual: number
          id?: string
          tipo_alerta: string
          unit_id?: string | null
          user_id: string
        }
        Update: {
          ajuste_sugerido?: number | null
          created_at?: string | null
          economia_potencial?: number | null
          email_enviado?: boolean | null
          email_enviado_em?: string | null
          fator_r_anterior?: number | null
          fator_r_atual?: number
          id?: string
          tipo_alerta?: string
          unit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fator_r_alerts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      import_sessions: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_name: string
          id: string
          imported_count: number | null
          pending_count: number | null
          period_end: string | null
          period_start: string | null
          status: string | null
          total_records: number | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_name: string
          id?: string
          imported_count?: number | null
          pending_count?: number | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          total_records?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_name?: string
          id?: string
          imported_count?: number | null
          pending_count?: number | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          total_records?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_sessions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      import_staging: {
        Row: {
          codigo: string
          convenio: string | null
          created_at: string | null
          created_by: string | null
          date: string
          error_message: string | null
          has_error: boolean | null
          id: string
          import_session_id: string
          is_duplicate: boolean | null
          is_nao_pago: boolean | null
          is_particular: boolean | null
          paciente: string | null
          payment_method: string
          resolution_amount: number | null
          resolution_justification: string | null
          resolution_payment_method: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          selected: boolean | null
          status: string | null
          transaction_id: string | null
          unit_id: string | null
          updated_at: string | null
          valor_bruto: number | null
          valor_pago: number | null
        }
        Insert: {
          codigo: string
          convenio?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          error_message?: string | null
          has_error?: boolean | null
          id?: string
          import_session_id: string
          is_duplicate?: boolean | null
          is_nao_pago?: boolean | null
          is_particular?: boolean | null
          paciente?: string | null
          payment_method: string
          resolution_amount?: number | null
          resolution_justification?: string | null
          resolution_payment_method?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          selected?: boolean | null
          status?: string | null
          transaction_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
          valor_bruto?: number | null
          valor_pago?: number | null
        }
        Update: {
          codigo?: string
          convenio?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          error_message?: string | null
          has_error?: boolean | null
          id?: string
          import_session_id?: string
          is_duplicate?: boolean | null
          is_nao_pago?: boolean | null
          is_particular?: boolean | null
          paciente?: string | null
          payment_method?: string
          resolution_amount?: number | null
          resolution_justification?: string | null
          resolution_payment_method?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          selected?: boolean | null
          status?: string | null
          transaction_id?: string | null
          unit_id?: string | null
          updated_at?: string | null
          valor_bruto?: number | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_staging_import_session_id_fkey"
            columns: ["import_session_id"]
            isOneToOne: false
            referencedRelation: "import_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_staging_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_staging_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
      invoices: {
        Row: {
          cnae: string | null
          competence_month: number
          competence_year: number
          created_at: string
          created_by: string | null
          customer_city: string | null
          customer_cnpj: string | null
          customer_name: string
          deductions: number | null
          description: string | null
          document_full_number: string | null
          document_number: string
          file_name: string | null
          file_path: string | null
          id: string
          iss_value: number | null
          issue_date: string
          issuer_cnpj: string | null
          issuer_name: string | null
          net_value: number
          notes: string | null
          parte_relacionada_nome: string | null
          parte_relacionada_tipo: string | null
          payer_id: string | null
          received_at: string | null
          service_code: string | null
          service_value: number
          status: string
          unit_id: string | null
          updated_at: string
          verification_code: string | null
        }
        Insert: {
          cnae?: string | null
          competence_month: number
          competence_year: number
          created_at?: string
          created_by?: string | null
          customer_city?: string | null
          customer_cnpj?: string | null
          customer_name: string
          deductions?: number | null
          description?: string | null
          document_full_number?: string | null
          document_number: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          iss_value?: number | null
          issue_date: string
          issuer_cnpj?: string | null
          issuer_name?: string | null
          net_value: number
          notes?: string | null
          parte_relacionada_nome?: string | null
          parte_relacionada_tipo?: string | null
          payer_id?: string | null
          received_at?: string | null
          service_code?: string | null
          service_value: number
          status?: string
          unit_id?: string | null
          updated_at?: string
          verification_code?: string | null
        }
        Update: {
          cnae?: string | null
          competence_month?: number
          competence_year?: number
          created_at?: string
          created_by?: string | null
          customer_city?: string | null
          customer_cnpj?: string | null
          customer_name?: string
          deductions?: number | null
          description?: string | null
          document_full_number?: string | null
          document_number?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          iss_value?: number | null
          issue_date?: string
          issuer_cnpj?: string | null
          issuer_name?: string | null
          net_value?: number
          notes?: string | null
          parte_relacionada_nome?: string | null
          parte_relacionada_tipo?: string | null
          payer_id?: string | null
          received_at?: string | null
          service_code?: string | null
          service_value?: number
          status?: string
          unit_id?: string | null
          updated_at?: string
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      lis_closure_items: {
        Row: {
          amount: number
          card_fee_percent: number | null
          card_fee_value: number | null
          cash_component: number | null
          closure_id: string | null
          comprovante_status: string | null
          convenio: string | null
          created_at: string
          date: string
          discount_approval_channel: string | null
          discount_approved_at: string | null
          discount_approved_by: string | null
          discount_percent: number | null
          discount_reason: string | null
          discount_value: number | null
          envelope_id: string | null
          gross_amount: number | null
          id: string
          justificativa: string | null
          lis_code: string
          net_amount: number | null
          patient_name: string | null
          payment_method: string
          payment_status: string
          receivable_component: number | null
          status: string
          transaction_id: string | null
          unit_id: string | null
        }
        Insert: {
          amount?: number
          card_fee_percent?: number | null
          card_fee_value?: number | null
          cash_component?: number | null
          closure_id?: string | null
          comprovante_status?: string | null
          convenio?: string | null
          created_at?: string
          date: string
          discount_approval_channel?: string | null
          discount_approved_at?: string | null
          discount_approved_by?: string | null
          discount_percent?: number | null
          discount_reason?: string | null
          discount_value?: number | null
          envelope_id?: string | null
          gross_amount?: number | null
          id?: string
          justificativa?: string | null
          lis_code: string
          net_amount?: number | null
          patient_name?: string | null
          payment_method: string
          payment_status?: string
          receivable_component?: number | null
          status?: string
          transaction_id?: string | null
          unit_id?: string | null
        }
        Update: {
          amount?: number
          card_fee_percent?: number | null
          card_fee_value?: number | null
          cash_component?: number | null
          closure_id?: string | null
          comprovante_status?: string | null
          convenio?: string | null
          created_at?: string
          date?: string
          discount_approval_channel?: string | null
          discount_approved_at?: string | null
          discount_approved_by?: string | null
          discount_percent?: number | null
          discount_reason?: string | null
          discount_value?: number | null
          envelope_id?: string | null
          gross_amount?: number | null
          id?: string
          justificativa?: string | null
          lis_code?: string
          net_amount?: number | null
          patient_name?: string | null
          payment_method?: string
          payment_status?: string
          receivable_component?: number | null
          status?: string
          transaction_id?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_lis_closure_items_envelope"
            columns: ["envelope_id"]
            isOneToOne: false
            referencedRelation: "cash_envelopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lis_closure_items_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "lis_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lis_closure_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lis_closure_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      lis_closures: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          conferencia_checkbox: boolean
          created_at: string
          created_by: string
          id: string
          itens_sem_comprovante: number
          period_end: string
          period_start: string
          status: string
          total_cartao_liquido: number
          total_dinheiro: number
          total_nao_pago: number
          total_pix: number
          total_taxa_cartao: number
          unit_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          conferencia_checkbox?: boolean
          created_at?: string
          created_by: string
          id?: string
          itens_sem_comprovante?: number
          period_end: string
          period_start: string
          status?: string
          total_cartao_liquido?: number
          total_dinheiro?: number
          total_nao_pago?: number
          total_pix?: number
          total_taxa_cartao?: number
          unit_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          conferencia_checkbox?: boolean
          created_at?: string
          created_by?: string
          id?: string
          itens_sem_comprovante?: number
          period_end?: string
          period_start?: string
          status?: string
          total_cartao_liquido?: number
          total_dinheiro?: number
          total_nao_pago?: number
          total_pix?: number
          total_taxa_cartao?: number
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lis_closures_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      lis_users: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          lis_id: number | null
          login: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          lis_id?: number | null
          login: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          lis_id?: number | null
          login?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
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
      patrimony_items: {
        Row: {
          categoria: string
          created_at: string | null
          created_by: string | null
          data_aquisicao: string | null
          data_vencimento: string | null
          descricao: string
          id: string
          observacoes: string | null
          proprietario_nome: string | null
          proprietario_tipo: string | null
          tipo: string
          unit_id: string | null
          updated_at: string | null
          valor_atual: number
          valor_original: number | null
        }
        Insert: {
          categoria: string
          created_at?: string | null
          created_by?: string | null
          data_aquisicao?: string | null
          data_vencimento?: string | null
          descricao: string
          id?: string
          observacoes?: string | null
          proprietario_nome?: string | null
          proprietario_tipo?: string | null
          tipo: string
          unit_id?: string | null
          updated_at?: string | null
          valor_atual: number
          valor_original?: number | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          created_by?: string | null
          data_aquisicao?: string | null
          data_vencimento?: string | null
          descricao?: string
          id?: string
          observacoes?: string | null
          proprietario_nome?: string | null
          proprietario_tipo?: string | null
          tipo?: string
          unit_id?: string | null
          updated_at?: string | null
          valor_atual?: number
          valor_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patrimony_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payables: {
        Row: {
          banco_codigo: string | null
          banco_nome: string | null
          beneficiario: string | null
          beneficiario_cnpj: string | null
          category_id: string | null
          codigo_barras: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_number: string | null
          file_bucket: string | null
          file_name: string | null
          file_path: string | null
          id: string
          intended_payment_method: string | null
          linha_digitavel: string | null
          matched_bank_item_id: string | null
          matched_transaction_id: string | null
          ocr_confidence: number | null
          paid_amount: number | null
          paid_at: string | null
          paid_method: string | null
          parcela_numero: number | null
          parcela_total: number | null
          parte_relacionada_nome: string | null
          parte_relacionada_tipo: string | null
          payment_bank_account_id: string | null
          pix_key: string | null
          status: string
          supplier_invoice_id: string | null
          tipo: string
          unit_id: string | null
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          banco_codigo?: string | null
          banco_nome?: string | null
          beneficiario?: string | null
          beneficiario_cnpj?: string | null
          category_id?: string | null
          codigo_barras?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number?: string | null
          file_bucket?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          intended_payment_method?: string | null
          linha_digitavel?: string | null
          matched_bank_item_id?: string | null
          matched_transaction_id?: string | null
          ocr_confidence?: number | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_method?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          parte_relacionada_nome?: string | null
          parte_relacionada_tipo?: string | null
          payment_bank_account_id?: string | null
          pix_key?: string | null
          status?: string
          supplier_invoice_id?: string | null
          tipo?: string
          unit_id?: string | null
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          banco_codigo?: string | null
          banco_nome?: string | null
          beneficiario?: string | null
          beneficiario_cnpj?: string | null
          category_id?: string | null
          codigo_barras?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number?: string | null
          file_bucket?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          intended_payment_method?: string | null
          linha_digitavel?: string | null
          matched_bank_item_id?: string | null
          matched_transaction_id?: string | null
          ocr_confidence?: number | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_method?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          parte_relacionada_nome?: string | null
          parte_relacionada_tipo?: string | null
          payment_bank_account_id?: string | null
          pix_key?: string | null
          status?: string
          supplier_invoice_id?: string | null
          tipo?: string
          unit_id?: string | null
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "payables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_matched_transaction_id_fkey"
            columns: ["matched_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_payment_bank_account_id_fkey"
            columns: ["payment_bank_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payables_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payers: {
        Row: {
          active: boolean
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_functions: {
        Row: {
          created_at: string | null
          function: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          function: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string | null
          function?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_functions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_units: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          profile_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          profile_id: string
          unit_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          profile_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_units_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string
          id: string
          is_active: boolean | null
          last_access: string | null
          lis_id: number | null
          lis_login: string | null
          must_change_password: boolean | null
          name: string
          telefone: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email: string
          id: string
          is_active?: boolean | null
          last_access?: string | null
          lis_id?: number | null
          lis_login?: string | null
          must_change_password?: boolean | null
          name: string
          telefone?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          last_access?: string | null
          lis_id?: number | null
          lis_login?: string | null
          must_change_password?: boolean | null
          name?: string
          telefone?: string | null
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
      seed_bank_statements: {
        Row: {
          account_id: string | null
          ano: number
          created_at: string | null
          created_by: string | null
          file_name: string
          file_type: string
          id: string
          imported: boolean
          imported_at: string | null
          mes: number
          storage_path: string
        }
        Insert: {
          account_id?: string | null
          ano?: number
          created_at?: string | null
          created_by?: string | null
          file_name: string
          file_type: string
          id?: string
          imported?: boolean
          imported_at?: string | null
          mes: number
          storage_path: string
        }
        Update: {
          account_id?: string | null
          ano?: number
          created_at?: string | null
          created_by?: string | null
          file_name?: string
          file_type?: string
          id?: string
          imported?: boolean
          imported_at?: string | null
          mes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "seed_bank_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      seed_initial_data: {
        Row: {
          categoria: string
          chave: string
          created_at: string | null
          created_by: string | null
          data_referencia: string | null
          id: string
          observacoes: string | null
          referencia_id: string | null
          updated_at: string | null
          updated_by: string | null
          valor: Json
        }
        Insert: {
          categoria: string
          chave: string
          created_at?: string | null
          created_by?: string | null
          data_referencia?: string | null
          id?: string
          observacoes?: string | null
          referencia_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor: Json
        }
        Update: {
          categoria?: string
          chave?: string
          created_at?: string | null
          created_by?: string | null
          data_referencia?: string | null
          id?: string
          observacoes?: string | null
          referencia_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor?: Json
        }
        Relationships: []
      }
      seed_payroll: {
        Row: {
          ano: number
          created_at: string | null
          created_by: string | null
          decimo_terceiro: number
          ferias: number
          fgts: number
          id: string
          inss_patronal: number
          mes: number
          observacoes: string | null
          prolabore: number
          salarios: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ano?: number
          created_at?: string | null
          created_by?: string | null
          decimo_terceiro?: number
          ferias?: number
          fgts?: number
          id?: string
          inss_patronal?: number
          mes: number
          observacoes?: string | null
          prolabore?: number
          salarios?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          created_by?: string | null
          decimo_terceiro?: number
          ferias?: number
          fgts?: number
          id?: string
          inss_patronal?: number
          mes?: number
          observacoes?: string | null
          prolabore?: number
          salarios?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      seed_revenue: {
        Row: {
          ano: number
          created_at: string | null
          created_by: string | null
          fonte_principal: string | null
          id: string
          mes: number
          observacoes: string | null
          receita_outras: number
          receita_servicos: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ano?: number
          created_at?: string | null
          created_by?: string | null
          fonte_principal?: string | null
          id?: string
          mes: number
          observacoes?: string | null
          receita_outras?: number
          receita_servicos?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          created_by?: string | null
          fonte_principal?: string | null
          id?: string
          mes?: number
          observacoes?: string | null
          receita_outras?: number
          receita_servicos?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      seed_taxes: {
        Row: {
          ano: number
          created_at: string | null
          created_by: string | null
          das: number
          id: string
          irrf_retido: number
          iss_proprio: number
          iss_retido: number
          mes: number
          observacoes: string | null
          outros: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ano?: number
          created_at?: string | null
          created_by?: string | null
          das?: number
          id?: string
          irrf_retido?: number
          iss_proprio?: number
          iss_retido?: number
          mes: number
          observacoes?: string | null
          outros?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          created_by?: string | null
          das?: number
          id?: string
          irrf_retido?: number
          iss_proprio?: number
          iss_retido?: number
          mes?: number
          observacoes?: string | null
          outros?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      supplier_invoices: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_number: string
          document_series: string | null
          due_date: string | null
          file_name: string | null
          file_path: string | null
          id: string
          installments_count: number | null
          issue_date: string
          ocr_confidence: number | null
          payment_conditions: string | null
          status: string
          supplier_cnpj: string | null
          supplier_name: string
          total_value: number
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number: string
          document_series?: string | null
          due_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          installments_count?: number | null
          issue_date: string
          ocr_confidence?: number | null
          payment_conditions?: string | null
          status?: string
          supplier_cnpj?: string | null
          supplier_name: string
          total_value: number
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_number?: string
          document_series?: string | null
          due_date?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          installments_count?: number | null
          issue_date?: string
          ocr_confidence?: number | null
          payment_conditions?: string | null
          status?: string
          supplier_cnpj?: string | null
          supplier_name?: string
          total_value?: number
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_unit_id_fkey"
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
          iss_municipio_incidente: string | null
          iss_responsavel_unit_id: string | null
          iss_tipo_apuracao: string | null
          iss_valor_fixo_mensal: number | null
          notas: string | null
          regime_atual: string
          unit_id: string | null
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          iss_aliquota?: number
          iss_municipio_incidente?: string | null
          iss_responsavel_unit_id?: string | null
          iss_tipo_apuracao?: string | null
          iss_valor_fixo_mensal?: number | null
          notas?: string | null
          regime_atual?: string
          unit_id?: string | null
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          iss_aliquota?: number
          iss_municipio_incidente?: string | null
          iss_responsavel_unit_id?: string | null
          iss_tipo_apuracao?: string | null
          iss_valor_fixo_mensal?: number | null
          notas?: string | null
          regime_atual?: string
          unit_id?: string | null
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_config_iss_responsavel_unit_id_fkey"
            columns: ["iss_responsavel_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
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
          bank_account_id: string | null
          card_fee_percent: number | null
          card_fee_value: number | null
          category_id: string
          competencia_ano: number | null
          competencia_mes: number | null
          created_at: string
          created_by: string
          date: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          discount_approval_channel: string | null
          discount_approved_at: string | null
          discount_approved_by: string | null
          discount_percent: number | null
          discount_reason: string | null
          discount_value: number | null
          gross_amount: number | null
          id: string
          lis_protocol_id: string | null
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
          bank_account_id?: string | null
          card_fee_percent?: number | null
          card_fee_value?: number | null
          category_id: string
          competencia_ano?: number | null
          competencia_mes?: number | null
          created_at?: string
          created_by: string
          date: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          discount_approval_channel?: string | null
          discount_approved_at?: string | null
          discount_approved_by?: string | null
          discount_percent?: number | null
          discount_reason?: string | null
          discount_value?: number | null
          gross_amount?: number | null
          id?: string
          lis_protocol_id?: string | null
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
          bank_account_id?: string | null
          card_fee_percent?: number | null
          card_fee_value?: number | null
          category_id?: string
          competencia_ano?: number | null
          competencia_mes?: number | null
          created_at?: string
          created_by?: string
          date?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          discount_approval_channel?: string | null
          discount_approved_at?: string | null
          discount_approved_by?: string | null
          discount_percent?: number | null
          discount_reason?: string | null
          discount_value?: number | null
          gross_amount?: number | null
          id?: string
          lis_protocol_id?: string | null
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
            foreignKeyName: "transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
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
          capital_social: number | null
          centraliza_tributos_federais: boolean | null
          cnpj: string | null
          code: string
          created_at: string
          data_abertura: string | null
          data_opcao_simples: string | null
          data_situacao_cadastral: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          municipio_codigo_ibge: string | null
          municipio_nome: string | null
          name: string
          natureza_juridica: string | null
          nome_fantasia: string | null
          opcao_mei: boolean | null
          opcao_simples: boolean | null
          parent_unit_id: string | null
          porte: string | null
          razao_social: string | null
          situacao_cadastral: string | null
          telefone: string | null
          tipo_unidade_receita: string | null
          uf: string | null
          unit_type: string | null
        }
        Insert: {
          capital_social?: number | null
          centraliza_tributos_federais?: boolean | null
          cnpj?: string | null
          code: string
          created_at?: string
          data_abertura?: string | null
          data_opcao_simples?: string | null
          data_situacao_cadastral?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          municipio_codigo_ibge?: string | null
          municipio_nome?: string | null
          name: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          opcao_mei?: boolean | null
          opcao_simples?: boolean | null
          parent_unit_id?: string | null
          porte?: string | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          telefone?: string | null
          tipo_unidade_receita?: string | null
          uf?: string | null
          unit_type?: string | null
        }
        Update: {
          capital_social?: number | null
          centraliza_tributos_federais?: boolean | null
          cnpj?: string | null
          code?: string
          created_at?: string
          data_abertura?: string | null
          data_opcao_simples?: string | null
          data_situacao_cadastral?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          municipio_codigo_ibge?: string | null
          municipio_nome?: string | null
          name?: string
          natureza_juridica?: string | null
          nome_fantasia?: string | null
          opcao_mei?: boolean | null
          opcao_simples?: boolean | null
          parent_unit_id?: string | null
          porte?: string | null
          razao_social?: string | null
          situacao_cadastral?: string | null
          telefone?: string | null
          tipo_unidade_receita?: string | null
          uf?: string | null
          unit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_parent_unit_id_fkey"
            columns: ["parent_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
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
      app_role:
        | "admin"
        | "secretaria"
        | "contabilidade"
        | "gestor_unidade"
        | "financeiro"
        | "contador"
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
      app_role: [
        "admin",
        "secretaria",
        "contabilidade",
        "gestor_unidade",
        "financeiro",
        "contador",
      ],
    },
  },
} as const
