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
          duration_ms: number | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          event_type: string
          id: string
          message: string
          model: string
          payload_json: Json
          provider: string
          severity: Database["public"]["Enums"]["log_severity"]
        }
        Insert: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          duration_ms?: number | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          event_type?: string
          id?: string
          message?: string
          model?: string
          payload_json?: Json
          provider?: string
          severity?: Database["public"]["Enums"]["log_severity"]
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          duration_ms?: number | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          event_type?: string
          id?: string
          message?: string
          model?: string
          payload_json?: Json
          provider?: string
          severity?: Database["public"]["Enums"]["log_severity"]
        }
        Relationships: []
      }
      admin_notes: {
        Row: {
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type?: string
          id?: string
          note?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          note?: string
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
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      asset_events: {
        Row: {
          asset_name: string
          chapter_id: string | null
          course_id: string | null
          created_at: string
          event_type: string
          id: string
          is_lw_embed: boolean
          is_preview_mode: boolean
          lw_course_id: string | null
          lw_email: string | null
          lw_name: string | null
          lw_unit_id: string | null
          lw_user_id: string | null
          referrer: string | null
          seconds_spent: number | null
          section_name: string | null
          teaching_asset_id: string | null
          user_agent: string | null
        }
        Insert: {
          asset_name: string
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          is_lw_embed?: boolean
          is_preview_mode?: boolean
          lw_course_id?: string | null
          lw_email?: string | null
          lw_name?: string | null
          lw_unit_id?: string | null
          lw_user_id?: string | null
          referrer?: string | null
          seconds_spent?: number | null
          section_name?: string | null
          teaching_asset_id?: string | null
          user_agent?: string | null
        }
        Update: {
          asset_name?: string
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          is_lw_embed?: boolean
          is_preview_mode?: boolean
          lw_course_id?: string | null
          lw_email?: string | null
          lw_name?: string | null
          lw_unit_id?: string | null
          lw_user_id?: string | null
          referrer?: string | null
          seconds_spent?: number | null
          section_name?: string | null
          teaching_asset_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_events_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_flags: {
        Row: {
          created_at: string
          flag_reason: string
          flagged_by_va_id: string | null
          id: string
          notes: string | null
          resolved_at: string | null
          status: string
          teaching_asset_id: string
        }
        Insert: {
          created_at?: string
          flag_reason?: string
          flagged_by_va_id?: string | null
          id?: string
          notes?: string | null
          resolved_at?: string | null
          status?: string
          teaching_asset_id: string
        }
        Update: {
          created_at?: string
          flag_reason?: string
          flagged_by_va_id?: string | null
          id?: string
          notes?: string | null
          resolved_at?: string | null
          status?: string
          teaching_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_flags_flagged_by_va_id_fkey"
            columns: ["flagged_by_va_id"]
            isOneToOne: false
            referencedRelation: "va_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_flags_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_flowcharts: {
        Row: {
          created_at: string
          flowchart_image_id: string | null
          flowchart_image_url: string | null
          id: string
          instruction_label: string | null
          instruction_number: number
          teaching_asset_id: string
        }
        Insert: {
          created_at?: string
          flowchart_image_id?: string | null
          flowchart_image_url?: string | null
          id?: string
          instruction_label?: string | null
          instruction_number?: number
          teaching_asset_id: string
        }
        Update: {
          created_at?: string
          flowchart_image_id?: string | null
          flowchart_image_url?: string | null
          id?: string
          instruction_label?: string | null
          instruction_number?: number
          teaching_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_flowcharts_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_groups: {
        Row: {
          created_at: string
          group_code: string
          id: string
        }
        Insert: {
          created_at?: string
          group_code?: string
          id?: string
        }
        Update: {
          created_at?: string
          group_code?: string
          id?: string
        }
        Relationships: []
      }
      asset_issue_reports: {
        Row: {
          asset_name: string | null
          created_at: string | null
          id: string
          message: string
          reporter_email: string | null
          status: string | null
          teaching_asset_id: string | null
        }
        Insert: {
          asset_name?: string | null
          created_at?: string | null
          id?: string
          message: string
          reporter_email?: string | null
          status?: string | null
          teaching_asset_id?: string | null
        }
        Update: {
          asset_name?: string | null
          created_at?: string | null
          id?: string
          message?: string
          reporter_email?: string | null
          status?: string | null
          teaching_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_issue_reports_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_share_events: {
        Row: {
          asset_name: string
          created_at: string
          event_type: string
          id: string
          referrer: string | null
          teaching_asset_id: string | null
          user_agent: string | null
        }
        Insert: {
          asset_name: string
          created_at?: string
          event_type: string
          id?: string
          referrer?: string | null
          teaching_asset_id?: string | null
          user_agent?: string | null
        }
        Update: {
          asset_name?: string
          created_at?: string
          event_type?: string
          id?: string
          referrer?: string | null
          teaching_asset_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_share_events_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_code: string
          chapter_number: number
          confidence_score: number
          course_id: string
          created_at: string
          difficulty_estimate: number
          exercise_code: string
          google_sheet_url: string
          group_id: string | null
          id: string
          ocr_text: string
          source_problem_text: string
          status: Database["public"]["Enums"]["asset_status"]
          textbook_id: string | null
          variant_problem_text: string
          variant_solution_text: string
          video_status: Database["public"]["Enums"]["asset_video_status"]
          walkthrough_video_url: string
        }
        Insert: {
          asset_code: string
          chapter_number: number
          confidence_score?: number
          course_id: string
          created_at?: string
          difficulty_estimate?: number
          exercise_code?: string
          google_sheet_url?: string
          group_id?: string | null
          id?: string
          ocr_text?: string
          source_problem_text?: string
          status?: Database["public"]["Enums"]["asset_status"]
          textbook_id?: string | null
          variant_problem_text?: string
          variant_solution_text?: string
          video_status?: Database["public"]["Enums"]["asset_video_status"]
          walkthrough_video_url?: string
        }
        Update: {
          asset_code?: string
          chapter_number?: number
          confidence_score?: number
          course_id?: string
          created_at?: string
          difficulty_estimate?: number
          exercise_code?: string
          google_sheet_url?: string
          group_id?: string | null
          id?: string
          ocr_text?: string
          source_problem_text?: string
          status?: Database["public"]["Enums"]["asset_status"]
          textbook_id?: string | null
          variant_problem_text?: string
          variant_solution_text?: string
          video_status?: Database["public"]["Enums"]["asset_video_status"]
          walkthrough_video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "asset_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "textbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      background_jobs: {
        Row: {
          batch_id: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          job_type: string
          payload: Json
          started_at: string | null
          status: string
        }
        Insert: {
          batch_id?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_type: string
          payload?: Json
          started_at?: string | null
          status?: string
        }
        Update: {
          batch_id?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_type?: string
          payload?: Json
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      banked_questions: {
        Row: {
          ai_confidence_score: number
          answer_a: string
          answer_b: string
          answer_c: string
          answer_d: string
          answer_e: string
          asset_id: string | null
          correct_answer: string
          created_at: string
          difficulty: number
          id: string
          question_text: string
          question_type: Database["public"]["Enums"]["banked_question_type"]
          rating: number | null
          rejection_notes: string | null
          review_status: Database["public"]["Enums"]["question_review_status"]
          short_explanation: string
          teaching_asset_id: string | null
        }
        Insert: {
          ai_confidence_score?: number
          answer_a?: string
          answer_b?: string
          answer_c?: string
          answer_d?: string
          answer_e?: string
          asset_id?: string | null
          correct_answer?: string
          created_at?: string
          difficulty?: number
          id?: string
          question_text?: string
          question_type: Database["public"]["Enums"]["banked_question_type"]
          rating?: number | null
          rejection_notes?: string | null
          review_status?: Database["public"]["Enums"]["question_review_status"]
          short_explanation?: string
          teaching_asset_id?: string | null
        }
        Update: {
          ai_confidence_score?: number
          answer_a?: string
          answer_b?: string
          answer_c?: string
          answer_d?: string
          answer_e?: string
          asset_id?: string | null
          correct_answer?: string
          created_at?: string
          difficulty?: number
          id?: string
          question_text?: string
          question_type?: Database["public"]["Enums"]["banked_question_type"]
          rating?: number | null
          rejection_notes?: string | null
          review_status?: Database["public"]["Enums"]["question_review_status"]
          short_explanation?: string
          teaching_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banked_questions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banked_questions_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_fix_queue: {
        Row: {
          assets_errored: number
          assets_processed: number
          assets_skipped: number
          assets_succeeded: number
          completed_at: string | null
          created_at: string
          error_summary: string | null
          id: string
          operation_key: string
          operation_name: string
          queue_position: number
          scope_chapter_id: string | null
          scope_course_id: string | null
          scope_status_filter: string
          started_at: string | null
          status: string
        }
        Insert: {
          assets_errored?: number
          assets_processed?: number
          assets_skipped?: number
          assets_succeeded?: number
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          id?: string
          operation_key: string
          operation_name: string
          queue_position: number
          scope_chapter_id?: string | null
          scope_course_id?: string | null
          scope_status_filter?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          assets_errored?: number
          assets_processed?: number
          assets_skipped?: number
          assets_succeeded?: number
          completed_at?: string | null
          created_at?: string
          error_summary?: string | null
          id?: string
          operation_key?: string
          operation_name?: string
          queue_position?: number
          scope_chapter_id?: string | null
          scope_course_id?: string | null
          scope_status_filter?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_fix_queue_scope_chapter_id_fkey"
            columns: ["scope_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_fix_queue_scope_course_id_fkey"
            columns: ["scope_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
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
      chapter_batch_run_items: {
        Row: {
          attempts: number
          batch_run_id: string
          created_variant_ids: Json | null
          duration_ms: number | null
          ended_at: string | null
          id: string
          last_error: string | null
          seq: number
          source_problem_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          batch_run_id: string
          created_variant_ids?: Json | null
          duration_ms?: number | null
          ended_at?: string | null
          id?: string
          last_error?: string | null
          seq: number
          source_problem_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          batch_run_id?: string
          created_variant_ids?: Json | null
          duration_ms?: number | null
          ended_at?: string | null
          id?: string
          last_error?: string | null
          seq?: number
          source_problem_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_batch_run_items_batch_run_id_fkey"
            columns: ["batch_run_id"]
            isOneToOne: false
            referencedRelation: "chapter_batch_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_batch_run_items_source_problem_id_fkey"
            columns: ["source_problem_id"]
            isOneToOne: false
            referencedRelation: "chapter_problems"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_batch_runs: {
        Row: {
          avg_seconds_per_source: number | null
          chapter_id: string
          completed_sources: number
          course_id: string
          created_at: string
          created_by_user_id: string | null
          ended_at: string | null
          failed_sources: number
          id: string
          notes: string | null
          provider: string
          started_at: string | null
          status: string
          total_sources: number
          variant_count: number
        }
        Insert: {
          avg_seconds_per_source?: number | null
          chapter_id: string
          completed_sources?: number
          course_id: string
          created_at?: string
          created_by_user_id?: string | null
          ended_at?: string | null
          failed_sources?: number
          id?: string
          notes?: string | null
          provider?: string
          started_at?: string | null
          status?: string
          total_sources?: number
          variant_count?: number
        }
        Update: {
          avg_seconds_per_source?: number | null
          chapter_id?: string
          completed_sources?: number
          course_id?: string
          created_at?: string
          created_by_user_id?: string | null
          ended_at?: string | null
          failed_sources?: number
          id?: string
          notes?: string | null
          provider?: string
          started_at?: string | null
          status?: string
          total_sources?: number
          variant_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapter_batch_runs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_batch_runs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_build_runs: {
        Row: {
          approved_count: number
          avg_seconds_per_approved: number | null
          avg_seconds_per_terminal: number | null
          chapter_id: string
          course_id: string
          ended_at: string | null
          id: string
          import_count: number
          imported_source_ids: Json
          needs_fix_count: number
          notes: string | null
          started_at: string
          status: string
          terminal_count: number
          total_seconds: number | null
        }
        Insert: {
          approved_count?: number
          avg_seconds_per_approved?: number | null
          avg_seconds_per_terminal?: number | null
          chapter_id: string
          course_id: string
          ended_at?: string | null
          id?: string
          import_count?: number
          imported_source_ids?: Json
          needs_fix_count?: number
          notes?: string | null
          started_at?: string
          status?: string
          terminal_count?: number
          total_seconds?: number | null
        }
        Update: {
          approved_count?: number
          avg_seconds_per_approved?: number | null
          avg_seconds_per_terminal?: number | null
          chapter_id?: string
          course_id?: string
          ended_at?: string | null
          id?: string
          import_count?: number
          imported_source_ids?: Json
          needs_fix_count?: number
          notes?: string | null
          started_at?: string
          status?: string
          terminal_count?: number
          total_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_build_runs_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_build_runs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_problems: {
        Row: {
          build_run_id: string | null
          chapter_id: string
          combined_group_id: string | null
          contains_no_journal_entries: boolean
          course_id: string
          created_at: string
          dependency_status: string
          dependency_type: string
          detected_dependency_ref: string
          difficulty_internal:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id: string
          import_status: string
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
          solution_pdf_file_id: string | null
          solution_pdf_page_end: number | null
          solution_pdf_page_start: number | null
          solution_screenshot_url: string | null
          solution_screenshot_urls: string[]
          solution_source: string
          solution_text: string
          solution_text_confidence: number | null
          source_code: string
          source_label: string
          source_type: string
          status: string
          title: string
        }
        Insert: {
          build_run_id?: string | null
          chapter_id: string
          combined_group_id?: string | null
          contains_no_journal_entries?: boolean
          course_id: string
          created_at?: string
          dependency_status?: string
          dependency_type?: string
          detected_dependency_ref?: string
          difficulty_internal?:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id?: string
          import_status?: string
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
          solution_pdf_file_id?: string | null
          solution_pdf_page_end?: number | null
          solution_pdf_page_start?: number | null
          solution_screenshot_url?: string | null
          solution_screenshot_urls?: string[]
          solution_source?: string
          solution_text?: string
          solution_text_confidence?: number | null
          source_code?: string
          source_label?: string
          source_type?: string
          status?: string
          title?: string
        }
        Update: {
          build_run_id?: string | null
          chapter_id?: string
          combined_group_id?: string | null
          contains_no_journal_entries?: boolean
          course_id?: string
          created_at?: string
          dependency_status?: string
          dependency_type?: string
          detected_dependency_ref?: string
          difficulty_internal?:
            | Database["public"]["Enums"]["difficulty_level"]
            | null
          id?: string
          import_status?: string
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
          solution_pdf_file_id?: string | null
          solution_pdf_page_end?: number | null
          solution_pdf_page_start?: number | null
          solution_screenshot_url?: string | null
          solution_screenshot_urls?: string[]
          solution_source?: string
          solution_text?: string
          solution_text_confidence?: number | null
          source_code?: string
          source_label?: string
          source_type?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_problems_build_run_id_fkey"
            columns: ["build_run_id"]
            isOneToOne: false
            referencedRelation: "chapter_build_runs"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "chapter_problems_solution_pdf_file_id_fkey"
            columns: ["solution_pdf_file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
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
          asset_codes: string[] | null
          chapter_id: string
          course_id: string | null
          created_at: string
          display_order: number
          generated_by_ai: boolean | null
          id: string
          is_active: boolean
          is_supplementary: boolean
          lw_quiz_link: string | null
          lw_video_link: string | null
          merged_into_topic_id: string | null
          original_asset_codes: string[] | null
          quiz_status: string | null
          topic_description: string | null
          topic_name: string
          topic_number: number | null
          topic_rationale: string | null
          video_status: string | null
        }
        Insert: {
          asset_codes?: string[] | null
          chapter_id: string
          course_id?: string | null
          created_at?: string
          display_order?: number
          generated_by_ai?: boolean | null
          id?: string
          is_active?: boolean
          is_supplementary?: boolean
          lw_quiz_link?: string | null
          lw_video_link?: string | null
          merged_into_topic_id?: string | null
          original_asset_codes?: string[] | null
          quiz_status?: string | null
          topic_description?: string | null
          topic_name: string
          topic_number?: number | null
          topic_rationale?: string | null
          video_status?: string | null
        }
        Update: {
          asset_codes?: string[] | null
          chapter_id?: string
          course_id?: string | null
          created_at?: string
          display_order?: number
          generated_by_ai?: boolean | null
          id?: string
          is_active?: boolean
          is_supplementary?: boolean
          lw_quiz_link?: string | null
          lw_video_link?: string | null
          merged_into_topic_id?: string | null
          original_asset_codes?: string[] | null
          quiz_status?: string | null
          topic_description?: string | null
          topic_name?: string
          topic_number?: number | null
          topic_rationale?: string | null
          video_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_topics_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_topics_merged_into_topic_id_fkey"
            columns: ["merged_into_topic_id"]
            isOneToOne: false
            referencedRelation: "chapter_topics"
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
          je_only_mode: boolean
          target_lessons: number | null
          topics_locked: boolean
          topics_locked_at: string | null
          topics_locked_count: number | null
        }
        Insert: {
          chapter_name: string
          chapter_number: number
          course_id: string
          created_at?: string
          id?: string
          je_only_mode?: boolean
          target_lessons?: number | null
          topics_locked?: boolean
          topics_locked_at?: string | null
          topics_locked_count?: number | null
        }
        Update: {
          chapter_name?: string
          chapter_number?: number
          course_id?: string
          created_at?: string
          id?: string
          je_only_mode?: boolean
          target_lessons?: number | null
          topics_locked?: boolean
          topics_locked_at?: string | null
          topics_locked_count?: number | null
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
      chart_of_accounts: {
        Row: {
          account_type: string
          canonical_name: string
          created_at: string
          id: string
          is_global_default: boolean
          keywords: string[] | null
          normal_balance: string
        }
        Insert: {
          account_type?: string
          canonical_name: string
          created_at?: string
          id?: string
          is_global_default?: boolean
          keywords?: string[] | null
          normal_balance?: string
        }
        Update: {
          account_type?: string
          canonical_name?: string
          created_at?: string
          id?: string
          is_global_default?: boolean
          keywords?: string[] | null
          normal_balance?: string
        }
        Relationships: []
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
      course_textbooks: {
        Row: {
          course_id: string
          created_at: string
          id: string
          textbook_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          textbook_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          textbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_textbooks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_textbooks_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "textbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          course_name: string
          created_at: string
          description: string
          id: string
          slug: string
        }
        Insert: {
          code?: string
          course_name: string
          created_at?: string
          description?: string
          id?: string
          slug: string
        }
        Update: {
          code?: string
          course_name?: string
          created_at?: string
          description?: string
          id?: string
          slug?: string
        }
        Relationships: []
      }
      dissector_problems: {
        Row: {
          chapter_id: string | null
          completions: number | null
          course_id: string | null
          created_at: string | null
          highlights: Json
          id: string
          plays: number | null
          problem_text: string
          status: string | null
          teaching_asset_id: string | null
        }
        Insert: {
          chapter_id?: string | null
          completions?: number | null
          course_id?: string | null
          created_at?: string | null
          highlights?: Json
          id?: string
          plays?: number | null
          problem_text: string
          status?: string | null
          teaching_asset_id?: string | null
        }
        Update: {
          chapter_id?: string | null
          completions?: number | null
          course_id?: string | null
          created_at?: string | null
          highlights?: Json
          id?: string
          plays?: number | null
          problem_text?: string
          status?: string | null
          teaching_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dissector_problems_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dissector_problems_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dissector_problems_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      edu_preview_sessions: {
        Row: {
          asset_codes: string[]
          asset_ids: string[]
          created_at: string
          email: string
          expires_at: string
          id: string
          used: boolean
        }
        Insert: {
          asset_codes: string[]
          asset_ids: string[]
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used?: boolean
        }
        Update: {
          asset_codes?: string[]
          asset_ids?: string[]
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used?: boolean
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
      entry_builder_accounts: {
        Row: {
          account_name: string
          account_type: string
          chapter_id: string | null
          id: string
          normal_balance: string
        }
        Insert: {
          account_name: string
          account_type: string
          chapter_id?: string | null
          id?: string
          normal_balance: string
        }
        Update: {
          account_name?: string
          account_type?: string
          chapter_id?: string | null
          id?: string
          normal_balance?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_builder_accounts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_builder_items: {
        Row: {
          date_label: string | null
          deleted: boolean | null
          entries: Json
          id: string
          set_id: string | null
          sort_order: number | null
          source_asset_id: string | null
          transaction_description: string
        }
        Insert: {
          date_label?: string | null
          deleted?: boolean | null
          entries: Json
          id?: string
          set_id?: string | null
          sort_order?: number | null
          source_asset_id?: string | null
          transaction_description: string
        }
        Update: {
          date_label?: string | null
          deleted?: boolean | null
          entries?: Json
          id?: string
          set_id?: string | null
          sort_order?: number | null
          source_asset_id?: string | null
          transaction_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_builder_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "entry_builder_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_builder_items_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_builder_sets: {
        Row: {
          chapter_id: string | null
          completions: number | null
          course_id: string | null
          created_at: string | null
          id: string
          plays: number | null
          status: string | null
        }
        Insert: {
          chapter_id?: string | null
          completions?: number | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          plays?: number | null
          status?: string | null
        }
        Update: {
          chapter_id?: string | null
          completions?: number | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          plays?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_builder_sets_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_builder_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
      export_set_questions: {
        Row: {
          banked_question_id: string
          created_at: string
          export_set_id: string
          id: string
          order_index: number
        }
        Insert: {
          banked_question_id: string
          created_at?: string
          export_set_id: string
          id?: string
          order_index?: number
        }
        Update: {
          banked_question_id?: string
          created_at?: string
          export_set_id?: string
          id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "export_set_questions_banked_question_id_fkey"
            columns: ["banked_question_id"]
            isOneToOne: false
            referencedRelation: "banked_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_set_questions_export_set_id_fkey"
            columns: ["export_set_id"]
            isOneToOne: false
            referencedRelation: "export_sets"
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
      flashcard_decks: {
        Row: {
          chapter_id: string | null
          chapter_number: number | null
          completions: number | null
          course_code: string | null
          course_id: string | null
          created_at: string | null
          id: string
          plays: number | null
          status: string | null
          total_cards: number | null
          updated_at: string | null
        }
        Insert: {
          chapter_id?: string | null
          chapter_number?: number | null
          completions?: number | null
          course_code?: string | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          plays?: number | null
          status?: string | null
          total_cards?: number | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string | null
          chapter_number?: number | null
          completions?: number | null
          course_code?: string | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          plays?: number | null
          status?: string | null
          total_cards?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_decks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_decks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          card_type: string
          created_at: string | null
          deck_id: string | null
          deleted: boolean | null
          front: string
          id: string
          sort_order: number | null
          source_asset_id: string | null
        }
        Insert: {
          back: string
          card_type: string
          created_at?: string | null
          deck_id?: string | null
          deleted?: boolean | null
          front: string
          id?: string
          sort_order?: number | null
          source_asset_id?: string | null
        }
        Update: {
          back?: string
          card_type?: string
          created_at?: string | null
          deck_id?: string | null
          deleted?: boolean | null
          front?: string
          id?: string
          sort_order?: number | null
          source_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "flashcard_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
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
      formula_items: {
        Row: {
          deleted: boolean | null
          formula_name: string
          formula_text: string
          hint: string | null
          id: string
          set_id: string | null
          sort_order: number | null
          source_asset_id: string | null
        }
        Insert: {
          deleted?: boolean | null
          formula_name: string
          formula_text: string
          hint?: string | null
          id?: string
          set_id?: string | null
          sort_order?: number | null
          source_asset_id?: string | null
        }
        Update: {
          deleted?: boolean | null
          formula_name?: string
          formula_text?: string
          hint?: string | null
          id?: string
          set_id?: string | null
          sort_order?: number | null
          source_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formula_items_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "formula_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_items_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_sets: {
        Row: {
          chapter_id: string | null
          completions: number | null
          course_id: string | null
          created_at: string | null
          id: string
          plays: number | null
          status: string | null
        }
        Insert: {
          chapter_id?: string | null
          completions?: number | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          plays?: number | null
          status?: string | null
        }
        Update: {
          chapter_id?: string | null
          completions?: number | null
          course_id?: string | null
          created_at?: string | null
          id?: string
          plays?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formula_sets_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_sets_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_debug_notes: {
        Row: {
          activity_log_run_id: string | null
          activity_log_snapshot: Json | null
          admin_note: string
          ai_output_raw: string | null
          annotated_by: string | null
          chapter_id: string
          correct_answer: string | null
          course_id: string
          created_at: string | null
          debug_session_id: string | null
          error_field: string
          error_type: string
          generation_prompt: string | null
          id: string
          resolution_note: string | null
          resolved: boolean | null
          resolved_at: string | null
          teaching_asset_id: string
          updated_at: string | null
        }
        Insert: {
          activity_log_run_id?: string | null
          activity_log_snapshot?: Json | null
          admin_note: string
          ai_output_raw?: string | null
          annotated_by?: string | null
          chapter_id: string
          correct_answer?: string | null
          course_id: string
          created_at?: string | null
          debug_session_id?: string | null
          error_field: string
          error_type: string
          generation_prompt?: string | null
          id?: string
          resolution_note?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          teaching_asset_id: string
          updated_at?: string | null
        }
        Update: {
          activity_log_run_id?: string | null
          activity_log_snapshot?: Json | null
          admin_note?: string
          ai_output_raw?: string | null
          annotated_by?: string | null
          chapter_id?: string
          correct_answer?: string | null
          course_id?: string
          created_at?: string | null
          debug_session_id?: string | null
          error_field?: string
          error_type?: string
          generation_prompt?: string | null
          id?: string
          resolution_note?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          teaching_asset_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_debug_notes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_debug_notes_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          level: string
          message: string
          payload_json: Json | null
          run_id: string
          scope: string
          seq: number
        }
        Insert: {
          created_at?: string
          event_type?: string
          id?: string
          level?: string
          message?: string
          payload_json?: Json | null
          run_id: string
          scope?: string
          seq?: number
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          level?: string
          message?: string
          payload_json?: Json | null
          run_id?: string
          scope?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "generation_runs"
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
      generation_runs: {
        Row: {
          chapter_id: string | null
          course_id: string | null
          created_at: string
          debug_bundle_json: Json | null
          duration_ms: number | null
          error_summary: string | null
          id: string
          model: string | null
          provider: string
          source_problem_id: string | null
          status: string
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          debug_bundle_json?: Json | null
          duration_ms?: number | null
          error_summary?: string | null
          id?: string
          model?: string | null
          provider?: string
          source_problem_id?: string | null
          status?: string
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          debug_bundle_json?: Json | null
          duration_ms?: number | null
          error_summary?: string | null
          id?: string
          model?: string | null
          provider?: string
          source_problem_id?: string | null
          status?: string
          user_id?: string | null
          variant_id?: string | null
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
      parsed_solution_blocks: {
        Row: {
          chapter_id: string
          cleaned_text: string
          confidence: number
          course_id: string
          created_at: string
          file_id: string
          id: string
          page_end: number | null
          page_start: number | null
          raw_text: string
          source_code: string
          source_type: string
          status: string
        }
        Insert: {
          chapter_id: string
          cleaned_text?: string
          confidence?: number
          course_id: string
          created_at?: string
          file_id: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          raw_text?: string
          source_code?: string
          source_type?: string
          status?: string
        }
        Update: {
          chapter_id?: string
          cleaned_text?: string
          confidence?: number
          course_id?: string
          created_at?: string
          file_id?: string
          id?: string
          page_end?: number | null
          page_start?: number | null
          raw_text?: string
          source_code?: string
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "parsed_solution_blocks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_solution_blocks_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_solution_blocks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          chapter_id: string | null
          course_id: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          link_type: string
          original_price_cents: number | null
          price_cents: number
          sale_expires_at: string | null
          sale_label: string | null
          url: string
        }
        Insert: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          link_type?: string
          original_price_cents?: number | null
          price_cents?: number
          sale_expires_at?: string | null
          sale_label?: string | null
          url?: string
        }
        Update: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          link_type?: string
          original_price_cents?: number | null
          price_cents?: number
          sale_expires_at?: string | null
          sale_label?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      preview_rate_limits: {
        Row: {
          attempt_count: number
          first_attempt_at: string
          id: string
          ip_hash: string
          last_attempt_at: string
        }
        Insert: {
          attempt_count?: number
          first_attempt_at?: string
          id?: string
          ip_hash: string
          last_attempt_at?: string
        }
        Update: {
          attempt_count?: number
          first_attempt_at?: string
          id?: string
          ip_hash?: string
          last_attempt_at?: string
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
      problem_instructions: {
        Row: {
          created_at: string
          id: string
          instruction_number: number
          instruction_text: string
          teaching_asset_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instruction_number: number
          instruction_text?: string
          teaching_asset_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instruction_number?: number
          instruction_text?: string
          teaching_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "problem_instructions_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
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
          answer_parts_json: Json | null
          base_problem_id: string
          candidate_data: Json
          created_at: string
          highlight_key_json: Json | null
          id: string
          je_entries_json: Json | null
          je_entry_status_json: Json | null
          je_skeleton_json: Json | null
          journal_entry_completed_json: Json | null
          journal_entry_template_json: Json | null
          parts_json: Json | null
          reviewed_at: string | null
          variant_label: string
          variant_problem_text: string
          variant_solution_text: string
          variant_status: string
        }
        Insert: {
          answer_parts_json?: Json | null
          base_problem_id: string
          candidate_data?: Json
          created_at?: string
          highlight_key_json?: Json | null
          id?: string
          je_entries_json?: Json | null
          je_entry_status_json?: Json | null
          je_skeleton_json?: Json | null
          journal_entry_completed_json?: Json | null
          journal_entry_template_json?: Json | null
          parts_json?: Json | null
          reviewed_at?: string | null
          variant_label?: string
          variant_problem_text?: string
          variant_solution_text?: string
          variant_status?: string
        }
        Update: {
          answer_parts_json?: Json | null
          base_problem_id?: string
          candidate_data?: Json
          created_at?: string
          highlight_key_json?: Json | null
          id?: string
          je_entries_json?: Json | null
          je_entry_status_json?: Json | null
          je_skeleton_json?: Json | null
          journal_entry_completed_json?: Json | null
          journal_entry_template_json?: Json | null
          parts_json?: Json | null
          reviewed_at?: string | null
          variant_label?: string
          variant_problem_text?: string
          variant_solution_text?: string
          variant_status?: string
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
      sheet_prep_log: {
        Row: {
          archived: boolean
          id: string
          notes: string | null
          reviewed: boolean
          reviewed_at: string | null
          submitted_at: string
          teaching_asset_id: string
          va_account_id: string | null
        }
        Insert: {
          archived?: boolean
          id?: string
          notes?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          submitted_at?: string
          teaching_asset_id: string
          va_account_id?: string | null
        }
        Update: {
          archived?: boolean
          id?: string
          notes?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          submitted_at?: string
          teaching_asset_id?: string
          va_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sheet_prep_log_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_prep_log_va_account_id_fkey"
            columns: ["va_account_id"]
            isOneToOne: false
            referencedRelation: "va_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          template_file_id: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          template_file_id: string
          version?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          template_file_id?: string
          version?: string
        }
        Relationships: []
      }
      solutions_qa_assets: {
        Row: {
          asset_name: string
          chapter_id: string
          course_id: string
          created_at: string
          id: string
          qa_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          teaching_asset_id: string
        }
        Insert: {
          asset_name: string
          chapter_id: string
          course_id: string
          created_at?: string
          id?: string
          qa_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          teaching_asset_id: string
        }
        Update: {
          asset_name?: string
          chapter_id?: string
          course_id?: string
          created_at?: string
          id?: string
          qa_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          teaching_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solutions_qa_assets_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      solutions_qa_issues: {
        Row: {
          asset_name: string
          created_at: string
          fix_description: string | null
          fix_scope: string
          fix_status: string
          id: string
          issue_description: string
          qa_asset_id: string
          screenshot_url: string | null
          section: string
          suggested_fix: string | null
        }
        Insert: {
          asset_name: string
          created_at?: string
          fix_description?: string | null
          fix_scope?: string
          fix_status?: string
          id?: string
          issue_description: string
          qa_asset_id: string
          screenshot_url?: string | null
          section: string
          suggested_fix?: string | null
        }
        Update: {
          asset_name?: string
          created_at?: string
          fix_description?: string | null
          fix_scope?: string
          fix_status?: string
          id?: string
          issue_description?: string
          qa_asset_id?: string
          screenshot_url?: string | null
          section?: string
          suggested_fix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solutions_qa_issues_qa_asset_id_fkey"
            columns: ["qa_asset_id"]
            isOneToOne: false
            referencedRelation: "solutions_qa_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      solutions_qa_reviews: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          asset_name: string
          chapter_id: string
          course_id: string
          created_at: string
          fix_description: string | null
          id: string
          issue_description: string | null
          lovable_prompt_generated: boolean
          qa_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_url: string | null
          teaching_asset_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          asset_name?: string
          chapter_id: string
          course_id: string
          created_at?: string
          fix_description?: string | null
          id?: string
          issue_description?: string | null
          lovable_prompt_generated?: boolean
          qa_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          teaching_asset_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          asset_name?: string
          chapter_id?: string
          course_id?: string
          created_at?: string
          fix_description?: string | null
          id?: string
          issue_description?: string | null
          lovable_prompt_generated?: boolean
          qa_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          teaching_asset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solutions_qa_reviews_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
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
          admin_notes: Json
          answer_summary_backup: string | null
          asset_approved_at: string | null
          asset_name: string
          asset_type: Database["public"]["Enums"]["asset_type"]
          banked_generated_at: string | null
          banked_generation_status: string
          banked_review_status: string
          banked_reviewed_at: string | null
          base_raw_problem_id: string | null
          chapter_id: string
          concept_notes: string | null
          core_rank: number | null
          course_id: string
          created_at: string
          csv_export_status: string
          csv_exported_at: string | null
          debug_annotated_at: string | null
          debug_session_id: string | null
          deployment_completed_at: string | null
          deployment_status: string
          difficulty: Database["public"]["Enums"]["asset_difficulty"] | null
          ebook_status: string
          exam_traps: string | null
          financial_statements_json: Json | null
          flowchart_image_id: string | null
          flowchart_image_url: string | null
          google_sheet_file_id: string | null
          google_sheet_status: string
          google_sheet_url: string | null
          id: string
          important_formulas: string | null
          instruction_1: string | null
          instruction_2: string | null
          instruction_3: string | null
          instruction_4: string | null
          instruction_5: string | null
          instruction_list: string | null
          journal_entry_block: string | null
          journal_entry_completed_json: Json | null
          journal_entry_template_json: Json | null
          last_bulk_fix_at: string | null
          last_bulk_fix_label: string | null
          last_tutored_at: string | null
          lw_csv_exported_at: string | null
          lw_ebook_url: string | null
          lw_html_added: boolean | null
          lw_import_status: string
          lw_imported_at: string | null
          lw_quiz_url: string | null
          lw_video_url: string | null
          mc_status: string
          phase2_entered_at: string | null
          phase2_status: string | null
          practice_page_views: number | null
          prep_doc_id: string | null
          prep_doc_url: string | null
          problem_context: string | null
          problem_context_backup: string | null
          problem_text_backup: string | null
          problem_text_ht_backup: string | null
          problem_title: string | null
          problem_type: string | null
          qa_status: string
          sheet_last_synced_at: string | null
          sheet_master_url: string | null
          sheet_path_url: string | null
          sheet_practice_url: string | null
          sheet_promo_url: string | null
          sheet_template_version: string | null
          solution_screenshot_url: string | null
          solutions_page_views: number | null
          source_number: string | null
          source_ref: string | null
          source_type: string | null
          supplementary_je_json: Json | null
          survive_problem_text: string
          survive_solution_text: string
          t_accounts_json: Json | null
          tables_json: Json | null
          tags: string[]
          test_slide_id: string | null
          test_slide_url: string | null
          times_used: number
          topic_id: string | null
          updated_at: string
          uses_financial_statements: boolean
          uses_t_accounts: boolean
          uses_tables: boolean
          video_production_status: string
          video_ready_at: string | null
          whiteboard_status: string
          worked_steps: string | null
          worked_steps_backup: string | null
        }
        Insert: {
          admin_notes?: Json
          answer_summary_backup?: string | null
          asset_approved_at?: string | null
          asset_name?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          banked_generated_at?: string | null
          banked_generation_status?: string
          banked_review_status?: string
          banked_reviewed_at?: string | null
          base_raw_problem_id?: string | null
          chapter_id: string
          concept_notes?: string | null
          core_rank?: number | null
          course_id: string
          created_at?: string
          csv_export_status?: string
          csv_exported_at?: string | null
          debug_annotated_at?: string | null
          debug_session_id?: string | null
          deployment_completed_at?: string | null
          deployment_status?: string
          difficulty?: Database["public"]["Enums"]["asset_difficulty"] | null
          ebook_status?: string
          exam_traps?: string | null
          financial_statements_json?: Json | null
          flowchart_image_id?: string | null
          flowchart_image_url?: string | null
          google_sheet_file_id?: string | null
          google_sheet_status?: string
          google_sheet_url?: string | null
          id?: string
          important_formulas?: string | null
          instruction_1?: string | null
          instruction_2?: string | null
          instruction_3?: string | null
          instruction_4?: string | null
          instruction_5?: string | null
          instruction_list?: string | null
          journal_entry_block?: string | null
          journal_entry_completed_json?: Json | null
          journal_entry_template_json?: Json | null
          last_bulk_fix_at?: string | null
          last_bulk_fix_label?: string | null
          last_tutored_at?: string | null
          lw_csv_exported_at?: string | null
          lw_ebook_url?: string | null
          lw_html_added?: boolean | null
          lw_import_status?: string
          lw_imported_at?: string | null
          lw_quiz_url?: string | null
          lw_video_url?: string | null
          mc_status?: string
          phase2_entered_at?: string | null
          phase2_status?: string | null
          practice_page_views?: number | null
          prep_doc_id?: string | null
          prep_doc_url?: string | null
          problem_context?: string | null
          problem_context_backup?: string | null
          problem_text_backup?: string | null
          problem_text_ht_backup?: string | null
          problem_title?: string | null
          problem_type?: string | null
          qa_status?: string
          sheet_last_synced_at?: string | null
          sheet_master_url?: string | null
          sheet_path_url?: string | null
          sheet_practice_url?: string | null
          sheet_promo_url?: string | null
          sheet_template_version?: string | null
          solution_screenshot_url?: string | null
          solutions_page_views?: number | null
          source_number?: string | null
          source_ref?: string | null
          source_type?: string | null
          supplementary_je_json?: Json | null
          survive_problem_text?: string
          survive_solution_text?: string
          t_accounts_json?: Json | null
          tables_json?: Json | null
          tags?: string[]
          test_slide_id?: string | null
          test_slide_url?: string | null
          times_used?: number
          topic_id?: string | null
          updated_at?: string
          uses_financial_statements?: boolean
          uses_t_accounts?: boolean
          uses_tables?: boolean
          video_production_status?: string
          video_ready_at?: string | null
          whiteboard_status?: string
          worked_steps?: string | null
          worked_steps_backup?: string | null
        }
        Update: {
          admin_notes?: Json
          answer_summary_backup?: string | null
          asset_approved_at?: string | null
          asset_name?: string
          asset_type?: Database["public"]["Enums"]["asset_type"]
          banked_generated_at?: string | null
          banked_generation_status?: string
          banked_review_status?: string
          banked_reviewed_at?: string | null
          base_raw_problem_id?: string | null
          chapter_id?: string
          concept_notes?: string | null
          core_rank?: number | null
          course_id?: string
          created_at?: string
          csv_export_status?: string
          csv_exported_at?: string | null
          debug_annotated_at?: string | null
          debug_session_id?: string | null
          deployment_completed_at?: string | null
          deployment_status?: string
          difficulty?: Database["public"]["Enums"]["asset_difficulty"] | null
          ebook_status?: string
          exam_traps?: string | null
          financial_statements_json?: Json | null
          flowchart_image_id?: string | null
          flowchart_image_url?: string | null
          google_sheet_file_id?: string | null
          google_sheet_status?: string
          google_sheet_url?: string | null
          id?: string
          important_formulas?: string | null
          instruction_1?: string | null
          instruction_2?: string | null
          instruction_3?: string | null
          instruction_4?: string | null
          instruction_5?: string | null
          instruction_list?: string | null
          journal_entry_block?: string | null
          journal_entry_completed_json?: Json | null
          journal_entry_template_json?: Json | null
          last_bulk_fix_at?: string | null
          last_bulk_fix_label?: string | null
          last_tutored_at?: string | null
          lw_csv_exported_at?: string | null
          lw_ebook_url?: string | null
          lw_html_added?: boolean | null
          lw_import_status?: string
          lw_imported_at?: string | null
          lw_quiz_url?: string | null
          lw_video_url?: string | null
          mc_status?: string
          phase2_entered_at?: string | null
          phase2_status?: string | null
          practice_page_views?: number | null
          prep_doc_id?: string | null
          prep_doc_url?: string | null
          problem_context?: string | null
          problem_context_backup?: string | null
          problem_text_backup?: string | null
          problem_text_ht_backup?: string | null
          problem_title?: string | null
          problem_type?: string | null
          qa_status?: string
          sheet_last_synced_at?: string | null
          sheet_master_url?: string | null
          sheet_path_url?: string | null
          sheet_practice_url?: string | null
          sheet_promo_url?: string | null
          sheet_template_version?: string | null
          solution_screenshot_url?: string | null
          solutions_page_views?: number | null
          source_number?: string | null
          source_ref?: string | null
          source_type?: string | null
          supplementary_je_json?: Json | null
          survive_problem_text?: string
          survive_solution_text?: string
          t_accounts_json?: Json | null
          tables_json?: Json | null
          tags?: string[]
          test_slide_id?: string | null
          test_slide_url?: string | null
          times_used?: number
          topic_id?: string | null
          updated_at?: string
          uses_financial_statements?: boolean
          uses_t_accounts?: boolean
          uses_tables?: boolean
          video_production_status?: string
          video_ready_at?: string | null
          whiteboard_status?: string
          worked_steps?: string | null
          worked_steps_backup?: string | null
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
          {
            foreignKeyName: "teaching_assets_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "chapter_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      textbooks: {
        Row: {
          created_at: string
          edition: string
          id: string
          isbn: string
          publisher: string
          title: string
        }
        Insert: {
          created_at?: string
          edition?: string
          id?: string
          isbn?: string
          publisher?: string
          title: string
        }
        Update: {
          created_at?: string
          edition?: string
          id?: string
          isbn?: string
          publisher?: string
          title?: string
        }
        Relationships: []
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
      uploaded_files: {
        Row: {
          chapter_id: string | null
          course_id: string | null
          created_at: string
          filename: string
          id: string
          mime_type: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          filename: string
          id?: string
          mime_type?: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_files_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_files_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
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
      va_accounts: {
        Row: {
          account_status: string
          assigned_chapter_id: string | null
          assigned_course_id: string | null
          completed_at: string | null
          created_at: string
          email: string
          first_action_at: string | null
          first_login_at: string | null
          full_name: string
          id: string
          last_action_at: string | null
          role: string
          test_assigned_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          assigned_chapter_id?: string | null
          assigned_course_id?: string | null
          completed_at?: string | null
          created_at?: string
          email: string
          first_action_at?: string | null
          first_login_at?: string | null
          full_name: string
          id?: string
          last_action_at?: string | null
          role?: string
          test_assigned_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          assigned_chapter_id?: string | null
          assigned_course_id?: string | null
          completed_at?: string | null
          created_at?: string
          email?: string
          first_action_at?: string | null
          first_login_at?: string | null
          full_name?: string
          id?: string
          last_action_at?: string | null
          role?: string
          test_assigned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "va_accounts_assigned_chapter_id_fkey"
            columns: ["assigned_chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "va_accounts_assigned_course_id_fkey"
            columns: ["assigned_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      va_activity_log: {
        Row: {
          action_type: string
          asset_id: string | null
          chapter_id: string | null
          created_at: string
          id: string
          payload_json: Json | null
          user_id: string
        }
        Insert: {
          action_type: string
          asset_id?: string | null
          chapter_id?: string | null
          created_at?: string
          id?: string
          payload_json?: Json | null
          user_id: string
        }
        Update: {
          action_type?: string
          asset_id?: string | null
          chapter_id?: string | null
          created_at?: string
          id?: string
          payload_json?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "va_activity_log_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      va_assignments: {
        Row: {
          assigned_at: string
          assigned_role: string
          chapter_id: string
          course_id: string
          created_at: string
          hours_logged: number
          id: string
          notes: string | null
          status: string
          va_account_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_role?: string
          chapter_id: string
          course_id: string
          created_at?: string
          hours_logged?: number
          id?: string
          notes?: string | null
          status?: string
          va_account_id: string
        }
        Update: {
          assigned_at?: string
          assigned_role?: string
          chapter_id?: string
          course_id?: string
          created_at?: string
          hours_logged?: number
          id?: string
          notes?: string | null
          status?: string
          va_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "va_assignments_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "va_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "va_assignments_va_account_id_fkey"
            columns: ["va_account_id"]
            isOneToOne: false
            referencedRelation: "va_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      va_completion_log: {
        Row: {
          asset_name: string
          chapter_number: number
          completed_at: string
          completion_type: string
          course_code: string
          id: string
          source_code: string
          teaching_asset_id: string | null
          user_id: string
          va_account_id: string
        }
        Insert: {
          asset_name?: string
          chapter_number?: number
          completed_at?: string
          completion_type?: string
          course_code?: string
          id?: string
          source_code?: string
          teaching_asset_id?: string | null
          user_id: string
          va_account_id: string
        }
        Update: {
          asset_name?: string
          chapter_number?: number
          completed_at?: string
          completion_type?: string
          course_code?: string
          id?: string
          source_code?: string
          teaching_asset_id?: string | null
          user_id?: string
          va_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "va_completion_log_teaching_asset_id_fkey"
            columns: ["teaching_asset_id"]
            isOneToOne: false
            referencedRelation: "teaching_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      va_questions: {
        Row: {
          addressed_at: string | null
          admin_response: string | null
          chapter_id: string | null
          created_at: string
          id: string
          question: string
          status: string
          va_account_id: string
        }
        Insert: {
          addressed_at?: string | null
          admin_response?: string | null
          chapter_id?: string | null
          created_at?: string
          id?: string
          question?: string
          status?: string
          va_account_id: string
        }
        Update: {
          addressed_at?: string | null
          admin_response?: string | null
          chapter_id?: string | null
          created_at?: string
          id?: string
          question?: string
          status?: string
          va_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "va_questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "va_questions_va_account_id_fkey"
            columns: ["va_account_id"]
            isOneToOne: false
            referencedRelation: "va_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      increment_practice_views: {
        Args: { asset_id: string }
        Returns: undefined
      }
      increment_solutions_views: {
        Args: { asset_id: string }
        Returns: undefined
      }
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
      asset_status: "imported" | "variant_generated" | "approved" | "banked"
      asset_type:
        | "practice_problem"
        | "journal_entry"
        | "concept_review"
        | "exam_prep"
      asset_video_status: "none" | "coming_soon" | "published"
      banked_question_type:
        | "JE_MC"
        | "CALC_MC"
        | "CONCEPT_MC"
        | "TRUE_FALSE"
        | "TRAP"
        | "RELEVANT_INFO"
        | "IRRELEVANT_INFO"
      difficulty_level: "easy" | "medium" | "hard" | "tricky"
      entity_type:
        | "source_problem"
        | "lw_item"
        | "export_job"
        | "topic"
        | "chapter"
        | "system"
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
      problem_type: "exercise" | "problem" | "custom" | "quick_study"
      question_review_status: "pending" | "approved" | "rejected"
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
      asset_status: ["imported", "variant_generated", "approved", "banked"],
      asset_type: [
        "practice_problem",
        "journal_entry",
        "concept_review",
        "exam_prep",
      ],
      asset_video_status: ["none", "coming_soon", "published"],
      banked_question_type: [
        "JE_MC",
        "CALC_MC",
        "CONCEPT_MC",
        "TRUE_FALSE",
        "TRAP",
        "RELEVANT_INFO",
        "IRRELEVANT_INFO",
      ],
      difficulty_level: ["easy", "medium", "hard", "tricky"],
      entity_type: [
        "source_problem",
        "lw_item",
        "export_job",
        "topic",
        "chapter",
        "system",
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
      problem_type: ["exercise", "problem", "custom", "quick_study"],
      question_review_status: ["pending", "approved", "rejected"],
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
