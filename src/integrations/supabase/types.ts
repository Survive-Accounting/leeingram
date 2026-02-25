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
      chapter_problems: {
        Row: {
          chapter_id: string
          course_id: string
          created_at: string
          difficulty_internal:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id: string
          journal_entry_text: string | null
          problem_text: string
          problem_type: Database["public"]["Enums"]["problem_type"]
          solution_text: string
          source_label: string
          status: string
          title: string
        }
        Insert: {
          chapter_id: string
          course_id: string
          created_at?: string
          difficulty_internal?:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id?: string
          journal_entry_text?: string | null
          problem_text?: string
          problem_type?: Database["public"]["Enums"]["problem_type"]
          solution_text?: string
          source_label?: string
          status?: string
          title?: string
        }
        Update: {
          chapter_id?: string
          course_id?: string
          created_at?: string
          difficulty_internal?:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id?: string
          journal_entry_text?: string | null
          problem_text?: string
          problem_type?: Database["public"]["Enums"]["problem_type"]
          solution_text?: string
          source_label?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_problems_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_problems_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
          target_lessons: number | null
        }
        Insert: {
          chapter_name: string
          chapter_number: number
          course_id: string
          created_at?: string
          id?: string
          target_lessons?: number | null
        }
        Update: {
          chapter_name?: string
          chapter_number?: number
          course_id?: string
          created_at?: string
          id?: string
          target_lessons?: number | null
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
      lesson_outputs: {
        Row: {
          canva_slide_blocks: string | null
          generated_at: string | null
          id: string
          lesson_id: string
          lesson_summary: string | null
          problem_breakdown: string | null
          rewritten_exam_problems: string | null
          slide_script: string | null
          video_outline: string | null
        }
        Insert: {
          canva_slide_blocks?: string | null
          generated_at?: string | null
          id?: string
          lesson_id: string
          lesson_summary?: string | null
          problem_breakdown?: string | null
          rewritten_exam_problems?: string | null
          slide_script?: string | null
          video_outline?: string | null
        }
        Update: {
          canva_slide_blocks?: string | null
          generated_at?: string | null
          id?: string
          lesson_id?: string
          lesson_summary?: string | null
          problem_breakdown?: string | null
          rewritten_exam_problems?: string | null
          slide_script?: string | null
          video_outline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_outputs_lesson_id_fkey"
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
      lesson_problem_pairs: {
        Row: {
          id: string
          lesson_id: string
          problem_pair_id: string
          sequence_order: number
        }
        Insert: {
          id?: string
          lesson_id: string
          problem_pair_id: string
          sequence_order?: number
        }
        Update: {
          id?: string
          lesson_id?: string
          problem_pair_id?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_problem_pairs_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_problem_pairs_problem_pair_id_fkey"
            columns: ["problem_pair_id"]
            isOneToOne: false
            referencedRelation: "problem_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_id: string
          concept_explanation: string | null
          course_id: string
          created_at: string
          id: string
          lesson_order: number | null
          lesson_status: Database["public"]["Enums"]["lesson_status"]
          lesson_title: string
          must_memorize: string | null
          shortcuts: string | null
          status_filmed: boolean | null
          status_planned: boolean | null
          status_posted: boolean | null
          status_quiz_created: boolean | null
          status_ready_to_film: boolean | null
          topic: string | null
          traps: string | null
        }
        Insert: {
          chapter_id: string
          concept_explanation?: string | null
          course_id: string
          created_at?: string
          id?: string
          lesson_order?: number | null
          lesson_status?: Database["public"]["Enums"]["lesson_status"]
          lesson_title: string
          must_memorize?: string | null
          shortcuts?: string | null
          status_filmed?: boolean | null
          status_planned?: boolean | null
          status_posted?: boolean | null
          status_quiz_created?: boolean | null
          status_ready_to_film?: boolean | null
          topic?: string | null
          traps?: string | null
        }
        Update: {
          chapter_id?: string
          concept_explanation?: string | null
          course_id?: string
          created_at?: string
          id?: string
          lesson_order?: number | null
          lesson_status?: Database["public"]["Enums"]["lesson_status"]
          lesson_title?: string
          must_memorize?: string | null
          shortcuts?: string | null
          status_filmed?: boolean | null
          status_planned?: boolean | null
          status_posted?: boolean | null
          status_quiz_created?: boolean | null
          status_ready_to_film?: boolean | null
          topic?: string | null
          traps?: string | null
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
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      problem_assets: {
        Row: {
          asset_type: string
          created_at: string
          file_name: string
          file_url: string
          id: string
          page_index: number
          problem_pair_id: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          file_name?: string
          file_url: string
          id?: string
          page_index?: number
          problem_pair_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          page_index?: number
          problem_pair_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_assets_problem_pair_id_fkey"
            columns: ["problem_pair_id"]
            isOneToOne: false
            referencedRelation: "problem_pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_pairs: {
        Row: {
          chapter_id: string
          created_at: string
          description: string | null
          id: string
          notes: string | null
          number: number
          problem_code: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          number: number
          problem_code: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          number?: number
          problem_code?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_pairs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_variants: {
        Row: {
          base_problem_id: string
          created_at: string
          id: string
          variant_label: string
          variant_problem_text: string
          variant_solution_text: string
        }
        Insert: {
          base_problem_id: string
          created_at?: string
          id?: string
          variant_label?: string
          variant_problem_text?: string
          variant_solution_text?: string
        }
        Update: {
          base_problem_id?: string
          created_at?: string
          id?: string
          variant_label?: string
          variant_problem_text?: string
          variant_solution_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_variants_base_problem_id_fkey"
            columns: ["base_problem_id"]
            isOneToOne: false
            referencedRelation: "chapter_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_items: {
        Row: {
          category: string
          completed_at: string | null
          content_tags: string[] | null
          created_at: string
          description: string | null
          domain: string
          id: string
          priority: string
          series_id: string | null
          status: string
          target_semester: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          completed_at?: string | null
          content_tags?: string[] | null
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          priority?: string
          series_id?: string | null
          status?: string
          target_semester?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          content_tags?: string[] | null
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          priority?: string
          series_id?: string | null
          status?: string
          target_semester?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_items_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "vlog_seasons"
            referencedColumns: ["id"]
          },
        ]
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
      teaching_assets: {
        Row: {
          asset_name: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          base_raw_problem_id: string | null
          chapter_id: string
          course_id: string
          created_at: string
          difficulty: Database["public"]["Enums"]["asset_difficulty"] | null
          id: string
          journal_entry_block: string | null
          source_ref: string | null
          survive_problem_text: string
          survive_solution_text: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          asset_name?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          base_raw_problem_id?: string | null
          chapter_id: string
          course_id: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["asset_difficulty"] | null
          id?: string
          journal_entry_block?: string | null
          source_ref?: string | null
          survive_problem_text?: string
          survive_solution_text?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          asset_name?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          base_raw_problem_id?: string | null
          chapter_id?: string
          course_id?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["asset_difficulty"] | null
          id?: string
          journal_entry_block?: string | null
          source_ref?: string | null
          survive_problem_text?: string
          survive_solution_text?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_assets_base_raw_problem_id_fkey"
            columns: ["base_raw_problem_id"]
            isOneToOne: false
            referencedRelation: "chapter_problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assets_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_explore_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          title: string
          trip_id: string
          url: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          title: string
          trip_id: string
          url?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          trip_id?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_explore_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_task_links: {
        Row: {
          created_at: string
          id: string
          label: string
          task_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          task_id: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          task_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "trip_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_tasks: {
        Row: {
          assigned_to: string
          category: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_listed: boolean | null
          is_sold: boolean | null
          sold_price: number | null
          sort_order: number | null
          status: string
          target_date: string | null
          title: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_listed?: boolean | null
          is_sold?: boolean | null
          sold_price?: number | null
          sort_order?: number | null
          status?: string
          target_date?: string | null
          title: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string
          category?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_listed?: boolean | null
          is_sold?: boolean | null
          sold_price?: number | null
          sort_order?: number | null
          status?: string
          target_date?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_tasks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          target_semester: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          season_number: number
          series_name?: string
          target_semester?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          season_number?: number
          series_name?: string
          target_semester?: string | null
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
      asset_difficulty: "standard" | "harder" | "tricky"
      asset_type:
        | "practice_problem"
        | "journal_entry"
        | "concept_review"
        | "exam_prep"
      difficulty_level: "easy" | "medium" | "hard" | "tricky"
      file_type: "textbook" | "solutions" | "tutoring" | "transcript" | "other"
      lesson_status:
        | "Planning"
        | "Sheet Generated"
        | "Filming"
        | "Editing"
        | "Published"
      problem_type: "exercise" | "problem" | "custom"
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
      asset_difficulty: ["standard", "harder", "tricky"],
      asset_type: [
        "practice_problem",
        "journal_entry",
        "concept_review",
        "exam_prep",
      ],
      difficulty_level: ["easy", "medium", "hard", "tricky"],
      file_type: ["textbook", "solutions", "tutoring", "transcript", "other"],
      lesson_status: [
        "Planning",
        "Sheet Generated",
        "Filming",
        "Editing",
        "Published",
      ],
      problem_type: ["exercise", "problem", "custom"],
    },
  },
} as const
