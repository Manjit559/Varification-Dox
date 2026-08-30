import { useState } from 'react';
import { Headset, Mail, Lock, Loader2, Eye, EyeOff, ShieldCheck, Users, UserCog } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/lib/supabase';
import { ROLE_LABELS } from '@/lib/constants';

const ROLES: { value: Role; icon: typeof UserCog; desc: string }[] = [
  { value: 'admin', icon: ShieldCheck, desc: 'Full system access & configuration' },
  { value: 'supervisor', icon: Users, desc: 'Monitor agents, manage queues & campaigns' },
  { value: 'agent', icon: Headset, desc: 'Handle calls and capture PSF feedback' },
];

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('agent');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === 'signin') {
      const { error } = await signIn(email.trim(), password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email.trim(), password, role, name || email.split('@')[0]);
      if (error) setError(error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 shadow-lg shadow-sky-500/30 mb-4">
            <Headset className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TATA RSA Contact Center</h1>
          <p className="text-slate-400 text-sm mt-1">Outbound Dialler & Post-Service Feedback Platform</p>
        </div>

        <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl mb-6">
            {(['signin', 'signup'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  mode === m ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}>
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                    className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Select Your Role</label>
                  <div className="space-y-2">
                    {ROLES.map((r) => {
                      const Icon = r.icon;
                      return (
                        <button key={r.value} type="button" onClick={() => setRole(r.value)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                            role === r.value ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 hover:border-slate-600'
                          }`}>
                          <Icon className={`w-5 h-5 ${role === r.value ? 'text-sky-400' : 'text-slate-400'}`} />
                          <div>
                            <div className={`text-sm font-medium ${role === r.value ? 'text-sky-300' : 'text-slate-200'}`}>{ROLE_LABELS[r.value]}</div>
                            <div className="text-xs text-slate-500">{r.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@tata.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type={showPw ? 'text' : 'password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-60 text-white font-medium rounded-lg transition shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500 text-center mt-5 leading-relaxed">
            By continuing you consent to call recording and data processing for quality and compliance purposes.
          </p>
        </div>
      </div>
    </div>
  );
}
