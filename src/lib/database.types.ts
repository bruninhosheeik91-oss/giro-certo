export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          name: string;
          city: string | null;
          start_date: string | null;
          photo_url: string | null;
          monthly_goal: number;
          maintenance_reserve_per_km: number;
          ride_criteria_min_per_km: number;
          ride_criteria_min_per_hour: number;
          ride_criteria_min_value: number;
          ride_criteria_consider_return: boolean;
          notification_daily_goal: boolean;
          notification_maintenance: boolean;
          notification_fuel_reminder: boolean;
          notification_shift_reminders: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          name: string;
          city?: string | null;
          start_date?: string | null;
          photo_url?: string | null;
          monthly_goal?: number;
          maintenance_reserve_per_km?: number;
          ride_criteria_min_per_km?: number;
          ride_criteria_min_per_hour?: number;
          ride_criteria_min_value?: number;
          ride_criteria_consider_return?: boolean;
          notification_daily_goal?: boolean;
          notification_maintenance?: boolean;
          notification_fuel_reminder?: boolean;
          notification_shift_reminders?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      vehicles: Table<
        {
          id: string;
          user_id: string;
          nickname: string;
          type: string;
          brand: string | null;
          model: string | null;
          year: string | null;
          plate: string | null;
          current_km: number;
          odometer_baseline_km: number;
          fuel_type: string | null;
          fuel_avg_km_liter: number | null;
          ref_price_liter: number | null;
          acquisition_value: number | null;
          acquisition_date: string | null;
          notes: string | null;
          is_active: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          user_id: string;
          nickname: string;
          type: string;
          brand?: string | null;
          model?: string | null;
          year?: string | null;
          plate?: string | null;
          current_km?: number;
          odometer_baseline_km?: number;
          fuel_type?: string | null;
          fuel_avg_km_liter?: number | null;
          ref_price_liter?: number | null;
          acquisition_value?: number | null;
          acquisition_date?: string | null;
          notes?: string | null;
          is_active?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      shifts: Table<
        {
          id: string;
          user_id: string;
          vehicle_id: string | null;
          start_at: string;
          end_at: string | null;
          status: string;
          km_start: number | null;
          km_end: number | null;
          earnings_cents: number;
          expenses_cents: number;
          paused_seconds: number;
          note: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          user_id: string;
          vehicle_id?: string | null;
          start_at: string;
          end_at?: string | null;
          status?: string;
          km_start?: number | null;
          km_end?: number | null;
          earnings_cents?: number;
          expenses_cents?: number;
          paused_seconds?: number;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      shift_pauses: Table<
        {
          id: string;
          user_id: string;
          shift_id: string;
          start_at: string;
          end_at: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          user_id: string;
          shift_id: string;
          start_at: string;
          end_at?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      transactions: Table<
        {
          id: string;
          user_id: string;
          type: Database['public']['Enums']['transaction_type'];
          category: string | null;
          amount: number;
          occurred_at: string;
          description: string | null;
          vehicle_id: string | null;
          shift_id: string | null;
          installment_id: string | null;
          commitment_id: string | null;
          origin: Database['public']['Enums']['transaction_origin'];
          metadata: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          user_id: string;
          type: Database['public']['Enums']['transaction_type'];
          category?: string | null;
          amount: number;
          occurred_at: string;
          description?: string | null;
          vehicle_id?: string | null;
          shift_id?: string | null;
          installment_id?: string | null;
          commitment_id?: string | null;
          origin?: Database['public']['Enums']['transaction_origin'];
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
      commitments: Table<
        {
          id: string;
          user_id: string;
          type: Database['public']['Enums']['commitment_type'];
          title: string;
          category: string | null;
          creditor: string | null;
          installment_amount: number;
          first_due_date: string;
          total_installments: number | null;
          due_day: number;
          end_date: string | null;
          notes: string | null;
          status: Database['public']['Enums']['commitment_status'];
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          user_id: string;
          type: Database['public']['Enums']['commitment_type'];
          title: string;
          category?: string | null;
          creditor?: string | null;
          installment_amount: number;
          first_due_date: string;
          total_installments?: number | null;
          due_day: number;
          end_date?: string | null;
          notes?: string | null;
          status?: Database['public']['Enums']['commitment_status'];
          created_at?: string;
          updated_at?: string;
        }
      >;
      installments: Table<
        {
          id: string;
          commitment_id: string;
          user_id: string;
          number: number;
          reference_month: string | null;
          due_date: string;
          expected_amount: number;
          status: string;
          paid_at: string | null;
          paid_amount: number | null;
          payment_origin: string | null;
          transaction_id: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          commitment_id: string;
          user_id: string;
          number: number;
          reference_month?: string | null;
          due_date: string;
          expected_amount: number;
          status?: string;
          paid_at?: string | null;
          paid_amount?: number | null;
          payment_origin?: string | null;
          transaction_id?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      fuel_records: Table<
        {
          id: string;
          user_id: string;
          vehicle_id: string | null;
          shift_id: string | null;
          odometer_km: number | null;
          liters: number;
          price_per_liter: number;
          total: number;
          occurred_at: string;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          user_id: string;
          vehicle_id?: string | null;
          shift_id?: string | null;
          odometer_km?: number | null;
          liters: number;
          price_per_liter: number;
          total: number;
          occurred_at: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      maintenance_records: Table<
        {
          id: string;
          user_id: string;
          vehicle_id: string | null;
          date: string;
          category: Database['public']['Enums']['maintenance_category'];
          description: string | null;
          cost: number;
          odometer_km: number | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          user_id: string;
          vehicle_id?: string | null;
          date: string;
          category: Database['public']['Enums']['maintenance_category'];
          description?: string | null;
          cost: number;
          odometer_km?: number | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      maintenance_reserve_entries: Table<
        {
          id: string;
          user_id: string;
          vehicle_id: string | null;
          date: string;
          amount: number;
          entry_type: string;
          description: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          user_id: string;
          vehicle_id?: string | null;
          date: string;
          amount: number;
          entry_type?: string;
          description?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      registered_apps: Table<
        {
          id: string;
          user_id: string;
          name: string;
          color: string;
          icon: string;
          is_active: boolean;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          user_id: string;
          name: string;
          color: string;
          icon: string;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      user_settings: Table<
        {
          user_id: string;
          currency: string;
          locale: string;
          theme: string;
          backup_auto: boolean;
          selected_month: string | null;
          local_import_completed_at: string | null;
          updated_at: string;
        },
        {
          user_id: string;
          currency?: string;
          locale?: string;
          theme?: string;
          backup_auto?: boolean;
          selected_month?: string | null;
          local_import_completed_at?: string | null;
          updated_at?: string;
        }
      >;
    };
    Views: Record<never, never>;
    Functions: {
      delete_cloud_entity: {
        Args: { p_table: string; p_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      transaction_type: 'ganho' | 'abastecimento' | 'manutencao' | 'outra_despesa';
      transaction_origin: 'manual' | 'opening_balance';
      commitment_type:
        | 'conta_unica'
        | 'compra_parcelada'
        | 'financiamento_veiculo'
        | 'emprestimo'
        | 'consorcio'
        | 'conta_recorrente';
      commitment_status: 'ativo' | 'pausado' | 'cancelado' | 'concluido';
      maintenance_category:
        | 'troca_oleo'
        | 'pneu_dianteiro'
        | 'pneu_traseiro'
        | 'relacao'
        | 'freios'
        | 'filtro'
        | 'revisao'
        | 'eletrica'
        | 'motor'
        | 'suspensao'
        | 'lavagem'
        | 'acessorio'
        | 'outra';
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
