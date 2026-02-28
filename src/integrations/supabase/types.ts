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
      account_aliases: {
        Row: {
          canonical_name: string
          course_short: string | null
          created_at: string
          id: string
          preferred_display_name: string
        }
        Insert: {
          canonical_name: string
          course_short?: string | null
          created_at?: string
          id?: string
          preferred_display_name: string
        }
        Update: {
          canonical_name?: string
          course_short?: string | null
          created_at?: string
          id?: string
          preferred_display_name?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          event_type: string
          id: string
          payload_json: Json
          severity: Database["public"]["Enums"]["log_severity"]
        }
        Insert: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          event_type?: string
          id?: string
          payload_json?: Json
          severity?: Database["public"]["Enums"]["log_severity"]
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          event_type?: string
          id?: string
          payload_json?: Json
          severity?: Database["public"]["Enums"]["log_severity"]
        }
        Relationships: []
      }
      answer_packages: {
        Row: {
          answer_payload: Json
          approved_at: string | null
          approved_by: string | null
          computed_values: Json
          created_at: string
          extracted_inputs: Json
          generator: Database["public"]["Enums"]["answer_generator"]
          id: string
          output_type: Database["public"]["Enums"]["answer_output_type"]
          source_problem_id: string
          status: Database["public"]["Enums"]["answer_status"]
          validation_results: Json
          version: number
        }
        Insert: {
          answer_payload?: Json
          approved_at?: string | null
          approved_by?: string | null
          computed_values?: Json
          created_at?: string
          extracted_inputs?: Json
          generator?: Database["public"]["Enums"]["answer_generator"]
          id?: string
          output_type?: Database["public"]["Enums"]["answer_output_type"]
          source_problem_id: string
          status?: Database["public"]["Enums"]["answer_status"]
          validation_results?: Json
          version?: number
        }
        Update: {
          answer_payload?: Json
          approved_at?: string | null
          approved_by?: string | null
          computed_values?: Json
          created_at?: string
          extracted_inputs?: Json
          generator?: Database["public"]["Enums"]["answer_generator"]
          id?: string
          output_type?: Database["public"]["Enums"]["answer_output_type"]
          source_problem_id?: string
          status?: Database["public"]["Enums"]["answer_status"]
          validation_results?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "answer_packages_source_problem_id_fkey"
            columns: ["source_problem_id"]
            isOneToOne: false
            referencedRelation: "chapter_problems"
            referencedColumns: ["id"]
          },
        ]
      }
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
      chapter_accounts: {
        Row: {
          account_name: string
          account_type: string
          chapter_id: string
          created_at: string
          credit_effect: string
          debit_effect: string
          id: string
          is_approved: boolean
          normal_balance: string
          source: string
        }
        Insert: {
          account_name: string
          account_type?: string
          chapter_id: string
          created_at?: string
          credit_effect?: string
          debit_effect?: string
          id?: string
          is_approved?: boolean
          normal_balance?: string
          source?: string
        }
        Update: {
          account_name?: string
          account_type?: string
          chapter_id?: string
          created_at?: string
          credit_effect?: string
          debit_effect?: string
          id?: string
          is_approved?: boolean
          normal_balance?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_accounts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
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
          ocr_confidence: string
          ocr_confidence_notes: string
          ocr_detected_label: string
          ocr_detected_lo: string
          ocr_detected_title: string
          ocr_detected_type: string
          ocr_extracted_problem_text: string
          ocr_extracted_solution_text: string
          ocr_status: string
          pipeline_status: Database["public"]["Enums"]["problem_pipeline_status"]
          problem_screenshot_url: string | null
          problem_screenshot_urls: string[]
          problem_text: string
          problem_type: Database["public"]["Enums"]["problem_type"]
          scenario_blocks_json: Json | null
          solution_screenshot_url: string | null
          solution_screenshot_urls: string[]
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
          ocr_confidence?: string
          ocr_confidence_notes?: string
          ocr_detected_label?: string
          ocr_detected_lo?: string
          ocr_detected_title?: string
          ocr_detected_type?: string
          ocr_extracted_problem_text?: string
          ocr_extracted_solution_text?: string
          ocr_status?: string
          pipeline_status?: Database["public"]["Enums"]["problem_pipeline_status"]
          problem_screenshot_url?: string | null
          problem_screenshot_urls?: string[]
          problem_text?: string
          problem_type?: Database["public"]["Enums"]["problem_type"]
          scenario_blocks_json?: Json | null
          solution_screenshot_url?: string | null
          solution_screenshot_urls?: string[]
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
          ocr_confidence?: string
          ocr_confidence_notes?: string
          ocr_detected_label?: string
          ocr_detected_lo?: string
          ocr_detected_title?: string
          ocr_detected_type?: string
          ocr_extracted_problem_text?: string
          ocr_extracted_solution_text?: string
          ocr_status?: string
          pipeline_status?: Database["public"]["Enums"]["problem_pipeline_status"]
          problem_screenshot_url?: string | null
          problem_screenshot_urls?: string[]
          problem_text?: string
          problem_type?: Database["public"]["Enums"]["problem_type"]
          scenario_blocks_json?: Json | null
          solution_screenshot_url?: string | null
          solution_screenshot_urls?: string[]
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
      chapter_topics: {
        Row: {
          chapter_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          topic_name: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          topic_name: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          topic_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
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
      company_names: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          style: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          style?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          style?: string
        }
        Relationships: []
      }
      correction_events: {
        Row: {
          after_json: Json
          auto_tags: string[]
          before_json: Json
          chapter_id: string
          created_at: string
          diff_json: Json
          id: string
          source_problem_id: string
          summary: string
          user_id: string | null
        }
        Insert: {
          after_json?: Json
          auto_tags?: string[]
          before_json?: Json
          chapter_id: string
          created_at?: string
          diff_json?: Json
          id?: string
          source_problem_id: string
          summary?: string
          user_id?: string | null
        }
        Update: {
          after_json?: Json
          auto_tags?: string[]
          before_json?: Json
          chapter_id?: string
          created_at?: string
          diff_json?: Json
          id?: string
          source_problem_id?: string
          summary?: string
          user_id?: string | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          code: string
          course_name: string
          created_at: string
          id: string
          slug: string
        }
        Insert: {
          code?: string
          course_name: string
          created_at?: string
          id?: string
          slug: string
        }
        Update: {
          code?: string
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
      export_set_items: {
        Row: {
          export_set_id: string
          id: string
          order_index: number
          teaching_asset_id: string
        }
        Insert: {
          export_set_id: string
          id?: string
          order_index?: number
          teaching_asset_id: string
        }
        Update: {
          export_set_id?: string
          id?: string
          order_index?: number
          teaching_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_set_items_export_set_id_fkey"
            columns: ["export_set_id"]
            isOneToOne: false
            referencedRelation: "export_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_set_items_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      export_sets: {
        Row: {
          chapter_id: string | null
          course_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_sets_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
      generation_jobs: {
        Row: {
          completed_at: string | null
          error: string
          id: string
          input_payload: Json
          job_type: Database["public"]["Enums"]["generation_job_type"]
          requested_at: string
          requested_by: string | null
          source_problem_id: string
          status: Database["public"]["Enums"]["generation_job_status"]
        }
        Insert: {
          completed_at?: string | null
          error?: string
          id?: string
          input_payload?: Json
          job_type?: Database["public"]["Enums"]["generation_job_type"]
          requested_at?: string
          requested_by?: string | null
          source_problem_id: string
          status?: Database["public"]["Enums"]["generation_job_status"]
        }
        Update: {
          completed_at?: string | null
          error?: string
          id?: string
          input_payload?: Json
          job_type?: Database["public"]["Enums"]["generation_job_type"]
          requested_at?: string
          requested_by?: string | null
          source_problem_id?: string
          status?: Database["public"]["Enums"]["generation_job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_source_problem_id_fkey"
            columns: ["source_problem_id"]
            isOneToOne: false
            referencedRelation: "chapter_problems"
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
      lw_items: {
        Row: {
          answer_1: string
          answer_10: string
          answer_2: string
          answer_3: string
          answer_4: string
          answer_5: string
          answer_6: string
          answer_7: string
          answer_8: string
          answer_9: string
          banked_at: string | null
          chapter_id: string
          correct_answer: string
          correct_explanation: string
          course_id: string
          created_at: string
          id: string
          include_in_bank: boolean
          incorrect_explanation: string
          item_key: string
          item_label: string
          lw_type: string
          needs_topic_review: boolean
          question_text: string
          source_problem_id: string
          status: string
          topic_id: string | null
          topic_locked: boolean
          updated_at: string
        }
        Insert: {
          answer_1?: string
          answer_10?: string
          answer_2?: string
          answer_3?: string
          answer_4?: string
          answer_5?: string
          answer_6?: string
          answer_7?: string
          answer_8?: string
          answer_9?: string
          banked_at?: string | null
          chapter_id: string
          correct_answer?: string
          correct_explanation?: string
          course_id: string
          created_at?: string
          id?: string
          include_in_bank?: boolean
          incorrect_explanation?: string
          item_key?: string
          item_label?: string
          lw_type?: string
          needs_topic_review?: boolean
          question_text?: string
          source_problem_id: string
          status?: string
          topic_id?: string | null
          topic_locked?: boolean
          updated_at?: string
        }
        Update: {
          answer_1?: string
          answer_10?: string
          answer_2?: string
          answer_3?: string
          answer_4?: string
          answer_5?: string
          answer_6?: string
          answer_7?: string
          answer_8?: string
          answer_9?: string
          banked_at?: string | null
          chapter_id?: string
          correct_answer?: string
          correct_explanation?: string
          course_id?: string
          created_at?: string
          id?: string
          include_in_bank?: boolean
          incorrect_explanation?: string
          item_key?: string
          item_label?: string
          lw_type?: string
          needs_topic_review?: boolean
          question_text?: string
          source_problem_id?: string
          status?: string
          topic_id?: string | null
          topic_locked?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lw_items_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lw_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lw_items_source_problem_id_fkey"
            columns: ["source_problem_id"]
            isOneToOne: false
            referencedRelation: "chapter_problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lw_items_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "chapter_topics"
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
          candidate_data: Json
          created_at: string
          id: string
          journal_entry_completed_json: Json | null
          journal_entry_template_json: Json | null
          variant_label: string
          variant_problem_text: string
          variant_solution_text: string
        }
        Insert: {
          base_problem_id: string
          candidate_data?: Json
          created_at?: string
          id?: string
          journal_entry_completed_json?: Json | null
          journal_entry_template_json?: Json | null
          variant_label?: string
          variant_problem_text?: string
          variant_solution_text?: string
        }
        Update: {
          base_problem_id?: string
          candidate_data?: Json
          created_at?: string
          id?: string
          journal_entry_completed_json?: Json | null
          journal_entry_template_json?: Json | null
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
      repair_notes: {
        Row: {
          answer_package_id: string
          created_at: string
          created_by: string | null
          desired_fix: string
          do_not_change: string | null
          id: string
          note_type: Database["public"]["Enums"]["repair_note_type"]
          resolved_at: string | null
          source_problem_id: string
          status: Database["public"]["Enums"]["repair_note_status"]
          what_was_wrong: string
        }
        Insert: {
          answer_package_id: string
          created_at?: string
          created_by?: string | null
          desired_fix?: string
          do_not_change?: string | null
          id?: string
          note_type?: Database["public"]["Enums"]["repair_note_type"]
          resolved_at?: string | null
          source_problem_id: string
          status?: Database["public"]["Enums"]["repair_note_status"]
          what_was_wrong?: string
        }
        Update: {
          answer_package_id?: string
          created_at?: string
          created_by?: string | null
          desired_fix?: string
          do_not_change?: string | null
          id?: string
          note_type?: Database["public"]["Enums"]["repair_note_type"]
          resolved_at?: string | null
          source_problem_id?: string
          status?: Database["public"]["Enums"]["repair_note_status"]
          what_was_wrong?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_notes_answer_package_id_fkey"
            columns: ["answer_package_id"]
            isOneToOne: false
            referencedRelation: "answer_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_notes_source_problem_id_fkey"
            columns: ["source_problem_id"]
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
          journal_entry_completed_json: Json | null
          journal_entry_template_json: Json | null
          last_tutored_at: string | null
          source_ref: string | null
          survive_problem_text: string
          survive_solution_text: string
          tags: string[]
          times_used: number
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
          journal_entry_completed_json?: Json | null
          journal_entry_template_json?: Json | null
          last_tutored_at?: string | null
          source_ref?: string | null
          survive_problem_text?: string
          survive_solution_text?: string
          tags?: string[]
          times_used?: number
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
          journal_entry_completed_json?: Json | null
          journal_entry_template_json?: Json | null
          last_tutored_at?: string | null
          source_ref?: string | null
          survive_problem_text?: string
          survive_solution_text?: string
          tags?: string[]
          times_used?: number
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
      topic_rules: {
        Row: {
          chapter_number: number
          course_short: string
          created_at: string
          id: string
          match_field: string
          pattern: string
          priority: number
          topic_name: string
        }
        Insert: {
          chapter_number: number
          course_short: string
          created_at?: string
          id?: string
          match_field?: string
          pattern: string
          priority?: number
          topic_name: string
        }
        Update: {
          chapter_number?: number
          course_short?: string
          created_at?: string
          id?: string
          match_field?: string
          pattern?: string
          priority?: number
          topic_name?: string
        }
        Relationships: []
      }
      topic_templates: {
        Row: {
          chapter_number: number
          course_short: string
          created_at: string
          display_order: number
          id: string
          topic_name: string
        }
        Insert: {
          chapter_number: number
          course_short: string
          created_at?: string
          display_order?: number
          id?: string
          topic_name: string
        }
        Update: {
          chapter_number?: number
          course_short?: string
          created_at?: string
          display_order?: number
          id?: string
          topic_name?: string
        }
        Relationships: []
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
      variant_feedback: {
        Row: {
          created_at: string
          free_text_note: string | null
          id: string
          rejection_reason: string
          source_problem_id: string
          variant_data: Json
        }
        Insert: {
          created_at?: string
          free_text_note?: string | null
          id?: string
          rejection_reason: string
          source_problem_id: string
          variant_data?: Json
        }
        Update: {
          created_at?: string
          free_text_note?: string | null
          id?: string
          rejection_reason?: string
          source_problem_id?: string
          variant_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "variant_feedback_source_problem_id_fkey"
            columns: ["source_problem_id"]
            isOneToOne: false
            referencedRelation: "chapter_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_generation_settings: {
        Row: {
          created_at: string
          default_difficulty: string
          exam_realism: Json
          id: string
          je_answer_only: boolean
          je_canva_export: boolean
          je_fully_worked: boolean
          je_google_sheets_format: boolean
          no_written_explanation: boolean
          require_different_company: boolean
          require_different_scenario: boolean
          require_different_values: boolean
          store_solution_internally: boolean
          teaching_tone: Json
          tricky_je_direction_trap: boolean
          tricky_missing_info: boolean
          tricky_multi_step_decoy: boolean
          tricky_numerical_decoys: boolean
          tricky_partial_period: boolean
          tricky_sign_reversal: boolean
          updated_at: string
          use_company_names: boolean
          user_id: string
          variants_per_request: number
          video_linked_explanation: boolean
        }
        Insert: {
          created_at?: string
          default_difficulty?: string
          exam_realism?: Json
          id?: string
          je_answer_only?: boolean
          je_canva_export?: boolean
          je_fully_worked?: boolean
          je_google_sheets_format?: boolean
          no_written_explanation?: boolean
          require_different_company?: boolean
          require_different_scenario?: boolean
          require_different_values?: boolean
          store_solution_internally?: boolean
          teaching_tone?: Json
          tricky_je_direction_trap?: boolean
          tricky_missing_info?: boolean
          tricky_multi_step_decoy?: boolean
          tricky_numerical_decoys?: boolean
          tricky_partial_period?: boolean
          tricky_sign_reversal?: boolean
          updated_at?: string
          use_company_names?: boolean
          user_id: string
          variants_per_request?: number
          video_linked_explanation?: boolean
        }
        Update: {
          created_at?: string
          default_difficulty?: string
          exam_realism?: Json
          id?: string
          je_answer_only?: boolean
          je_canva_export?: boolean
          je_fully_worked?: boolean
          je_google_sheets_format?: boolean
          no_written_explanation?: boolean
          require_different_company?: boolean
          require_different_scenario?: boolean
          require_different_values?: boolean
          store_solution_internally?: boolean
          teaching_tone?: Json
          tricky_je_direction_trap?: boolean
          tricky_missing_info?: boolean
          tricky_multi_step_decoy?: boolean
          tricky_numerical_decoys?: boolean
          tricky_partial_period?: boolean
          tricky_sign_reversal?: boolean
          updated_at?: string
          use_company_names?: boolean
          user_id?: string
          variants_per_request?: number
          video_linked_explanation?: boolean
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
      actor_type: "user" | "system" | "ai"
      answer_generator: "ai" | "system" | "mixed"
      answer_output_type:
        | "numeric_values"
        | "journal_entries"
        | "multiple_choice"
        | "mixed"
      answer_status: "drafted" | "needs_review" | "approved"
      asset_difficulty: "standard" | "harder" | "tricky"
      asset_type:
        | "practice_problem"
        | "journal_entry"
        | "concept_review"
        | "exam_prep"
      difficulty_level: "easy" | "medium" | "hard" | "tricky"
      entity_type:
        | "source_problem"
        | "lw_item"
        | "export_job"
        | "topic"
        | "chapter"
      file_type: "textbook" | "solutions" | "tutoring" | "transcript" | "other"
      generation_job_status: "queued" | "running" | "done" | "failed"
      generation_job_type: "generate" | "regenerate_with_repair_note"
      lesson_status:
        | "Planning"
        | "Sheet Generated"
        | "Filming"
        | "Editing"
        | "Published"
      log_severity: "info" | "warn" | "error"
      problem_pipeline_status:
        | "imported"
        | "generated"
        | "approved"
        | "banked"
        | "ready_to_film"
        | "deployed"
      problem_type: "exercise" | "problem" | "custom"
      repair_note_status: "open" | "resolved"
      repair_note_type:
        | "math_fix"
        | "format_fix"
        | "wording_fix"
        | "missing_step"
        | "wrong_topic"
        | "other"
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
      actor_type: ["user", "system", "ai"],
      answer_generator: ["ai", "system", "mixed"],
      answer_output_type: [
        "numeric_values",
        "journal_entries",
        "multiple_choice",
        "mixed",
      ],
      answer_status: ["drafted", "needs_review", "approved"],
      asset_difficulty: ["standard", "harder", "tricky"],
      asset_type: [
        "practice_problem",
        "journal_entry",
        "concept_review",
        "exam_prep",
      ],
      difficulty_level: ["easy", "medium", "hard", "tricky"],
      entity_type: [
        "source_problem",
        "lw_item",
        "export_job",
        "topic",
        "chapter",
      ],
      file_type: ["textbook", "solutions", "tutoring", "transcript", "other"],
      generation_job_status: ["queued", "running", "done", "failed"],
      generation_job_type: ["generate", "regenerate_with_repair_note"],
      lesson_status: [
        "Planning",
        "Sheet Generated",
        "Filming",
        "Editing",
        "Published",
      ],
      log_severity: ["info", "warn", "error"],
      problem_pipeline_status: [
        "imported",
        "generated",
        "approved",
        "banked",
        "ready_to_film",
        "deployed",
      ],
      problem_type: ["exercise", "problem", "custom"],
      repair_note_status: ["open", "resolved"],
      repair_note_type: [
        "math_fix",
        "format_fix",
        "wording_fix",
        "missing_step",
        "wrong_topic",
        "other",
      ],
    },
  },
} as const
