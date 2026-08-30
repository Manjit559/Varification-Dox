import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import AuthScreen from '@/components/AuthScreen';
import Sidebar, { type View } from '@/components/Sidebar';
import SupervisorDashboard from '@/components/SupervisorDashboard';
import AgentDesktop from '@/components/AgentDesktop';
import Customers from '@/components/Customers';
import Campaigns from '@/components/Campaigns';
import Queues from '@/components/Queues';
import CallHistory from '@/components/CallHistory';
import Reports from '@/components/Reports';
import AuditLogs from '@/components/AuditLogs';
import Callbacks from '@/components/Callbacks';
import Dispositions from '@/components/Dispositions';
import UserManagement from '@/components/UserManagement';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AgentStateName } from '@/lib/supabase';

function Shell() {
  const { session, profile, loading } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [agentState, setAgentState] = useState<AgentStateName>('offline');

  const role = profile?.role ?? 'agent';

  useEffect(() => {
    if (view === 'dashboard' && role === 'agent') setView('agent-desktop');
    if (view === 'agent-desktop' && role !== 'agent') setView('dashboard');
  }, [role]);

  // Load agent's own state for sidebar indicator
  useEffect(() => {
    if (!session?.user) return;
    const loadState = async () => {
      const { data } = await supabase.from('cc_agent_states').select('state').eq('agent_id', session.user.id).maybeSingle();
      if (data) setAgentState(data.state as AgentStateName);
    };
    loadState();
    const channel = supabase.channel('agent-state-self')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cc_agent_states', filter: `agent_id=eq.${session.user.id}` },
        () => loadState())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-sky-500 animate-spin" /></div>;
  }

  if (!session) return <AuthScreen />;

  // If no profile yet (shouldn't happen for signup flow, but guard)
  if (!profile) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading profile…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar view={view} setView={setView} agentState={agentState} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {view === 'dashboard' && <SupervisorDashboard setView={setView} />}
          {view === 'agent-desktop' && <AgentDesktop />}
          {view === 'customers' && <Customers />}
          {view === 'campaigns' && <Campaigns />}
          {view === 'queues' && <Queues />}
          {view === 'callbacks' && <Callbacks />}
          {view === 'call-history' && <CallHistory />}
          {view === 'dispositions' && <Dispositions />}
          {view === 'reports' && <Reports />}
          {view === 'audit' && <AuditLogs />}
          {view === 'users' && <UserManagement />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return <AuthProvider><Shell /></AuthProvider>;
}
