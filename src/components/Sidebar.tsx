import { useState } from 'react';
import { Headset, LayoutDashboard, Phone, Users, Megaphone, BarChart3, ScrollText, LogOut, Menu, X, UserCog, History, FileSpreadsheet, PhoneCall } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, getStateMeta } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type { Role } from '@/lib/supabase';

export type View =
  | 'dashboard' | 'agent-desktop' | 'customers' | 'campaigns' | 'queues'
  | 'call-history' | 'reports' | 'audit' | 'callbacks' | 'dispositions' | 'users';

type NavItem = { id: View; label: string; icon: typeof LayoutDashboard; roles: Role[] };

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'supervisor', 'agent'] },
  { id: 'agent-desktop', label: 'Agent Desktop', icon: PhoneCall, roles: ['agent'] },
  { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'supervisor'] },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, roles: ['admin', 'supervisor'] },
  { id: 'queues', label: 'Queues', icon: Phone, roles: ['admin', 'supervisor'] },
  { id: 'callbacks', label: 'Callbacks', icon: PhoneCall, roles: ['admin', 'supervisor', 'agent'] },
  { id: 'call-history', label: 'Call History', icon: History, roles: ['admin', 'supervisor', 'agent'] },
  { id: 'dispositions', label: 'Dispositions', icon: FileSpreadsheet, roles: ['admin', 'supervisor'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'supervisor'] },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText, roles: ['admin', 'supervisor'] },
  { id: 'users', label: 'User Management', icon: UserCog, roles: ['admin'] },
];

export default function Sidebar({ view, setView, agentState }: { view: View; setView: (v: View) => void; agentState?: string }) {
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const role = profile?.role ?? 'agent';
  const items = NAV.filter((n) => n.roles.includes(role));

  const stateMeta = agentState ? getStateMeta(agentState as never) : null;

  return (
    <>
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center">
            <Headset className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white">TATA RSA CC</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-slate-300"><Menu className="w-6 h-6" /></button>
      </div>

      {open && <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />}

      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-60 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg shadow-sky-500/30">
              <Headset className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm leading-none">TATA RSA CC</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Dialler & PSF Platform</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button key={item.id} onClick={() => { setView(item.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active ? 'bg-sky-500/15 text-sky-300 border border-sky-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`}>
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          {role === 'agent' && stateMeta && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-slate-800/40">
              <span className={`w-2 h-2 rounded-full ${stateMeta.color} animate-pulse`} />
              <span className="text-xs text-slate-300">{stateMeta.label}</span>
            </div>
          )}
          <div className="px-3 py-2 mb-2">
            <div className="text-xs text-slate-500">{ROLE_LABELS[role]}</div>
            <div className="text-sm text-slate-200 truncate">{profile?.display_name ?? user?.email}</div>
          </div>
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

export { supabase };
