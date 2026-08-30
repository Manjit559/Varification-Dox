// TATA RSA Contact-Centre — Telephony Edge Function
// Provider abstraction layer. Implements a TelephonyProvider interface so an
// approved production SIP/CCaaS provider can be integrated later without
// changing the frontend or database schema.
//
// Routes (all under /functions/v1/cc-telephony):
//   POST /dial          — initiate an outbound call (auto or manual)
//   POST /hangup        — end a call
//   POST /hold         — toggle hold
//   POST /mute          — toggle mute
//   POST /transfer      — warm/cold transfer
//   POST /event         — webhook callback from provider (call state change)
//   GET  /health        — provider health check
//
// The active provider is selected via the TELEPHONY_PROVIDER secret
// ('mock' | 'genesys' | 'twilio' | 'amazon-connect' | 'custom').
// Only 'mock' is fully implemented here; others throw "not configured"
// until the provider SDK + credentials are wired in production.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// =========================================================
// TelephonyProvider interface
// =========================================================
interface DialRequest {
  callId: string;
  callRef: string;
  from: string;
  to: string;
  direction: "outbound" | "manual" | "callback";
  agentId: string;
  customerId?: string;
  queueId?: string;
  campaignId?: string;
  recordingEnabled: boolean;
}

interface DialResult {
  providerCallId: string;
  status: string;
  recordingId?: string;
}

interface TelephonyProvider {
  name: string;
  dial(req: DialRequest): Promise<DialResult>;
  hangup(providerCallId: string): Promise<void>;
  toggleHold(providerCallId: string, hold: boolean): Promise<void>;
  toggleMute(providerCallId: string, muted: boolean): Promise<void>;
  transfer(providerCallId: string, target: string, warm: boolean): Promise<void>;
  handleWebhook(payload: unknown): Promise<{ callRef?: string; status: string; details?: Record<string, unknown> }>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}

// =========================================================
// Mock provider — simulates call progression for development.
// In production, replace with a real provider implementation.
// =========================================================
class MockTelephonyProvider implements TelephonyProvider {
  name = "mock";
  async dial(req: DialRequest): Promise<DialResult> {
    return {
      providerCallId: `mock-${req.callRef}`,
      status: "dialing",
      recordingId: req.recordingEnabled ? `rec-${req.callRef}` : undefined,
    };
  }
  async hangup(): Promise<void> {}
  async toggleHold(): Promise<void> {}
  async toggleMute(): Promise<void> {}
  async transfer(): Promise<void> {}
  async handleWebhook(payload: unknown): Promise<{ callRef?: string; status: string; details?: Record<string, unknown> }> {
    const p = payload as Record<string, unknown>;
    return { callRef: (p.callRef as string) ?? undefined, status: (p.status as string) ?? "connected", details: { provider: "mock" } };
  }
  async health(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: "mock provider active" };
  }
}

// =========================================================
// Provider factory — selects based on TELEPHONY_PROVIDER secret.
// Production providers are stubbed; wire SDK + secrets to activate.
// =========================================================
function getProvider(): TelephonyProvider {
  const providerName = Deno.env.get("TELEPHONY_PROVIDER") ?? "mock";
  switch (providerName) {
    case "mock":
      return new MockTelephonyProvider();
    case "genesys":
    case "twilio":
    case "amazon-connect":
    case "custom":
      // Production: import and instantiate the provider SDK here.
      // e.g. return new GenesysProvider(Deno.env.get("GENESYS_TOKEN"));
      throw new Error(`Telephony provider '${providerName}' is not yet configured. Wire the provider SDK and credentials in the edge function to enable.`);
    default:
      throw new Error(`Unknown telephony provider: ${providerName}`);
  }
}

// =========================================================
// Supabase client (service role for DB writes)
// =========================================================
function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function generateCallRef(): string {
  return `CALL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// =========================================================
// Route handlers
// =========================================================
async function handleDial(req: Request, supabase: ReturnType<typeof getSupabase>): Promise<Response> {
  const body = await req.json();
  const { agentId, customerId, phone, direction, queueId, queueItemId, campaignId, recordingEnabled } = body;

  if (!agentId || !phone) {
    return json({ error: "agentId and phone are required" }, 400);
  }

  const callRef = generateCallRef();

  // Insert call record
  const { data: callRec, error } = await supabase.from("cc_calls").insert({
    call_ref: callRef,
    direction: direction ?? "manual",
    status: "queued",
    customer_id: customerId ?? null,
    agent_id: agentId,
    campaign_id: campaignId ?? null,
    queue_id: queueId ?? null,
    queue_item_id: queueItemId ?? null,
    phone_dialed: phone,
    started_at: new Date().toISOString(),
  }).select().single();

  if (error) return json({ error: error.message }, 500);

  // Insert call event
  await supabase.from("cc_call_events").insert({
    call_id: callRec.id,
    event_type: "call_created",
    to_status: "queued",
    details: { call_ref: callRef, direction },
  });

  // Invoke provider
  const provider = getProvider();
  try {
    const result = await provider.dial({
      callId: callRec.id,
      callRef,
      from: "+918000000000",
      to: phone,
      direction: direction ?? "manual",
      agentId,
      customerId,
      queueId,
      campaignId,
      recordingEnabled: recordingEnabled ?? true,
    });

    // Update call with provider info and transition to dialing
    await supabase.from("cc_calls").update({
      status: "dialing",
      recording_id: result.recordingId ?? null,
    }).eq("id", callRec.id);

    await supabase.from("cc_call_events").insert({
      call_id: callRec.id,
      event_type: "provider_dial",
      from_status: "queued",
      to_status: "dialing",
      details: { provider_call_id: result.providerCallId, provider_status: result.status },
    });

    return json({ callId: callRec.id, callRef, providerCallId: result.providerCallId, status: "dialing" });
  } catch (err) {
    // Provider failed — mark as network_failure
    await supabase.from("cc_calls").update({ status: "network_failure", ended_at: new Date().toISOString() }).eq("id", callRec.id);
    await supabase.from("cc_call_events").insert({
      call_id: callRec.id,
      event_type: "provider_error",
      to_status: "network_failure",
      details: { error: (err as Error).message },
    });
    return json({ error: (err as Error).message, callId: callRec.id }, 502);
  }
}

async function handleCallAction(req: Request, supabase: ReturnType<typeof getSupabase>, action: string): Promise<Response> {
  const body = await req.json();
  const { callId, providerCallId } = body;
  if (!callId) return json({ error: "callId required" }, 400);

  const provider = getProvider();
  const statusMap: Record<string, string> = {
    hangup: "disconnected",
    hold: "on_hold",
    unhold: "connected",
    mute: "muted",
    unmute: "connected",
    transfer: "transferred",
  };

  try {
    switch (action) {
      case "hangup":
        await provider.hangup(providerCallId);
        await supabase.from("cc_calls").update({ status: "disconnected", ended_at: new Date().toISOString() }).eq("id", callId);
        break;
      case "hold":
        await provider.toggleHold(providerCallId, true);
        await supabase.from("cc_calls").update({ status: "on_hold" }).eq("id", callId);
        break;
      case "unhold":
        await provider.toggleHold(providerCallId, false);
        await supabase.from("cc_calls").update({ status: "connected" }).eq("id", callId);
        break;
      case "mute":
        await provider.toggleMute(providerCallId, true);
        await supabase.from("cc_calls").update({ status: "muted" }).eq("id", callId);
        break;
      case "unmute":
        await provider.toggleMute(providerCallId, false);
        await supabase.from("cc_calls").update({ status: "connected" }).eq("id", callId);
        break;
      case "transfer": {
        const { target, warm } = body;
        await provider.transfer(providerCallId, target, warm ?? false);
        await supabase.from("cc_calls").update({ status: "transferred" }).eq("id", callId);
        break;
      }
    }

    await supabase.from("cc_call_events").insert({
      call_id: callId,
      event_type: action,
      to_status: statusMap[action] ?? action,
      details: body,
    });

    return json({ ok: true, status: statusMap[action] ?? action });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
}

async function handleWebhook(req: Request, supabase: ReturnType<typeof getSupabase>): Promise<Response> {
  const payload = await req.json();
  const provider = getProvider();
  try {
    const result = await provider.handleWebhook(payload);
    if (result.callRef) {
      const updates: Record<string, unknown> = {};
      if (result.status === "connected") updates.connected_at = new Date().toISOString();
      if (["completed", "no_answer", "busy", "rejected", "invalid_number", "network_failure", "disconnected"].includes(result.status)) {
        updates.ended_at = new Date().toISOString();
      }
      updates.status = result.status;
      await supabase.from("cc_calls").update(updates).eq("call_ref", result.callRef);
      await supabase.from("cc_call_events").insert({
        call_id: null,
        event_type: "webhook",
        to_status: result.status,
        details: result.details ?? {},
      });
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// =========================================================
// Main handler
// =========================================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace("/functions/v1/cc-telephony", "");
  const supabase = getSupabase();

  try {
    if (path === "/health" || path === "") {
      const provider = getProvider();
      const h = await provider.health();
      return json({ ok: h.ok, provider: provider.name, detail: h.detail });
    }
    if (path === "/dial" && req.method === "POST") return await handleDial(req, supabase);
    if (path === "/hangup" && req.method === "POST") return await handleCallAction(req, supabase, "hangup");
    if (path === "/hold" && req.method === "POST") return await handleCallAction(req, supabase, "hold");
    if (path === "/unhold" && req.method === "POST") return await handleCallAction(req, supabase, "unhold");
    if (path === "/mute" && req.method === "POST") return await handleCallAction(req, supabase, "mute");
    if (path === "/unmute" && req.method === "POST") return await handleCallAction(req, supabase, "unmute");
    if (path === "/transfer" && req.method === "POST") return await handleCallAction(req, supabase, "transfer");
    if (path === "/event" && req.method === "POST") return await handleWebhook(req, supabase);

    return json({ error: "not found", path }, 404);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
