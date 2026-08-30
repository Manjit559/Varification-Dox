/*
# TATA RSA Contact-Centre — Schema Part 2: all tables + RLS
*/

-- cc_profiles policies (table created in part 1)
DROP POLICY IF EXISTS "select_own_profile" ON cc_profiles;
CREATE POLICY "select_own_profile" ON cc_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "insert_own_profile" ON cc_profiles;
CREATE POLICY "insert_own_profile" ON cc_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_profile" ON cc_profiles;
CREATE POLICY "update_own_profile" ON cc_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR cc_is_admin()) WITH CHECK (auth.uid() = user_id OR cc_is_admin());
DROP POLICY IF EXISTS "admin_delete_profile" ON cc_profiles;
CREATE POLICY "admin_delete_profile" ON cc_profiles FOR DELETE
  TO authenticated USING (cc_is_admin());
CREATE INDEX IF NOT EXISTS cc_profiles_user_id_idx ON cc_profiles(user_id);

-- =========================================================
-- cc_audit_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity text NOT NULL DEFAULT 'system',
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cc_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_audit_all" ON cc_audit_logs;
CREATE POLICY "select_audit_all" ON cc_audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "insert_audit_own" ON cc_audit_logs;
CREATE POLICY "insert_audit_own" ON cc_audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS cc_audit_logs_created_idx ON cc_audit_logs(created_at DESC);

-- =========================================================
-- cc_customers
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  phone text NOT NULL,
  alt_phone text,
  email text,
  location text,
  address text,
  vehicle_number text,
  vehicle_model text,
  rsa_case_id text,
  rsa_case_type text,
  rsa_case_status text,
  service_date timestamptz,
  service_type text,
  service_partner text,
  dealer_workshop text,
  technician_name text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  dnc_opt_out boolean NOT NULL DEFAULT false,
  invalid_number boolean NOT NULL DEFAULT false,
  is_duplicate boolean NOT NULL DEFAULT false,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cc_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_customers_staff" ON cc_customers;
CREATE POLICY "select_customers_staff" ON cc_customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_customers_sup" ON cc_customers;
CREATE POLICY "insert_customers_sup" ON cc_customers FOR INSERT TO authenticated WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "update_customers_sup" ON cc_customers;
CREATE POLICY "update_customers_sup" ON cc_customers FOR UPDATE TO authenticated USING (cc_is_supervisor_or_admin()) WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "delete_customers_admin" ON cc_customers;
CREATE POLICY "delete_customers_admin" ON cc_customers FOR DELETE TO authenticated USING (cc_is_admin());
CREATE INDEX IF NOT EXISTS cc_customers_phone_idx ON cc_customers(phone);
CREATE INDEX IF NOT EXISTS cc_customers_case_idx ON cc_customers(rsa_case_id);

-- =========================================================
-- cc_customer_history
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_customer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES cc_customers(id) ON DELETE CASCADE,
  interaction_type text NOT NULL DEFAULT 'call',
  summary text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cc_customer_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_history_staff" ON cc_customer_history;
CREATE POLICY "select_history_staff" ON cc_customer_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_history_staff" ON cc_customer_history;
CREATE POLICY "insert_history_staff" ON cc_customer_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS cc_customer_history_cust_idx ON cc_customer_history(customer_id);

-- =========================================================
-- cc_campaigns
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','draft')),
  priority int NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  max_attempts int NOT NULL DEFAULT 3,
  retry_interval_minutes int NOT NULL DEFAULT 60,
  calling_window_start time NOT NULL DEFAULT '09:00',
  calling_window_end time NOT NULL DEFAULT '21:00',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cc_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_campaigns_staff" ON cc_campaigns;
CREATE POLICY "select_campaigns_staff" ON cc_campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_campaigns_sup" ON cc_campaigns;
CREATE POLICY "write_campaigns_sup" ON cc_campaigns FOR INSERT TO authenticated WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "update_campaigns_sup" ON cc_campaigns;
CREATE POLICY "update_campaigns_sup" ON cc_campaigns FOR UPDATE TO authenticated USING (cc_is_supervisor_or_admin()) WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "delete_campaigns_admin" ON cc_campaigns;
CREATE POLICY "delete_campaigns_admin" ON cc_campaigns FOR DELETE TO authenticated USING (cc_is_admin());

-- =========================================================
-- cc_queues
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES cc_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'on' CHECK (status IN ('on','off','paused')),
  priority int NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  calling_window_start time NOT NULL DEFAULT '09:00',
  calling_window_end time NOT NULL DEFAULT '21:00',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cc_queues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_queues_staff" ON cc_queues;
CREATE POLICY "select_queues_staff" ON cc_queues FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_queues_sup" ON cc_queues;
CREATE POLICY "insert_queues_sup" ON cc_queues FOR INSERT TO authenticated WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "update_queues_sup" ON cc_queues;
CREATE POLICY "update_queues_sup" ON cc_queues FOR UPDATE TO authenticated USING (cc_is_supervisor_or_admin()) WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "delete_queues_admin" ON cc_queues;
CREATE POLICY "delete_queues_admin" ON cc_queues FOR DELETE TO authenticated USING (cc_is_admin());
CREATE INDEX IF NOT EXISTS cc_queues_campaign_idx ON cc_queues(campaign_id);

-- =========================================================
-- cc_queue_assignments
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_queue_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES cc_queues(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (queue_id, agent_id)
);
ALTER TABLE cc_queue_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_assign_staff" ON cc_queue_assignments;
CREATE POLICY "select_assign_staff" ON cc_queue_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_assign_sup" ON cc_queue_assignments;
CREATE POLICY "insert_assign_sup" ON cc_queue_assignments FOR INSERT TO authenticated WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "delete_assign_sup" ON cc_queue_assignments;
CREATE POLICY "delete_assign_sup" ON cc_queue_assignments FOR DELETE TO authenticated USING (cc_is_supervisor_or_admin());
CREATE INDEX IF NOT EXISTS cc_queue_assign_agent_idx ON cc_queue_assignments(agent_id);
CREATE INDEX IF NOT EXISTS cc_queue_assign_queue_idx ON cc_queue_assignments(queue_id);

-- =========================================================
-- cc_queue_items
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES cc_queues(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES cc_customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dialing','completed','skipped','callback','failed')),
  priority int NOT NULL DEFAULT 5,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  assigned_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  callback_at timestamptz,
  callback_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cc_queue_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_qi_staff" ON cc_queue_items;
CREATE POLICY "select_qi_staff" ON cc_queue_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_qi_sup" ON cc_queue_items;
CREATE POLICY "insert_qi_sup" ON cc_queue_items FOR INSERT TO authenticated WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "update_qi_staff" ON cc_queue_items;
CREATE POLICY "update_qi_staff" ON cc_queue_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_qi_admin" ON cc_queue_items;
CREATE POLICY "delete_qi_admin" ON cc_queue_items FOR DELETE TO authenticated USING (cc_is_admin());
CREATE INDEX IF NOT EXISTS cc_qi_queue_status_idx ON cc_queue_items(queue_id, status);
CREATE INDEX IF NOT EXISTS cc_qi_priority_idx ON cc_queue_items(priority, next_attempt_at);

-- =========================================================
-- cc_agent_states
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_agent_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'offline' CHECK (state IN ('available','on_call','wrap_up','meal_break','short_break','tea_break','personal_break','training','meeting','technical_break','offline')),
  state_reason text,
  state_changed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cc_agent_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_agent_states_staff" ON cc_agent_states;
CREATE POLICY "select_agent_states_staff" ON cc_agent_states FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_agent_state_own" ON cc_agent_states;
CREATE POLICY "insert_agent_state_own" ON cc_agent_states FOR INSERT TO authenticated WITH CHECK (auth.uid() = agent_id);
DROP POLICY IF EXISTS "update_agent_state_own" ON cc_agent_states;
CREATE POLICY "update_agent_state_own" ON cc_agent_states FOR UPDATE TO authenticated USING (auth.uid() = agent_id OR cc_is_supervisor_or_admin()) WITH CHECK (auth.uid() = agent_id OR cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "delete_agent_state_admin" ON cc_agent_states;
CREATE POLICY "delete_agent_state_admin" ON cc_agent_states FOR DELETE TO authenticated USING (cc_is_admin());

-- =========================================================
-- cc_agent_state_history
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_agent_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL,
  reason text,
  duration_seconds int,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE cc_agent_state_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_ash_staff" ON cc_agent_state_history;
CREATE POLICY "select_ash_staff" ON cc_agent_state_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_ash_own" ON cc_agent_state_history;
CREATE POLICY "insert_ash_own" ON cc_agent_state_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = agent_id OR cc_is_supervisor_or_admin());
CREATE INDEX IF NOT EXISTS cc_ash_agent_idx ON cc_agent_state_history(agent_id);
CREATE INDEX IF NOT EXISTS cc_ash_started_idx ON cc_agent_state_history(started_at DESC);

-- =========================================================
-- cc_calls
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_ref text UNIQUE,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','manual','callback')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','dialing','ringing','connected','on_hold','muted','transferred','disconnected','wrap_up','completed','no_answer','busy','rejected','invalid_number','network_failure')),
  customer_id uuid REFERENCES cc_customers(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES cc_campaigns(id) ON DELETE SET NULL,
  queue_id uuid REFERENCES cc_queues(id) ON DELETE SET NULL,
  queue_item_id uuid REFERENCES cc_queue_items(id) ON DELETE SET NULL,
  phone_dialed text,
  disposition_id uuid,
  disposition text,
  notes text,
  callback_scheduled_at timestamptz,
  started_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  talk_time_seconds int,
  acw_seconds int,
  recording_path text,
  recording_id text,
  recording_duration_seconds int,
  recording_accessed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recording_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cc_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_calls_staff" ON cc_calls;
CREATE POLICY "select_calls_staff" ON cc_calls FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_calls_staff" ON cc_calls;
CREATE POLICY "insert_calls_staff" ON cc_calls FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_calls_staff" ON cc_calls;
CREATE POLICY "update_calls_staff" ON cc_calls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_calls_admin" ON cc_calls;
CREATE POLICY "delete_calls_admin" ON cc_calls FOR DELETE TO authenticated USING (cc_is_admin());
CREATE INDEX IF NOT EXISTS cc_calls_agent_idx ON cc_calls(agent_id);
CREATE INDEX IF NOT EXISTS cc_calls_status_idx ON cc_calls(status);
CREATE INDEX IF NOT EXISTS cc_calls_created_idx ON cc_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS cc_calls_customer_idx ON cc_calls(customer_id);

-- =========================================================
-- cc_call_events
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES cc_calls(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cc_call_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_events_staff" ON cc_call_events;
CREATE POLICY "select_events_staff" ON cc_call_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_events_staff" ON cc_call_events;
CREATE POLICY "insert_events_staff" ON cc_call_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS cc_call_events_call_idx ON cc_call_events(call_id);

-- =========================================================
-- cc_dispositions
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_dispositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'connected' CHECK (category IN ('connected','no_contact','invalid','dnc','duplicate')),
  requires_callback boolean NOT NULL DEFAULT false,
  is_final boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cc_dispositions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_disp_staff" ON cc_dispositions;
CREATE POLICY "select_disp_staff" ON cc_dispositions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_disp_sup" ON cc_dispositions;
CREATE POLICY "insert_disp_sup" ON cc_dispositions FOR INSERT TO authenticated WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "update_disp_sup" ON cc_dispositions;
CREATE POLICY "update_disp_sup" ON cc_dispositions FOR UPDATE TO authenticated USING (cc_is_supervisor_or_admin()) WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "delete_disp_admin" ON cc_dispositions;
CREATE POLICY "delete_disp_admin" ON cc_dispositions FOR DELETE TO authenticated USING (cc_is_admin());

-- =========================================================
-- cc_psf_responses
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_psf_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES cc_calls(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES cc_customers(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  csat_score int CHECK (csat_score BETWEEN 1 AND 5),
  nps_score int CHECK (nps_score BETWEEN 0 AND 10),
  service_resolved boolean,
  technician_rating int CHECK (technician_rating BETWEEN 1 AND 5),
  service_partner_rating int CHECK (service_partner_rating BETWEEN 1 AND 5),
  customer_comments text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cc_psf_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_psf_staff" ON cc_psf_responses;
CREATE POLICY "select_psf_staff" ON cc_psf_responses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_psf_staff" ON cc_psf_responses;
CREATE POLICY "insert_psf_staff" ON cc_psf_responses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_psf_own" ON cc_psf_responses;
CREATE POLICY "update_psf_own" ON cc_psf_responses FOR UPDATE TO authenticated USING (auth.uid() = agent_id) WITH CHECK (auth.uid() = agent_id);
CREATE INDEX IF NOT EXISTS cc_psf_call_idx ON cc_psf_responses(call_id);

-- =========================================================
-- cc_callbacks
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES cc_calls(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES cc_customers(id) ON DELETE CASCADE,
  queue_id uuid REFERENCES cc_queues(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled','expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cc_callbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_cb_staff" ON cc_callbacks;
CREATE POLICY "select_cb_staff" ON cc_callbacks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_cb_staff" ON cc_callbacks;
CREATE POLICY "insert_cb_staff" ON cc_callbacks FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_cb_staff" ON cc_callbacks;
CREATE POLICY "update_cb_staff" ON cc_callbacks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_cb_admin" ON cc_callbacks;
CREATE POLICY "delete_cb_admin" ON cc_callbacks FOR DELETE TO authenticated USING (cc_is_admin());
CREATE INDEX IF NOT EXISTS cc_cb_scheduled_idx ON cc_callbacks(scheduled_at);
CREATE INDEX IF NOT EXISTS cc_cb_status_idx ON cc_callbacks(status);

-- =========================================================
-- cc_breaks + cc_break_logs
-- =========================================================
CREATE TABLE IF NOT EXISTS cc_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  default_max_minutes int NOT NULL DEFAULT 15,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE cc_breaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_breaks_staff" ON cc_breaks;
CREATE POLICY "select_breaks_staff" ON cc_breaks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_breaks_sup" ON cc_breaks;
CREATE POLICY "write_breaks_sup" ON cc_breaks FOR INSERT TO authenticated WITH CHECK (cc_is_supervisor_or_admin());
DROP POLICY IF EXISTS "update_breaks_sup" ON cc_breaks;
CREATE POLICY "update_breaks_sup" ON cc_breaks FOR UPDATE TO authenticated USING (cc_is_supervisor_or_admin()) WITH CHECK (cc_is_supervisor_or_admin());

CREATE TABLE IF NOT EXISTS cc_break_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  break_code text NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int
);
ALTER TABLE cc_break_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_bl_staff" ON cc_break_logs;
CREATE POLICY "select_bl_staff" ON cc_break_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_bl_own" ON cc_break_logs;
CREATE POLICY "insert_bl_own" ON cc_break_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = agent_id);
DROP POLICY IF EXISTS "update_bl_own" ON cc_break_logs;
CREATE POLICY "update_bl_own" ON cc_break_logs FOR UPDATE TO authenticated USING (auth.uid() = agent_id) WITH CHECK (auth.uid() = agent_id);
CREATE INDEX IF NOT EXISTS cc_bl_agent_idx ON cc_break_logs(agent_id);

-- =========================================================
-- Triggers + storage bucket
-- =========================================================
CREATE OR REPLACE FUNCTION cc_set_updated_at()
RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['cc_profiles','cc_customers','cc_campaigns','cc_queues','cc_queue_items','cc_agent_states','cc_calls','cc_callbacks']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION cc_set_updated_at();', t, t);
  END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recordings','recordings', false, 104857600,
  ARRAY['audio/mpeg','audio/wav','audio/ogg','application/ogg'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Agents upload recordings" ON storage.objects;
CREATE POLICY "Agents upload recordings" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Staff read recordings" ON storage.objects;
CREATE POLICY "Staff read recordings" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'recordings');
DROP POLICY IF EXISTS "Admin delete recordings" ON storage.objects;
CREATE POLICY "Admin delete recordings" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'recordings' AND cc_is_admin());
