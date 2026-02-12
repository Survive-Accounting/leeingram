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
        }
        Insert: {
          created_at?: string
          generated_lesson_plan?: string | null
          generated_problem_list?: string | null
          generated_video_outline?: string | null
          id?: string
          lesson_id: string
          questionnaire_answers?: Json
        }
        Update: {
          created_at?: string
          generated_lesson_plan?: string | null
          generated_problem_list?: string | null
          generated_video_outline?: string | null
          id?: string
          lesson_id?: string
          questionnaire_answers?: Json
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
