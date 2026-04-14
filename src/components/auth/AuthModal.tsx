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
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden">
          <div className="relative px-6 pt-6 pb-4">
            <button onClick={onClose} className="absolute right-4 top-4 p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Magic link'}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {mode === 'signin' ? 'Sign in to your Quirkify account' : mode === 'signup' ? 'Join the Quirkify community' : "We'll email you a sign-in link"}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="px-6 pb-4 space-y-3">
            {error && <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-600 text-sm">{error}</div>}
            {success && <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-green-700 text-sm">{success}</div>}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required
                className="input pl-10" />
            </div>
            {mode !== 'magic' && (
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                  required={mode === 'signin'} minLength={6}
                  className="input pl-10" />
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 justify-center disabled:opacity-60">
              {loading
                ? <><Loader className="w-4 h-4 animate-spin" /> Please wait…</>
                : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Magic Link'}
            </button>
          </form>
          <div className="px-6 pb-5 text-center">
            {mode === 'signin' && (
              <>
                <button onClick={() => setMode('magic')} className="text-gray-400 text-xs hover:text-gray-600">Forgot password? Use magic link</button>
                <p className="mt-2 text-gray-400 text-xs">No account? <button onClick={() => setMode('signup')} className="text-purple-600 font-semibold hover:underline">Sign up</button></p>
              </>
            )}
            {(mode === 'signup' || mode === 'magic') && (
              <p className="text-gray-400 text-xs">Already have an account? <button onClick={() => setMode('signin')} className="text-purple-600 font-semibold hover:underline">Sign in</button></p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
