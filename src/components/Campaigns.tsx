import { useEffect, useState, useCallback } from 'react';
import { Megaphone, Plus, Pause, Play, Power, X } from 'lucide-react';
import { supabase, logAudit, type Campaign } from '@/lib/supabase';
import { Card, Badge, Button, Modal, TextInput, TextArea, Select, EmptyState, ConfirmDialog } from './ui';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cc_campaigns').select('*').order('created_at', { ascending: false });
    setCampaigns(data as Campaign[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (c: Campaign) => {
    const newStatus = c.status === 'active' ? 'paused' : 'active';
    await supabase.from('cc_campaigns').update({ status: newStatus }).eq('id', c.id);
    await logAudit('campaign_status_change', 'campaign', { id: c.id, from: c.status, to: newStatus }, c.id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaign Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{campaigns.length} campaigns configured</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-1"><Plus className="w-4 h-4" /> New Campaign</Button>
      </div>

      {loading ? <div className="p-8 text-center text-slate-500 text-sm">Loading…</div> :
      campaigns.length === 0 ? <Card><EmptyState icon={<Megaphone className="w-8 h-8 text-slate-600" />} title="No campaigns yet" /></Card> :
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map(c => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-white font-semibold">{c.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{c.description ?? 'No description'}</div>
              </div>
              <Badge label={c.status} color={c.status === 'active' ? 'bg-emerald-500' : c.status === 'paused' ? 'bg-amber-500' : 'bg-slate-500'} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 mb-4">
              <div><span className="text-slate-500">Priority:</span> <span className="text-slate-200">P{c.priority}</span></div>
              <div><span className="text-slate-500">Max Attempts:</span> <span className="text-slate-200">{c.max_attempts}</span></div>
              <div><span className="text-slate-500">Retry Interval:</span> <span className="text-slate-200">{c.retry_interval_minutes}m</span></div>
              <div><span className="text-slate-500">Calling Window:</span> <span className="text-slate-200">{c.calling_window_start}–{c.calling_window_end}</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => toggleStatus(c)} className="flex-1 flex items-center justify-center gap-1 text-xs">
                {c.status === 'active' ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Activate</>}
              </Button>
              <Button variant="ghost" onClick={() => setDeleteId(c.id)} className="text-xs text-rose-400"><X className="w-3.5 h-3.5" /></Button>
            </div>
          </Card>
        ))}
      </div>}

      {showAdd && <AddCampaignModal onClose={() => setShowAdd(false)} onDone={load} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) { await supabase.from('cc_campaigns').delete().eq('id', deleteId); await logAudit('campaign_deleted', 'campaign', { id: deleteId }); setDeleteId(null); load(); } }}
        title="Delete Campaign" message="This will delete the campaign and all its queues. This cannot be undone." />
    </div>
  );
}

function AddCampaignModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', priority: '5', max_attempts: '3', retry_interval_minutes: '60', calling_window_start: '09:00', calling_window_end: '21:00' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.name) { setError('Name is required.'); return; }
    setSaving(true);
    const { error } = await supabase.from('cc_campaigns').insert({
      name: form.name, description: form.description || null,
      priority: parseInt(form.priority), max_attempts: parseInt(form.max_attempts),
      retry_interval_minutes: parseInt(form.retry_interval_minutes),
      calling_window_start: form.calling_window_start, calling_window_end: form.calling_window_end,
      status: 'active',
    });
    if (error) { setError(error.message); setSaving(false); return; }
    await logAudit('campaign_created', 'campaign', { name: form.name });
    onDone(); onClose();
  };

  return (
    <Modal open onClose={onClose} title="New Campaign">
      <div className="space-y-3">
        <div><label className="text-xs text-slate-400">Name *</label><TextInput value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} placeholder="Campaign name" /></div>
        <div><label className="text-xs text-slate-400">Description</label><TextArea value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} rows={2} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-400">Priority (1-10)</label>
            <Select value={form.priority} onChange={(v) => setForm(f => ({ ...f, priority: v }))} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} className="w-full" /></div>
          <div><label className="text-xs text-slate-400">Max Attempts</label>
            <Select value={form.max_attempts} onChange={(v) => setForm(f => ({ ...f, max_attempts: v }))} options={[1, 2, 3, 5, 10].map(n => ({ value: String(n), label: String(n) }))} className="w-full" /></div>
          <div><label className="text-xs text-slate-400">Retry Interval (min)</label><TextInput value={form.retry_interval_minutes} onChange={(v) => setForm(f => ({ ...f, retry_interval_minutes: v }))} type="number" /></div>
          <div><label className="text-xs text-slate-400">Start Time</label><input type="time" value={form.calling_window_start} onChange={(e) => setForm(f => ({ ...f, calling_window_start: e.target.value }))} className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm" /></div>
          <div><label className="text-xs text-slate-400">End Time</label><input type="time" value={form.calling_window_end} onChange={(e) => setForm(f => ({ ...f, calling_window_end: e.target.value }))} className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm" /></div>
        </div>
        {error && <div className="text-xs text-rose-400">{error}</div>}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}
