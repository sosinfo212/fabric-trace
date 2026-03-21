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
      chaines: {
        Row: {
          chef_de_chaine_id: string | null
          created_at: string
          id: string
          nbr_operateur: number
          num_chaine: number
          responsable_qlty_id: string | null
          updated_at: string
        }
        Insert: {
          chef_de_chaine_id?: string | null
          created_at?: string
          id?: string
          nbr_operateur?: number
          num_chaine: number
          responsable_qlty_id?: string | null
          updated_at?: string
        }
        Update: {
          chef_de_chaine_id?: string | null
          created_at?: string
          id?: string
          nbr_operateur?: number
          num_chaine?: number
          responsable_qlty_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chaines_chef_de_chaine_id_fkey"
            columns: ["chef_de_chaine_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chaines_responsable_qlty_id_fkey"
            columns: ["responsable_qlty_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          designation: string | null
          id: string
          instruction: string | null
          instruction_logistique: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          id?: string
          instruction?: string | null
          instruction_logistique?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          id?: string
          instruction?: string | null
          instruction_logistique?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      commandes: {
        Row: {
          client_id: string | null
          created_at: string
          date_debut: string | null
          date_fin: string | null
          date_planifiee: string | null
          id: string
          instruction: string | null
          num_commande: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          date_planifiee?: string | null
          id?: string
          instruction?: string | null
          num_commande: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          date_debut?: string | null
          date_fin?: string | null
          date_planifiee?: string | null
          id?: string
          instruction?: string | null
          num_commande?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commandes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          label: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      defaut_categories: {
        Row: {
          category_name: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      defaut_list: {
        Row: {
          category_id: string
          created_at: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "defaut_list_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "defaut_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fab_orders: {
        Row: {
          chaine_id: string
          client_id: string
          comment: string | null
          comment_chaine: string | null
          created_at: string
          creation_date_of: string
          date_fabrication: string | null
          end_prod: string | null
          id: string
          instruction: string | null
          lot_set: string
          of_id: string
          order_prod: string | null
          pf_qty: number
          prod_name: string | null
          prod_ref: string | null
          product_id: string | null
          sale_order_id: string
          set_qty: number
          sf_qty: number
          statut_of: string
          tester_qty: number
          updated_at: string
        }
        Insert: {
          chaine_id: string
          client_id: string
          comment?: string | null
          comment_chaine?: string | null
          created_at?: string
          creation_date_of?: string
          date_fabrication?: string | null
          end_prod?: string | null
          id?: string
          instruction?: string | null
          lot_set?: string
          of_id: string
          order_prod?: string | null
          pf_qty?: number
          prod_name?: string | null
          prod_ref?: string | null
          product_id?: string | null
          sale_order_id: string
          set_qty?: number
          sf_qty?: number
          statut_of?: string
          tester_qty?: number
          updated_at?: string
        }
        Update: {
          chaine_id?: string
          client_id?: string
          comment?: string | null
          comment_chaine?: string | null
          created_at?: string
          creation_date_of?: string
          date_fabrication?: string | null
          end_prod?: string | null
          id?: string
          instruction?: string | null
          lot_set?: string
          of_id?: string
          order_prod?: string | null
          pf_qty?: number
          prod_name?: string | null
          prod_ref?: string | null
          product_id?: string | null
          sale_order_id?: string
          set_qty?: number
          sf_qty?: number
          statut_of?: string
          tester_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fab_orders_chaine_id_fkey"
            columns: ["chaine_id"]
            isOneToOne: false
            referencedRelation: "chaines"
            referencedColumns: ["id"]
          },
        ]
      }
      product_components: {
        Row: {
          component_code: string | null
          component_name: string | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          component_code?: string | null
          component_name?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          component_code?: string | null
          component_name?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          product_name: string
          ref_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          product_name: string
          ref_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          product_name?: string
          ref_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          id: string
          menu_path: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          id?: string
          menu_path: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          id?: string
          menu_path?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
        | "planificatrice"
        | "responsable_magasin_pf"
        | "controle"
        | "chef_de_chaine"
        | "agent_qualite"
        | "chef_equipe_serigraphie"
        | "responsable_magasin"
        | "chef_equipe_injection"
        | "chef_equipe_pf"
        | "agent_logistique"
        | "agent_magasin"
        | "responsable_transport"
        | "operator"
        | "chef_chaine"
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
        "planificatrice",
        "responsable_magasin_pf",
        "controle",
        "chef_de_chaine",
        "agent_qualite",
        "chef_equipe_serigraphie",
        "responsable_magasin",
        "chef_equipe_injection",
        "chef_equipe_pf",
        "agent_logistique",
        "agent_magasin",
        "responsable_transport",
        "operator",
        "chef_chaine",
      ],
    },
  },
} as const
