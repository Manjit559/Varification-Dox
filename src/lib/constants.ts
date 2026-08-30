import type { AgentStateName, CallStatus, Role } from './supabase';

export const AGENT_STATES: { value: AgentStateName; label: string; color: string; category: 'active' | 'break' | 'inactive' }[] = [
  { value: 'available', label: 'Available', color: 'bg-emerald-500', category: 'active' },
  { value: 'on_call', label: 'On Call', color: 'bg-sky-500', category: 'active' },
  { value: 'wrap_up', label: 'Wrap-Up', color: 'bg-amber-500', category: 'active' },
  { value: 'meal_break', label: 'Meal Break', color: 'bg-orange-500', category: 'break' },
  { value: 'short_break', label: 'Short Break', color: 'bg-violet-500', category: 'break' },
  { value: 'tea_break', label: 'Tea Break', color: 'bg-pink-500', category: 'break' },
  { value: 'personal_break', label: 'Personal Break', color: 'bg-fuchsia-500', category: 'break' },
  { value: 'training', label: 'Training', color: 'bg-cyan-500', category: 'break' },
  { value: 'meeting', label: 'Meeting', color: 'bg-indigo-500', category: 'break' },
  { value: 'technical_break', label: 'Technical Break', color: 'bg-rose-500', category: 'break' },
  { value: 'offline', label: 'Offline', color: 'bg-slate-500', category: 'inactive' },
];

export const CALL_STATUSES: { value: CallStatus; label: string; color: string }[] = [
  { value: 'queued', label: 'Queued', color: 'bg-slate-500' },
  { value: 'dialing', label: 'Dialing', color: 'bg-indigo-500' },
  { value: 'ringing', label: 'Ringing', color: 'bg-violet-500' },
  { value: 'connected', label: 'Connected', color: 'bg-emerald-500' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-amber-500' },
  { value: 'muted', label: 'Muted', color: 'bg-yellow-500' },
  { value: 'transferred', label: 'Transferred', color: 'bg-cyan-500' },
  { value: 'disconnected', label: 'Disconnected', color: 'bg-rose-500' },
  { value: 'wrap_up', label: 'Wrap-Up', color: 'bg-orange-500' },
  { value: 'completed', label: 'Completed', color: 'bg-teal-500' },
  { value: 'no_answer', label: 'No Answer', color: 'bg-slate-400' },
  { value: 'busy', label: 'Busy', color: 'bg-amber-600' },
  { value: 'rejected', label: 'Rejected', color: 'bg-rose-400' },
  { value: 'invalid_number', label: 'Invalid Number', color: 'bg-red-500' },
  { value: 'network_failure', label: 'Network Failure', color: 'bg-red-600' },
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  supervisor: 'Supervisor',
  agent: 'Agent',
};

export function getStateMeta(s: AgentStateName) {
  return AGENT_STATES.find((x) => x.value === s) ?? AGENT_STATES[AGENT_STATES.length - 1];
}

export function getCallStatusMeta(s: CallStatus) {
  return CALL_STATUSES.find((x) => x.value === s) ?? { value: s, label: s, color: 'bg-slate-500' };
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  timeZone: 'Asia/Kolkata',
  });
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  if (phone.length <= 4) return phone;
  return phone.slice(0, 3) + '•••••' + phone.slice(-3);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [name, domain] = email.split('@');
  if (!domain) return '—';
  return name.slice(0, 2) + '•••@' + domain;
}
