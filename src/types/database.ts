// Hand-written to match supabase/migrations/000{1,2}_*.sql, since migrations
// are applied manually via the Supabase SQL editor rather than the linked
// CLI. Keep this in sync with each new migration.
//
// To switch to real codegen later (once you're willing to run `supabase
// login` + `supabase link`):
//   npx supabase gen types typescript --linked > src/types/database.ts

export type UserRole = "SUPER_ADMIN" | "USER";
export type UserStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DutyStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type HalfDaySession = "AM" | "PM";
export type SpecialLeaveApplicationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";
/** One element of the p_days array sent to set_leave_log_days. */
export type LeaveDayAllocation = {
  date: string;
  leave_type_id: string;
  fraction: number;
};
export type HolidayScope = "GLOBAL" | "PROFILE" | "USER";
export type TimeFormat = "12h" | "24h";
export type OfficerTimelineEventType =
  | "JOINING"
  | "TRAINING"
  | "POSTING"
  | "TRANSFER"
  | "PROMOTION"
  | "SPECIAL_DUTY"
  | "ACHIEVEMENT"
  | "OTHER";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          name: string;
          code: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
        Relationships: [];
      };
      duty_types: {
        Row: {
          id: string;
          profile_id: string;
          name: string;
          code: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          name: string;
          code: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["duty_types"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          profile_id: string | null;
          department_id: string | null;
          role: UserRole;
          status: UserStatus;
          full_name: string;
          employee_code: string | null;
          phone: string | null;
          time_format: TimeFormat;
          designation: string | null;
          avatar_url: string | null;
          joining_date: string | null;
          joining_place: string | null;
          current_posting: string | null;
          date_of_birth: string | null;
          blood_group: string | null;
          emergency_contact: string | null;
          home_district: string | null;
          bio: string | null;
          created_at: string;
          approved_by: string | null;
          approved_at: string | null;
        };
        // Rows are created only by the handle_new_auth_user trigger — RLS
        // has no INSERT policy on this table, so a client-side insert is
        // rejected at the database layer regardless of what TS allows here.
        Insert: Database["public"]["Tables"]["users"]["Row"];
        Update: Partial<{
          role: UserRole;
          status: UserStatus;
          approved_by: string | null;
          approved_at: string | null;
          full_name: string;
          phone: string | null;
          department_id: string | null;
          time_format: TimeFormat;
          designation: string | null;
          avatar_url: string | null;
          employee_code: string | null;
          joining_date: string | null;
          joining_place: string | null;
          current_posting: string | null;
          date_of_birth: string | null;
          blood_group: string | null;
          emergency_contact: string | null;
          home_district: string | null;
          bio: string | null;
        }>;
        Relationships: [];
      };
      permissions: {
        Row: {
          id: string;
          code: string;
          category: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          category: string;
          description?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["permissions"]["Insert"]>;
        Relationships: [];
      };
      user_permissions: {
        Row: {
          user_id: string;
          permission_id: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: {
          user_id: string;
          permission_id: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_permissions"]["Insert"]
        >;
        Relationships: [];
      };
      duties: {
        Row: {
          id: string;
          user_id: string;
          duty_type_id: string;
          starts_at: string;
          ends_at: string;
          location: string | null;
          notes: string | null;
          status: DutyStatus;
          ta_from_place: string | null;
          ta_to_place: string | null;
          ta_distance_km: number | null;
          ta_amount: number | null;
          ta_vehicle_type?: string | null;
          // Holiday state. `is_holiday` classifies the DATE; `is_holiday_duty`
          // means the officer actually worked it (and has not cancelled it).
          // Both are derived server-side and must never be set from a form.
          is_holiday: boolean;
          is_holiday_duty: boolean;
          // Claiming holiday pay on a day the calendar does NOT call a
          // holiday. Meaningless — and rejected by a check constraint — when
          // is_holiday is true.
          manual_holiday_claim: boolean;
          holiday_allowance: number;
          // Shared by the per-day rows of one multi-day submission. Non-null
          // even for a single-day duty, so no query needs null-handling.
          duty_group_id: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          duty_type_id: string;
          starts_at: string;
          ends_at: string;
          location?: string | null;
          notes?: string | null;
          status?: DutyStatus;
          ta_from_place?: string | null;
          ta_to_place?: string | null;
          ta_distance_km?: number | null;
          ta_amount?: number | null;
          ta_vehicle_type?: string | null;
          is_holiday?: boolean;
          is_holiday_duty?: boolean;
          manual_holiday_claim?: boolean;
          holiday_allowance?: number;
          duty_group_id?: string;
          created_by: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["duties"]["Insert"]>;
        Relationships: [];
      };
      leave_types: {
        Row: {
          id: string;
          // null = an admin/global type, available to every officer.
          profile_id: string | null;
          // null = global; set = a personal type, visible to that officer only.
          user_id: string | null;
          name: string;
          code: string;
          is_active: boolean;
          /** Calendar colour, `#rrggbb`. */
          color: string;
          /**
           * Owned by the application, not by an admin or an officer. The
           * Holiday Leave type (code "HL") is wired into the duty rules, so
           * renaming, deleting or deactivating it would break them silently —
           * the RLS write policies exclude these rows.
           */
          is_system: boolean;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          user_id?: string | null;
          name: string;
          code: string;
          is_active?: boolean;
          color?: string;
          is_system?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["leave_types"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          /** Extra pay for one worked holiday. 0 means "not configured". */
          holiday_day_rate: number;
          /** Daily salary rate used for unpaid leave (Binpagari Leave / LWP) salary deduction calculations. */
          daily_salary_rate: number;
          /** `HH:MM:SS` — pre-fills the duty form. */
          default_shift_start: string;
          default_shift_end: string;
          print_recipient_title: string | null;
          print_station_name: string | null;
          print_signatory_name: string | null;
          print_default_vehicle: string | null;
          print_use_gujarati_digits: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          holiday_day_rate?: number;
          daily_salary_rate?: number;
          default_shift_start?: string;
          default_shift_end?: string;
          print_recipient_title?: string | null;
          print_station_name?: string | null;
          print_signatory_name?: string | null;
          print_default_vehicle?: string | null;
          print_use_gujarati_digits?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
        Relationships: [];
      };
      user_leave_balances: {
        Row: {
          user_id: string;
          leave_type_id: string;
          year: number;
          allocated: number;
          /**
           * A hand-entered carried-in figure for this year only (see 0028).
           * null = use the computed carry; 0 = a deliberate "nothing carried".
           */
          carried_override: number | null;
        };
        Insert: {
          user_id: string;
          leave_type_id: string;
          year: number;
          allocated?: number;
          carried_override?: number | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_leave_balances"]["Insert"]
        >;
        Relationships: [];
      };
      /** See 0028_leave_carry_forward.sql. Per officer + type, NOT per year. */
      user_leave_carry_rules: {
        Row: {
          user_id: string;
          leave_type_id: string;
          carry_forward: boolean;
          /**
           * Maximum accumulated balance for a year: allocation + carried-in
           * cannot exceed this. null = no maximum (NOT "cap at the grant").
           */
          max_accumulated: number | null;
        };
        Insert: {
          user_id: string;
          leave_type_id: string;
          carry_forward?: boolean;
          max_accumulated?: number | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_leave_carry_rules"]["Insert"]
        >;
        Relationships: [];
      };
      user_disabled_leave_types: {
        Row: {
          user_id: string;
          leave_type_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          leave_type_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_disabled_leave_types"]["Insert"]
        >;
        Relationships: [];
      };
      special_leave_applications: {
        Row: {
          id: string;
          user_id: string;
          leave_type_id: string;
          year: number;
          applied_date: string;
          applied_days: number;
          reason: string | null;
          status: SpecialLeaveApplicationStatus;
          approved_date: string | null;
          approved_by: string | null;
          approved_days: number | null;
          order_no: string | null;
          valid_from: string | null;
          valid_to: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          leave_type_id?: string;
          year: number;
          applied_date: string;
          applied_days: number;
          reason?: string | null;
          status?: SpecialLeaveApplicationStatus;
          approved_date?: string | null;
          approved_by?: string | null;
          approved_days?: number | null;
          order_no?: string | null;
          valid_from?: string | null;
          valid_to?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["special_leave_applications"]["Insert"]
        >;
        Relationships: [];
      };
      leave_logs: {
        Row: {
          id: string;
          user_id: string;
          leave_type_id: string;
          start_date: string;
          end_date: string;
          is_half_day: boolean;
          half_day_session: HalfDaySession | null;
          reason: string | null;
          special_leave_application_id: string | null;
          created_at: string;
        };
        // Created via the log_leave() RPC (which enforces the half-day-aware
        // overlap rule); RLS also permits a plain own-row insert.
        Insert: Database["public"]["Tables"]["leave_logs"]["Row"];
        Update: Partial<{
          leave_type_id: string;
          start_date: string;
          end_date: string;
          is_half_day: boolean;
          half_day_session: HalfDaySession | null;
          reason: string | null;
          special_leave_application_id: string | null;
        }>;
        Relationships: [];
      };
      /**
       * Which leave type each day of a leave_logs row is charged to (0036).
       * One log can span CL, HL and OH days; balances sum these rows.
       * Written only through set_leave_log_days / log_leave_with_days.
       */
      leave_log_days: {
        Row: {
          id: string;
          leave_log_id: string;
          user_id: string;
          leave_date: string;
          leave_type_id: string;
          fraction: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          leave_log_id: string;
          user_id: string;
          leave_date: string;
          leave_type_id: string;
          fraction?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leave_log_days"]["Insert"]>;
        Relationships: [];
      };
      holidays: {
        Row: {
          id: string;
          name: string;
          holiday_date: string;
          scope: HolidayScope;
          profile_id: string | null;
          user_id: string | null;
          is_government: boolean;
          is_recurring_yearly: boolean;
          is_optional: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          holiday_date: string;
          scope: HolidayScope;
          profile_id?: string | null;
          user_id?: string | null;
          is_government?: boolean;
          is_recurring_yearly?: boolean;
          is_optional?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["holidays"]["Insert"]>;
        Relationships: [];
      };
      file_attachments: {
        Row: {
          id: string;
          bucket_path: string;
          related_entity_type: string;
          related_entity_id: string | null;
          uploaded_by: string | null;
          original_filename: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          bucket_path: string;
          related_entity_type: string;
          related_entity_id?: string | null;
          uploaded_by?: string | null;
          original_filename: string;
          mime_type: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["file_attachments"]["Insert"]
        >;
        Relationships: [];
      };
      officer_timeline: {
        Row: {
          id: string;
          user_id: string;
          event_type: OfficerTimelineEventType;
          title: string;
          designation: string | null;
          department: string | null;
          location: string | null;
          from_location: string | null;
          to_location: string | null;
          start_date: string;
          end_date: string | null;
          is_current: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: OfficerTimelineEventType;
          title: string;
          designation?: string | null;
          department?: string | null;
          location?: string | null;
          from_location?: string | null;
          to_location?: string | null;
          start_date: string;
          end_date?: string | null;
          is_current?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["officer_timeline"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: {
      leave_balance_view: {
        Row: {
          user_id: string;
          leave_type_id: string;
          year: number;
          /** This year's grant alone, before anything carried in. */
          allocated: number;
          /**
           * Whether an allocation row actually exists, as opposed to
           * `allocated` defaulting to 0. The dashboard's "set this year's
           * allowance" prompt keys off this — see 0028.
           */
          allocation_exists: boolean;
          carried_in: number;
          total_before_cap: number;
          total_available: number;
          max_accumulated: number | null;
          carry_forward: boolean;
          /** Days the maximum swallowed, so the UI can say they were lost. */
          capped_away: number;
          used: number;
          /** total_available - used. Includes carried days; may be negative. */
          remaining: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      /**
       * The dates that count as holidays for one officer in one year:
       * Sundays, 2nd/4th Saturdays, and any `holidays` row visible to them.
       * Distinct, so a festival on a Sunday counts once. See 0026.
       */
      holiday_dates_for_year: {
        Args: { p_year: number; p_user_id: string };
        Returns: string[];
      };
      /** How many of the above there are — the Holiday Leave allocation. */
      holiday_count_for_year: {
        Args: { p_year: number; p_user_id: string };
        Returns: number;
      };
      is_super_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_permission: {
        Args: { perm_code: string };
        Returns: boolean;
      };
      is_approved: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      update_own_profile_info: {
        Args: {
          p_full_name: string | null;
          p_phone: string | null;
          p_department_id: string | null;
          p_time_format: TimeFormat | null;
        };
        Returns: Database["public"]["Tables"]["users"]["Row"];
      };
      /** Replaces a log's per-day allocation. Own logs only. See 0036. */
      set_leave_log_days: {
        Args: { p_leave_log_id: string; p_days: LeaveDayAllocation[] };
        Returns: undefined;
      };
      /** log_leave() and its day rows in one transaction. See 0036. */
      log_leave_with_days: {
        Args: {
          p_leave_type_id: string;
          p_start_date: string;
          p_end_date: string;
          p_is_half_day: boolean;
          p_half_day_session: string | null;
          p_reason: string | null;
          p_days: LeaveDayAllocation[];
          p_special_leave_application_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["leave_logs"]["Row"];
      };
      log_leave: {
        Args: {
          p_leave_type_id: string;
          p_start_date: string;
          p_end_date: string;
          p_is_half_day: boolean;
          p_half_day_session: HalfDaySession | null;
          p_reason: string | null;
          p_special_leave_application_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["leave_logs"]["Row"];
      };
      create_or_get_department: {
        Args: {
          p_name: string;
        };
        Returns: {
          id: string;
          name: string;
          code: string;
          is_new: boolean;
        };
      };
      update_own_officer_profile: {
        Args: {
          p_full_name: string | null;
          p_phone: string | null;
          p_department_id: string | null;
          p_designation: string | null;
          p_employee_code: string | null;
          p_joining_date: string | null;
          p_joining_place: string | null;
          p_current_posting: string | null;
          p_date_of_birth: string | null;
          p_blood_group: string | null;
          p_emergency_contact: string | null;
          p_home_district: string | null;
          p_bio: string | null;
        };
        Returns: Database["public"]["Tables"]["users"]["Row"];
      };
      update_own_avatar: {
        Args: {
          p_avatar_url: string | null;
        };
        Returns: Database["public"]["Tables"]["users"]["Row"];
      };
    };
    Enums: {
      user_role: UserRole;
      user_status: UserStatus;
      duty_status: DutyStatus;
      holiday_scope: HolidayScope;
    };
    CompositeTypes: Record<string, never>;
  };
};
