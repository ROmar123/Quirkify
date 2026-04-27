import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Mail, Lock, Sparkles, Shield, Zap, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
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

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signIn(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Make sure Google OAuth is enabled in Supabase.');
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 80px)',
        background: 'var(--bg)',
        padding: '40px 16px 80px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-8 w-full lg:grid-cols-[1.1fr_0.9fr] items-center">

        {/* Left: brand pitch */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            style={{
              borderRadius: 28,
              background: 'linear-gradient(135deg, #1E1B4B 0%, #4C1D95 55%, #831843 100%)',
              padding: '40px 36px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative blobs */}
            <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(244,114,182,0.18)', filter: 'blur(50px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -30, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(99,102,241,0.18)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 9999, padding: '4px 12px', marginBottom: 20 }}>
                <Sparkles size={12} color="#F472B6" />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.8)' }}>
                  Quirkify Access
                </span>
              </div>

              <h1
                style={{
                  fontFamily: '"Nunito", sans-serif',
                  fontSize: 'clamp(28px, 4vw, 44px)',
                  fontWeight: 900,
                  lineHeight: 1.1,
                  color: '#fff',
                  letterSpacing: '-0.02em',
                  marginBottom: 16,
                }}
              >
                Your quirky<br />
                <span style={{ background: 'linear-gradient(90deg,#F472B6,#C084FC)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  universe awaits.
                </span>
              </h1>

              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 32, maxWidth: 400 }}>
                One account unlocks store checkout, live auctions, your profile &amp; wallet, and admin tools.
              </p>

              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  { icon: Shield, text: 'AI-verified listings — every product reviewed before it goes live', color: '#34D399' },
                  { icon: Zap, text: 'Earn XP on purchases and auction wins', color: '#FBBF24' },
                  { icon: Trophy, text: 'Bid, win, and build your quirky collection', color: '#F472B6' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.text}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        background: 'rgba(255,255,255,0.07)',
                        borderRadius: 14, padding: '12px 16px',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <Icon size={16} color={item.color} style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right: auth form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          style={{
            background: '#fff',
            borderRadius: 28,
            border: '1px solid #F3F4F6',
            padding: '32px 28px',
            boxShadow: '0 8px 40px rgba(168,85,247,0.1)',
          }}
        >
          {/* Mode toggle */}
          <div style={{ display: 'inline-flex', background: '#F3F4F6', borderRadius: 14, padding: 4, marginBottom: 28 }}>
            {(['signin', 'signup'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                style={{
                  borderRadius: 10, padding: '8px 18px',
                  fontSize: 13, fontWeight: 700, border: 'none',
                  background: mode === item ? 'var(--gradient-primary)' : 'transparent',
                  color: mode === item ? '#fff' : '#6B7280',
                  cursor: 'pointer',
                  boxShadow: mode === item ? '0 2px 8px rgba(168,85,247,0.3)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {item === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 6 }}>
                  Display name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  style={{ background: '#F9FAFB', width: '100%' }}
                  placeholder="Your name"
                />
              </label>
            )}

            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 6 }}>
                Email
              </span>
              <div style={{ position: 'relative' }}>
                <Mail size={14} color="#9CA3AF" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="input"
                  style={{ background: '#F9FAFB', paddingLeft: 40, width: '100%' }}
                  placeholder="you@example.com"
                />
              </div>
            </label>

            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: 6 }}>
                Password
              </span>
              <div style={{ position: 'relative' }}>
                <Lock size={14} color="#9CA3AF" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="input"
                  style={{ background: '#F9FAFB', paddingLeft: 40, width: '100%' }}
                  placeholder="••••••••"
                />
              </div>
            </label>

            {error && (
              <div style={{ borderRadius: 12, background: '#FFF1F2', border: '1px solid #FECDD3', padding: '10px 14px', fontSize: 13, color: '#BE123C' }}>
                {error}
              </div>
            )}

            <button
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--gradient-primary)', color: '#fff',
                border: 'none', borderRadius: 14,
                padding: '14px 20px', fontSize: 14, fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
                boxShadow: '0 4px 16px rgba(168,85,247,0.35)',
                transition: 'opacity 0.2s',
              }}
            >
              <ArrowRight size={16} />
              {mode === 'signin' ? 'Continue with email' : 'Create Quirkify account'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#F3F4F6' }} />
          </div>

          <button
            onClick={() => void handleGoogle()}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%',
              background: '#F9FAFB', color: '#374151',
              border: '1.5px solid #E5E7EB', borderRadius: 14,
              padding: '12px 20px', fontSize: 14, fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            <Sparkles size={15} color="#A855F7" />
            Continue with Google
          </button>

          <p style={{ marginTop: 20, fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>
            By continuing you agree to our{' '}
            <a href="/terms" style={{ color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>Terms</a>
            {' '}&amp;{' '}
            <a href="/privacy" style={{ color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>Privacy Policy</a>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
