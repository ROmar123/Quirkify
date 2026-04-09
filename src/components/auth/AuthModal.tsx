import { useState } from 'react';
import { X, Mail, Lock, Loader } from 'lucide-react';
import { signInWithEmail, signInWithPassword, signUpWithEmail, handleAuthError } from '../../services/authService';

interface AuthModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signInWithPassword(email, password);
        if (error) throw error;
        onSuccess?.();
        onClose();
      } else if (mode === 'signup') {
        const { error } = await signUpWithEmail(email, password, { display_name: email.split('@')[0] });
        if (error) throw error;
        setSuccess('Check your email to confirm!');
      } else {
        const { error } = await signInWithEmail(email);
        if (error) throw error;
        setSuccess('Check your email for a magic link!');
      }
    } catch (e: any) {
      setError(handleAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden">
          <div className="relative p-6 pb-4" style={{ background: 'linear-gradient(135deg, #FDF4FF, #F5F3FF)' }}>
            <button onClick={onClose} className="absolute right-4 top-4 p-1 hover:bg-purple-100 rounded-full">
              <X className="w-5 h-5 text-purple-400" />
            </button>
            <h2 className="text-2xl font-black text-purple-900">
              {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Magic link'}
            </h2>
            <p className="text-purple-500 text-sm font-semibold mt-1">
              {mode === 'signin' ? 'Sign in to your Quirkify account' : mode === 'signup' ? 'Join the commerce revolution' : "We'll email you a sign-in link"}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm font-semibold">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-600 text-sm font-semibold">{success}</div>}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
              <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full pl-10 pr-4 py-3 border-2 border-purple-100 rounded-xl text-sm font-semibold focus:outline-none focus:border-purple-400 transition-colors bg-purple-50/30" />
            </div>
            {mode !== 'magic' && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300" />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                  required={mode === 'signin'} minLength={6}
                  className="w-full pl-10 pr-4 py-3 border-2 border-purple-100 rounded-xl text-sm font-semibold focus:outline-none focus:border-purple-400 transition-colors bg-purple-50/30" />
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
              {loading ? <span className="flex items-center justify-center gap-2"><Loader className="w-4 h-4 animate-spin" /> Please wait...</span>
               : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Magic Link'}
            </button>
          </form>
          <div className="px-6 pb-6 text-center">
            {mode === 'signin' && (
              <>
                <button onClick={() => setMode('magic')} className="text-purple-400 text-xs font-semibold hover:underline">Forgot password? Use magic link</button>
                <p className="mt-2 text-purple-400 text-xs font-semibold">No account? <button onClick={() => setMode('signup')} className="text-purple-600 font-bold hover:underline">Sign up</button></p>
              </>
            )}
            {(mode === 'signup' || mode === 'magic') && (
              <p className="text-purple-400 text-xs font-semibold">Already have an account? <button onClick={() => setMode('signin')} className="text-purple-600 font-bold hover:underline">Sign in</button></p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
