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
      changelog: {
        Row: {
          created_at: string
          id: string
          prompt_number: number
          sub_tasks: Json
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          prompt_number: number
          sub_tasks?: Json
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          prompt_number?: number
          sub_tasks?: Json
          title?: string
        }
        Relationships: []
      }
      chapter_resources: {
        Row: {
          chapter_id: string
          course_id: string
          file_name: string
          file_type: Database["public"]["Enums"]["file_type"]
          file_url: string
          id: string
          uploaded_at: string
        }
        Insert: {
          chapter_id: string
          course_id: string
          file_name: string
          file_type?: Database["public"]["Enums"]["file_type"]
          file_url: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          chapter_id?: string
          course_id?: string
          file_name?: string
          file_type?: Database["public"]["Enums"]["file_type"]
          file_url?: string
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_resources_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_resources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          chapter_name: string
          chapter_number: number
          course_id: string
          created_at: string
          id: string
        }
        Insert: {
          chapter_name: string
          chapter_number: number
          course_id: string
          created_at?: string
          id?: string
        }
        Update: {
          chapter_name?: string
          chapter_number?: number
          course_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          course_name: string
          created_at: string
          id: string
          slug: string
        }
        Insert: {
          course_name: string
          created_at?: string
          id?: string
          slug: string
        }
        Update: {
          course_name?: string
          created_at?: string
          id?: string
          slug?: string
        }
        Relationships: []
      }
      emails: {
        Row: {
          ai_refined_body: string | null
          ai_strategy_notes: string | null
          audience: string
          course_tags: string[] | null
          created_at: string
          email_type: string
          final_draft: string | null
          giving: string
          hoping_to_receive: string
          id: string
          is_series: boolean | null
          journal_body: string
          local_flavor: string
          max_refinements: number
          purpose: string
          refinement_count: number
          refinement_history: Json | null
          semester: string
          send_date: string | null
          send_day: string | null
          send_time: string | null
          send_week: number | null
          sent_at: string | null
          series_name: string | null
          series_order: number | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_refined_body?: string | null
          ai_strategy_notes?: string | null
          audience?: string
          course_tags?: string[] | null
          created_at?: string
          email_type?: string
          final_draft?: string | null
          giving?: string
          hoping_to_receive?: string
          id?: string
          is_series?: boolean | null
          journal_body?: string
          local_flavor?: string
          max_refinements?: number
          purpose?: string
          refinement_count?: number
          refinement_history?: Json | null
          semester?: string
          send_date?: string | null
          send_day?: string | null
          send_time?: string | null
          send_week?: number | null
          sent_at?: string | null
          series_name?: string | null
          series_order?: number | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_refined_body?: string | null
          ai_strategy_notes?: string | null
          audience?: string
          course_tags?: string[] | null
          created_at?: string
          email_type?: string
          final_draft?: string | null
          giving?: string
          hoping_to_receive?: string
          id?: string
          is_series?: boolean | null
          journal_body?: string
          local_flavor?: string
          max_refinements?: number
          purpose?: string
          refinement_count?: number
          refinement_history?: Json | null
          semester?: string
          send_date?: string | null
          send_day?: string | null
          send_time?: string | null
          send_week?: number | null
          sent_at?: string | null
          series_name?: string | null
          series_order?: number | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          actual_minutes: number | null
          completed_at: string | null
          created_at: string
          domain: string
          duration_minutes: number
          focus_area: string
          focus_detail: string | null
          id: string
          intention: string
          lesson_id: string | null
          notes: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          domain?: string
          duration_minutes?: number
          focus_area: string
          focus_detail?: string | null
          id?: string
          intention?: string
          lesson_id?: string | null
          notes?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          completed_at?: string | null
          created_at?: string
          domain?: string
          duration_minutes?: number
          focus_area?: string
          focus_detail?: string | null
          id?: string
          intention?: string
          lesson_id?: string | null
          notes?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sheets: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          sheet_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          sheet_url: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          sheet_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_sheets_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          created_at: string
          generated_lesson_plan: string | null
          generated_problem_list: string | null
          generated_video_outline: string | null
          id: string
          lesson_id: string
          questionnaire_answers: Json
          refinement_history: Json | null
        }
        Insert: {
          created_at?: string
          generated_lesson_plan?: string | null
          generated_problem_list?: string | null
          generated_video_outline?: string | null
          id?: string
          lesson_id: string
          questionnaire_answers?: Json
          refinement_history?: Json | null
        }
        Update: {
          created_at?: string
          generated_lesson_plan?: string | null
          generated_problem_list?: string | null
          generated_video_outline?: string | null
          id?: string
          lesson_id?: string
          questionnaire_answers?: Json
          refinement_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_id: string
          course_id: string
          created_at: string
          id: string
          lesson_status: Database["public"]["Enums"]["lesson_status"]
          lesson_title: string
        }
        Insert: {
          chapter_id: string
          course_id: string
          created_at?: string
          id?: string
          lesson_status?: Database["public"]["Enums"]["lesson_status"]
          lesson_title: string
        }
        Update: {
          chapter_id?: string
          course_id?: string
          created_at?: string
          id?: string
          lesson_status?: Database["public"]["Enums"]["lesson_status"]
          lesson_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      music_links: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
          youtube_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          user_id: string
          youtube_url: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
          youtube_url?: string
        }
        Relationships: []
      }
      roadmap_items: {
        Row: {
          category: string
          completed_at: string | null
          created_at: string
          description: string | null
          domain: string
          id: string
          priority: string
          status: string
          target_semester: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          priority?: string
          status?: string
          target_semester?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          priority?: string
          status?: string
          target_semester?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sprint_activity_log: {
        Row: {
          action_detail: string | null
          action_type: string
          created_at: string
          id: string
          lesson_id: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          action_detail?: string | null
          action_type: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          action_detail?: string | null
          action_type?: string
          created_at?: string
          id?: string
          lesson_id?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_activity_log_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_activity_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "focus_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      story_ideas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      story_uploads: {
        Row: {
          file_name: string
          file_url: string
          id: string
          story_idea_id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          file_name: string
          file_url: string
          id?: string
          story_idea_id: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          file_name?: string
          file_url?: string
          id?: string
          story_idea_id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_uploads_story_idea_id_fkey"
            columns: ["story_idea_id"]
            isOneToOne: false
            referencedRelation: "story_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          location: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          email_max_refinements: number | null
          email_style_guide: string | null
          email_types: string[] | null
          id: string
          semester_end_date: string | null
          semester_start_date: string | null
          semesters: string[] | null
          style_guide: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_max_refinements?: number | null
          email_style_guide?: string | null
          email_types?: string[] | null
          id?: string
          semester_end_date?: string | null
          semester_start_date?: string | null
          semesters?: string[] | null
          style_guide?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_max_refinements?: number | null
          email_style_guide?: string | null
          email_types?: string[] | null
          id?: string
          semester_end_date?: string | null
          semester_start_date?: string | null
          semesters?: string[] | null
          style_guide?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vlog_episodes: {
        Row: {
          created_at: string
          description: string | null
          episode_number: number
          id: string
          season_id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          episode_number: number
          id?: string
          season_id: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          episode_number?: number
          id?: string
          season_id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vlog_episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "vlog_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      vlog_seasons: {
        Row: {
          created_at: string
          description: string | null
          id: string
          season_number: number
          series_name: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          season_number: number
          series_name?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          season_number?: number
          series_name?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      file_type: "textbook" | "solutions" | "tutoring" | "transcript" | "other"
      lesson_status:
        | "Planning"
        | "Sheet Generated"
        | "Filming"
        | "Editing"
        | "Published"
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
      file_type: ["textbook", "solutions", "tutoring", "transcript", "other"],
      lesson_status: [
        "Planning",
        "Sheet Generated",
        "Filming",
        "Editing",
        "Published",
      ],
    },
  },
} as const
