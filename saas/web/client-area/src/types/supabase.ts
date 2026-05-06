export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_leases: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          instance_registry_id: string | null
          lease_type: string
          metadata: Json | null
          provider_account_id: string
          starts_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          instance_registry_id?: string | null
          lease_type?: string
          metadata?: Json | null
          provider_account_id: string
          starts_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          instance_registry_id?: string | null
          lease_type?: string
          metadata?: Json | null
          provider_account_id?: string
          starts_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_leases_instance_registry_id_fkey"
            columns: ["instance_registry_id"]
            isOneToOne: false
            referencedRelation: "instance_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_leases_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: false
            referencedRelation: "provider_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acting_as_role: string | null
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          resource_id: string | null
          resource_type: string | null
          session_id: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acting_as_role?: string | null
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acting_as_role?: string | null
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          name: string | null
          phone: string
          read_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          phone: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          phone?: string
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          created_at: string | null
          credits_consumed: number | null
          credits_estimated: number | null
          delivered_count: number | null
          failed_count: number | null
          id: string
          instance_id: string | null
          media_type: string | null
          media_url: string | null
          message_template: string
          metadata: Json | null
          name: string
          read_count: number | null
          scheduled_at: string | null
          sent_count: number | null
          started_at: string | null
          status: string | null
          tenant_id: string
          total_recipients: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          credits_consumed?: number | null
          credits_estimated?: number | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          instance_id?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template: string
          metadata?: Json | null
          name: string
          read_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string | null
          tenant_id: string
          total_recipients?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          credits_consumed?: number | null
          credits_estimated?: number | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          instance_id?: string | null
          media_type?: string | null
          media_url?: string | null
          message_template?: string
          metadata?: Json | null
          name?: string
          read_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string | null
          tenant_id?: string
          total_recipients?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instance_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_registry: {
        Row: {
          expires_at: string | null
          first_seen_at: string | null
          id: string
          instance_name: string | null
          instance_number: string | null
          is_business: boolean | null
          last_seen_at: string | null
          lifecycle: string | null
          metadata: Json | null
          platform: string | null
          provider_account_id: string | null
          remote_account_id: string | null
          remote_instance_id: string
          source: string | null
          status: string | null
          tenant_id: string | null
          tenant_provider_id: string
          token_last4: string | null
          updated_at: string | null
        }
        Insert: {
          expires_at?: string | null
          first_seen_at?: string | null
          id?: string
          instance_name?: string | null
          instance_number?: string | null
          is_business?: boolean | null
          last_seen_at?: string | null
          lifecycle?: string | null
          metadata?: Json | null
          platform?: string | null
          provider_account_id?: string | null
          remote_account_id?: string | null
          remote_instance_id: string
          source?: string | null
          status?: string | null
          tenant_id?: string | null
          tenant_provider_id: string
          token_last4?: string | null
          updated_at?: string | null
        }
        Update: {
          expires_at?: string | null
          first_seen_at?: string | null
          id?: string
          instance_name?: string | null
          instance_number?: string | null
          is_business?: boolean | null
          last_seen_at?: string | null
          lifecycle?: string | null
          metadata?: Json | null
          platform?: string | null
          provider_account_id?: string | null
          remote_account_id?: string | null
          remote_instance_id?: string
          source?: string | null
          status?: string | null
          tenant_id?: string | null
          tenant_provider_id?: string
          token_last4?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instance_registry_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: false
            referencedRelation: "provider_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_registry_tenant_provider_id_fkey"
            columns: ["tenant_provider_id"]
            isOneToOne: false
            referencedRelation: "tenant_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_accounts: {
        Row: {
          base_url: string | null
          created_at: string | null
          created_by: string | null
          credential_last4: Json | null
          credentials_enc: string
          environment: string
          id: string
          label: string
          metadata: Json | null
          provider: string
          public_config: Json | null
          status: string
          updated_at: string | null
          webhook_secret_enc: string | null
          webhook_secret_last4: string | null
          webhook_url: string | null
        }
        Insert: {
          base_url?: string | null
          created_at?: string | null
          created_by?: string | null
          credential_last4?: Json | null
          credentials_enc: string
          environment?: string
          id?: string
          label: string
          metadata?: Json | null
          provider: string
          public_config?: Json | null
          status?: string
          updated_at?: string | null
          webhook_secret_enc?: string | null
          webhook_secret_last4?: string | null
          webhook_url?: string | null
        }
        Update: {
          base_url?: string | null
          created_at?: string | null
          created_by?: string | null
          credential_last4?: Json | null
          credentials_enc?: string
          environment?: string
          id?: string
          label?: string
          metadata?: Json | null
          provider?: string
          public_config?: Json | null
          status?: string
          updated_at?: string | null
          webhook_secret_enc?: string | null
          webhook_secret_last4?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string | null
          credits_granted: number | null
          currency: string | null
          getnet_order_id: string | null
          getnet_payment_id: string | null
          getnet_status: string | null
          getnet_status_detail: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          parent_transaction_id: string | null
          payment_type: string | null
          refund_id: string | null
          subscription_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          credits_granted?: number | null
          currency?: string | null
          getnet_order_id?: string | null
          getnet_payment_id?: string | null
          getnet_status?: string | null
          getnet_status_detail?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          parent_transaction_id?: string | null
          payment_type?: string | null
          refund_id?: string | null
          subscription_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          credits_granted?: number | null
          currency?: string | null
          getnet_order_id?: string | null
          getnet_payment_id?: string | null
          getnet_status?: string | null
          getnet_status_detail?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          parent_transaction_id?: string | null
          payment_type?: string | null
          refund_id?: string | null
          subscription_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          credits_per_month: number
          description: string | null
          display_order: number | null
          features: Json | null
          getnet_plan_id: string | null
          id: string
          is_active: boolean | null
          max_instances: number
          name: string
          price_cents: number
        }
        Insert: {
          created_at?: string | null
          credits_per_month: number
          description?: string | null
          display_order?: number | null
          features?: Json | null
          getnet_plan_id?: string | null
          id: string
          is_active?: boolean | null
          max_instances: number
          name: string
          price_cents: number
        }
        Update: {
          created_at?: string | null
          credits_per_month?: number
          description?: string | null
          display_order?: number | null
          features?: Json | null
          getnet_plan_id?: string | null
          id?: string
          is_active?: boolean | null
          max_instances?: number
          name?: string
          price_cents?: number
        }
        Relationships: []
      }
      platform_admin_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          status: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          status?: string | null
          token: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          status?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          permissions: Json | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          permissions?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          permissions?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      provider_account_assignments: {
        Row: {
          assignment_kind: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          provider_account_id: string
          starts_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          assignment_kind?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider_account_id: string
          starts_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          assignment_kind?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider_account_id?: string
          starts_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_account_assignments_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: false
            referencedRelation: "provider_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_account_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_account_events: {
        Row: {
          actor_user_id: string | null
          created_at: string | null
          details: Json | null
          error_message: string | null
          event_type: string
          id: string
          instance_registry_id: string | null
          provider_account_id: string | null
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          event_type: string
          id?: string
          instance_registry_id?: string | null
          provider_account_id?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          event_type?: string
          id?: string
          instance_registry_id?: string | null
          provider_account_id?: string | null
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_account_events_instance_registry_id_fkey"
            columns: ["instance_registry_id"]
            isOneToOne: false
            referencedRelation: "instance_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_account_events_provider_account_id_fkey"
            columns: ["provider_account_id"]
            isOneToOne: false
            referencedRelation: "provider_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_account_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_accounts: {
        Row: {
          account_kind: string
          admin_token_enc: string
          admin_token_last4: string | null
          capacity_instances: number | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          label: string
          metadata: Json | null
          plan_label: string | null
          provider: string
          rotation_policy: Json | null
          server_url: string
          status: string
          updated_at: string | null
          used_instances: number | null
        }
        Insert: {
          account_kind?: string
          admin_token_enc: string
          admin_token_last4?: string | null
          capacity_instances?: number | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label: string
          metadata?: Json | null
          plan_label?: string | null
          provider?: string
          rotation_policy?: Json | null
          server_url?: string
          status?: string
          updated_at?: string | null
          used_instances?: number | null
        }
        Update: {
          account_kind?: string
          admin_token_enc?: string
          admin_token_last4?: string | null
          capacity_instances?: number | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string
          metadata?: Json | null
          plan_label?: string | null
          provider?: string
          rotation_policy?: Json | null
          server_url?: string
          status?: string
          updated_at?: string | null
          used_instances?: number | null
        }
        Relationships: []
      }
      provider_secrets: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          provider_name: string
          provider_type: string | null
          rotated_at: string | null
          secret_label: string | null
          secret_value: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_name: string
          provider_type?: string | null
          rotated_at?: string | null
          secret_label?: string | null
          secret_value: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_name?: string
          provider_type?: string | null
          rotated_at?: string | null
          secret_label?: string | null
          secret_value?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_logs: {
        Row: {
          auto_fix_enabled: boolean | null
          corrected_count: number
          created_at: string | null
          days_back: number
          details: Json | null
          discrepancy_count: number
          error_count: number
          id: string
          matched_count: number
          reconciled_at: string
          total_checked: number
        }
        Insert: {
          auto_fix_enabled?: boolean | null
          corrected_count: number
          created_at?: string | null
          days_back: number
          details?: Json | null
          discrepancy_count: number
          error_count: number
          id?: string
          matched_count: number
          reconciled_at: string
          total_checked: number
        }
        Update: {
          auto_fix_enabled?: boolean | null
          corrected_count?: number
          created_at?: string | null
          days_back?: number
          details?: Json | null
          discrepancy_count?: number
          error_count?: number
          id?: string
          matched_count?: number
          reconciled_at?: string
          total_checked?: number
        }
        Relationships: []
      }
      referral_clicks: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          referral_link_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          referral_link_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          referral_link_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_clicks_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_commissions: {
        Row: {
          commission_amount: number
          commission_rate: number
          created_at: string | null
          credited_at: string
          getnet_event_type: string | null
          getnet_payment_id: string | null
          id: string
          payment_amount: number
          referee_tenant_id: string
          referral_link_id: string
          referrer_tenant_id: string
          reversal_reason: string | null
          reversed_at: string | null
          status: string | null
        }
        Insert: {
          commission_amount: number
          commission_rate?: number
          created_at?: string | null
          credited_at?: string
          getnet_event_type?: string | null
          getnet_payment_id?: string | null
          id?: string
          payment_amount: number
          referee_tenant_id: string
          referral_link_id: string
          referrer_tenant_id: string
          reversal_reason?: string | null
          reversed_at?: string | null
          status?: string | null
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          created_at?: string | null
          credited_at?: string
          getnet_event_type?: string | null
          getnet_payment_id?: string | null
          id?: string
          payment_amount?: number
          referee_tenant_id?: string
          referral_link_id?: string
          referrer_tenant_id?: string
          reversal_reason?: string | null
          reversed_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_referee_tenant_id_fkey"
            columns: ["referee_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_referrer_tenant_id_fkey"
            columns: ["referrer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          created_at: string | null
          id: string
          ref_code: string
          referee_tenant_id: string
          referrer_tenant_id: string
          status: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ref_code: string
          referee_tenant_id: string
          referrer_tenant_id: string
          status?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ref_code?: string
          referee_tenant_id?: string
          referrer_tenant_id?: string
          status?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_referee_tenant_id_fkey"
            columns: ["referee_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_links_referrer_tenant_id_fkey"
            columns: ["referrer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string | null
          id: string
          metadata: Json | null
          original_payment_id: string
          processed_at: string | null
          processed_by: string | null
          reason: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          original_payment_id: string
          processed_at?: string | null
          processed_by?: string | null
          reason: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          original_payment_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_original_payment_id_fkey"
            columns: ["original_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secret_access_logs: {
        Row: {
          accessed_by: string | null
          accessed_from_ip: unknown
          action: string | null
          created_at: string | null
          id: string
          reason: string | null
          secret_id: string | null
        }
        Insert: {
          accessed_by?: string | null
          accessed_from_ip?: unknown
          action?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          secret_id?: string | null
        }
        Update: {
          accessed_by?: string | null
          accessed_from_ip?: unknown
          action?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secret_access_logs_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "provider_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_cancellation_logs: {
        Row: {
          action: string
          created_at: string | null
          grace_period_until: string | null
          id: string
          processed_at: string | null
          reason: string | null
          subscription_id: string
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          grace_period_until?: string | null
          id?: string
          processed_at?: string | null
          reason?: string | null
          subscription_id: string
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          grace_period_until?: string | null
          id?: string
          processed_at?: string | null
          reason?: string | null
          subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_cancellation_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_cancellation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_reason: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          getnet_customer_id: string | null
          getnet_subscription_id: string | null
          getnet_vault_id: string | null
          grace_period_until: string | null
          id: string
          last_payment_at: string | null
          next_payment_at: string | null
          pending_cancellation: boolean | null
          plan_id: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          cancel_reason?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          getnet_customer_id?: string | null
          getnet_subscription_id?: string | null
          getnet_vault_id?: string | null
          grace_period_until?: string | null
          id?: string
          last_payment_at?: string | null
          next_payment_at?: string | null
          pending_cancellation?: boolean | null
          plan_id: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          cancel_reason?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          getnet_customer_id?: string | null
          getnet_subscription_id?: string | null
          getnet_vault_id?: string | null
          grace_period_until?: string | null
          id?: string
          last_payment_at?: string | null
          next_payment_at?: string | null
          pending_cancellation?: boolean | null
          plan_id?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_billing_permissions: {
        Row: {
          created_at: string | null
          manage_subscription_allowed_roles: string[] | null
          max_purchase_amount: number | null
          purchase_allowed_roles: string[] | null
          refund_allowed_roles: string[] | null
          require_approval_above: number | null
          tenant_id: string
          updated_at: string | null
          view_billing_allowed_roles: string[] | null
        }
        Insert: {
          created_at?: string | null
          manage_subscription_allowed_roles?: string[] | null
          max_purchase_amount?: number | null
          purchase_allowed_roles?: string[] | null
          refund_allowed_roles?: string[] | null
          require_approval_above?: number | null
          tenant_id: string
          updated_at?: string | null
          view_billing_allowed_roles?: string[] | null
        }
        Update: {
          created_at?: string | null
          manage_subscription_allowed_roles?: string[] | null
          max_purchase_amount?: number | null
          purchase_allowed_roles?: string[] | null
          refund_allowed_roles?: string[] | null
          require_approval_above?: number | null
          tenant_id?: string
          updated_at?: string | null
          view_billing_allowed_roles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_billing_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_providers: {
        Row: {
          account_id: string | null
          created_at: string | null
          credentials_ref: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          provider: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          credentials_ref?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          provider: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          credentials_ref?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          provider?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_providers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          credits_balance: number | null
          email: string
          id: string
          max_instances: number | null
          monthly_credits: number | null
          mp_customer_id: string | null
          mp_subscription_id: string | null
          name: string
          onboarding_completed: boolean | null
          plan: string | null
          slug: string
          status: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credits_balance?: number | null
          email: string
          id?: string
          max_instances?: number | null
          monthly_credits?: number | null
          mp_customer_id?: string | null
          mp_subscription_id?: string | null
          name: string
          onboarding_completed?: boolean | null
          plan?: string | null
          slug: string
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credits_balance?: number | null
          email?: string
          id?: string
          max_instances?: number | null
          monthly_credits?: number | null
          mp_customer_id?: string | null
          mp_subscription_id?: string | null
          name?: string
          onboarding_completed?: boolean | null
          plan?: string | null
          slug?: string
          status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_tenant_memberships: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tenant_roles: {
        Row: {
          created_at: string | null
          id: string
          permissions: Json | null
          role: string
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          role?: string
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          role?: string
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenant_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          source: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          source?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          source?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_log: {
        Row: {
          created_at: string | null
          delivery_attempts: number | null
          event_type: string
          external_event_id: string
          id: string
          last_error: string | null
          payload: Json | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_attempts?: number | null
          event_type: string
          external_event_id: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_attempts?: number | null
          event_type?: string
          external_event_id?: string
          id?: string
          last_error?: string | null
          payload?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          delivery_attempts: number | null
          error_message: string | null
          event_type: string
          external_event_id: string
          id: string
          last_attempt_at: string | null
          payload: Json
          processed_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_attempts?: number | null
          error_message?: string | null
          event_type: string
          external_event_id: string
          id?: string
          last_attempt_at?: string | null
          payload: Json
          processed_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          delivery_attempts?: number | null
          error_message?: string | null
          event_type?: string
          external_event_id?: string
          id?: string
          last_attempt_at?: string | null
          payload?: Json
          processed_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      referral_summary: {
        Row: {
          active_referrals: number | null
          commission_30d_cents: number | null
          last_commission_date: string | null
          paying_referrals: number | null
          referrer_tenant_id: string | null
          total_commission_cents: number | null
          total_referrals: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_referrer_tenant_id_fkey"
            columns: ["referrer_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      audit_operation: {
        Args: {
          p_acting_as_role?: string
          p_action: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_new_value?: Json
          p_old_value?: Json
          p_resource_id?: string
          p_resource_type?: string
          p_session_id?: string
          p_tenant_id: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      cancel_subscription_with_grace_period: {
        Args: { p_reason?: string; p_subscription_id: string }
        Returns: Json
      }
      create_payment_idempotent: {
        Args: {
          p_amount_cents: number
          p_idempotency_key: string
          p_payment_type?: string
          p_tenant_id: string
        }
        Returns: {
          created_new: boolean
          payment_id: string
          status: string
        }[]
      }
      debit_wallet_credits_with_retry: {
        Args: {
          p_amount: number
          p_max_retries?: number
          p_reference: string
          p_tenant_id: string
        }
        Returns: {
          balance_after: number
          error_message: string
          new_version: number
          success: boolean
        }[]
      }
      generate_invite_token: { Args: never; Returns: string }
      get_provider_secret: {
        Args: { p_provider_name: string; p_tenant_id: string }
        Returns: {
          secret_value: string
        }[]
      }
      log_secret_access: {
        Args: { p_action: string; p_reason?: string; p_secret_id: string }
        Returns: string
      }
      mark_webhook_processed: {
        Args: {
          p_external_event_id: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: {
          success: boolean
          was_already_processed: boolean
        }[]
      }
      process_expired_grace_periods: {
        Args: never
        Returns: {
          details: Json
          failed_count: number
          processed_count: number
        }[]
      }
      process_refund: {
        Args: {
          p_payment_id: string
          p_refund_amount_cents: number
          p_tenant_id: string
        }
        Returns: {
          balance_after: number
          error_message: string
          success: boolean
        }[]
      }
      resume_subscription: {
        Args: { p_subscription_id: string }
        Returns: Json
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

