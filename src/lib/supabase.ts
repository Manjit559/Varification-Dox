import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 20 } },
});

export type Role = 'admin' | 'supervisor' | 'agent';

export type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  role: Role;
  employee_id: string | null;
  team: string | null;
  active: boolean;
};

export type Customer = {
  id: string;
  customer_name: string;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  location: string | null;
  address: string | null;
  vehicle_number: string | null;
  vehicle_model: string | null;
  rsa_case_id: string | null;
  rsa_case_type: string | null;
  rsa_case_status: string | null;
  service_date: string | null;
  service_type: string | null;
  service_partner: string | null;
  dealer_workshop: string | null;
  technician_name: string | null;
  timezone: string;
  dnc_opt_out: boolean;
  invalid_number: boolean;
  is_duplicate: boolean;
  source: string;
  created_at: string;
};

export type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed' | 'draft';
  priority: number;
  max_attempts: number;
  retry_interval_minutes: number;
  calling_window_start: string;
  calling_window_end: string;
  timezone: string;
  created_at: string;
};

export type Queue = {
  id: string;
  campaign_id: string;
  name: string;
  status: 'on' | 'off' | 'paused';
  priority: number;
  calling_window_start: string;
  calling_window_end: string;
  timezone: string;
  created_at: string;
};

export type QueueItem = {
  id: string;
  queue_id: string;
  customer_id: string;
  status: 'pending' | 'dialing' | 'completed' | 'skipped' | 'callback' | 'failed';
  priority: number;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  assigned_agent_id: string | null;
  callback_at: string | null;
  callback_reason: string | null;
  created_at: string;
};

export type CallStatus =
  | 'queued' | 'dialing' | 'ringing' | 'connected' | 'on_hold'
  | 'muted' | 'transferred' | 'disconnected' | 'wrap_up' | 'completed'
  | 'no_answer' | 'busy' | 'rejected' | 'invalid_number' | 'network_failure';

export type CallDirection = 'outbound' | 'manual' | 'callback';

export type Call = {
  id: string;
  call_ref: string | null;
  direction: CallDirection;
  status: CallStatus;
  customer_id: string | null;
  agent_id: string | null;
  campaign_id: string | null;
  queue_id: string | null;
  queue_item_id: string | null;
  phone_dialed: string | null;
  disposition: string | null;
  notes: string | null;
  callback_scheduled_at: string | null;
  started_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  talk_time_seconds: number | null;
  acw_seconds: number | null;
  recording_id: string | null;
  recording_duration_seconds: number | null;
  recording_accessed_by: string | null;
  recording_accessed_at: string | null;
  created_at: string;
};

export type CallEvent = {
  id: string;
  call_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type Disposition = {
  id: string;
  code: string;
  label: string;
  category: 'connected' | 'no_contact' | 'invalid' | 'dnc' | 'duplicate';
  requires_callback: boolean;
  is_final: boolean;
  sort_order: number;
  active: boolean;
};

export type AgentStateName =
  | 'available' | 'on_call' | 'wrap_up' | 'meal_break' | 'short_break'
  | 'tea_break' | 'personal_break' | 'training' | 'meeting' | 'technical_break' | 'offline';

export type AgentState = {
  id: string;
  agent_id: string;
  state: AgentStateName;
  state_reason: string | null;
  state_changed_at: string;
};

export type AgentStateHistory = {
  id: string;
  agent_id: string;
  from_state: string | null;
  to_state: AgentStateName;
  reason: string | null;
  duration_seconds: number | null;
  started_at: string;
  ended_at: string | null;
};

export type PsfResponse = {
  id: string;
  call_id: string;
  customer_id: string | null;
  agent_id: string | null;
  csat_score: number | null;
  nps_score: number | null;
  service_resolved: boolean | null;
  technician_rating: number | null;
  service_partner_rating: number | null;
  customer_comments: string | null;
  created_at: string;
};

export type Callback = {
  id: string;
  call_id: string | null;
  customer_id: string;
  queue_id: string | null;
  agent_id: string | null;
  scheduled_at: string;
  reason: string | null;
  status: 'pending' | 'completed' | 'cancelled' | 'expired';
  created_at: string;
};

export type BreakType = {
  id: string;
  code: string;
  label: string;
  default_max_minutes: number;
  active: boolean;
  sort_order: number;
};

export type BreakLog = {
  id: string;
  agent_id: string;
  break_code: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

export type AuditLog = {
  id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type QueueAssignment = {
  id: string;
  queue_id: string;
  agent_id: string;
  created_at: string;
};

export async function logAudit(
  action: string,
  entity: string = 'system',
  details: Record<string, unknown> = {},
  entityId: string | null = null
) {
  try {
    await supabase.from('cc_audit_logs').insert({ action, entity, details, entity_id: entityId });
  } catch (e) {
    console.error('audit log failed:', e);
  }
}
