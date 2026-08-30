import { useEffect, useState, useCallback } from 'react';
import {
  PhoneCall, PhoneOff, Users, Clock, TrendingUp, Activity, Star,
  CheckCircle2, XCircle, BarChart3, Headset, Coffee, Phone, Calendar,
} from 'lucide-react';
import { supabase, type Call, type AgentState, type Profile, type Campaign, type Queue, type PsfResponse } from '@/lib/supabase';
import { getStateMeta, getCallStatusMeta, formatDuration, formatDateTime } from '@/lib/constants';
import { Card, KpiCard, Badge, EmptyState } from './ui';
import type { View } from './Sidebar';

type AgentWithState = {
  profile: Profile;
  state: AgentState | null;
};

export default function SupervisorDashboard({ setView }: { setView: (v: View) => void }) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [agents, setAgents] = useState<AgentWithState[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [psf, setPsf] = useState<PsfResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [{ data: callsData }, { data: profiles }, { data: states }, { data: campData }, { data: qData }, { data: psfData }] = await Promise.all([
      supabase.from('cc_calls').select('*').gte('created_at', today.toISOString()).order('created_at', { ascending: false }),
      supabase.from('cc_profiles').select('*'),
      supabase.from('cc_agent_states').select('*'),
      supabase.from('cc_campaigns').select('*'),
      supabase.from('cc_queues').select('*'),
      supabase.from('cc_psf_responses').select('*').gte('created_at', today.toISOString()),
    ]);
    setCalls(callsData as Call[] ?? []);
    setCampaigns(campData as Campaign[] ?? []);
    setQueues(qData as Queue[] ?? []);
    setPsf(psfData as PsfResponse[] ?? []);
    const statesMap = new Map((states ?? []).map((s: AgentState) => [s.agent_id, s]));
    setAgents((profiles ?? []).map((p: Profile) => ({ profile: p, state: statesMap.get(p.user_id) ?? null })));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    // Realtime subscriptions
    const callsChannel = supabase.channel('sup-calls').on('postgres_changes',
      { event: '*', schema: 'public', table: 'cc_calls' }, () => loadAll()).subscribe();
    const statesChannel = supabase.channel('sup-states').on('postgres_changes',
      { event: '*', schema: 'public', table: 'cc_agent_states' }, () => loadAll()).subscribe();
    const psfChannel = supabase.channel('sup-psf').on('postgres_changes',
      { event: '*', schema: 'public', table: 'cc_psf_responses' }, () => loadAll()).subscribe();
    const interval = setInterval(loadAll, 15000);
    return () => { supabase.removeChannel(callsChannel); supabase.removeChannel(statesChannel); supabase.removeChannel(psfChannel); clearInterval(interval); };
  }, [loadAll]);

  // Compute KPIs from real data
  const totalCalls = calls.length;
  const connectedCalls = calls.filter(c => ['connected', 'on_hold', 'muted', 'transferred', 'wrap_up', 'completed'].includes(c.status)).length;
  const connectionRate = totalCalls ? Math.round((connectedCalls / totalCalls) * 100) : 0;
  const completedCalls = calls.filter(c => c.status === 'completed').length;
  const abandonedCalls = calls.filter(c => ['no_answer', 'busy', 'rejected', 'network_failure'].includes(c.status)).length;
  const pendingCalls = calls.filter(c => c.status === 'queued' || c.status === 'dialing').length;
  const callbacks = calls.filter(c => c.callback_scheduled_at).length;

  const avgTalkTime = connectedCalls
    ? Math.round(calls.filter(c => c.talk_time_seconds).reduce((a, c) => a + (c.talk_time_seconds ?? 0), 0) / connectedCalls)
    : 0;
  const avgAcw = completedCalls
    ? Math.round(calls.filter(c => c.acw_seconds).reduce((a, c) => a + (c.acw_seconds ?? 0), 0) / completedCalls)
    : 0;
  const aht = avgTalkTime + avgAcw;

  const availableAgents = agents.filter(a => a.state?.state === 'available').length;
  const onCallAgents = agents.filter(a => a.state?.state === 'on_call').length;
  const onBreakAgents = agents.filter(a => a.state?.state && ['meal_break', 'short_break', 'tea_break', 'personal_break', 'training', 'meeting', 'technical_break'].includes(a.state.state)).length;
  const offlineAgents = agents.filter(a => !a.state || a.state.state === 'offline').length;

  const csatScores = psf.filter(p => p.csat_score !== null).map(p => p.csat_score!);
  const avgCsat = csatScores.length ? (csatScores.reduce((a, b) => a + b, 0) / csatScores.length).toFixed(1) : '—';
  const npsScores = psf.filter(p => p.nps_score !== null).map(p => p.nps_score!);
  const promoters = npsScores.filter(n => n >= 9).length;
  const detractors = npsScores.filter(n => n <= 6).length;
  const nps = npsScores.length ? Math.round(((promoters - detractors) / npsScores.length) * 100) : 0;

  if (loading) return <div className="p-10 text-center text-slate-500 text-sm">Loading dashboard…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Operations Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Real-time contact center monitoring · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-slate-400">Live</span>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Calls" value={totalCalls} icon={<PhoneCall className="w-5 h-5 text-sky-400" />} accent="bg-sky-500/10" />
        <KpiCard label="Connected" value={connectedCalls} sub={`${connectionRate}% rate`} icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />} accent="bg-emerald-500/10" />
        <KpiCard label="Abandoned" value={abandonedCalls} icon={<XCircle className="w-5 h-5 text-rose-400" />} accent="bg-rose-500/10" />
        <KpiCard label="Pending" value={pendingCalls} icon={<Clock className="w-5 h-5 text-amber-400" />} accent="bg-amber-500/10" />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Avg Talk Time" value={formatDuration(avgTalkTime)} icon={<Phone className="w-5 h-5 text-violet-400" />} accent="bg-violet-500/10" />
        <KpiCard label="AHT" value={formatDuration(aht)} sub={`ACW ${formatDuration(avgAcw)}`} icon={<Activity className="w-5 h-5 text-cyan-400" />} accent="bg-cyan-500/10" />
        <KpiCard label="CSAT" value={avgCsat} sub={`${csatScores.length} responses`} icon={<Star className="w-5 h-5 text-amber-400" />} accent="bg-amber-500/10" />
        <KpiCard label="NPS" value={nps} sub={`${npsScores.length} responses`} icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} accent="bg-emerald-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent Monitor */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold text-white flex items-center gap-2"><Headset className="w-4 h-4 text-sky-400" /> Agent Monitor</h2>
              <div className="flex gap-3 text-xs">
                <span className="text-emerald-400">{availableAgents} Available</span>
                <span className="text-sky-400">{onCallAgents} On Call</span>
                <span className="text-amber-400">{onBreakAgents} Break</span>
                <span className="text-slate-500">{offlineAgents} Offline</span>
              </div>
            </div>
            {agents.length === 0 ? (
              <EmptyState icon={<Users className="w-8 h-8 text-slate-600" />} title="No agents registered" />
            ) : (
              <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
                {agents.map((a) => {
                  const state = a.state?.state ?? 'offline';
                  const meta = getStateMeta(state);
                  return (
                    <div key={a.profile.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/40 transition">
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.color} ${state === 'on_call' ? 'animate-pulse' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{a.profile.display_name}</div>
                        <div className="text-xs text-slate-500">{a.profile.role}</div>
                      </div>
                      <Badge label={meta.label} color={meta.color} />
                      <div className="text-xs text-slate-500 hidden sm:block">
                        {a.state?.state_changed_at ? formatDateTime(a.state.state_changed_at) : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Queue Status */}
        <div>
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white flex items-center gap-2"><Phone className="w-4 h-4 text-sky-400" /> Queue Status</h2>
            </div>
            {queues.length === 0 ? (
              <EmptyState icon={<Phone className="w-8 h-8 text-slate-600" />} title="No queues configured" />
            ) : (
              <div className="divide-y divide-slate-800">
                {queues.map((q) => {
                  const queueCalls = calls.filter(c => c.queue_id === q.id);
                  return (
                    <div key={q.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white">{q.name}</span>
                        <Badge label={q.status.toUpperCase()} color={q.status === 'on' ? 'bg-emerald-500' : q.status === 'paused' ? 'bg-amber-500' : 'bg-slate-500'} />
                      </div>
                      <div className="text-xs text-slate-500">{queueCalls.length} calls today</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Campaign Performance + Recent Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="font-semibold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-sky-400" /> Campaign Performance</h2>
          </div>
          {campaigns.length === 0 ? (
            <EmptyState icon={<BarChart3 className="w-8 h-8 text-slate-600" />} title="No campaigns" />
          ) : (
            <div className="divide-y divide-slate-800">
              {campaigns.map((c) => {
                const campCalls = calls.filter(call => call.campaign_id === c.id);
                const campConnected = campCalls.filter(call => ['connected', 'completed', 'wrap_up'].includes(call.status)).length;
                return (
                  <div key={c.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white">{c.name}</span>
                      <Badge label={c.status} color={c.status === 'active' ? 'bg-emerald-500' : 'bg-slate-500'} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{campCalls.length} calls</span>
                      <span>{campConnected} connected</span>
                      <span>P{c.priority}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2"><PhoneCall className="w-4 h-4 text-sky-400" /> Recent Calls</h2>
            <button onClick={() => setView('call-history')} className="text-xs text-sky-400 hover:text-sky-300">View all</button>
          </div>
          {calls.length === 0 ? (
            <EmptyState icon={<PhoneCall className="w-8 h-8 text-slate-600" />} title="No calls today" />
          ) : (
            <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
              {calls.slice(0, 10).map((c) => {
                const meta = getCallStatusMeta(c.status);
                return (
                  <div key={c.id} className="px-5 py-2.5 flex items-center gap-3">
                    <Badge label={meta.label} color={meta.color} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200">{c.phone_dialed ?? '—'}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(c.created_at)}</div>
                    </div>
                    <div className="text-xs text-slate-400">{c.disposition ?? '—'}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
