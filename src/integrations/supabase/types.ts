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
      ai_action_costs: {
        Row: {
          coins_cost: number
          created_at: string
          est_cost_usd: number
          id: string
          is_active: boolean
          label: string
          margin_alert_pct: number
          updated_at: string
        }
        Insert: {
          coins_cost?: number
          created_at?: string
          est_cost_usd?: number
          id: string
          is_active?: boolean
          label: string
          margin_alert_pct?: number
          updated_at?: string
        }
        Update: {
          coins_cost?: number
          created_at?: string
          est_cost_usd?: number
          id?: string
          is_active?: boolean
          label?: string
          margin_alert_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_budget_limits: {
        Row: {
          daily_limit_micros: number
          enabled: boolean
          id: number
          metering_ready: boolean
          monthly_limit_micros: number
          updated_at: string
        }
        Insert: {
          daily_limit_micros: number
          enabled?: boolean
          id: number
          metering_ready?: boolean
          monthly_limit_micros: number
          updated_at?: string
        }
        Update: {
          daily_limit_micros?: number
          enabled?: boolean
          id?: number
          metering_ready?: boolean
          monthly_limit_micros?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_budget_reservations: {
        Row: {
          action_id: string
          attempt_id: string
          billed_micros: number | null
          created_at: string
          id: string
          rate_version: string
          reconciled_at: string | null
          reserved_micros: number
          resource: string
          status: string
          user_id: string
        }
        Insert: {
          action_id: string
          attempt_id: string
          billed_micros?: number | null
          created_at?: string
          id?: string
          rate_version: string
          reconciled_at?: string | null
          reserved_micros: number
          resource: string
          status: string
          user_id: string
        }
        Update: {
          action_id?: string
          attempt_id?: string
          billed_micros?: number | null
          created_at?: string
          id?: string
          rate_version?: string
          reconciled_at?: string | null
          reserved_micros?: number
          resource?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_tts_authorizations: {
        Row: {
          action_id: string
          attempts: number
          consumed_at: string | null
          created_at: string
          response_hash: string
          user_id: string
        }
        Insert: {
          action_id: string
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          response_hash: string
          user_id: string
        }
        Update: {
          action_id?: string
          attempts?: number
          consumed_at?: string | null
          created_at?: string
          response_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_fallback_log: {
        Row: {
          created_at: string
          failed_model: string
          fallback_model: string | null
          feature: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          failed_model: string
          fallback_model?: string | null
          feature: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          failed_model?: string
          fallback_model?: string | null
          feature?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      ai_flashcoin_holds: {
        Row: {
          action_id: string
          amount: number
          cost_id: string | null
          created_at: string
          expires_at: string
          id: string
          job_id: string
          quota_reservation_id: string | null
          resource: string | null
          settled_at: string | null
          status: string
          uncertain: boolean
          unit_cost: number | null
          user_id: string
        }
        Insert: {
          action_id: string
          amount: number
          cost_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          job_id: string
          quota_reservation_id?: string | null
          resource?: string | null
          settled_at?: string | null
          status: string
          uncertain?: boolean
          unit_cost?: number | null
          user_id: string
        }
        Update: {
          action_id?: string
          amount?: number
          cost_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          job_id?: string
          quota_reservation_id?: string | null
          resource?: string | null
          settled_at?: string | null
          status?: string
          uncertain?: boolean
          unit_cost?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_flashcoin_holds_cost_id_fkey"
            columns: ["cost_id"]
            isOneToOne: false
            referencedRelation: "ai_action_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_flashcoin_holds_quota_reservation_id_fkey"
            columns: ["quota_reservation_id"]
            isOneToOne: false
            referencedRelation: "ai_quota_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_flashcard_billing_reservations: {
        Row: {
          action_id: string
          coin_units: number
          created_at: string
          generated_units: number | null
          id: string
          included_units: number
          job_id: string
          quota_reservation_id: string | null
          requested_units: number
          saved_coin_units: number
          saved_included_units: number
          settled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          action_id: string
          coin_units: number
          created_at?: string
          generated_units?: number | null
          id?: string
          included_units: number
          job_id: string
          quota_reservation_id?: string | null
          requested_units: number
          saved_coin_units?: number
          saved_included_units?: number
          settled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          action_id?: string
          coin_units?: number
          created_at?: string
          generated_units?: number | null
          id?: string
          included_units?: number
          job_id?: string
          quota_reservation_id?: string | null
          requested_units?: number
          saved_coin_units?: number
          saved_included_units?: number
          settled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_flashcard_billing_reserv_quota_reservation_id_fkey"
            columns: ["quota_reservation_id"]
            isOneToOne: false
            referencedRelation: "ai_quota_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_flashcard_billing_reservations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "document_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generated_flashcard_outputs: {
        Row: {
          action_id: string
          answer: string
          created_at: string
          flashcoin_cost: number
          image_index: number | null
          job_id: string
          ordinal: number
          output_id: string
          question: string
          saved_action_id: string | null
          saved_at: string | null
          user_id: string
        }
        Insert: {
          action_id: string
          answer: string
          created_at?: string
          flashcoin_cost?: number
          image_index?: number | null
          job_id: string
          ordinal: number
          output_id?: string
          question: string
          saved_action_id?: string | null
          saved_at?: string | null
          user_id: string
        }
        Update: {
          action_id?: string
          answer?: string
          created_at?: string
          flashcoin_cost?: number
          image_index?: number | null
          job_id?: string
          ordinal?: number
          output_id?: string
          question?: string
          saved_action_id?: string | null
          saved_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_generation_leases: {
        Row: {
          action_id: string
          lease_expires_at: string
          lease_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_id: string
          lease_expires_at: string
          lease_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_id?: string
          lease_expires_at?: string
          lease_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_note_format_sessions: {
        Row: {
          action_id: string
          created_at: string
          expires_at: string
          in_flight_chars: number | null
          in_flight_part: number | null
          next_part: number
          received_chars: number
          total_chars: number
          total_parts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          expires_at?: string
          in_flight_chars?: number | null
          in_flight_part?: number | null
          next_part?: number
          received_chars?: number
          total_chars: number
          total_parts: number
          updated_at?: string
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          expires_at?: string
          in_flight_chars?: number | null
          in_flight_part?: number | null
          next_part?: number
          received_chars?: number
          total_chars?: number
          total_parts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_quota_reservations: {
        Row: {
          action_id: string
          created_at: string
          daily_counted: boolean
          id: string
          job_id: string
          period_end: string
          period_start: string
          resource: string
          settled_at: string | null
          status: string
          units: number
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          daily_counted?: boolean
          id?: string
          job_id: string
          period_end: string
          period_start: string
          resource: string
          settled_at?: string | null
          status: string
          units: number
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          daily_counted?: boolean
          id?: string
          job_id?: string
          period_end?: string
          period_start?: string
          resource?: string
          settled_at?: string | null
          status?: string
          units?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_quota_usage: {
        Row: {
          action_id: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          resource: string
          units: number
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          resource: string
          units: number
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          resource?: string
          units?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_result_cache: {
        Row: {
          cache_key: string
          created_at: string
          hits: number
          kind: string
          last_hit_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          hits?: number
          kind: string
          last_hit_at?: string
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          hits?: number
          kind?: string
          last_hit_at?: string
          payload?: Json
        }
        Relationships: []
      }
      ai_trial_entitlements: {
        Row: {
          chat_turns_remaining: number
          formats_remaining: number
          granted_at: string | null
          maps_remaining: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_turns_remaining?: number
          formats_remaining?: number
          granted_at?: string | null
          maps_remaining?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_turns_remaining?: number
          formats_remaining?: number
          granted_at?: string | null
          maps_remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          chars: number
          coins_cost: number | null
          cost_usd: number | null
          created_at: string
          id: string
          kind: string
          lang: string | null
          user_id: string
        }
        Insert: {
          chars?: number
          coins_cost?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          kind: string
          lang?: string | null
          user_id: string
        }
        Update: {
          chars?: number
          coins_cost?: number | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          kind?: string
          lang?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_ledger: {
        Row: {
          action_id: string
          amount: number
          attempt_id: string
          billed_micros: number | null
          created_at: string
          id: string
          rate_version: string
          reconciled_at: string | null
          reserved_micros: number
          resource: string
          status: string
          user_id: string
        }
        Insert: {
          action_id: string
          amount?: number
          attempt_id: string
          billed_micros?: number | null
          created_at?: string
          id?: string
          rate_version: string
          reconciled_at?: string | null
          reserved_micros: number
          resource: string
          status: string
          user_id: string
        }
        Update: {
          action_id?: string
          amount?: number
          attempt_id?: string
          billed_micros?: number | null
          created_at?: string
          id?: string
          rate_version?: string
          reconciled_at?: string | null
          reserved_micros?: number
          resource?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_welcome_grants: {
        Row: {
          device_hash: string | null
          granted_at: string
          subnet_hash: string | null
          user_id: string
        }
        Insert: {
          device_hash?: string | null
          granted_at?: string
          subnet_hash?: string | null
          user_id: string
        }
        Update: {
          device_hash?: string | null
          granted_at?: string
          subnet_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          label: string | null
          lang: string | null
          path: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          label?: string | null
          lang?: string | null
          path: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          label?: string | null
          lang?: string | null
          path?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      billing_archive: {
        Row: {
          amount_cents: number | null
          archived_at: string
          created_at: string
          currency: string | null
          email: string | null
          environment: string | null
          expires_at: string | null
          former_user_id: string
          id: string
          paddle_transaction_id: string | null
          price_id: string | null
          product_id: string | null
          purchased_at: string | null
          refunded_at: string | null
          source: string
        }
        Insert: {
          amount_cents?: number | null
          archived_at?: string
          created_at?: string
          currency?: string | null
          email?: string | null
          environment?: string | null
          expires_at?: string | null
          former_user_id: string
          id?: string
          paddle_transaction_id?: string | null
          price_id?: string | null
          product_id?: string | null
          purchased_at?: string | null
          refunded_at?: string | null
          source?: string
        }
        Update: {
          amount_cents?: number | null
          archived_at?: string
          created_at?: string
          currency?: string | null
          email?: string | null
          environment?: string | null
          expires_at?: string | null
          former_user_id?: string
          id?: string
          paddle_transaction_id?: string | null
          price_id?: string | null
          product_id?: string | null
          purchased_at?: string | null
          refunded_at?: string | null
          source?: string
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          created_at: string
          id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_category_translations: {
        Row: {
          category_id: string
          id: string
          lang: string
          name: string
        }
        Insert: {
          category_id: string
          id?: string
          lang: string
          name: string
        }
        Update: {
          category_id?: string
          id?: string
          lang?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_comments: {
        Row: {
          body: string
          created_at: string
          hidden: boolean
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          hidden?: boolean
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          hidden?: boolean
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_newsletter_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          post_id: string
          sent_at: string | null
          status: string
          subscriber_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          post_id: string
          sent_at?: string | null
          status?: string
          subscriber_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          post_id?: string
          sent_at?: string | null
          status?: string
          subscriber_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_newsletter_deliveries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_newsletter_deliveries_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "blog_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_newsletter_publications: {
        Row: {
          created_at: string
          post_id: string
          queued_at: string | null
        }
        Insert: {
          created_at?: string
          post_id: string
          queued_at?: string | null
        }
        Update: {
          created_at?: string
          post_id?: string
          queued_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_newsletter_publications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_translations: {
        Row: {
          body_html: string
          excerpt: string | null
          id: string
          lang: string
          post_id: string
          seo_description: string | null
          seo_title: string | null
          title: string
        }
        Insert: {
          body_html?: string
          excerpt?: string | null
          id?: string
          lang: string
          post_id: string
          seo_description?: string | null
          seo_title?: string | null
          title: string
        }
        Update: {
          body_html?: string
          excerpt?: string | null
          id?: string
          lang?: string
          post_id?: string
          seo_description?: string | null
          seo_title?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          category_id: string | null
          cover_image_url: string | null
          cover_image_width: number
          created_at: string
          featured: boolean
          id: string
          published_at: string | null
          reading_time_min: number
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          author_id: string
          category_id?: string | null
          cover_image_url?: string | null
          cover_image_width?: number
          created_at?: string
          featured?: boolean
          id?: string
          published_at?: string | null
          reading_time_min?: number
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          category_id?: string | null
          cover_image_url?: string | null
          cover_image_width?: number
          created_at?: string
          featured?: boolean
          id?: string
          published_at?: string | null
          reading_time_min?: number
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_ratings: {
        Row: {
          created_at: string
          id: string
          post_id: string
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          stars: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_ratings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_subscribers: {
        Row: {
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          lang: string
          name: string | null
          unsubscribe_token: string
          updated_at: string
        }
        Insert: {
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          lang?: string
          name?: string | null
          unsubscribe_token?: string
          updated_at?: string
        }
        Update: {
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          lang?: string
          name?: string | null
          unsubscribe_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      card_videos: {
        Row: {
          audio_mime: string | null
          audio_storage_path: string | null
          audio_voice: string | null
          card_id: string | null
          created_at: string
          id: string
          is_official: boolean
          lang: string
          microcontext_id: string | null
          scenes: Json
          style: string
          transcript: string
          transcript_note: string | null
          user_id: string
        }
        Insert: {
          audio_mime?: string | null
          audio_storage_path?: string | null
          audio_voice?: string | null
          card_id?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          lang: string
          microcontext_id?: string | null
          scenes?: Json
          style: string
          transcript?: string
          transcript_note?: string | null
          user_id: string
        }
        Update: {
          audio_mime?: string | null
          audio_storage_path?: string | null
          audio_voice?: string | null
          card_id?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          lang?: string
          microcontext_id?: string | null
          scenes?: Json
          style?: string
          transcript?: string
          transcript_note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_videos_microcontext_id_fkey"
            columns: ["microcontext_id"]
            isOneToOne: false
            referencedRelation: "microcontexts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_curation: {
        Row: {
          answer: string
          audit_reason: string
          chapter: string
          created_at: string
          eligible: boolean
          id: string
          language: string
          official_card_id: string | null
          question: string
          reference: string
          review_notes: string
          reviewed_at: string | null
          reviewed_by: string | null
          rights_confirmed: boolean
          rights_notes: string
          risk: string
          source_answer: string
          source_card_id: string
          source_question: string
          status: string
          subject: string
          topic: string
          version: number
        }
        Insert: {
          answer: string
          audit_reason: string
          chapter: string
          created_at?: string
          eligible?: boolean
          id?: string
          language?: string
          official_card_id?: string | null
          question: string
          reference?: string
          review_notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_confirmed?: boolean
          rights_notes?: string
          risk?: string
          source_answer: string
          source_card_id: string
          source_question: string
          status?: string
          subject: string
          topic: string
          version?: number
        }
        Update: {
          answer?: string
          audit_reason?: string
          chapter?: string
          created_at?: string
          eligible?: boolean
          id?: string
          language?: string
          official_card_id?: string | null
          question?: string
          reference?: string
          review_notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_confirmed?: boolean
          rights_notes?: string
          risk?: string
          source_answer?: string
          source_card_id?: string
          source_question?: string
          status?: string
          subject?: string
          topic?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_curation_official_card_id_fkey"
            columns: ["official_card_id"]
            isOneToOne: true
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      community_curation_events: {
        Row: {
          created_at: string
          curation_id: string
          decision: string
          id: string
          review_notes: string
          reviewer_id: string
          rights_notes: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          curation_id: string
          decision: string
          id?: string
          review_notes: string
          reviewer_id: string
          rights_notes: string
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          curation_id?: string
          decision?: string
          id?: string
          review_notes?: string
          reviewer_id?: string
          rights_notes?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_curation_events_curation_id_fkey"
            columns: ["curation_id"]
            isOneToOne: false
            referencedRelation: "community_curation"
            referencedColumns: ["id"]
          },
        ]
      }
      community_game_curation: {
        Row: {
          audit_reason: string
          audited: boolean
          chapter: string
          created_at: string
          eligible: boolean
          id: string
          language: string
          official_deck_id: string | null
          review_notes: string
          reviewed_at: string | null
          reviewed_by: string | null
          rights_confirmed: boolean
          rights_notes: string
          risk: string
          rounds: Json
          source_deck_id: string | null
          status: string
          subject: string
          submitted_by: string | null
          title: string
          topic: string
          version: number
        }
        Insert: {
          audit_reason?: string
          audited?: boolean
          chapter: string
          created_at?: string
          eligible?: boolean
          id?: string
          language?: string
          official_deck_id?: string | null
          review_notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_confirmed?: boolean
          rights_notes?: string
          risk?: string
          rounds: Json
          source_deck_id?: string | null
          status?: string
          subject: string
          submitted_by?: string | null
          title: string
          topic: string
          version?: number
        }
        Update: {
          audit_reason?: string
          audited?: boolean
          chapter?: string
          created_at?: string
          eligible?: boolean
          id?: string
          language?: string
          official_deck_id?: string | null
          review_notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_confirmed?: boolean
          rights_notes?: string
          risk?: string
          rounds?: Json
          source_deck_id?: string | null
          status?: string
          subject?: string
          submitted_by?: string | null
          title?: string
          topic?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_game_curation_official_deck_id_fkey"
            columns: ["official_deck_id"]
            isOneToOne: true
            referencedRelation: "game_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      community_game_curation_events: {
        Row: {
          created_at: string
          curation_id: string
          decision: string
          id: string
          review_notes: string
          reviewer_id: string
          rights_notes: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          curation_id: string
          decision: string
          id?: string
          review_notes: string
          reviewer_id: string
          rights_notes: string
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          curation_id?: string
          decision?: string
          id?: string
          review_notes?: string
          reviewer_id?: string
          rights_notes?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_game_curation_events_curation_id_fkey"
            columns: ["curation_id"]
            isOneToOne: false
            referencedRelation: "community_game_curation"
            referencedColumns: ["id"]
          },
        ]
      }
      document_jobs: {
        Row: {
          action_id: string | null
          cards_count: number
          created_at: string
          dismissed: boolean
          document_name: string
          error_message: string | null
          expires_at: string
          failed_parts: number
          focus: string | null
          hint: string | null
          id: string
          input_images: Json
          input_slices: Json
          mode: string
          processed_parts: number
          requested_cards: number
          result_cards: Json
          status: string
          total_parts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          action_id?: string | null
          cards_count?: number
          created_at?: string
          dismissed?: boolean
          document_name?: string
          error_message?: string | null
          expires_at?: string
          failed_parts?: number
          focus?: string | null
          hint?: string | null
          id?: string
          input_images?: Json
          input_slices?: Json
          mode?: string
          processed_parts?: number
          requested_cards?: number
          result_cards?: Json
          status?: string
          total_parts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          action_id?: string | null
          cards_count?: number
          created_at?: string
          dismissed?: boolean
          document_name?: string
          error_message?: string | null
          expires_at?: string
          failed_parts?: number
          focus?: string | null
          hint?: string | null
          id?: string
          input_images?: Json
          input_slices?: Json
          mode?: string
          processed_parts?: number
          requested_cards?: number
          result_cards?: Json
          status?: string
          total_parts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_reviews: {
        Row: {
          created_at: string
          ease_factor: number | null
          flashcard_id: string
          id: string
          interval_days: number | null
          next_due_date: string | null
          previous_due_date: string | null
          quality: number
          repetitions: number | null
          reviewed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ease_factor?: number | null
          flashcard_id: string
          id?: string
          interval_days?: number | null
          next_due_date?: string | null
          previous_due_date?: string | null
          quality: number
          repetitions?: number | null
          reviewed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ease_factor?: number | null
          flashcard_id?: string
          id?: string
          interval_days?: number | null
          next_due_date?: string | null
          previous_due_date?: string | null
          quality?: number
          repetitions?: number | null
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_save_receipts: {
        Row: {
          action_id: string
          balance_after: number
          created_at: string
          inserted_count: number
          payload_hash: string
          user_id: string
        }
        Insert: {
          action_id: string
          balance_after: number
          created_at?: string
          inserted_count: number
          payload_hash: string
          user_id: string
        }
        Update: {
          action_id?: string
          balance_after?: number
          created_at?: string
          inserted_count?: number
          payload_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      flashcard_usage: {
        Row: {
          created_at: string
          flashcard_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flashcard_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flashcard_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_usage_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          answer: string
          answer_original: string | null
          card_format: string
          conversion_reason: string | null
          created_at: string
          due_date: string
          ease_factor: number
          id: string
          image_category_id: string | null
          image_focus: number | null
          image_pins: Json | null
          image_url: string | null
          interval_days: number
          is_favorite: boolean
          is_public_verified: boolean
          language: string | null
          last_reviewed_at: string | null
          linked_note_id: string | null
          microcontext_id: string | null
          order_index: number | null
          question: string
          question_original: string | null
          repetitions: number
          reviewed: boolean
          reviewed_marked_at: string | null
          revision_version: number
          rewritten_at: string | null
          source_id: string | null
          source_synced_at: string | null
          topic_id: string
          user_answer: string | null
          user_id: string
          user_modified: boolean
          video_url_1: string | null
          video_url_2: string | null
        }
        Insert: {
          answer: string
          answer_original?: string | null
          card_format?: string
          conversion_reason?: string | null
          created_at?: string
          due_date?: string
          ease_factor?: number
          id?: string
          image_category_id?: string | null
          image_focus?: number | null
          image_pins?: Json | null
          image_url?: string | null
          interval_days?: number
          is_favorite?: boolean
          is_public_verified?: boolean
          language?: string | null
          last_reviewed_at?: string | null
          linked_note_id?: string | null
          microcontext_id?: string | null
          order_index?: number | null
          question: string
          question_original?: string | null
          repetitions?: number
          reviewed?: boolean
          reviewed_marked_at?: string | null
          revision_version?: number
          rewritten_at?: string | null
          source_id?: string | null
          source_synced_at?: string | null
          topic_id: string
          user_answer?: string | null
          user_id: string
          user_modified?: boolean
          video_url_1?: string | null
          video_url_2?: string | null
        }
        Update: {
          answer?: string
          answer_original?: string | null
          card_format?: string
          conversion_reason?: string | null
          created_at?: string
          due_date?: string
          ease_factor?: number
          id?: string
          image_category_id?: string | null
          image_focus?: number | null
          image_pins?: Json | null
          image_url?: string | null
          interval_days?: number
          is_favorite?: boolean
          is_public_verified?: boolean
          language?: string | null
          last_reviewed_at?: string | null
          linked_note_id?: string | null
          microcontext_id?: string | null
          order_index?: number | null
          question?: string
          question_original?: string | null
          repetitions?: number
          reviewed?: boolean
          reviewed_marked_at?: string | null
          revision_version?: number
          rewritten_at?: string | null
          source_id?: string | null
          source_synced_at?: string | null
          topic_id?: string
          user_answer?: string | null
          user_id?: string
          user_modified?: boolean
          video_url_1?: string | null
          video_url_2?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_image_category_id_fkey"
            columns: ["image_category_id"]
            isOneToOne: false
            referencedRelation: "note_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_linked_note_id_fkey"
            columns: ["linked_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_microcontext_id_fkey"
            columns: ["microcontext_id"]
            isOneToOne: false
            referencedRelation: "microcontexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcoin_ledger: {
        Row: {
          action_id: string | null
          amount: number
          balance_after: number
          created_at: string
          id: string
          paddle_adjustment_id: string | null
          paddle_transaction_id: string | null
          purchase_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          action_id?: string | null
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          paddle_adjustment_id?: string | null
          paddle_transaction_id?: string | null
          purchase_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          action_id?: string | null
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          paddle_adjustment_id?: string | null
          paddle_transaction_id?: string | null
          purchase_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcoin_ledger_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "user_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      game_decks: {
        Row: {
          action_id: string | null
          created_at: string
          id: string
          is_official: boolean
          kind: string
          language: string | null
          source_id: string | null
          title: string
          topic_id: string
          user_id: string
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          kind?: string
          language?: string | null
          source_id?: string | null
          title: string
          topic_id: string
          user_id: string
        }
        Update: {
          action_id?: string | null
          created_at?: string
          id?: string
          is_official?: boolean
          kind?: string
          language?: string | null
          source_id?: string | null
          title?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_decks_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          created_at: string
          deck_id: string
          id: string
          payload: Json
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          id?: string
          payload: Json
          position: number
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          id?: string
          payload?: Json
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rounds_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "game_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_drafts: {
        Row: {
          activated_at: string | null
          content: string
          created_at: string
          email: string
          error: string | null
          expires_at: string
          full_name: string | null
          id: string
          lang: string
          processed_at: string | null
          status: string
          subject_id: string | null
          token_hash: string
          user_id: string | null
          want_map: boolean
          want_note: boolean
        }
        Insert: {
          activated_at?: string | null
          content: string
          created_at?: string
          email: string
          error?: string | null
          expires_at?: string
          full_name?: string | null
          id: string
          lang?: string
          processed_at?: string | null
          status?: string
          subject_id?: string | null
          token_hash: string
          user_id?: string | null
          want_map?: boolean
          want_note?: boolean
        }
        Update: {
          activated_at?: string | null
          content?: string
          created_at?: string
          email?: string
          error?: string | null
          expires_at?: string
          full_name?: string | null
          id?: string
          lang?: string
          processed_at?: string | null
          status?: string
          subject_id?: string | null
          token_hash?: string
          user_id?: string | null
          want_map?: boolean
          want_note?: boolean
        }
        Relationships: []
      }
      landing_source_usage: {
        Row: {
          calls: number
          client_key: string
          day: string
        }
        Insert: {
          calls?: number
          client_key: string
          day: string
        }
        Update: {
          calls?: number
          client_key?: string
          day?: string
        }
        Relationships: []
      }
      landing_test_usage: {
        Row: {
          day: string
          tests: number
          visitor_id: string
        }
        Insert: {
          day: string
          tests?: number
          visitor_id: string
        }
        Update: {
          day?: string
          tests?: number
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_test_usage_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "landing_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_visitor_cards: {
        Row: {
          answer: string
          created_at: string
          id: string
          ordinal: number
          question: string
          test_id: string
          visitor_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          ordinal: number
          question: string
          test_id: string
          visitor_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          ordinal?: number
          question?: string
          test_id?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "landing_visitor_cards_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "landing_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_visitor_handoffs: {
        Row: {
          cards_saved_at: string | null
          created_at: string
          generated_materials: Json | null
          generated_materials_at: string | null
          id: string
          lang: string
          materials_attempts: number
          materials_done_at: string | null
          reminder_sent_at: string | null
          source_text: string
          subject: string | null
          test_id: string
          topic: string | null
          topic_id: string | null
          user_id: string | null
          visitor_id: string
          want_map: boolean
          want_note: boolean
          want_video: boolean
        }
        Insert: {
          cards_saved_at?: string | null
          created_at?: string
          generated_materials?: Json | null
          generated_materials_at?: string | null
          id?: string
          lang?: string
          materials_attempts?: number
          materials_done_at?: string | null
          reminder_sent_at?: string | null
          source_text?: string
          subject?: string | null
          test_id: string
          topic?: string | null
          topic_id?: string | null
          user_id?: string | null
          visitor_id: string
          want_map?: boolean
          want_note?: boolean
          want_video?: boolean
        }
        Update: {
          cards_saved_at?: string | null
          created_at?: string
          generated_materials?: Json | null
          generated_materials_at?: string | null
          id?: string
          lang?: string
          materials_attempts?: number
          materials_done_at?: string | null
          reminder_sent_at?: string | null
          source_text?: string
          subject?: string | null
          test_id?: string
          topic?: string | null
          topic_id?: string | null
          user_id?: string | null
          visitor_id?: string
          want_map?: boolean
          want_note?: boolean
          want_video?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "landing_visitor_handoffs_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "landing_visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_visitors: {
        Row: {
          claimed_at: string | null
          claimed_user_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          lang: string
          maps_used: number
          notes_used: number
          updated_at: string
          videos_used: number
        }
        Insert: {
          claimed_at?: string | null
          claimed_user_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          lang?: string
          maps_used?: number
          notes_used?: number
          updated_at?: string
          videos_used?: number
        }
        Update: {
          claimed_at?: string | null
          claimed_user_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          lang?: string
          maps_used?: number
          notes_used?: number
          updated_at?: string
          videos_used?: number
        }
        Relationships: []
      }
      language_chat_messages: {
        Row: {
          content: string
          correction_data: Json | null
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          correction_data?: Json | null
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          correction_data?: Json | null
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "language_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "language_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      language_chat_sessions: {
        Row: {
          created_at: string
          id: string
          lang: string
          last_message_at: string | null
          level: string | null
          mode: string | null
          subject_id: string | null
          title: string
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lang: string
          last_message_at?: string | null
          level?: string | null
          mode?: string | null
          subject_id?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lang?: string
          last_message_at?: string | null
          level?: string | null
          mode?: string | null
          subject_id?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "language_chat_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      language_repeat_phrases: {
        Row: {
          best_score: number | null
          created_at: string
          id: string
          lang: string
          last_practiced_at: string | null
          level: string | null
          text: string
          times_practiced: number
          topic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_score?: number | null
          created_at?: string
          id?: string
          lang: string
          last_practiced_at?: string | null
          level?: string | null
          text: string
          times_practiced?: number
          topic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_score?: number | null
          created_at?: string
          id?: string
          lang?: string
          last_practiced_at?: string | null
          level?: string | null
          text?: string
          times_practiced?: number
          topic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      microcontexts: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string
          id: string
          mindmap_data: Json | null
          order_index: number
          reviewed_at: string | null
          subject_id: string | null
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
          user_notes: string | null
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          content?: string
          created_at?: string
          id?: string
          mindmap_data?: Json | null
          order_index?: number
          reviewed_at?: string | null
          subject_id?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id: string
          user_notes?: string | null
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string
          id?: string
          mindmap_data?: Json | null
          order_index?: number
          reviewed_at?: string | null
          subject_id?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
          user_notes?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "microcontexts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "microcontexts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      note_categories: {
        Row: {
          created_at: string
          id: string
          is_mirror: boolean | null
          name: string
          parent_id: string | null
          source_id: string | null
          source_synced_at: string | null
          subject_id: string | null
          topic_id: string | null
          user_id: string
          user_modified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          is_mirror?: boolean | null
          name: string
          parent_id?: string | null
          source_id?: string | null
          source_synced_at?: string | null
          subject_id?: string | null
          topic_id?: string | null
          user_id: string
          user_modified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_mirror?: boolean | null
          name?: string
          parent_id?: string | null
          source_id?: string | null
          source_synced_at?: string | null
          subject_id?: string | null
          topic_id?: string | null
          user_id?: string
          user_modified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "note_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "note_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_categories_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_categories_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      note_media: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          kind: string
          note_id: string | null
          order_index: number
          source_id: string | null
          source_synced_at: string | null
          storage_path: string | null
          title: string
          url: string | null
          user_id: string
          user_modified: boolean
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          kind: string
          note_id?: string | null
          order_index?: number
          source_id?: string | null
          source_synced_at?: string | null
          storage_path?: string | null
          title?: string
          url?: string | null
          user_id: string
          user_modified?: boolean
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note_id?: string | null
          order_index?: number
          source_id?: string | null
          source_synced_at?: string | null
          storage_path?: string | null
          title?: string
          url?: string | null
          user_id?: string
          user_modified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "note_media_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "note_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_media_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          category_id: string | null
          content_html: string
          content_html_backup: string | null
          created_at: string
          id: string
          source_id: string | null
          source_synced_at: string | null
          title: string
          updated_at: string
          user_id: string
          user_modified: boolean
        }
        Insert: {
          category_id?: string | null
          content_html?: string
          content_html_backup?: string | null
          created_at?: string
          id?: string
          source_id?: string | null
          source_synced_at?: string | null
          title?: string
          updated_at?: string
          user_id: string
          user_modified?: boolean
        }
        Update: {
          category_id?: string | null
          content_html?: string
          content_html_backup?: string | null
          created_at?: string
          id?: string
          source_id?: string | null
          source_synced_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          user_modified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "note_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      official_card_progress: {
        Row: {
          created_at: string
          due_date: string
          ease_factor: number
          flashcard_id: string
          id: string
          interval_days: number
          last_reviewed_at: string | null
          repetitions: number
          revision_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string
          ease_factor?: number
          flashcard_id: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          repetitions?: number
          revision_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          ease_factor?: number
          flashcard_id?: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          repetitions?: number
          revision_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "official_card_progress_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cookies_accepted_at: string | null
          created_at: string
          flashcoins_balance: number
          full_name: string | null
          phone: string | null
          phone_country: string | null
          subscriber_welcome_email_sent_at: string | null
          terms_accepted_at: string | null
          trial_blocked_email_sent_at: string | null
          trial_bonus_flashcards: number
          trial_day14_email_sent_at: string | null
          trial_day9_email_sent_at: string | null
          trial_extension_granted_at: string | null
          ui_lang: string | null
          updated_at: string
          user_id: string
          welcome_email_sent_at: string | null
          welcome_modal_dismissed_at: string | null
        }
        Insert: {
          cookies_accepted_at?: string | null
          created_at?: string
          flashcoins_balance?: number
          full_name?: string | null
          phone?: string | null
          phone_country?: string | null
          subscriber_welcome_email_sent_at?: string | null
          terms_accepted_at?: string | null
          trial_blocked_email_sent_at?: string | null
          trial_bonus_flashcards?: number
          trial_day14_email_sent_at?: string | null
          trial_day9_email_sent_at?: string | null
          trial_extension_granted_at?: string | null
          ui_lang?: string | null
          updated_at?: string
          user_id: string
          welcome_email_sent_at?: string | null
          welcome_modal_dismissed_at?: string | null
        }
        Update: {
          cookies_accepted_at?: string | null
          created_at?: string
          flashcoins_balance?: number
          full_name?: string | null
          phone?: string | null
          phone_country?: string | null
          subscriber_welcome_email_sent_at?: string | null
          terms_accepted_at?: string | null
          trial_blocked_email_sent_at?: string | null
          trial_bonus_flashcards?: number
          trial_day14_email_sent_at?: string | null
          trial_day9_email_sent_at?: string | null
          trial_extension_granted_at?: string | null
          ui_lang?: string | null
          updated_at?: string
          user_id?: string
          welcome_email_sent_at?: string | null
          welcome_modal_dismissed_at?: string | null
        }
        Relationships: []
      }
      purchase_refund_allocations: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          paddle_adjustment_id: string
          user_purchase_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          paddle_adjustment_id: string
          user_purchase_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          paddle_adjustment_id?: string
          user_purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_refund_allocations_user_purchase_id_fkey"
            columns: ["user_purchase_id"]
            isOneToOne: false
            referencedRelation: "user_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount_cents: number | null
          created_at: string | null
          currency: string | null
          environment: string
          id: string
          paddle_transaction_id: string
          price_id: string
          product_id: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string | null
          currency?: string | null
          environment?: string
          id?: string
          paddle_transaction_id: string
          price_id: string
          product_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string | null
          currency?: string | null
          environment?: string
          id?: string
          paddle_transaction_id?: string
          price_id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      store_products: {
        Row: {
          access_subject_id: string | null
          coins_amount: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          kind: string
          name: string
          order_index: number
          paddle_price_id: string
          price_cents: number | null
          price_label: string
          updated_at: string
          validity_days: number
        }
        Insert: {
          access_subject_id?: string | null
          coins_amount?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          name: string
          order_index?: number
          paddle_price_id: string
          price_cents?: number | null
          price_label: string
          updated_at?: string
          validity_days?: number
        }
        Update: {
          access_subject_id?: string | null
          coins_amount?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          kind?: string
          name?: string
          order_index?: number
          paddle_price_id?: string
          price_cents?: number | null
          price_label?: string
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_products_access_subject_id_fkey"
            columns: ["access_subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_notebook_cards: {
        Row: {
          created_at: string
          flashcard_id: string
          id: string
          notebook_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flashcard_id: string
          id?: string
          notebook_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          flashcard_id?: string
          id?: string
          notebook_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_notebook_cards_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_notebook_cards_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "study_notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      study_notebook_scopes: {
        Row: {
          created_at: string
          id: string
          notebook_id: string
          subject_id: string | null
          topic_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notebook_id: string
          subject_id?: string | null
          topic_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notebook_id?: string
          subject_id?: string | null
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_notebook_scopes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "study_notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_notebook_scopes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_notebook_scopes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_notebooks: {
        Row: {
          created_at: string
          current_card_id: string | null
          id: string
          last_studied_at: string | null
          mode: string
          name: string
          order_mode: string
          reviewed_card_ids: string[]
          shuffle_seed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_card_id?: string | null
          id?: string
          last_studied_at?: string | null
          mode?: string
          name: string
          order_mode?: string
          reviewed_card_ids?: string[]
          shuffle_seed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_card_id?: string | null
          id?: string
          last_studied_at?: string | null
          mode?: string
          name?: string
          order_mode?: string
          reviewed_card_ids?: string[]
          shuffle_seed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subject_grants: {
        Row: {
          copy_subject_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_synced_at: string | null
          product_id: string
          renew_mode: string
          source_subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          copy_subject_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          product_id: string
          renew_mode?: string
          source_subject_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          copy_subject_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          product_id?: string
          renew_mode?: string
          source_subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          id: string
          language: string | null
          name: string
          order_index: number | null
          source_id: string | null
          source_synced_at: string | null
          user_id: string
          user_modified: boolean
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          language?: string | null
          name: string
          order_index?: number | null
          source_id?: string | null
          source_synced_at?: string | null
          user_id: string
          user_modified?: boolean
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          language?: string | null
          name?: string
          order_index?: number | null
          source_id?: string | null
          source_synced_at?: string | null
          user_id?: string
          user_modified?: boolean
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          article_range: string | null
          created_at: string
          id: string
          name: string
          order_index: number | null
          parent_id: string | null
          review_enabled: boolean
          source_id: string | null
          source_synced_at: string | null
          subject_id: string
          user_id: string
          user_modified: boolean
        }
        Insert: {
          article_range?: string | null
          created_at?: string
          id?: string
          name: string
          order_index?: number | null
          parent_id?: string | null
          review_enabled?: boolean
          source_id?: string | null
          source_synced_at?: string | null
          subject_id: string
          user_id: string
          user_modified?: boolean
        }
        Update: {
          article_range?: string | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number | null
          parent_id?: string | null
          review_enabled?: boolean
          source_id?: string | null
          source_synced_at?: string | null
          subject_id?: string
          user_id?: string
          user_modified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_cache: {
        Row: {
          cache_key: string
          created_at: string
          hits: number
          last_hit_at: string
          source_lang: string | null
          target_lang: string
          translation: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          hits?: number
          last_hit_at?: string
          source_lang?: string | null
          target_lang?: string
          translation: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          hits?: number
          last_hit_at?: string
          source_lang?: string | null
          target_lang?: string
          translation?: string
        }
        Relationships: []
      }
      tts_cache: {
        Row: {
          cache_key: string
          char_count: number
          created_at: string
          created_by: string | null
          id: string
          lang: string
          last_used_at: string
          mime: string
          origin: string
          storage_path: string
          updated_at: string
          use_count: number
          voice: string
        }
        Insert: {
          cache_key: string
          char_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          lang: string
          last_used_at?: string
          mime?: string
          origin?: string
          storage_path: string
          updated_at?: string
          use_count?: number
          voice: string
        }
        Update: {
          cache_key?: string
          char_count?: number
          created_at?: string
          created_by?: string | null
          id?: string
          lang?: string
          last_used_at?: string
          mime?: string
          origin?: string
          storage_path?: string
          updated_at?: string
          use_count?: number
          voice?: string
        }
        Relationships: []
      }
      user_purchases: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          environment: string
          expires_at: string
          id: string
          paddle_transaction_id: string | null
          price_id: string | null
          product_id: string
          purchased_at: string
          refunded_amount_cents: number
          refunded_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          environment?: string
          expires_at?: string
          id?: string
          paddle_transaction_id?: string | null
          price_id?: string | null
          product_id: string
          purchased_at?: string
          refunded_amount_cents?: number
          refunded_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          environment?: string
          expires_at?: string
          id?: string
          paddle_transaction_id?: string | null
          price_id?: string | null
          product_id?: string
          purchased_at?: string
          refunded_amount_cents?: number
          refunded_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          notifications_enabled: boolean
          telegram_chat_id: string | null
          telegram_enabled: boolean
          telegram_link_code: string | null
          telegram_link_expires_at: string | null
          telegram_test_sent_at: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          notifications_enabled?: boolean
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          telegram_link_code?: string | null
          telegram_link_expires_at?: string | null
          telegram_test_sent_at?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          notifications_enabled?: boolean
          telegram_chat_id?: string | null
          telegram_enabled?: boolean
          telegram_link_code?: string | null
          telegram_link_expires_at?: string | null
          telegram_test_sent_at?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_ai_generation_lease: {
        Args: { p_action_id: string; p_lease_id: string; p_user_id: string }
        Returns: undefined
      }
      apply_flashcoins: {
        Args: {
          p_action_id?: string
          p_adjustment_id?: string
          p_amount: number
          p_reason: string
          p_transaction_id?: string
          p_user_id: string
        }
        Returns: number
      }
      apply_user_purchase_refund: {
        Args: {
          p_adjustment_id: string
          p_amount_cents: number
          p_full_refund?: boolean
          p_user_purchase_id: string
        }
        Returns: {
          already_applied: boolean
          applied_amount_cents: number
          fully_refunded: boolean
          total_refunded_cents: number
        }[]
      }
      authorize_ai_chat_tts: {
        Args: {
          p_action_id: string
          p_response_hash: string
          p_user_id: string
        }
        Returns: undefined
      }
      authorize_ai_note_format_part: {
        Args: {
          p_action_id: string
          p_chunk_chars: number
          p_part_index: number
          p_total_chars: number
          p_total_parts: number
          p_user_id: string
        }
        Returns: boolean
      }
      bump_tts_cache_usage: {
        Args: { p_id: string; p_origin: string }
        Returns: undefined
      }
      can_read_shared_card_video: {
        Args: { p_video_id: string }
        Returns: boolean
      }
      claim_ai_chat_tts_attempt: {
        Args: {
          p_action_id: string
          p_max_attempts?: number
          p_response_hash: string
          p_user_id: string
        }
        Returns: undefined
      }
      complete_ai_note_format_part: {
        Args: {
          p_action_id: string
          p_chunk_chars: number
          p_part_index: number
          p_user_id: string
        }
        Returns: undefined
      }
      consume_ai_chat_tts: {
        Args: {
          p_action_id: string
          p_response_hash: string
          p_user_id: string
        }
        Returns: undefined
      }
      current_user_has_password: { Args: never; Returns: boolean }
      delete_expired_document_jobs: { Args: never; Returns: number }
      discard_ai_generated_flashcard_job: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: undefined
      }
      extend_subject_grant: {
        Args: { p_expires_at: string; p_product_id: string; p_user_id: string }
        Returns: undefined
      }
      get_ai_generated_flashcards: {
        Args: { p_action_id: string; p_job_id: string; p_user_id: string }
        Returns: {
          answer: string
          image_index: number
          ordinal: number
          output_id: string
          question: string
        }[]
      }
      get_available_flashcoins: { Args: { p_user_id: string }; Returns: number }
      get_trial_status: {
        Args: { p_user_id: string }
        Returns: {
          blocked: boolean
          extension_granted: boolean
          trial_ends_at: string
        }[]
      }
      get_trial_status_by_email: {
        Args: { p_email: string }
        Returns: {
          trial_ends_at: string
        }[]
      }
      grant_ai_welcome_kit: {
        Args: {
          p_device_hash: string
          p_subnet_hash: string
          p_user_id: string
        }
        Returns: boolean
      }
      grant_trial_extension: {
        Args: { p_user_id: string }
        Returns: {
          extension_granted: boolean
          trial_ends_at: string
        }[]
      }
      has_active_ai_feature_coin_hold: {
        Args: { p_action_id: string; p_resource: string; p_user_id: string }
        Returns: string
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_ai_quota_action: {
        Args: { p_action_id: string; p_resource: string; p_user_id: string }
        Returns: boolean
      }
      has_note_access: {
        Args: { p_note_id: string; user_uuid: string }
        Returns: boolean
      }
      has_note_category_access: {
        Args: { p_category_id: string; user_uuid: string }
        Returns: boolean
      }
      has_pack_access: {
        Args: { p_product_id: string; user_uuid: string }
        Returns: boolean
      }
      has_subject_access: {
        Args: { p_subject_id: string; user_uuid: string }
        Returns: boolean
      }
      has_topic_access: {
        Args: { p_topic_id: string; user_uuid: string }
        Returns: boolean
      }
      is_app_manager: { Args: never; Returns: boolean }
      is_app_manager_user: { Args: { p_user_id: string }; Returns: boolean }
      is_user_trial_blocked: { Args: { p_user_id: string }; Returns: boolean }
      link_note_category_to_official: {
        Args: {
          p_category_id: string
          p_subject_id?: string
          p_topic_id?: string
        }
        Returns: {
          created_at: string
          id: string
          is_mirror: boolean | null
          name: string
          parent_id: string | null
          source_id: string | null
          source_synced_at: string | null
          subject_id: string | null
          topic_id: string | null
          user_id: string
          user_modified: boolean
        }
        SetofOptions: {
          from: "*"
          to: "note_categories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      merge_landing_generated_material: {
        Args: {
          _handoff_id: string
          _kind: string
          _ordinal: string
          _value: Json
        }
        Returns: undefined
      }
      quarantine_ai_generation_lease: {
        Args: { p_action_id: string; p_lease_id: string; p_user_id: string }
        Returns: undefined
      }
      reconcile_ai_budget: {
        Args: {
          p_billed_micros?: number
          p_reservation_id: string
          p_status: string
        }
        Returns: undefined
      }
      reconcile_ai_feature_coin_hold: {
        Args: { p_charge: boolean; p_hold_id: string }
        Returns: undefined
      }
      record_repeat_phrase_practice: {
        Args: { p_id: string; p_score: number }
        Returns: {
          best_score: number
          last_practiced_at: string
          times_practiced: number
        }[]
      }
      register_ai_generated_flashcards: {
        Args: {
          p_action_id: string
          p_cards: Json
          p_environment: string
          p_job_id: string
          p_lease_id: string
          p_user_id: string
        }
        Returns: {
          ordinal: number
          output_id: string
        }[]
      }
      register_ai_generated_flashcards_pre_reserved: {
        Args: {
          p_action_id: string
          p_cards: Json
          p_environment: string
          p_job_id: string
          p_lease_id: string
          p_user_id: string
        }
        Returns: {
          ordinal: number
          output_id: string
        }[]
      }
      release_ai_generation_lease: {
        Args: { p_action_id: string; p_lease_id: string; p_user_id: string }
        Returns: undefined
      }
      renew_ai_feature_coin_hold: {
        Args: { p_hold_id: string; p_user_id: string }
        Returns: undefined
      }
      renew_ai_generation_lease: {
        Args: { p_action_id: string; p_lease_id: string; p_user_id: string }
        Returns: undefined
      }
      reserve_ai_budget: {
        Args: {
          p_action_id: string
          p_attempt_id: string
          p_rate_version: string
          p_reserved_micros: number
          p_resource: string
          p_user_id: string
        }
        Returns: string
      }
      reserve_ai_feature_flashcoins: {
        Args: {
          p_action_id: string
          p_cost_id: string
          p_environment: string
          p_job_id: string
          p_resource: string
          p_units?: number
          p_user_id: string
        }
        Returns: {
          available_after: number
          coins_reserved: number
          hold_id: string
          is_pro: boolean
          quota_reservation_id: string
        }[]
      }
      reserve_ai_generated_flashcard_billing: {
        Args: {
          p_action_id: string
          p_environment: string
          p_job_id: string
          p_requested_units: number
          p_user_id: string
        }
        Returns: {
          available_after: number
          billing_reservation_id: string
          coins_reserved: number
          hold_id: string
          included_units: number
        }[]
      }
      reserve_ai_quota: {
        Args: {
          p_action_id: string
          p_environment: string
          p_job_id: string
          p_resource: string
          p_units: number
          p_user_id: string
        }
        Returns: {
          is_pro: boolean
          period_end: string
          period_start: string
          remaining_units: number
          reservation_id: string
          was_existing: boolean
        }[]
      }
      reserve_ai_quota_included_only: {
        Args: {
          p_action_id: string
          p_environment: string
          p_job_id: string
          p_resource: string
          p_units: number
          p_user_id: string
        }
        Returns: {
          is_pro: boolean
          period_end: string
          period_start: string
          remaining_units: number
          reservation_id: string
          was_existing: boolean
        }[]
      }
      reserve_ai_quota_included_only_v1: {
        Args: {
          p_action_id: string
          p_environment: string
          p_job_id: string
          p_resource: string
          p_units: number
          p_user_id: string
        }
        Returns: {
          is_pro: boolean
          period_end: string
          period_start: string
          remaining_units: number
          reservation_id: string
          was_existing: boolean
        }[]
      }
      reserve_landing_source: {
        Args: { _client_key: string; _global: number; _per_client: number }
        Returns: Json
      }
      reserve_landing_test: {
        Args: {
          _email: string
          _global: number
          _lang: string
          _name: string
          _per_email: number
        }
        Returns: Json
      }
      review_community_curation: {
        Args: {
          p_confirmed: boolean
          p_decision: string
          p_draft: Json
          p_id: string
          p_notes: string
          p_reviewer: string
          p_rights: string
          p_version: number
        }
        Returns: string
      }
      review_game_curation: {
        Args: {
          p_confirmed: boolean
          p_decision: string
          p_draft: Json
          p_id: string
          p_notes: string
          p_reviewer: string
          p_rights: string
          p_version: number
        }
        Returns: string
      }
      save_blog_post: {
        Args: {
          p_author_id: string
          p_post: Json
          p_post_id: string
          p_translations: Json
        }
        Returns: string
      }
      save_flashcards_atomically: {
        Args: {
          p_action_id: string
          p_cards: Json
          p_environment: string
          p_user_id: string
        }
        Returns: {
          balance_after: number
          inserted_count: number
          was_existing: boolean
        }[]
      }
      schedule_landing_reminder: { Args: { _secret: string }; Returns: number }
      settle_ai_feature_flashcoins: {
        Args: {
          p_hold_id: string
          p_success: boolean
          p_uncertain?: boolean
          p_user_id: string
        }
        Returns: {
          available_after: number
          balance_after: number
          charged_coins: number
        }[]
      }
      settle_ai_generated_flashcard_billing: {
        Args: { p_action_id: string; p_uncertain: boolean; p_user_id: string }
        Returns: undefined
      }
      settle_ai_quota: {
        Args: {
          p_reservation_id: string
          p_success: boolean
          p_was_sent?: boolean
        }
        Returns: undefined
      }
      settle_ai_quota_for_generated_flashcards: {
        Args: { p_action_id: string; p_job_id: string; p_user_id: string }
        Returns: undefined
      }
      sync_flashcard_reviews: {
        Args: { p_reviews: Json; p_user_id: string }
        Returns: Json
      }
      sync_note_category_flashcards: {
        Args: { p_category_id: string }
        Returns: number
      }
      trial_end_at: {
        Args: { p_created: string; p_ext: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
