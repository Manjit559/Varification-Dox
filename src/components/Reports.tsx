import { useEffect, useState, useCallback } from 'react';
import { BarChart3, Download, Star, Clock, Phone, Calendar } from 'lucide-react';
import { supabase, type Call, type PsfResponse, type BreakLog, type AgentStateHistory, type Callback, type Profile } from '@/lib/supabase';
import { formatDuration } from '@/lib/constants';
import { Card, KpiCard, Select, EmptyState } from './ui';

type ReportType = 'calls' | 'agents' | 'queues' | 'campaigns' | 'breaks' | 'callbacks' | 'feedback' | 'dispositions';

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'calls', label: 'Calls Report' },
  { value: 'agents', label: 'Agents Report' },
  { value: 'queues', label: 'Queues Report' },
  { value: 'campaigns', label: 'Campaigns Report' },
  { value: 'breaks', label: 'Breaks Report' },
  { value: 'callbacks', label: 'Callbacks Report' },
  { value: 'feedback', label: 'Feedback Report' },
  { value: 'dispositions', label: 'Dispositions Report' },
];

function getHeaders(type: ReportType): string[] {
  switch (type) {
    case 'calls': return ['Call Ref', 'Direction', 'Status', 'Phone', 'Agent', 'Disposition', 'Duration', 'Talk Time', 'ACW', 'Created'];
    case 'agents': return ['Agent', 'Total Calls', 'Completed', 'Avg Talk Time', 'Avg ACW'];
    case 'queues': return ['Queue ID', 'Total Calls', 'Connected', 'Completed'];
    case 'campaigns': return ['Campaign ID', 'Total Calls', 'Connected', 'Completed'];
    case 'breaks': return ['Agent', 'Break Type', 'Started', 'Ended', 'Duration'];
    case 'callbacks': return ['Customer ID', 'Agent', 'Scheduled At', 'Reason', 'Status'];
    case 'feedback': return ['Call ID', 'CSAT', 'NPS', 'Resolved', 'Tech Rating', 'Partner Rating', 'Comments'];
    case 'dispositions': return ['Disposition', 'Count'];
  }
}

function getRows(type: ReportType, calls: Call[], psf: PsfResponse[], breaks: BreakLog[], callbacks: Callback[], profileName: (uid: string | null) => string): string[][] {
  switch (type) {
    case 'calls':
      return calls.map((c) => [
        c.call_ref ?? '', c.direction, c.status, c.phone_dialed ?? '',
        profileName(c.agent_id), c.disposition ?? '',
        formatDuration(c.duration_seconds), formatDuration(c.talk_time_seconds),
        formatDuration(c.acw_seconds), c.created_at,
      ]);
    case 'agents': {
      const agents = new Map<string, { total: number; completed: number; talk: number; acw: number }>();
      calls.forEach((c) => {
        if (!c.agent_id) return;
        const a = agents.get(c.agent_id) ?? { total: 0, completed: 0, talk: 0, acw: 0 };
        a.total++;
        if (c.status === 'completed') a.completed++;
        a.talk += c.talk_time_seconds ?? 0;
        a.acw += c.acw_seconds ?? 0;
        agents.set(c.agent_id, a);
      });
      return [...agents.entries()].map(([uid, a]) => [
        profileName(uid), String(a.total), String(a.completed),
        formatDuration(a.completed ? Math.round(a.talk / a.completed) : 0),
        formatDuration(a.completed ? Math.round(a.acw / a.completed) : 0),
      ]);
    }
    case 'queues': {
      const q = new Map<string, { total: number; connected: number; completed: number }>();
      calls.forEach((c) => {
        if (!c.queue_id) return;
        const a = q.get(c.queue_id) ?? { total: 0, connected: 0, completed: 0 };
        a.total++;
        if (['connected', 'completed', 'wrap_up'].includes(c.status)) a.connected++;
        if (c.status === 'completed') a.completed++;
        q.set(c.queue_id, a);
      });
      return [...q.entries()].map(([id, a]) => [id.slice(0, 8), String(a.total), String(a.connected), String(a.completed)]);
    }
    case 'campaigns': {
      const c = new Map<string, { total: number; connected: number; completed: number }>();
      calls.forEach((call) => {
        if (!call.campaign_id) return;
        const a = c.get(call.campaign_id) ?? { total: 0, connected: 0, completed: 0 };
        a.total++;
        if (['connected', 'completed', 'wrap_up'].includes(call.status)) a.connected++;
        if (call.status === 'completed') a.completed++;
        c.set(call.campaign_id, a);
      });
      return [...c.entries()].map(([id, a]) => [id.slice(0, 8), String(a.total), String(a.connected), String(a.completed)]);
    }
    case 'breaks':
      return breaks.map((b) => [
        profileName(b.agent_id), b.break_code.replaceAll('_', ' '),
        b.started_at, b.ended_at ?? '', formatDuration(b.duration_seconds),
      ]);
    case 'callbacks':
      return callbacks.map((c) => [
        c.customer_id.slice(0, 8), profileName(c.agent_id),
        c.scheduled_at, c.reason ?? '', c.status,
      ]);
    case 'feedback':
      return psf.map((p) => [
        p.call_id.slice(0, 8), String(p.csat_score ?? ''), String(p.nps_score ?? ''),
        String(p.service_resolved ?? ''), String(p.technician_rating ?? ''),
        String(p.service_partner_rating ?? ''), p.customer_comments ?? '',
      ]);
    case 'dispositions': {
      const d = new Map<string, number>();
      calls.forEach((c) => {
        if (c.disposition) d.set(c.disposition, (d.get(c.disposition) ?? 0) + 1);
      });
      return [...d.entries()].map(([disp, count]) => [disp.replaceAll('_', ' '), String(count)]);
    }
  }
}

function buildCsv(rows: string[][], headers: string[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    const escaped = row.map((cell) => {
      const val = String(cell ?? '');
      return '"' + val.replaceAll('"', '""') + '"';
    });
    lines.push(escaped.join(','));
  }
  return lines.join('\n');
}

export default function Reports() {
  const [type, setType] = useState<ReportType>('calls');
  const [calls, setCalls] = useState<Call[]>([]);
  const [psf, setPsf] = useState<PsfResponse[]>([]);
  const [breaks, setBreaks] = useState<BreakLog[]>([]);
  const [stateHistory, setStateHistory] = useState<AgentStateHistory[]>([]);
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, pRes, bRes, shRes, cbRes, profRes] = await Promise.all([
      supabase.from('cc_calls').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('cc_psf_responses').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('cc_break_logs').select('*').order('started_at', { ascending: false }).limit(500),
      supabase.from('cc_agent_state_history').select('*').order('started_at', { ascending: false }).limit(500),
      supabase.from('cc_callbacks').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('cc_profiles').select('*'),
    ]);
    setCalls((cRes.data as Call[]) ?? []);
    setPsf((pRes.data as PsfResponse[]) ?? []);
    setBreaks((bRes.data as BreakLog[]) ?? []);
    setStateHistory((shRes.data as AgentStateHistory[]) ?? []);
    setCallbacks((cbRes.data as Callback[]) ?? []);
    setProfiles((profRes.data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const profileName = (uid: string | null) => profiles.find((p) => p.user_id === uid)?.display_name ?? '—';

  const totalCalls = calls.length;
  const completedCalls = calls.filter((c) => c.status === 'completed').length;
  const avgTalk = completedCalls
    ? Math.round(calls.filter((c) => c.talk_time_seconds).reduce((a, c) => a + (c.talk_time_seconds ?? 0), 0) / completedCalls)
    : 0;
  const csatScores = psf.filter((p) => p.csat_score !== null).map((p) => p.csat_score as number);
  const avgCsat = csatScores.length ? (csatScores.reduce((a, b) => a + b, 0) / csatScores.length).toFixed(1) : '—';
  const pendingCallbacks = callbacks.filter((c) => c.status === 'pending').length;

  const handleExport = () => {
    const headers = getHeaders(type);
    const rows = getRows(type, calls, psf, breaks, callbacks, profileName);
    const csv = buildCsv(rows, headers);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type + '-report-' + Date.now() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const headers = getHeaders(type);
  const rows = getRows(type, calls, psf, breaks, callbacks, profileName);
  const displayRows = rows.slice(0, 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-slate-400 text-sm mt-0.5">Export detailed reports as CSV</p>
        </div>
        <Select value={type} onChange={(v) => setType(v as ReportType)} options={REPORT_OPTIONS} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Calls" value={totalCalls} icon={<Phone className="w-5 h-5 text-sky-400" />} accent="bg-sky-500/10" />
        <KpiCard label="Avg Talk Time" value={formatDuration(avgTalk)} icon={<Clock className="w-5 h-5 text-violet-400" />} accent="bg-violet-500/10" />
        <KpiCard label="Avg CSAT" value={avgCsat} icon={<Star className="w-5 h-5 text-amber-400" />} accent="bg-amber-500/10" />
        <KpiCard label="Pending Callbacks" value={pendingCallbacks} icon={<Calendar className="w-5 h-5 text-emerald-400" />} accent="bg-emerald-500/10" />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white capitalize">{type} Report</h2>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg transition">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<BarChart3 className="w-8 h-8 text-slate-600" />} title="No data for this report" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
                  {headers.map((h) => (
                    <th key={h} className="text-left py-2 px-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {displayRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-800/40">
                    {row.map((cell, j) => (
                      <td key={j} className="py-2.5 px-3 text-slate-300 text-xs">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
