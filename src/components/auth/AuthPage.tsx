import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
<<<<<<< HEAD
import { LoaderCircle, Mail, Lock, ArrowRight, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
=======
import { LoaderCircle, Mail, Lock, ArrowRight, UserPlus, Sparkles, Shield, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
>>>>>>> origin/main
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
<<<<<<< HEAD
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate(next, { replace: true });
      }
    });

    return unsubscribe;
=======
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate(next, { replace: true });
    });
    return unsub;
>>>>>>> origin/main
  }, [navigate, next]);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyAction('password');
    setError(null);
    setNotice(null);
<<<<<<< HEAD

=======
>>>>>>> origin/main
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password);
        navigate(next, { replace: true });
      } else {
        const { session, user } = await signUpWithPassword(email, password, fullName, next);
        if (session || user?.identities?.length) {
<<<<<<< HEAD
          setNotice('Account created. If email confirmation is enabled, check your inbox before signing in.');
=======
          setNotice('Account created! Check your inbox to confirm your email.');
>>>>>>> origin/main
        } else {
          setNotice('Account created. Check your inbox to finish setup.');
        }
      }
    } catch (err) {
<<<<<<< HEAD
      setError(err instanceof Error ? err.message : 'Authentication failed.');
=======
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
>>>>>>> origin/main
    } finally {
      setBusyAction(null);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
<<<<<<< HEAD
      setError('Enter your email first to receive a magic link.');
      return;
    }

    setBusyAction('magic');
    setError(null);
    setNotice(null);

    try {
      await sendMagicLink(email, next);
      setNotice('Magic link sent. Check your inbox and open it on this device.');
=======
      setError('Enter your email address to receive a magic link.');
      return;
    }
    setBusyAction('magic');
    setError(null);
    setNotice(null);
    try {
      await sendMagicLink(email, next);
      setNotice('Magic link sent — check your inbox and open it on this device.');
>>>>>>> origin/main
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
<<<<<<< HEAD
    <div className="min-h-[calc(100vh-3.5rem)] px-4 py-10 pb-32 md:pb-10">
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
=======
    <div className="min-h-[calc(100vh-3.5rem)] hero-bg px-4 py-8 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">

        {/* Left — brand panel */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl text-white noise"
          style={{
            background: 'linear-gradient(145deg, #1e1b4b 0%, #4c1d95 50%, #be185d 100%)',
            boxShadow: '0 20px 60px rgba(76,29,149,0.30)',
          }}
        >
          <div className="p-8 md:p-10 h-full flex flex-col">
            <span className="section-label text-purple-300 mb-5">Quirkify Access</span>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4"
              style={{ fontFamily: 'Nunito, sans-serif' }}>
              Sign in only when it matters.
            </h1>
            <p className="text-white/70 text-sm md:text-base leading-relaxed mb-8">
              Browse the store and auctions freely. Sign in when you're ready to buy, bid, or track orders.
            </p>

            <div className="grid gap-3 sm:grid-cols-3 mt-auto">
              {[
                { icon: Sparkles, title: 'AI Verified', body: 'Every listing checked by Gemini before approval.' },
                { icon: Zap, title: 'Live Auctions', body: 'Bid live on rare & limited drops.' },
                { icon: Shield, title: 'Secure', body: 'PCI-compliant Yoco payments.' },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center mb-2.5">
                    <Icon className="w-3.5 h-3.5 text-purple-200" />
                  </div>
                  <p className="text-xs font-bold text-white mb-1">{title}</p>
                  <p className="text-[11px] text-white/60 leading-relaxed">{body}</p>
>>>>>>> origin/main
                </div>
              ))}
            </div>
          </div>
        </motion.section>

<<<<<<< HEAD
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
                    placeholder="Your full name"
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
=======
        {/* Right — form */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-gray-100 bg-white p-6 md:p-8 shadow-lg"
        >
          {/* Mode toggle */}
          <div className="inline-flex rounded-xl bg-gray-100 p-1 mb-6">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setNotice(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div
                  key="fullname"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</span>
                    <div className="relative">
                      <UserPlus className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        placeholder="Your full name"
                        className="input pl-10"
                      />
                    </div>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1.5">Email Address</span>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
>>>>>>> origin/main
                  required
                />
              </div>
            </label>

            <label className="block">
<<<<<<< HEAD
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.25em] text-purple-400">Password</span>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-300" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signin' ? 'Enter your password' : 'Create a secure password'}
                  className="w-full rounded-2xl border border-purple-100 bg-purple-50/50 py-3 pl-11 pr-4 text-sm font-semibold text-purple-900 outline-none transition-colors focus:border-purple-400 focus:bg-white"
=======
              <span className="block text-xs font-medium text-gray-600 mb-1.5">Password</span>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signin' ? 'Enter your password' : 'Create a secure password'}
                  className="input pl-10"
>>>>>>> origin/main
                  required
                />
              </div>
            </label>

<<<<<<< HEAD
            {(error || notice) && (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {error || notice}
              </div>
            )}

            <button type="submit" disabled={busyAction !== null} className="btn-primary w-full justify-center py-3 text-sm">
              {busyAction === 'password' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
=======
            {/* Feedback */}
            <AnimatePresence>
              {(error || notice) && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                    error
                      ? 'border-red-100 bg-red-50 text-red-600'
                      : 'border-green-100 bg-green-50 text-green-700'
                  }`}
                >
                  {error || notice}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={busyAction !== null}
              className="btn-primary w-full py-3 text-sm justify-center disabled:opacity-60"
            >
              {busyAction === 'password' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
>>>>>>> origin/main
              {mode === 'signin' ? 'Sign In with Email' : 'Create Account'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
<<<<<<< HEAD
            <div className="h-px flex-1 bg-purple-100" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-300">or</span>
            <div className="h-px flex-1 bg-purple-100" />
          </div>

          <div className="space-y-3">
            <button
              onClick={handleMagicLink}
              disabled={busyAction !== null}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm font-black text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-70"
            >
              {busyAction === 'magic' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send Magic Link
            </button>
          </div>
=======
            <div className="h-px flex-1 bg-gray-100" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">or</span>
            <div className="h-px flex-1 bg-gray-100" />
          </div>

          <button
            onClick={handleMagicLink}
            disabled={busyAction !== null}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-all disabled:opacity-60"
          >
            {busyAction === 'magic' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 text-purple-500" />
            )}
            Send Magic Link
          </button>

          <p className="text-center text-[10px] text-gray-400 mt-5">
            By continuing, you agree to our{' '}
            <a href="/terms" className="underline hover:text-gray-600 transition-colors">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="underline hover:text-gray-600 transition-colors">Privacy Policy</a>.
          </p>
>>>>>>> origin/main
        </motion.section>
      </div>
    </div>
  );
}
