import { useEffect, useState, useCallback } from 'react';
import { UserCog, Plus, X, ShieldCheck, Users, Headset } from 'lucide-react';
import { supabase, logAudit, type Profile, type Role } from '@/lib/supabase';
import { ROLE_LABELS } from '@/lib/constants';
import { Card, Badge, Button, Modal, TextInput, Select, EmptyState, ConfirmDialog } from './ui';

export default function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cc_profiles').select('*').order('created_at', { ascending: false });
    setProfiles(data as Profile[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRole = async (profile: Profile, newRole: Role) => {
    await supabase.from('cc_profiles').update({ role: newRole }).eq('id', profile.id);
    await logAudit('user_role_change', 'user', { user_id: profile.user_id, from: profile.role, to: newRole }, profile.id);
    load();
  };

  const toggleActive = async (profile: Profile) => {
    await supabase.from('cc_profiles').update({ active: !profile.active }).eq('id', profile.id);
    await logAudit('user_active_toggle', 'user', { user_id: profile.user_id, active: !profile.active }, profile.id);
    load();
  };

  const roleIcon: Record<Role, typeof UserCog> = {
    admin: ShieldCheck, supervisor: Users, agent: Headset,
  };
  const roleColor: Record<Role, string> = {
    admin: 'bg-rose-500', supervisor: 'bg-sky-500', agent: 'bg-emerald-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{profiles.length} users · {profiles.filter(p => p.role === 'admin').length} admins · {profiles.filter(p => p.role === 'supervisor').length} supervisors · {profiles.filter(p => p.role === 'agent').length} agents</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-1"><Plus className="w-4 h-4" /> Add User</Button>
      </div>

      {loading ? <div className="p-8 text-center text-slate-500 text-sm">Loading…</div> :
      profiles.length === 0 ? <Card><EmptyState icon={<UserCog className="w-8 h-8 text-slate-600" />} title="No users found" /></Card> :
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500 uppercase tracking-wide border-b border-slate-800">
            <th className="text-left py-2 px-4">Name</th><th className="text-left py-2 px-4">Employee ID</th>
            <th className="text-left py-2 px-4">Role</th><th className="text-left py-2 px-4">Team</th>
            <th className="text-left py-2 px-4">Status</th><th className="text-left py-2 px-4">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800">
            {profiles.map(p => {
              const Icon = roleIcon[p.role];
              return (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${roleColor[p.role]} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-white">{p.display_name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 text-xs font-mono">{p.employee_id ?? '—'}</td>
                  <td className="py-2.5 px-4">
                    <Select value={p.role} onChange={(v) => updateRole(p, v as Role)} options={[
                      { value: 'admin', label: 'Administrator' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'agent', label: 'Agent' },
                    ]} />
                  </td>
                  <td className="py-2.5 px-4 text-slate-300">{p.team ?? '—'}</td>
                  <td className="py-2.5 px-4">
                    <button onClick={() => toggleActive(p)} className={`text-xs font-medium ${p.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex gap-2">
                      <button onClick={() => setEditProfile(p)} className="text-xs text-sky-400 hover:text-sky-300">Edit</button>
                      <button onClick={() => setDeleteId(p.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>}

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onDone={load} />}
      {editProfile && <EditUserModal profile={editProfile} onClose={() => setEditProfile(null)} onDone={load} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) { await supabase.from('cc_profiles').delete().eq('id', deleteId); await logAudit('user_deleted', 'user', { id: deleteId }); setDeleteId(null); load(); } }}
        title="Delete User" message="This will remove the user profile. The auth account will remain. This cannot be undone." />
    </div>
  );
}

function AddUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ email: '', password: '', display_name: '', role: 'agent', employee_id: '', team: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.email || !form.password || !form.display_name) { setError('Email, password, and name are required.'); return; }
    setSaving(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password });
    if (signUpError) { setError(signUpError.message); setSaving(false); return; }
    if (data.user) {
      const { error: profileError } = await supabase.from('cc_profiles').insert({
        user_id: data.user.id, display_name: form.display_name, role: form.role as Role,
        employee_id: form.employee_id || null, team: form.team || null, active: true,
      });
      if (profileError) { setError(profileError.message); setSaving(false); return; }
      await logAudit('user_created', 'user', { email: form.email, role: form.role, name: form.display_name });
    }
    onDone(); onClose();
  };

  return (
    <Modal open onClose={onClose} title="Add User">
      <div className="space-y-3">
        <div><label className="text-xs text-slate-400">Display Name *</label><TextInput value={form.display_name} onChange={(v) => setForm(f => ({ ...f, display_name: v }))} placeholder="Full name" /></div>
        <div><label className="text-xs text-slate-400">Email *</label><TextInput value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} placeholder="user@tata.com" type="email" /></div>
        <div><label className="text-xs text-slate-400">Password *</label><TextInput value={form.password} onChange={(v) => setForm(f => ({ ...f, password: v }))} placeholder="Min 6 characters" type="password" /></div>
        <div><label className="text-xs text-slate-400">Role</label>
          <Select value={form.role} onChange={(v) => setForm(f => ({ ...f, role: v }))} options={[
            { value: 'admin', label: 'Administrator' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'agent', label: 'Agent' },
          ]} className="w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-400">Employee ID</label><TextInput value={form.employee_id} onChange={(v) => setForm(f => ({ ...f, employee_id: v }))} placeholder="EMP001" /></div>
          <div><label className="text-xs text-slate-400">Team</label><TextInput value={form.team} onChange={(v) => setForm(f => ({ ...f, team: v }))} placeholder="PSF Chennai" /></div>
        </div>
        {error && <div className="text-xs text-rose-400">{error}</div>}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Creating…' : 'Create User'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function EditUserModal({ profile, onClose, onDone }: { profile: Profile; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ display_name: profile.display_name, employee_id: profile.employee_id ?? '', team: profile.team ?? '', role: profile.role });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('cc_profiles').update({
      display_name: form.display_name, employee_id: form.employee_id || null, team: form.team || null, role: form.role as Role,
    }).eq('id', profile.id);
    if (error) { setError(error.message); setSaving(false); return; }
    await logAudit('user_updated', 'user', { id: profile.id, changes: form }, profile.id);
    onDone(); onClose();
  };

  return (
    <Modal open onClose={onClose} title="Edit User">
      <div className="space-y-3">
        <div><label className="text-xs text-slate-400">Display Name</label><TextInput value={form.display_name} onChange={(v) => setForm(f => ({ ...f, display_name: v }))} /></div>
        <div><label className="text-xs text-slate-400">Role</label>
          <Select value={form.role} onChange={(v) => setForm(f => ({ ...f, role: v }))} options={[
            { value: 'admin', label: 'Administrator' }, { value: 'supervisor', label: 'Supervisor' }, { value: 'agent', label: 'Agent' },
          ]} className="w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-slate-400">Employee ID</label><TextInput value={form.employee_id} onChange={(v) => setForm(f => ({ ...f, employee_id: v }))} /></div>
          <div><label className="text-xs text-slate-400">Team</label><TextInput value={form.team} onChange={(v) => setForm(f => ({ ...f, team: v }))} /></div>
        </div>
        {error && <div className="text-xs text-rose-400">{error}</div>}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </div>
    </Modal>
  );
}
