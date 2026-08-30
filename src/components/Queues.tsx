import { useEffect, useState, useCallback } from 'react';
import { Phone, Plus, Power, Pause, Play, Users, X, UserPlus } from 'lucide-react';
import { supabase, logAudit, type Queue, type Campaign, type Profile, type QueueAssignment } from '@/lib/supabase';
import { Card, Badge, Button, Modal, TextInput, Select, EmptyState } from './ui';

export default function Queues() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<QueueAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [manageQueue, setManageQueue] = useState<Queue | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: qData }, { data: cData }, { data: pData }, { data: aData }] = await Promise.all([
      supabase.from('cc_queues').select('*').order('created_at', { ascending: false }),
      supabase.from('cc_campaigns').select('*'),
      supabase.from('cc_profiles').select('*'),
      supabase.from('cc_queue_assignments').select('*'),
    ]);
    setQueues(qData as Queue[] ?? []);
    setCampaigns(cData as Campaign[] ?? []);
    setProfiles(pData as Profile[] ?? []);
    setAssignments(aData as QueueAssignment[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cycleStatus = async (q: Queue) => {
    const order: Queue['status'][] = ['on', 'paused', 'off'];
    const next = order[(order.indexOf(q.status) + 1) % order.length];
    await supabase.from('cc_queues').update({ status: next }).eq('id', q.id);
    await logAudit('queue_status_change', 'queue', { id: q.id, from: q.status, to: next }, q.id);
    load();
  };

  const assignAgent = async (queueId: string, agentId: string) => {
    await supabase.from('cc_queue_assignments').insert({ queue_id: queueId, agent_id: agentId });
    await logAudit('agent_assigned_to_queue', 'queue', { queue_id: queueId, agent_id: agentId });
    load();
  };

  const unassignAgent = async (assignmentId: string) => {
    await supabase.from('cc_queue_assignments').delete().eq('id', assignmentId);
    await logAudit('agent_unassigned_from_queue', 'queue', { assignment_id: assignmentId });
    load();
  };

  const agentProfiles = profiles.filter(p => p.role === 'agent');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Queue Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{queues.length} queues · Control calling queues, priorities, and agent assignments</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-1"><Plus className="w-4 h-4" /> New Queue</Button>
      </div>

      {loading ? <div className="p-8 text-center text-slate-500 text-sm">Loading…</div> :
      queues.length === 0 ? <Card><EmptyState icon={<Phone className="w-8 h-8 text-slate-600" />} title="No queues configured" /></Card> :
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {queues.map(q => {
          const campaign = campaigns.find(c => c.id === q.campaign_id);
          const queueAssigns = assignments.filter(a => a.queue_id === q.id);
          return (
            <Card key={q.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-white font-semibold">{q.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{campaign?.name ?? '—'}</div>
                </div>
                <Badge label={q.status.toUpperCase()} color={q.status === 'on' ? 'bg-emerald-500' : q.status === 'paused' ? 'bg-amber-500' : 'bg-slate-500'} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 mb-4">
                <div><span className="text-slate-500">Priority:</span> <span className="text-slate-200">P{q.priority}</span></div>
                <div><span className="text-slate-500">Window:</span> <span className="text-slate-200">{q.calling_window_start}–{q.calling_window_end}</span></div>
                <div><span className="text-slate-500">Agents:</span> <span className="text-slate-200">{queueAssigns.length}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => cycleStatus(q)} className="flex-1 flex items-center justify-center gap-1 text-xs">
                  {q.status === 'on' ? <><Pause className="w-3.5 h-3.5" /> Pause</> : q.status === 'paused' ? <><Power className="w-3.5 h-3.5" /> Turn Off</> : <><Play className="w-3.5 h-3.5" /> Turn On</>}
                </Button>
                <Button variant="secondary" onClick={() => setManageQueue(q)} className="flex items-center gap-1 text-xs"><Users className="w-3.5 h-3.5" /> Manage</Button>
              </div>
            </Card>
          );
        })}
      </div>}

      {showAdd && <AddQueueModal campaigns={campaigns} onClose={() => setShowAdd(false)} onDone={load} />}
      {manageQueue && (
        <Modal open onClose={() => setManageQueue(null)} title={`Manage Agents — ${manageQueue.name}`}>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Assign Agent</label>
              <div className="flex gap-2">
                <Select value="" onChange={(v) => { if (v) assignAgent(manageQueue.id, v); }} options={[{ value: '', label: 'Select agent…' }, ...agentProfiles.map(p => ({ value: p.user_id, label: p.display_name }))]} className="flex-1" />
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-2">Assigned Agents ({assignments.filter(a => a.queue_id === manageQueue.id).length})</div>
              <div className="space-y-2">
                {assignments.filter(a => a.queue_id === manageQueue.id).map(a => {
                  const p = profiles.find(pr => pr.user_id === a.agent_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-sky-400" />
                        <span className="text-sm text-slate-200">{p?.display_name ?? 'Unknown'}</span>
                      </div>
                      <button onClick={() => unassignAgent(a.id)} className="text-slate-500 hover:text-rose-400"><X className="w-4 h-4" /></button>
                    </div>
                  );
                })}
                {assignments.filter(a => a.queue_id === manageQueue.id).length === 0 && <div className="text-sm text-slate-500 py-2 text-center">No agents assigned.</div>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddQueueModal({ campaigns, onClose, onDone }: { campaigns: Campaign[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', campaign_id: '', priority: '5', calling_window_start: '09:00', calling_window_end: '21:00' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.name || !form.campaign_id) { setError('Name and campaign are required.'); return; }
    setSaving(true);
    const { error } = await supabase.from('cc_queues').insert({
      name: form.name, campaign_id: form.campaign_id, priority: parseInt(form.priority),
      calling_window_start: form.calling_window_start, calling_window_end: form.calling_window_end,
      status: 'on',
    });
    if (error) { setError(error.message); setSaving(false); return; }
    await logAudit('queue_created', 'queue', { name: form.name });
    onDone(); onClose();
  };

  return (
    <Modal open onClose={onClose} title="New Queue">
      <div className="space-y-3">
        <div><label className="text-xs text-slate-400">Name *</label><TextInput value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} placeholder="Queue name" /></div>
        <div><label className="text-xs text-slate-400">Campaign *</label>
          <Select value={form.campaign_id} onChange={(v) => setForm(f => ({ ...f, campaign_id: v }))} options={[{ value: '', label: 'Select campaign…' }, ...campaigns.map(c => ({ value: c.id, label: c.name }))]} className="w-full" /></div>
        <div><label className="text-xs text-slate-400">Priority (1-10)</label>
          <Select value={form.priority} onChange={(v) => setForm(f => ({ ...f, priority: v }))} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} className="w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-400">Start Time</label><input type="time" value={form.calling_window_start} onChange={(e) => setForm(f => ({ ...f, calling_window_start: e.target.value }))} className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm" /></div>
          <div><label className="text-xs text-slate-400">End Time</label><input type="time" value={form.calling_window_end} onChange={(e) => setForm(f => ({ ...f, calling_window_end: e.target.value }))} className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm" /></div>
        </div>
        {error && <div className="text-xs text-rose-400">{error}</div>}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Creating…' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}
