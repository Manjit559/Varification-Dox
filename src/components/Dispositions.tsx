import { useEffect, useState, useCallback } from 'react';
import { FileSpreadsheet, Plus, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { supabase, logAudit, type Disposition } from '@/lib/supabase';
import { Card, Badge, Button, Modal, TextInput, Select, EmptyState, ConfirmDialog } from './ui';

export default function Dispositions() {
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cc_dispositions').select('*').order('sort_order');
    setDispositions(data as Disposition[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (d: Disposition) => {
    await supabase.from('cc_dispositions').update({ active: !d.active }).eq('id', d.id);
    await logAudit('disposition_toggled', 'disposition', { code: d.code, active: !d.active }, d.id);
    load();
  };

  const categoryColor: Record<string, string> = {
    connected: 'bg-emerald-500', no_contact: 'bg-amber-500', invalid: 'bg-rose-500', dnc: 'bg-red-500', duplicate: 'bg-slate-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Disposition Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{dispositions.length} dispositions · {dispositions.filter(d => d.active).length} active</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-1"><Plus className="w-4 h-4" /> Add Disposition</Button>
      </div>

      {loading ? <div className="p-8 text-center text-slate-500 text-sm">Loading…</div> :
      dispositions.length === 0 ? <Card><EmptyState icon={<FileSpreadsheet className="w-8 h-8 text-slate-600" />} title="No dispositions configured" /></Card> :
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
            <th className="text-left py-2 px-4">Code</th><th className="text-left py-2 px-4">Label</th>
            <th className="text-left py-2 px-4">Category</th><th className="text-left py-2 px-4">Callback</th>
            <th className="text-left py-2 px-4">Final</th><th className="text-left py-2 px-4">Active</th><th></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800">
            {dispositions.map(d => (
              <tr key={d.id} className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 text-slate-400 font-mono text-xs">{d.code}</td>
                <td className="py-2.5 px-4 text-white">{d.label}</td>
                <td className="py-2.5 px-4"><Badge label={d.category.replace(/_/g, ' ')} color={categoryColor[d.category] ?? 'bg-slate-500'} /></td>
                <td className="py-2.5 px-4">{d.requires_callback ? <span className="text-amber-400 text-xs">Yes</span> : <span className="text-slate-600 text-xs">No</span>}</td>
                <td className="py-2.5 px-4">{d.is_final ? <span className="text-emerald-400 text-xs">Yes</span> : <span className="text-slate-600 text-xs">No</span>}</td>
                <td className="py-2.5 px-4">
                  <button onClick={() => toggleActive(d)} className={d.active ? 'text-emerald-400' : 'text-slate-600'}>
                    {d.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                </td>
                <td className="py-2.5 px-4 text-right"><button onClick={() => setDeleteId(d.id)} className="text-slate-500 hover:text-rose-400"><X className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>}

      {showAdd && <AddDispositionModal onClose={() => setShowAdd(false)} onDone={load} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) { await supabase.from('cc_dispositions').delete().eq('id', deleteId); await logAudit('disposition_deleted', 'disposition', { id: deleteId }); setDeleteId(null); load(); } }}
        title="Delete Disposition" message="This will remove this disposition option. Existing calls with this disposition will not be affected." />
    </div>
  );
}

function AddDispositionModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ code: '', label: '', category: 'connected', requires_callback: 'false', is_final: 'true', sort_order: '99' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.code || !form.label) { setError('Code and label are required.'); return; }
    setSaving(true);
    const { error } = await supabase.from('cc_dispositions').insert({
      code: form.code, label: form.label, category: form.category,
      requires_callback: form.requires_callback === 'true', is_final: form.is_final === 'true',
      sort_order: parseInt(form.sort_order), active: true,
    });
    if (error) { setError(error.message); setSaving(false); return; }
    await logAudit('disposition_created', 'disposition', { code: form.code });
    onDone(); onClose();
  };

  return (
    <Modal open onClose={onClose} title="Add Disposition">
      <div className="space-y-3">
        <div><label className="text-xs text-slate-400">Code *</label><TextInput value={form.code} onChange={(v) => setForm(f => ({ ...f, code: v }))} placeholder="e.g. callback_requested" /></div>
        <div><label className="text-xs text-slate-400">Label *</label><TextInput value={form.label} onChange={(v) => setForm(f => ({ ...f, label: v }))} placeholder="Display label" /></div>
        <div><label className="text-xs text-slate-400">Category</label>
          <Select value={form.category} onChange={(v) => setForm(f => ({ ...f, category: v }))} options={[
            { value: 'connected', label: 'Connected' }, { value: 'no_contact', label: 'No Contact' },
            { value: 'invalid', label: 'Invalid' }, { value: 'dnc', label: 'DNC' }, { value: 'duplicate', label: 'Duplicate' },
          ]} className="w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-400">Requires Callback</label>
            <Select value={form.requires_callback} onChange={(v) => setForm(f => ({ ...f, requires_callback: v }))} options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }]} className="w-full" /></div>
          <div><label className="text-xs text-slate-400">Is Final</label>
            <Select value={form.is_final} onChange={(v) => setForm(f => ({ ...f, is_final: v }))} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} className="w-full" /></div>
        </div>
        {error && <div className="text-xs text-rose-400">{error}</div>}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Add'}</Button>
        </div>
      </div>
    </Modal>
  );
}
