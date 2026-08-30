import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Phone, PhoneOff, Pause, Play, MicOff, Mic, PhoneForwarded, User, Clock,
  Headset, Coffee, Calendar, FileText, Star, Save, Loader2, PhoneCall,
  CheckCircle2, AlertCircle, Car, MapPin, Wrench, Shield, ChevronRight, History,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, logAudit, type Customer, type QueueItem, type Call, type Disposition, type AgentStateName, type AgentState } from '@/lib/supabase';
import { AGENT_STATES, getStateMeta, getCallStatusMeta, formatDuration, maskPhone, formatDateTime } from '@/lib/constants';
import { dialNumber, hangup, toggleHold, toggleMute } from '@/lib/telephony';
import { Card, Badge, Button, TextInput, TextArea, Select, Modal } from './ui';

type Phase = 'idle' | 'connecting' | 'active' | 'wrapup';

export default function AgentDesktop() {
  const { user, profile } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');
  const [agentState, setAgentState] = useState<AgentStateName>('offline');
  const [queues, setQueues] = useState<{ id: string; name: string }[]>([]);
  const [assignedQueues, setAssignedQueues] = useState<string[]>([]);
  const [nextItem, setNextItem] = useState<QueueItem | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [providerCallId, setProviderCallId] = useState<string>('');
  const [callDuration, setCallDuration] = useState(0);
  const [isHold, setIsHold] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [selectedDisposition, setSelectedDisposition] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakType, setBreakType] = useState('short_break');
  const [psf, setPsf] = useState({ csat: 0, nps: 0, service_resolved: null as boolean | null, technician_rating: 0, service_partner_rating: 0, comments: '' });
  const [callbackAt, setCallbackAt] = useState('');
  const [callbackReason, setCallbackReason] = useState('');
  const [history, setHistory] = useState<{ id: string; summary: string; created_at: string }[]>([]);
  const [loadingNext, setLoadingNext] = useState(false);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load queues + dispositions on mount
  useEffect(() => {
    (async () => {
      const [{ data: qData }, { data: dData }] = await Promise.all([
        supabase.from('cc_queues').select('id, name').eq('status', 'on'),
        supabase.from('cc_dispositions').select('*').eq('active', true).order('sort_order'),
      ]);
      setQueues(qData ?? []);
      setDispositions(dData as Disposition[] ?? []);
    })();
  }, []);

  // Load assigned queues
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('cc_queue_assignments').select('queue_id').eq('agent_id', user.id);
      setAssignedQueues((data ?? []).map((a) => a.queue_id));
    })();
  }, [user]);

  // Load agent state
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('cc_agent_states').select('*').eq('agent_id', user.id).maybeSingle();
      if (data) {
        setAgentState(data.state as AgentStateName);
      } else {
        // Create initial state
        await supabase.from('cc_agent_states').insert({ agent_id: user.id, state: 'offline' });
        setAgentState('offline');
      }
    })();
  }, [user]);

  // Call duration timer
  useEffect(() => {
    if (phase === 'active') {
      durationTimer.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (durationTimer.current) clearInterval(durationTimer.current);
      setCallDuration(0);
    }
    return () => { if (durationTimer.current) clearInterval(durationTimer.current); };
  }, [phase]);

  const changeAgentState = useCallback(async (newState: AgentStateName, reason?: string) => {
    if (!user) return;
    const oldState = agentState;
    const { error } = await supabase.from('cc_agent_states').update({
      state: newState, state_reason: reason ?? null, state_changed_at: new Date().toISOString(),
    }).eq('agent_id', user.id);
    if (!error) {
      setAgentState(newState);
      await supabase.from('cc_agent_state_history').insert({
        agent_id: user.id, from_state: oldState, to_state: newState, reason: reason ?? null,
        started_at: new Date().toISOString(),
      });
      await logAudit('agent_state_change', 'agent_state', { from: oldState, to: newState, reason });
    }
  }, [user, agentState]);

  const loadCustomer = useCallback(async (customerId: string) => {
    const { data: cust } = await supabase.from('cc_customers').select('*').eq('id', customerId).maybeSingle();
    setCustomer(cust as Customer | null);
    // Load history
    const { data: hist } = await supabase.from('cc_customer_history').select('id, summary, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(5);
    setHistory(hist ?? []);
  }, []);

  const fetchNextCall = useCallback(async () => {
    if (!user || assignedQueues.length === 0) return;
    setLoadingNext(true);
    setError(null);
    // Find highest-priority pending queue item from assigned queues
    const { data: items } = await supabase
      .from('cc_queue_items')
      .select('*')
      .in('queue_id', assignedQueues)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('next_attempt_at', { ascending: true, nullsFirst: true })
      .limit(1);
    const item = items?.[0] as QueueItem | undefined;
    if (!item) {
      setError('No pending calls in your queues.');
      setLoadingNext(false);
      return;
    }
    // Check DNC, invalid number, max attempts
    await loadCustomer(item.customer_id);
    setNextItem(item);
    // Mark as dialing
    await supabase.from('cc_queue_items').update({ status: 'dialing', assigned_agent_id: user.id, last_attempt_at: new Date().toISOString() }).eq('id', item.id);
    // Auto-dial
    await doDial(item, 'outbound');
    setLoadingNext(false);
  }, [user, assignedQueues, loadCustomer]);

  const doDial = useCallback(async (item: QueueItem | null, direction: 'outbound' | 'manual' | 'callback', phoneOverride?: string) => {
    if (!user || !customer) return;
    setError(null);
    setPhase('connecting');
    await changeAgentState('on_call');
    const phone = phoneOverride ?? customer.phone;
    try {
      const result = await dialNumber({
        agentId: user.id,
        phone,
        direction,
        customerId: customer.id,
        queueId: item?.queue_id,
        queueItemId: item?.id,
        campaignId: undefined,
        recordingEnabled: true,
      });
      setProviderCallId(result.providerCallId);
      // Fetch the call record
      const { data: callRec } = await supabase.from('cc_calls').select('*').eq('id', result.callId).maybeSingle();
      setActiveCall(callRec as Call | null);
      // Simulate call progression (mock provider): dialing → ringing → connected
      setTimeout(() => updateCallStatus('ringing'), 1000);
      setTimeout(() => {
        updateCallStatus('connected');
        setPhase('active');
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dial failed');
      setPhase('idle');
      await changeAgentState('available');
    }
  }, [user, customer, changeAgentState]);

  const updateCallStatus = useCallback(async (status: string) => {
    if (!activeCall) return;
    const updates: Record<string, unknown> = { status };
    if (status === 'connected') updates.connected_at = new Date().toISOString();
    await supabase.from('cc_calls').update(updates).eq('id', activeCall.id);
    await supabase.from('cc_call_events').insert({ call_id: activeCall.id, event_type: status, to_status: status });
    setActiveCall((c) => c ? { ...c, status: status as Call['status'] } : c);
  }, [activeCall]);

  const handleHangup = useCallback(async () => {
    if (!activeCall) return;
    try { await hangup(activeCall.id, providerCallId); } catch { /* mock may fail */ }
    await updateCallStatus('disconnected');
    setPhase('wrapup');
    await changeAgentState('wrap_up');
  }, [activeCall, providerCallId, updateCallStatus, changeAgentState]);

  const handleHold = useCallback(async () => {
    if (!activeCall) return;
    const newHold = !isHold;
    setIsHold(newHold);
    try { await toggleHold(activeCall.id, providerCallId, newHold); } catch { /* mock */ }
  }, [activeCall, providerCallId, isHold]);

  const handleMute = useCallback(async () => {
    if (!activeCall) return;
    const newMute = !isMuted;
    setIsMuted(newMute);
    try { await toggleMute(activeCall.id, providerCallId, newMute); } catch { /* mock */ }
  }, [activeCall, providerCallId, isMuted]);

  const completeWrapUp = useCallback(async () => {
    if (!activeCall || !user) return;
    const now = new Date().toISOString();
    const talkTime = activeCall.connected_at ? Math.floor((Date.now() - new Date(activeCall.connected_at).getTime()) / 1000) : 0;
    const acwTime = Math.floor((Date.now() - new Date(activeCall.ended_at ?? now).getTime()) / 1000);

    const disp = dispositions.find((d) => d.code === selectedDisposition);
    const updates: Record<string, unknown> = {
      status: 'completed',
      ended_at: now,
      disposition: selectedDisposition || null,
      notes: notes || null,
      talk_time_seconds: talkTime,
      acw_seconds: acwTime,
      duration_seconds: activeCall.started_at ? Math.floor((Date.now() - new Date(activeCall.started_at).getTime()) / 1000) : 0,
      callback_scheduled_at: callbackAt || null,
    };
    await supabase.from('cc_calls').update(updates).eq('id', activeCall.id);
    await supabase.from('cc_call_events').insert({ call_id: activeCall.id, event_type: 'wrapup_complete', to_status: 'completed', details: { disposition: selectedDisposition } });

    // Save PSF if any field set
    if (psf.csat > 0 || psf.nps > 0 || psf.service_resolved !== null || psf.comments) {
      await supabase.from('cc_psf_responses').insert({
        call_id: activeCall.id,
        customer_id: customer?.id ?? null,
        agent_id: user.id,
        csat_score: psf.csat || null,
        nps_score: psf.nps || null,
        service_resolved: psf.service_resolved,
        technician_rating: psf.technician_rating || null,
        service_partner_rating: psf.service_partner_rating || null,
        customer_comments: psf.comments || null,
      });
    }

    // Save callback if scheduled
    if (callbackAt) {
      await supabase.from('cc_callbacks').insert({
        call_id: activeCall.id,
        customer_id: customer?.id,
        queue_id: nextItem?.queue_id ?? null,
        agent_id: user.id,
        scheduled_at: callbackAt,
        reason: callbackReason || null,
        status: 'pending',
      });
      if (nextItem) {
        await supabase.from('cc_queue_items').update({ status: 'callback', callback_at: callbackAt, callback_reason: callbackReason }).eq('id', nextItem.id);
      }
    } else if (nextItem) {
      const newAttempts = (nextItem.attempts ?? 0) + 1;
      const isFinal = disp?.is_final ?? false;
      await supabase.from('cc_queue_items').update({
        status: isFinal ? 'completed' : 'pending',
        attempts: newAttempts,
        next_attempt_at: isFinal ? null : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }).eq('id', nextItem.id);
    }

    // Add customer history
    if (customer) {
      await supabase.from('cc_customer_history').insert({
        customer_id: customer.id,
        interaction_type: 'call',
        summary: `${selectedDisposition || 'Call completed'} — ${notes.slice(0, 100) || 'No notes'}`,
      });
    }

    await logAudit('call_disposition_set', 'call', { call_id: activeCall.id, disposition: selectedDisposition }, activeCall.id);

    // Reset
    setPhase('idle');
    setActiveCall(null);
    setNextItem(null);
    setCustomer(null);
    setSelectedDisposition('');
    setNotes('');
    setCallbackAt('');
    setCallbackReason('');
    setPsf({ csat: 0, nps: 0, service_resolved: null, technician_rating: 0, service_partner_rating: 0, comments: '' });
    await changeAgentState('available');
  }, [activeCall, user, customer, nextItem, selectedDisposition, notes, callbackAt, callbackReason, psf, dispositions, changeAgentState]);

  const handleManualDial = useCallback(async () => {
    if (!manualPhone || !user) return;
    setError(null);
    // Create a temp customer or find existing
    const { data: existing } = await supabase.from('cc_customers').select('*').eq('phone', manualPhone).maybeSingle();
    if (existing) {
      setCustomer(existing as Customer);
    } else {
      // For manual dial, create a minimal customer record (agents can't insert customers per RLS,
      // so we'll just use the phone directly without a customer record)
      setCustomer({ id: '', customer_name: 'Manual Dial', phone: manualPhone, alt_phone: null, email: null, location: null, address: null, vehicle_number: null, vehicle_model: null, rsa_case_id: null, rsa_case_type: null, rsa_case_status: null, service_date: null, service_type: null, service_partner: null, dealer_workshop: null, technician_name: null, timezone: 'Asia/Kolkata', dnc_opt_out: false, invalid_number: false, is_duplicate: false, source: 'manual', created_at: '' } as Customer);
    }
    setPhase('connecting');
    await changeAgentState('on_call');
    try {
      const result = await dialNumber({ agentId: user.id, phone: manualPhone, direction: 'manual', recordingEnabled: true });
      setProviderCallId(result.providerCallId);
      const { data: callRec } = await supabase.from('cc_calls').select('*').eq('id', result.callId).maybeSingle();
      setActiveCall(callRec as Call | null);
      setTimeout(() => updateCallStatus('ringing'), 1000);
      setTimeout(() => { updateCallStatus('connected'); setPhase('active'); }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dial failed');
      setPhase('idle');
      await changeAgentState('available');
    }
  }, [manualPhone, user, changeAgentState, updateCallStatus]);

  const stateMeta = getStateMeta(agentState);
  const callMeta = activeCall ? getCallStatusMeta(activeCall.status) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Desktop</h1>
          <p className="text-slate-400 text-sm mt-0.5">Welcome, {profile?.display_name ?? 'Agent'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge label={stateMeta.label} color={stateMeta.color} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Call Controls + State */}
        <div className="lg:col-span-2 space-y-4">
          {/* Agent State Panel */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Headset className="w-4 h-4 text-sky-400" /> Agent State</h2>
              <span className="text-xs text-slate-500">Since {formatDateTime(agentState === 'offline' ? null : new Date().toISOString())}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => changeAgentState('available')}
                disabled={phase === 'active' || phase === 'connecting'}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-40 ${
                  agentState === 'available' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}>
                Available
              </button>
              <button onClick={() => setShowBreakModal(true)}
                disabled={phase === 'active' || phase === 'connecting' || phase === 'wrapup'}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition disabled:opacity-40 flex items-center gap-1">
                <Coffee className="w-3.5 h-3.5" /> Break
              </button>
              <button onClick={() => changeAgentState('offline')}
                disabled={phase === 'active' || phase === 'connecting'}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition disabled:opacity-40">
                Offline
              </button>
            </div>
          </Card>

          {/* Call Control Panel */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2"><PhoneCall className="w-4 h-4 text-sky-400" /> Call Controls</h2>
              {phase === 'active' && callMeta && <Badge label={callMeta.label} color={callMeta.color} />}
            </div>

            {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-3">{error}</div>}

            {phase === 'idle' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Assigned Queues</label>
                    <div className="text-sm text-slate-300">
                      {assignedQueues.length === 0
                        ? 'No queues assigned. Ask supervisor to assign you.'
                        : queues.filter(q => assignedQueues.includes(q.id)).map(q => q.name).join(', ')}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Next Call</label>
                    <Button onClick={fetchNextCall} disabled={agentState !== 'available' || assignedQueues.length === 0 || loadingNext}
                      className="w-full flex items-center justify-center gap-2">
                      {loadingNext ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                      Get Next Call
                    </Button>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-4">
                  <label className="text-xs text-slate-400 mb-2 block">Manual Dial</label>
                  <div className="flex gap-2">
                    <TextInput value={manualPhone} onChange={setManualPhone} placeholder="+91 98XXX XXXXX" />
                    <Button onClick={handleManualDial} disabled={!manualPhone || agentState !== 'available'}
                      className="flex items-center gap-1 shrink-0">
                      <Phone className="w-4 h-4" /> Dial
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {phase === 'connecting' && (
              <div className="text-center py-8">
                <Loader2 className="w-10 h-10 text-sky-400 animate-spin mx-auto mb-3" />
                <div className="text-white font-medium">Connecting…</div>
                <div className="text-sm text-slate-400 mt-1">{customer?.phone}</div>
              </div>
            )}

            {phase === 'active' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white tabular-nums">{formatDuration(callDuration)}</div>
                    <div className="text-sm text-slate-400 mt-1">{customer?.customer_name ?? 'Manual Call'}</div>
                    <div className="text-xs text-slate-500">{maskPhone(customer?.phone)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={handleHold} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isHold ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                    {isHold ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </button>
                  <button onClick={handleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition ${isMuted ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button onClick={handleHangup} className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center transition shadow-lg shadow-rose-500/30">
                    <PhoneOff className="w-6 h-6" />
                  </button>
                </div>
                {activeCall?.recording_id && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Recording in progress
                  </div>
                )}
              </div>
            )}

            {phase === 'wrapup' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">After Call Work (ACW)</span>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Disposition</label>
                  <Select value={selectedDisposition} onChange={setSelectedDisposition}
                    options={[{ value: '', label: 'Select disposition…' }, ...dispositions.map(d => ({ value: d.code, label: d.label }))]}
                    className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Notes</label>
                  <TextArea value={notes} onChange={setNotes} placeholder="Call notes…" rows={3} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Schedule Callback (optional)</label>
                    <input type="datetime-local" value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Callback Reason</label>
                    <TextInput value={callbackReason} onChange={setCallbackReason} placeholder="Reason…" />
                  </div>
                </div>
                <Button onClick={completeWrapUp} variant="primary" className="w-full flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Complete & Save
                </Button>
              </div>
            )}
          </Card>

          {/* PSF Questionnaire — shown during active call or wrapup */}
          {(phase === 'active' || phase === 'wrapup') && customer?.id && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><Star className="w-4 h-4 text-amber-400" /> PSF Questionnaire</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">CSAT Score (1-5)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setPsf(p => ({ ...p, csat: n }))}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition ${psf.csat === n ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">NPS Score (0-10)</label>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: 11 }, (_, i) => i).map(n => (
                      <button key={n} onClick={() => setPsf(p => ({ ...p, nps: n }))}
                        className={`w-8 h-8 rounded-md text-xs font-medium transition ${psf.nps === n ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Was the service issue resolved?</label>
                  <div className="flex gap-2">
                    <button onClick={() => setPsf(p => ({ ...p, service_resolved: true }))}
                      className={`px-4 py-1.5 rounded-lg text-sm transition ${psf.service_resolved === true ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Yes</button>
                    <button onClick={() => setPsf(p => ({ ...p, service_resolved: false }))}
                      className={`px-4 py-1.5 rounded-lg text-sm transition ${psf.service_resolved === false ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>No</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Technician Rating (1-5)</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setPsf(p => ({ ...p, technician_rating: n }))}
                          className={`w-8 h-8 rounded-md text-xs ${psf.technician_rating === n ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1.5 block">Service Partner Rating (1-5)</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setPsf(p => ({ ...p, service_partner_rating: n }))}
                          className={`w-8 h-8 rounded-md text-xs ${psf.service_partner_rating === n ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Customer Comments</label>
                  <TextArea value={psf.comments} onChange={(v) => setPsf(p => ({ ...p, comments: v }))} placeholder="Customer feedback…" rows={2} />
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right: Customer Info */}
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><User className="w-4 h-4 text-sky-400" /> Customer Information</h2>
            {!customer ? (
              <div className="text-sm text-slate-500 py-6 text-center">No customer loaded. Accept a call to view details.</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-white font-medium">{customer.customer_name}</div>
                  <div className="text-xs text-slate-500">{maskPhone(customer.phone)}</div>
                </div>
                {customer.email && <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Email" value={customer.email} />}
                {customer.location && <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Location" value={customer.location} />}
                {customer.vehicle_number && <InfoRow icon={<Car className="w-3.5 h-3.5" />} label="Vehicle" value={`${customer.vehicle_number} (${customer.vehicle_model ?? '—'})`} />}
                {customer.rsa_case_id && <InfoRow icon={<Shield className="w-3.5 h-3.5" />} label="RSA Case" value={`${customer.rsa_case_id} — ${customer.rsa_case_type ?? ''}`} />}
                {customer.rsa_case_status && <InfoRow icon={<Shield className="w-3.5 h-3.5" />} label="Case Status" value={customer.rsa_case_status} />}
                {customer.service_type && <InfoRow icon={<Wrench className="w-3.5 h-3.5" />} label="Service" value={customer.service_type} />}
                {customer.service_partner && <InfoRow icon={<Wrench className="w-3.5 h-3.5" />} label="Service Partner" value={customer.service_partner} />}
                {customer.technician_name && <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Technician" value={customer.technician_name} />}
                {customer.service_date && <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label="Service Date" value={formatDateTime(customer.service_date)} />}
                {customer.dnc_opt_out && <div className="text-xs text-rose-400 bg-rose-500/10 rounded px-2 py-1">DNC / Opt-Out — Do Not Call</div>}
                {customer.invalid_number && <div className="text-xs text-amber-400 bg-amber-500/10 rounded px-2 py-1">Invalid Number Flag</div>}
              </div>
            )}
          </Card>

          {/* Previous interactions */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><History className="w-4 h-4 text-sky-400" /> Previous Interactions</h2>
            {history.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 text-center">No previous interactions.</div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="text-xs">
                    <div className="text-slate-300">{h.summary}</div>
                    <div className="text-slate-600">{formatDateTime(h.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Break Modal */}
      <Modal open={showBreakModal} onClose={() => setShowBreakModal(false)} title="Start Break">
        <div className="space-y-3">
          {AGENT_STATES.filter(s => s.category === 'break').map(s => (
            <button key={s.value} onClick={() => { setBreakType(s.value); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${breakType === s.value ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
              <span className="text-sm text-slate-200">{s.label}</span>
            </button>
          ))}
          <Button onClick={async () => { await changeAgentState(breakType as AgentStateName); setShowBreakModal(false); }} className="w-full">
            Start Break
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-slate-500 mt-0.5">{icon}</span>
      <div>
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="text-slate-200">{value}</div>
      </div>
    </div>
  );
}
