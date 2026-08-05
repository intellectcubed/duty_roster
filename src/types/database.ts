// Hand-written until you generate this from Supabase:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts

export interface Database {
  public: {
    Tables: {
      staff: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          role: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          role?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
      };
      shifts: {
        Row: {
          id: string;
          name: string;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          name: string;
          start_time: string;
          end_time: string;
        };
        Update: Partial<Database["public"]["Tables"]["shifts"]["Insert"]>;
      };
      roster_entries: {
        Row: {
          id: string;
          staff_id: string;
          shift_id: string;
          duty_date: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          shift_id: string;
          duty_date: string;
          status?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["roster_entries"]["Insert"]
        >;
      };
    };
  };
}
