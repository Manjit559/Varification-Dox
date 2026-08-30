import { useEffect, useState, useCallback } from 'react';
import { PhoneCall, Calendar, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase, logAudit, type Callback, type Customer, type Profile } from '@/lib/supabase';
import { formatDateTime, maskPhone } from '@/lib/constants';
import { Card, Badge, Button, EmptyState, Select } from './ui';

export default function Callbacks() {
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cbData }, { data: custData }, { data: profData }] = await Promise.all([
      supabase.from('cc_callbacks').select('*').order('scheduled_at', { ascending: true }),
      supabase.from('cc_customers').select('*'),
      supabase.from('cc_profiles').select('*'),
    ]);
    setCallbacks(cbData as Callback[] ?? []);
    setCustomers(Object.fromEntries((custData ?? []).map((c: Customer) => [c.id, c])));
    setProfiles(Object.fromEntries((profData ?? []).map((p: Profile) => [p.user_id, p])));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: Callback['status']) => {
    await supabase.from('cc_callbacks').update({ status }).eq('id', id);
    await logAudit('callback_status_change', 'callback', { id, status }, id);
    load();
  };

  const filtered = callbacks.filter(c => statusFilter === 'all' || c.status === statusFilter);
  const now = new Date();
  const isEligible = (cb: Callback) => cb.status === 'pending' && new Date(cb.scheduled_at) <= now;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Callback Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{callbacks.filter(c => c.status === 'pending').length} pending · {callbacks.filter(c => isEligible(c)).length} eligible now</p>
        </div>
        <Select value={statusFilter} onChange={setStatusFilter} options={[
          { value: 'all', label: 'All' }, { value: 'pending', label: 'Pending' },
          { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'expired', label: 'Expired' },
        ]} />
      </div>

      {loading ? <div className="p-8 text-center text-slate-500 text-sm">Loading…</div> :
      filtered.length === 0 ? <Card><EmptyState icon={<PhoneCall className="w-8 h-8 text-slate-600" />} title="No callbacks found" /></Card> :
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(cb => {
          const cust = customers[cb.customer_id];
          const agent = cb.agent_id ? profiles[cb.agent_id] : null;
          const eligible = isEligible(cb);
          return (
            <Card key={cb.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-white font-medium">{cust?.customer_name ?? '—'}</div>
                  <div className="text-xs text-slate-400">{maskPhone(cust?.phone)}</div>
                </div>
                <Badge label={cb.status} color={cb.status === 'pending' ? 'bg-amber-500' : cb.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-500'} />
              </div>
              <div className="space-y-1 text-xs text-slate-400 mb-3">
                <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {formatDateTime(cb.scheduled_at)}</div>
                {cb.reason && <div>Reason: {cb.reason}</div>}
                {agent && <div>Agent: {agent.display_name}</div>}
              </div>
              {eligible && <div className="text-xs text-emerald-400 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Eligible for calling now</div>}
              {cb.status === 'pending' && (
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => updateStatus(cb.id, 'completed')} className="flex-1 text-xs flex items-center justify-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</Button>
                  <Button variant="ghost" onClick={() => updateStatus(cb.id, 'cancelled')} className="text-xs text-rose-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Cancel</Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>}
    </div>
  );
}
