// Telephony API client — talks to the cc-telephony edge function.
// The edge function implements the TelephonyProvider interface and persists
// all call events to the database. This client is the single integration
// point between the frontend and the telephony layer.

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cc-telephony`;

import { supabase } from '@/lib/supabase';

async function callTelephony(path: string, body: Record<string, unknown>) {
  const { data: session } = await supabase.auth.getSession();
  const res = await fetch(`${FUNCTION_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'request failed' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export type DialResponse = {
  callId: string;
  callRef: string;
  providerCallId: string;
  status: string;
};

export async function dialNumber(params: {
  agentId: string;
  phone: string;
  direction: 'outbound' | 'manual' | 'callback';
  customerId?: string;
  queueId?: string;
  queueItemId?: string;
  campaignId?: string;
  recordingEnabled?: boolean;
}): Promise<DialResponse> {
  return callTelephony('/dial', params);
}

export async function hangup(callId: string, providerCallId: string) {
  return callTelephony('/hangup', { callId, providerCallId });
}

export async function toggleHold(callId: string, providerCallId: string, hold: boolean) {
  return callTelephony(hold ? '/hold' : '/unhold', { callId, providerCallId });
}

export async function toggleMute(callId: string, providerCallId: string, muted: boolean) {
  return callTelephony(muted ? '/mute' : '/unmute', { callId, providerCallId });
}

export async function transferCall(callId: string, providerCallId: string, target: string, warm: boolean = false) {
  return callTelephony('/transfer', { callId, providerCallId, target, warm });
}
