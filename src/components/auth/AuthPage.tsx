import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Mail, Lock, Sparkles } from 'lucide-react';
import { auth, onAuthStateChanged, signIn, signInWithPassword, signUpWithPassword } from '../../firebase';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/';
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, (user) => user && navigate(next, { replace: true })), [navigate, next]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password);
      } else {
        await signUpWithPassword(email, password, name);
      }
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-80px)] bg-[radial-gradient(circle_at_top,#19324a,transparent_35%),linear-gradient(180deg,#090d14,#101823)] px-4 py-10 text-white">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#f6c971]">Quirkify Access</p>
          <h1 className="mt-4 text-4xl font-black leading-tight md:text-5xl">
            Sign in to buy, bid, manage stock, and approve AI workflows.
          </h1>
          <p className="mt-5 max-w-xl text-white/65">
            Customer and admin surfaces share one system. Authentication unlocks checkout, order history, review queue approvals, and live auction operations.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              'One account unlocks store checkout, profile, wallet, and bids',
              'Gemini-assisted intake with human review before publishing',
              'Commerce and customer records reconcile into the same operating backend',
            ].map((item) => (
              <div key={item} className="rounded-3xl border border-white/10 bg-black/15 p-4 text-sm text-white/70">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#f6f1e8] p-6 text-[#10151e] shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="inline-flex rounded-full bg-[#10151e]/8 p-1">
            {(['signin', 'signup'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${mode === item ? 'bg-[#10151e] text-white' : 'text-[#10151e]/60'}`}
              >
                {item === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-[#10151e]/55">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input bg-white" placeholder="Hamza’s biggest collector fan" />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-[#10151e]/55">Email</span>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#10151e]/35" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input bg-white pl-11" placeholder="you@example.com" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-[#10151e]/55">Password</span>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#10151e]/35" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="input bg-white pl-11" placeholder="••••••••" />
              </div>
            </label>
            {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#10151e] px-4 py-3 text-sm font-bold text-white">
              <ArrowRight className="h-4 w-4" />
              {mode === 'signin' ? 'Continue with email' : 'Create Quirkify account'}
            </button>
          </form>

          <button
            onClick={() => void signIn(next)}
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[#10151e]/10 bg-white px-4 py-3 text-sm font-bold text-[#10151e]"
          >
            <Sparkles className="h-4 w-4" />
            Continue with Google
          </button>
        </div>
      </div>
    </section>
  );
}
