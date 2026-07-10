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
      account_access: {
        Row: {
          created_at: string
          paused_at: string | null
          reason: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          updated_by: string | null
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          paused_at?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          paused_at?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          acao: string
          actor_id: string | null
          created_at: string
          entidade: string | null
          entidade_id: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          acao: string
          actor_id?: string | null
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          acao?: string
          actor_id?: string | null
          created_at?: string
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          cnpj: string
          created_at: string
          criada_por: string | null
          id: string
          nome_fantasia: string | null
          razao_social: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          criada_por?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          criada_por?: string | null
          id?: string
          nome_fantasia?: string | null
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      fipe_brands: {
        Row: {
          codigo: string
          created_at: string
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["fipe_vehicle_type"]
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["fipe_vehicle_type"]
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["fipe_vehicle_type"]
          updated_at?: string
        }
        Relationships: []
      }
      fipe_models: {
        Row: {
          brand_id: string
          codigo: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          codigo: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fipe_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "fipe_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      fipe_sync_log: {
        Row: {
          brands_count: number | null
          error: string | null
          finished_at: string | null
          id: string
          models_count: number | null
          notes: string | null
          started_at: string
          status: string
          tipo: Database["public"]["Enums"]["fipe_vehicle_type"] | null
          years_count: number | null
        }
        Insert: {
          brands_count?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          models_count?: number | null
          notes?: string | null
          started_at?: string
          status?: string
          tipo?: Database["public"]["Enums"]["fipe_vehicle_type"] | null
          years_count?: number | null
        }
        Update: {
          brands_count?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          models_count?: number | null
          notes?: string | null
          started_at?: string
          status?: string
          tipo?: Database["public"]["Enums"]["fipe_vehicle_type"] | null
          years_count?: number | null
        }
        Relationships: []
      }
      fipe_years: {
        Row: {
          codigo: string
          combustivel: string | null
          created_at: string
          id: string
          model_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          codigo: string
          combustivel?: string | null
          created_at?: string
          id?: string
          model_id: string
          nome: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          combustivel?: string | null
          created_at?: string
          id?: string
          model_id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fipe_years_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "fipe_models"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          unit_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          token?: string
          unit_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          unit_id: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          unit_id: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      os_items: {
        Row: {
          created_at: string
          desconto: number
          descricao: string
          id: string
          os_id: string
          preco_unitario: number
          quantidade: number
          referencia_id: string | null
          subtotal: number
          tipo: Database["public"]["Enums"]["os_item_type"]
          unit_id: string
        }
        Insert: {
          created_at?: string
          desconto?: number
          descricao: string
          id?: string
          os_id: string
          preco_unitario?: number
          quantidade?: number
          referencia_id?: string | null
          subtotal?: number
          tipo: Database["public"]["Enums"]["os_item_type"]
          unit_id: string
        }
        Update: {
          created_at?: string
          desconto?: number
          descricao?: string
          id?: string
          os_id?: string
          preco_unitario?: number
          quantidade?: number
          referencia_id?: string | null
          subtotal?: number
          tipo?: Database["public"]["Enums"]["os_item_type"]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_items_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      os_payments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metodo: Database["public"]["Enums"]["payment_method"]
          observacao: string | null
          os_id: string
          pago_em: string
          unit_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metodo: Database["public"]["Enums"]["payment_method"]
          observacao?: string | null
          os_id: string
          pago_em?: string
          unit_id: string
          valor: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["payment_method"]
          observacao?: string | null
          os_id?: string
          pago_em?: string
          unit_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_payments_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      part_batches: {
        Row: {
          created_at: string
          fornecedor: string | null
          id: string
          lote: string | null
          part_id: string
          preco_custo: number | null
          preco_venda: number | null
          quantidade: number
          unit_id: string
          validade: string | null
        }
        Insert: {
          created_at?: string
          fornecedor?: string | null
          id?: string
          lote?: string | null
          part_id: string
          preco_custo?: number | null
          preco_venda?: number | null
          quantidade?: number
          unit_id: string
          validade?: string | null
        }
        Update: {
          created_at?: string
          fornecedor?: string | null
          id?: string
          lote?: string | null
          part_id?: string
          preco_custo?: number | null
          preco_venda?: number | null
          quantidade?: number
          unit_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_batches_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_batches_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          preco_venda_padrao: number | null
          sku: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          preco_venda_padrao?: number | null
          sku?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          preco_venda_padrao?: number | null
          sku?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          data_abertura: string
          data_conclusao: string | null
          diagnostico: string | null
          id: string
          km_entrada: number | null
          mecanico_id: string | null
          numero: number
          observacoes_cliente: string | null
          observacoes_internas: string | null
          status: Database["public"]["Enums"]["os_status"]
          total: number
          unit_id: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          data_abertura?: string
          data_conclusao?: string | null
          diagnostico?: string | null
          id?: string
          km_entrada?: number | null
          mecanico_id?: string | null
          numero: number
          observacoes_cliente?: string | null
          observacoes_internas?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          total?: number
          unit_id: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          data_abertura?: string
          data_conclusao?: string | null
          diagnostico?: string | null
          id?: string
          km_entrada?: number | null
          mecanico_id?: string | null
          numero?: number
          observacoes_cliente?: string | null
          observacoes_internas?: string | null
          status?: Database["public"]["Enums"]["os_status"]
          total?: number
          unit_id?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      services_catalog: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          preco_padrao: number
          tempo_estimado_min: number | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          preco_padrao?: number
          tempo_estimado_min?: number | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          preco_padrao?: number
          tempo_estimado_min?: number | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_catalog_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          ativa: boolean
          cep: string | null
          cidade: string | null
          company_id: string
          created_at: string
          endereco: string | null
          id: string
          nome: string
          os_seq: number
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          cep?: string | null
          cidade?: string | null
          company_id: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          os_seq?: number
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          cep?: string | null
          cidade?: string | null
          company_id?: string
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          os_seq?: number
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          ano: number | null
          chassi: string | null
          cor: string | null
          created_at: string
          customer_id: string
          id: string
          km_atual: number | null
          marca: string | null
          modelo: string | null
          observacoes: string | null
          placa: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          ano?: number | null
          chassi?: string | null
          cor?: string | null
          created_at?: string
          customer_id: string
          id?: string
          km_atual?: number | null
          marca?: string | null
          modelo?: string | null
          observacoes?: string | null
          placa?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          ano?: number | null
          chassi?: string | null
          cor?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          km_atual?: number | null
          marca?: string | null
          modelo?: string | null
          observacoes?: string | null
          placa?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      access_active: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: {
        Args: { _unit_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_unit_admin: {
        Args: { _unit_id: string; _user_id: string }
        Returns: boolean
      }
      next_os_number: { Args: { _unit: string }; Returns: number }
    }
    Enums: {
      account_status: "pending" | "approved" | "rejected" | "paused" | "expired"
      app_role:
        | "super_admin"
        | "oficina_admin"
        | "mecanico"
        | "recepcionista"
        | "financeiro"
      fipe_vehicle_type: "cars" | "motorcycles" | "trucks"
      os_item_type: "servico" | "peca" | "descricao_livre"
      os_status:
        | "aberta"
        | "em_andamento"
        | "aguardando_peca"
        | "aguardando_aprovacao"
        | "concluida"
        | "cancelada"
      payment_method:
        | "dinheiro"
        | "pix"
        | "credito"
        | "debito"
        | "boleto"
        | "transferencia"
        | "outro"
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
      account_status: ["pending", "approved", "rejected", "paused", "expired"],
      app_role: [
        "super_admin",
        "oficina_admin",
        "mecanico",
        "recepcionista",
        "financeiro",
      ],
      fipe_vehicle_type: ["cars", "motorcycles", "trucks"],
      os_item_type: ["servico", "peca", "descricao_livre"],
      os_status: [
        "aberta",
        "em_andamento",
        "aguardando_peca",
        "aguardando_aprovacao",
        "concluida",
        "cancelada",
      ],
      payment_method: [
        "dinheiro",
        "pix",
        "credito",
        "debito",
        "boleto",
        "transferencia",
        "outro",
      ],
    },
  },
} as const
