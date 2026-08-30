import { useEffect, useState, useCallback } from 'react';
import { ScrollText, Activity, Calendar } from 'lucide-react';
import { supabase, type AuditLog } from '@/lib/supabase';
import { formatDateTime } from '@/lib/constants';
import { Card, EmptyState } from './ui';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cc_audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    setLogs(data as AuditLog[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const actionColor = (action: string): string => {
    if (action.includes('delete')) return 'text-rose-400';
    if (action.includes('create') || action.includes('signup')) return 'text-emerald-400';
    if (action.includes('login') || action.includes('logout')) return 'text-sky-400';
    if (action.includes('change') || action.includes('update')) return 'text-amber-400';
    if (action.includes('export') || action.includes('recording')) return 'text-violet-400';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-slate-400 text-sm mt-0.5">Immutable record of all system actions for compliance and security</p>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-500 text-sm">Loading…</div> :
        logs.length === 0 ? <EmptyState icon={<ScrollText className="w-8 h-8 text-slate-600" />} title="No audit events recorded yet" /> :
        <div className="divide-y divide-slate-800 max-h-[70vh] overflow-y-auto">
          {logs.map(log => (
            <div key={log.id} className="px-5 py-3.5 flex items-start gap-4 hover:bg-slate-800/40 transition">
              <Activity className={`w-4 h-4 mt-0.5 shrink-0 ${actionColor(log.action)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${actionColor(log.action)}`}>{log.action.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-slate-500 capitalize">{log.entity}</span>
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="text-xs text-slate-500 mt-1 font-mono break-words">{JSON.stringify(log.details)}</div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                <Calendar className="w-3.5 h-3.5" />
                {formatDateTime(log.created_at)}
              </div>
            </div>
          ))}
        </div>}
      </Card>
    </div>
  );
}
