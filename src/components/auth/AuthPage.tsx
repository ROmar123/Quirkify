import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoaderCircle, Mail, Lock, ArrowRight, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import {
  auth,
  onAuthStateChanged,
  sendMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from '../../firebase';

type AuthMode = 'signin' | 'signup';

function sanitizeNext(next: string | null) {
  if (!next || !next.startsWith('/')) return '/';
  return next;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = sanitizeNext(searchParams.get('next'));
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(auth.currentUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [busyAction, setBusyAction] = useState<'password' | 'magic' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate(next, { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate, next]);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyAction('password');
    setError(null);
    setNotice(null);

    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password);
        navigate(next, { replace: true });
      } else {
        const { session, user } = await signUpWithPassword(email, password, fullName, next);
        if (session || user?.identities?.length) {
          setNotice('Account created. If email confirmation is enabled, check your inbox before signing in.');
        } else {
          setNotice('Account created. Check your inbox to finish setup.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError('Enter your email first to receive a magic link.');
      return;
    }

    setBusyAction('magic');
    setError(null);
    setNotice(null);

    try {
      await sendMagicLink(email, next);
      setNotice('Magic link sent. Check your inbox and open it on this device.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] px-4 py-10">
      <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-white/60 p-8 md:p-10 text-white shadow-[0_30px_120px_rgba(109,40,217,0.18)] relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #2D1B69 0%, #7C3AED 45%, #EC4899 100%)' }}
        >
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -top-12 -left-8 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-fuchsia-200/20 blur-3xl" />
          </div>
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-pink-100/80">Quirkify Access</p>
            <h1 className="mt-4 text-4xl md:text-6xl font-black leading-none">Sign in only when it matters.</h1>
            <p className="mt-5 max-w-xl text-sm md:text-base font-semibold text-white/80">
              Browse store and auctions freely, then sign in when you want to buy, bid, track orders, or manage your account.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['Store', 'Browse live products without signing in'],
                ['Auctions', 'Join public auction rooms before you bid'],
                ['Account', 'Sign in only for checkout, bids, orders, and account'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-sm font-black">{title}</p>
                  <p className="mt-1 text-xs font-semibold text-white/70">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[2rem] border border-purple-100 bg-white p-6 md:p-8 shadow-xl"
        >
          <div className="inline-flex rounded-full border border-purple-100 bg-purple-50 p-1">
            <button
              onClick={() => setMode('signin')}
              className={`rounded-full px-4 py-2 text-sm font-black transition-colors ${mode === 'signin' ? 'bg-white text-purple-700 shadow-sm' : 'text-purple-400'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`rounded-full px-4 py-2 text-sm font-black transition-colors ${mode === 'signup' ? 'bg-white text-purple-700 shadow-sm' : 'text-purple-400'}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.25em] text-purple-400">Full name</span>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300" />
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Rhidaa Omar"
                    className="w-full rounded-2xl border border-purple-100 bg-purple-50/50 py-3 pl-11 pr-4 text-sm font-semibold text-purple-900 outline-none transition-colors focus:border-purple-400 focus:bg-white"
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.25em] text-purple-400">Email</span>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-purple-100 bg-purple-50/50 py-3 pl-11 pr-4 text-sm font-semibold text-purple-900 outline-none transition-colors focus:border-purple-400 focus:bg-white"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.25em] text-purple-400">Password</span>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signin' ? 'Enter your password' : 'Create a secure password'}
                  className="w-full rounded-2xl border border-purple-100 bg-purple-50/50 py-3 pl-11 pr-4 text-sm font-semibold text-purple-900 outline-none transition-colors focus:border-purple-400 focus:bg-white"
                  required
                />
              </div>
            </label>

            {(error || notice) && (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {error || notice}
              </div>
            )}

            <button type="submit" disabled={busyAction !== null} className="btn-primary w-full justify-center py-3 text-sm">
              {busyAction === 'password' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {mode === 'signin' ? 'Sign In with Email' : 'Create Account'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-purple-100" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-300">or</span>
            <div className="h-px flex-1 bg-purple-100" />
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700">
              Google sign-in is disabled for now. Email and magic link are the active auth paths.
            </div>

            <button
              onClick={handleMagicLink}
              disabled={busyAction !== null}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm font-black text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-70"
            >
              {busyAction === 'magic' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send Magic Link
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
