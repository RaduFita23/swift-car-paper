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
      contracts: {
        Row: {
          generated_at: string
          id: string
          pdf_path: string
          transaction_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          pdf_path: string
          transaction_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          pdf_path?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          id: string
          ocr_data: Json | null
          storage_path: string
          transaction_id: string | null
          type: Database["public"]["Enums"]["document_type"]
          uploaded_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          id?: string
          ocr_data?: Json | null
          storage_path: string
          transaction_id?: string | null
          type: Database["public"]["Enums"]["document_type"]
          uploaded_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          id?: string
          ocr_data?: Json | null
          storage_path?: string
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          adresa: string | null
          cnp: string | null
          created_at: string
          cui: string | null
          data_nasterii: string | null
          denumire_firma: string | null
          email: string | null
          id: string
          nr_reg_com: string | null
          numar_buletin: string | null
          nume: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          prenume: string | null
          reprezentant: string | null
          serie_buletin: string | null
          telefon: string | null
          updated_at: string
        }
        Insert: {
          adresa?: string | null
          cnp?: string | null
          created_at?: string
          cui?: string | null
          data_nasterii?: string | null
          denumire_firma?: string | null
          email?: string | null
          id: string
          nr_reg_com?: string | null
          numar_buletin?: string | null
          nume?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          prenume?: string | null
          reprezentant?: string | null
          serie_buletin?: string | null
          telefon?: string | null
          updated_at?: string
        }
        Update: {
          adresa?: string | null
          cnp?: string | null
          created_at?: string
          cui?: string | null
          data_nasterii?: string | null
          denumire_firma?: string | null
          email?: string | null
          id?: string
          nr_reg_com?: string | null
          numar_buletin?: string | null
          nume?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          prenume?: string | null
          reprezentant?: string | null
          serie_buletin?: string | null
          telefon?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          buyer_id: string | null
          buyer_snapshot: Json | null
          created_at: string
          currency: string | null
          id: string
          notes: string | null
          price: number | null
          seller_id: string
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          buyer_id?: string | null
          buyer_snapshot?: Json | null
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          seller_id: string
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          buyer_id?: string | null
          buyer_snapshot?: Json | null
          created_at?: string
          currency?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          seller_id?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
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
      vehicles: {
        Row: {
          an: number | null
          capacitate_cilindrica: number | null
          created_at: string
          culoare: string | null
          id: string
          itp_expira_la: string | null
          km: number | null
          marca: string
          model: string
          nr_inmatriculare: string | null
          owner_id: string
          serie_civ: string | null
          vin: string | null
        }
        Insert: {
          an?: number | null
          capacitate_cilindrica?: number | null
          created_at?: string
          culoare?: string | null
          id?: string
          itp_expira_la?: string | null
          km?: number | null
          marca: string
          model: string
          nr_inmatriculare?: string | null
          owner_id: string
          serie_civ?: string | null
          vin?: string | null
        }
        Update: {
          an?: number | null
          capacitate_cilindrica?: number | null
          created_at?: string
          culoare?: string | null
          id?: string
          itp_expira_la?: string | null
          km?: number | null
          marca?: string
          model?: string
          nr_inmatriculare?: string | null
          owner_id?: string
          serie_civ?: string | null
          vin?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      document_type:
        | "buletin"
        | "cerere_inmatriculare"
        | "contract_vc"
        | "rca"
        | "plata_certificat"
        | "civ"
        | "talon"
        | "itp"
      person_type: "fizica" | "juridica"
      transaction_status: "draft" | "docs_pending" | "ready" | "signed"
      transaction_type: "pf_pf" | "pf_pj" | "pj_pf" | "pj_pj"
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
      app_role: ["admin", "user"],
      document_type: [
        "buletin",
        "cerere_inmatriculare",
        "contract_vc",
        "rca",
        "plata_certificat",
        "civ",
        "talon",
        "itp",
      ],
      person_type: ["fizica", "juridica"],
      transaction_status: ["draft", "docs_pending", "ready", "signed"],
      transaction_type: ["pf_pf", "pf_pj", "pj_pf", "pj_pj"],
    },
  },
} as const
