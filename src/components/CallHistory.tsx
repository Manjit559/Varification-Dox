import { useEffect, useState, useCallback } from 'react';
import { History, Search, Download, Phone, X } from 'lucide-react';
import { supabase, type Call, type Customer, type Profile } from '@/lib/supabase';
import { getCallStatusMeta, formatDateTime, formatDuration, maskPhone } from '@/lib/constants';
import { Card, Badge, Select, EmptyState } from './ui';

export default function CallHistory() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dispositionFilter, setDispositionFilter] = useState('all');
  const [selected, setSelected] = useState<Call | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: callData }, { data: custData }, { data: profData }] = await Promise.all([
      supabase.from('cc_calls').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('cc_customers').select('*'),
      supabase.from('cc_profiles').select('*'),
    ]);
    setCalls(callData as Call[] ?? []);
    setCustomers(Object.fromEntries((custData ?? []).map((c: Customer) => [c.id, c])));
    setProfiles(Object.fromEntries((profData ?? []).map((p: Profile) => [p.user_id, p])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = calls.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (dispositionFilter !== 'all' && c.disposition !== dispositionFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const cust = c.customer_id ? customers[c.customer_id] : null;
      if (!c.phone_dialed?.includes(s) && !c.call_ref?.toLowerCase().includes(s) && !cust?.customer_name.toLowerCase().includes(s) && !cust?.rsa_case_id?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const exportCsv = () => {
    const headers = ['Call Ref', 'Direction', 'Status', 'Phone', 'Customer', 'Case ID', 'Agent', 'Disposition', 'Duration', 'Talk Time', 'ACW', 'Started', 'Ended'];
    const rows = filtered.map(c => {
      const cust = c.customer_id ? customers[c.customer_id] : null;
      const agent = c.agent_id ? profiles[c.agent_id] : null;
      return [c.call_ref ?? '', c.direction, c.status, c.phone_dialed ?? '', cust?.customer_name ?? '', cust?.rsa_case_id ?? '', agent?.display_name ?? '', c.disposition ?? '', c.duration_seconds ?? '', c.talk_time_seconds ?? '', c.acw_seconds ?? '', c.started_at ?? '', c.ended_at ?? ''];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `call-history-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Call History</h1>
          <p className="text-slate-400 text-sm mt-0.5">{filtered.length} calls · Filter by date, customer, agent, status, disposition</p>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg transition">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search phone, name, case ID, call ref…"
              className="w-full pl-10 pr-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40" />
          </div>
          <Select value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All Statuses' }, ...['queued','dialing','ringing','connected','on_hold','muted','transferred','disconnected','wrap_up','completed','no_answer','busy','rejected','invalid_number','network_failure'].map(s => ({ value: s, label: s.replace(/_/g, ' ') }))]} />
          <Select value={dispositionFilter} onChange={setDispositionFilter} options={[{ value: 'all', label: 'All Dispositions' }, ...['connected','feedback_completed','customer_satisfied','customer_dissatisfied','complaint_raised','escalation_required','callback_requested','no_answer','busy','phone_switched_off','out_of_coverage','call_rejected','invalid_number','wrong_number','network_failure','customer_refused_feedback','dnc','duplicate'].map(d => ({ value: d, label: d.replace(/_/g, ' ') }))]} />
        </div>

        {loading ? <div className="p-8 text-center text-slate-500 text-sm">Loading…</div> :
        filtered.length === 0 ? <EmptyState icon={<History className="w-8 h-8 text-slate-600" />} title="No calls found" /> :
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
              <th className="text-left py-2 px-3">Call Ref</th><th className="text-left py-2 px-3">Customer</th>
              <th className="text-left py-2 px-3">Phone</th><th className="text-left py-2 px-3">Agent</th>
              <th className="text-left py-2 px-3">Status</th><th className="text-left py-2 px-3">Disposition</th>
              <th className="text-left py-2 px-3">Duration</th><th className="text-left py-2 px-3">Time</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.slice(0, 100).map(c => {
                const meta = getCallStatusMeta(c.status);
                const cust = c.customer_id ? customers[c.customer_id] : null;
                const agent = c.agent_id ? profiles[c.agent_id] : null;
                return (
                  <tr key={c.id} className="hover:bg-slate-800/40 cursor-pointer" onClick={() => setSelected(c)}>
                    <td className="py-2.5 px-3 text-slate-400 text-xs font-mono">{c.call_ref?.slice(0, 15) ?? '—'}</td>
                    <td className="py-2.5 px-3 text-slate-200">{cust?.customer_name ?? 'Manual'}</td>
                    <td className="py-2.5 px-3 text-slate-300">{maskPhone(c.phone_dialed)}</td>
                    <td className="py-2.5 px-3 text-slate-300">{agent?.display_name ?? '—'}</td>
                    <td className="py-2.5 px-3"><Badge label={meta.label} color={meta.color} /></td>
                    <td className="py-2.5 px-3 text-slate-300 text-xs">{c.disposition?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-xs">{formatDuration(c.duration_seconds)}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">{formatDateTime(c.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
      </Card>

      {selected && <CallDetailDrawer call={selected} customer={selected.customer_id ? customers[selected.customer_id] : null} agent={selected.agent_id ? profiles[selected.agent_id] : null} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CallDetailDrawer({ call, customer, agent, onClose }: { call: Call; customer: Customer | null; agent: Profile | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Call Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Call Ref" value={call.call_ref ?? '—'} />
            <Field label="Direction" value={call.direction} />
            <Field label="Status" value={call.status.replace(/_/g, ' ')} />
            <Field label="Disposition" value={call.disposition?.replace(/_/g, ' ') ?? '—'} />
            <Field label="Phone" value={maskPhone(call.phone_dialed)} />
            <Field label="Customer" value={customer?.customer_name ?? 'Manual'} />
            <Field label="Agent" value={agent?.display_name ?? '—'} />
            <Field label="Duration" value={formatDuration(call.duration_seconds)} />
            <Field label="Talk Time" value={formatDuration(call.talk_time_seconds)} />
            <Field label="ACW" value={formatDuration(call.acw_seconds)} />
            <Field label="Started" value={formatDateTime(call.started_at)} />
            <Field label="Ended" value={formatDateTime(call.ended_at)} />
            <Field label="Callback" value={formatDateTime(call.callback_scheduled_at)} />
            <Field label="Recording ID" value={call.recording_id ?? '—'} />
          </div>
          {call.notes && <div><div className="text-xs text-slate-500 uppercase mb-1">Notes</div><div className="text-sm text-slate-200">{call.notes}</div></div>}
          {call.recording_id && (
            <div className="bg-slate-800/40 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Recording</div>
              <div className="text-xs text-slate-500">Recording metadata stored. Playback requires authorization. Access is audited.</div>
              <div className="text-xs text-slate-600 mt-1">Duration: {formatDuration(call.recording_duration_seconds)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] text-slate-500 uppercase">{label}</div><div className="text-slate-200 break-words">{value}</div></div>;
}
