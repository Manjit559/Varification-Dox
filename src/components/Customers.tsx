import { useEffect, useState, useCallback } from 'react';
import { Users, Upload, Search, FileSpreadsheet, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { supabase, logAudit, type Customer } from '@/lib/supabase';
import { maskPhone, maskEmail, formatDateTime } from '@/lib/constants';
import { Card, Badge, Button, Modal, TextInput, TextArea, EmptyState, ConfirmDialog } from './ui';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cc_customers').select('*').order('created_at', { ascending: false });
    setCustomers(data as Customer[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.customer_name.toLowerCase().includes(s) || c.phone.includes(s) || (c.rsa_case_id ?? '').toLowerCase().includes(s) || (c.vehicle_number ?? '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Customer Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{customers.length} customers · {customers.filter(c => c.source === 'seed').length} demo records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowImport(true)} className="flex items-center gap-1"><Upload className="w-4 h-4" /> Import CSV</Button>
          <Button onClick={() => setShowAdd(true)} className="flex items-center gap-1"><Users className="w-4 h-4" /> Add Customer</Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, case ID, vehicle…"
            className="w-full pl-10 pr-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40" />
        </div>

        {loading ? <div className="p-8 text-center text-slate-500 text-sm">Loading…</div> :
        filtered.length === 0 ? <EmptyState icon={<Users className="w-8 h-8 text-slate-600" />} title="No customers found" /> :
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
                <th className="text-left py-2 px-3">Name</th>
                <th className="text-left py-2 px-3">Phone</th>
                <th className="text-left py-2 px-3">RSA Case</th>
                <th className="text-left py-2 px-3">Vehicle</th>
                <th className="text-left py-2 px-3">Service</th>
                <th className="text-left py-2 px-3">Flags</th>
                <th className="text-left py-2 px-3">Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-800/40 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="py-2.5 px-3 text-white">{c.customer_name}</td>
                  <td className="py-2.5 px-3 text-slate-300">{maskPhone(c.phone)}</td>
                  <td className="py-2.5 px-3 text-slate-300">{c.rsa_case_id ?? '—'}</td>
                  <td className="py-2.5 px-3 text-slate-300">{c.vehicle_number ?? '—'}</td>
                  <td className="py-2.5 px-3 text-slate-300">{c.service_type ?? '—'}</td>
                  <td className="py-2.5 px-3">
                    {c.dnc_opt_out && <span className="text-xs text-rose-400 mr-1">DNC</span>}
                    {c.invalid_number && <span className="text-xs text-amber-400 mr-1">Invalid</span>}
                    {c.is_duplicate && <span className="text-xs text-slate-400">Dup</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs ${c.source === 'seed' ? 'text-slate-500' : 'text-sky-400'}`}>{c.source}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }} className="text-slate-500 hover:text-rose-400 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
      </Card>

      {selected && <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onDone={load} />}
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onDone={load} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) { await supabase.from('cc_customers').delete().eq('id', deleteId); await logAudit('customer_deleted', 'customer', { id: deleteId }); setDeleteId(null); load(); } }}
        title="Delete Customer" message="This will permanently delete the customer and all related data. This cannot be undone." />
    </div>
  );
}

function CustomerDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Customer Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="text-lg font-bold text-white">{customer.customer_name}</div>
            <div className="text-sm text-slate-400">{maskPhone(customer.phone)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Alt Phone" value={maskPhone(customer.alt_phone)} />
            <Field label="Email" value={maskEmail(customer.email)} />
            <Field label="Location" value={customer.location} />
            <Field label="Address" value={customer.address} />
            <Field label="Vehicle Number" value={customer.vehicle_number} />
            <Field label="Vehicle Model" value={customer.vehicle_model} />
            <Field label="RSA Case ID" value={customer.rsa_case_id} />
            <Field label="Case Type" value={customer.rsa_case_type} />
            <Field label="Case Status" value={customer.rsa_case_status} />
            <Field label="Service Type" value={customer.service_type} />
            <Field label="Service Partner" value={customer.service_partner} />
            <Field label="Dealer/Workshop" value={customer.dealer_workshop} />
            <Field label="Technician" value={customer.technician_name} />
            <Field label="Service Date" value={formatDateTime(customer.service_date)} />
            <Field label="Timezone" value={customer.timezone} />
            <Field label="Source" value={customer.source} />
          </div>
          {(customer.dnc_opt_out || customer.invalid_number || customer.is_duplicate) && (
            <div className="space-y-1">
              {customer.dnc_opt_out && <div className="text-xs text-rose-400 bg-rose-500/10 rounded px-3 py-1.5">DNC / Opt-Out</div>}
              {customer.invalid_number && <div className="text-xs text-amber-400 bg-amber-500/10 rounded px-3 py-1.5">Invalid Number</div>}
              {customer.is_duplicate && <div className="text-xs text-slate-400 bg-slate-500/10 rounded px-3 py-1.5">Duplicate Record</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return <div><div className="text-[11px] text-slate-500 uppercase">{label}</div><div className="text-slate-200">{value ?? '—'}</div></div>;
}

function AddCustomerModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ customer_name: '', phone: '', alt_phone: '', email: '', location: '', address: '', vehicle_number: '', vehicle_model: '', rsa_case_id: '', rsa_case_type: '', service_type: '', service_partner: '', technician_name: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.customer_name || !form.phone) { setError('Name and phone are required.'); return; }
    setSaving(true);
    // Check duplicate
    const { data: dup } = await supabase.from('cc_customers').select('id').eq('phone', form.phone).maybeSingle();
    const { error } = await supabase.from('cc_customers').insert({ ...form, is_duplicate: !!dup, source: 'manual' });
    if (error) { setError(error.message); setSaving(false); return; }
    await logAudit('customer_created', 'customer', { name: form.customer_name, phone: form.phone });
    onDone(); onClose();
  };

  return (
    <Modal open onClose={onClose} title="Add Customer" wide>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="text-xs text-slate-400">Name *</label><TextInput value={form.customer_name} onChange={(v) => setForm(f => ({ ...f, customer_name: v }))} placeholder="Customer name" /></div>
        <div><label className="text-xs text-slate-400">Phone *</label><TextInput value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} placeholder="+91…" /></div>
        <div><label className="text-xs text-slate-400">Alt Phone</label><TextInput value={form.alt_phone} onChange={(v) => setForm(f => ({ ...f, alt_phone: v }))} /></div>
        <div><label className="text-xs text-slate-400">Email</label><TextInput value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} /></div>
        <div><label className="text-xs text-slate-400">Location</label><TextInput value={form.location} onChange={(v) => setForm(f => ({ ...f, location: v }))} /></div>
        <div><label className="text-xs text-slate-400">Vehicle Number</label><TextInput value={form.vehicle_number} onChange={(v) => setForm(f => ({ ...f, vehicle_number: v }))} /></div>
        <div><label className="text-xs text-slate-400">Vehicle Model</label><TextInput value={form.vehicle_model} onChange={(v) => setForm(f => ({ ...f, vehicle_model: v }))} /></div>
        <div><label className="text-xs text-slate-400">RSA Case ID</label><TextInput value={form.rsa_case_id} onChange={(v) => setForm(f => ({ ...f, rsa_case_id: v }))} /></div>
        <div><label className="text-xs text-slate-400">Case Type</label><TextInput value={form.rsa_case_type} onChange={(v) => setForm(f => ({ ...f, rsa_case_type: v }))} /></div>
        <div><label className="text-xs text-slate-400">Service Type</label><TextInput value={form.service_type} onChange={(v) => setForm(f => ({ ...f, service_type: v }))} /></div>
        <div><label className="text-xs text-slate-400">Service Partner</label><TextInput value={form.service_partner} onChange={(v) => setForm(f => ({ ...f, service_partner: v }))} /></div>
        <div><label className="text-xs text-slate-400">Technician</label><TextInput value={form.technician_name} onChange={(v) => setForm(f => ({ ...f, technician_name: v }))} /></div>
        <div className="col-span-2"><label className="text-xs text-slate-400">Address</label><TextArea value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} rows={2} /></div>
      </div>
      {error && <div className="text-xs text-rose-400 mt-2">{error}</div>}
      <div className="flex gap-2 mt-4">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
        <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Save'}</Button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<{ valid: Record<string, string>[]; invalid: string[]; duplicates: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return null;
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const valid: Record<string, string>[] = [];
    const invalid: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
      if (!row.customer_name || !row.phone) { invalid.push(`Row ${i + 1}: missing name or phone`); continue; }
      if (!/^\+?\d{10,13}$/.test(row.phone.replace(/\s/g, ''))) { invalid.push(`Row ${i + 1}: invalid phone format`); continue; }
      valid.push(row);
    }
    return { valid, invalid, duplicates: 0 };
  };

  const handlePreview = () => {
    const parsed = parseCSV(csvText);
    if (parsed) setPreview(parsed);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    let imported = 0, dups = 0;
    for (const row of preview.valid) {
      const { data: existing } = await supabase.from('cc_customers').select('id').eq('phone', row.phone).maybeSingle();
      if (existing) { dups++; continue; }
      const { error } = await supabase.from('cc_customers').insert({
        customer_name: row.customer_name, phone: row.phone, alt_phone: row.alt_phone ?? null,
        email: row.email ?? null, location: row.location ?? null, address: row.address ?? null,
        vehicle_number: row.vehicle_number ?? null, vehicle_model: row.vehicle_model ?? null,
        rsa_case_id: row.rsa_case_id ?? null, rsa_case_type: row.rsa_case_type ?? null,
        service_type: row.service_type ?? null, service_partner: row.service_partner ?? null,
        technician_name: row.technician_name ?? null, source: 'import',
      });
      if (!error) imported++;
    }
    await logAudit('customer_import', 'customer', { imported, duplicates: dups, invalid: preview.invalid.length });
    setResult(`Imported ${imported} customers. Skipped ${dups} duplicates. ${preview.invalid.length} invalid rows.`);
    setImporting(false);
    setTimeout(() => { onDone(); onClose(); }, 2000);
  };

  return (
    <Modal open onClose={onClose} title="Import Customers (CSV)" wide>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Paste CSV data (headers: customer_name, phone, alt_phone, email, location, vehicle_number, vehicle_model, rsa_case_id, rsa_case_type, service_type, service_partner, technician_name)</label>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={6} placeholder="customer_name,phone,email,location,vehicle_number,rsa_case_id,service_type&#10;John Doe,+919876543210,john@email.com,Mumbai,MH01AB1234,RSA-001,Towing"
            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/40 resize-none" />
        </div>
        <Button variant="secondary" onClick={handlePreview} disabled={!csvText} className="flex items-center gap-1"><FileSpreadsheet className="w-4 h-4" /> Preview</Button>

        {preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-500/10 rounded-lg p-3"><div className="text-xl font-bold text-emerald-400">{preview.valid.length}</div><div className="text-xs text-slate-400">Valid</div></div>
              <div className="bg-rose-500/10 rounded-lg p-3"><div className="text-xl font-bold text-rose-400">{preview.invalid.length}</div><div className="text-xs text-slate-400">Invalid</div></div>
              <div className="bg-amber-500/10 rounded-lg p-3"><div className="text-xl font-bold text-amber-400">0</div><div className="text-xs text-slate-400">Duplicates</div></div>
            </div>
            {preview.invalid.length > 0 && (
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
                <div className="text-xs text-rose-300 font-medium mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Invalid Rows</div>
                {preview.invalid.map((msg, i) => <div key={i} className="text-xs text-rose-200/70">{msg}</div>)}
              </div>
            )}
            {preview.valid.length > 0 && (
              <div className="overflow-x-auto max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-slate-500 border-b border-slate-800">
                    <th className="text-left py-1 px-2">Name</th><th className="text-left py-1 px-2">Phone</th><th className="text-left py-1 px-2">Case ID</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-800">
                    {preview.valid.slice(0, 20).map((r, i) => (
                      <tr key={i}><td className="py-1 px-2 text-slate-200">{r.customer_name}</td><td className="py-1 px-2 text-slate-300">{r.phone}</td><td className="py-1 px-2 text-slate-300">{r.rsa_case_id ?? '—'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button onClick={handleImport} disabled={importing || preview.valid.length === 0} className="w-full flex items-center justify-center gap-2">
              {importing ? 'Importing…' : <><Upload className="w-4 h-4" /> Import {preview.valid.length} Customers</>}
            </Button>
          </div>
        )}
        {result && <div className="text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {result}</div>}
      </div>
    </Modal>
  );
}
