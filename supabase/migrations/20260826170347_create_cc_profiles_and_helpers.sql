/*
# TATA RSA Contact-Centre — Schema Part 1: profiles + helpers
Creates cc_profiles table first, then role-check helper functions.
*/

CREATE TABLE IF NOT EXISTS cc_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Agent',
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','supervisor','agent')),
  employee_id text,
  team text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE cc_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION cc_is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM cc_profiles WHERE user_id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION cc_is_supervisor_or_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM cc_profiles WHERE user_id = auth.uid() AND role IN ('admin','supervisor'));
$$;
