import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, User, Building2, CreditCard, ShieldCheck, ArrowRight, ArrowLeft, Camera, X, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { auth, onAuthStateChanged, type AuthUser } from '../../firebase';
import { updateProfile, setUserRole, getProfileByUid } from '../../services/profileService';

type OnboardingStep = 'intro' | 'business' | 'identity' | 'bank' | 'success';

function CameraCapture({ onCapture, label }: { onCapture: (blob: Blob) => void, label: string }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Camera access denied. Please check your browser permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            onCapture(blob);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-100 rounded-xl text-center">
        <X className="w-7 h-7 text-red-500 mx-auto mb-3" />
        <p className="text-xs font-semibold text-red-600 mb-4">{error}</p>
        <button onClick={startCamera} className="btn-primary py-2 px-5 text-sm">
          Try Again
        </button>
      </div>
    );
  }

  if (!stream) {
    return (
      <div
        onClick={startCamera}
        className="p-10 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center hover:border-purple-400 transition-all cursor-pointer group"
      >
        <Camera className="w-7 h-7 text-gray-300 group-hover:text-purple-500 mb-3 transition-colors" />
        <p className="text-xs font-medium text-gray-400">{label}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-purple-900 overflow-hidden rounded-xl border border-purple-200">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
        <button
          onClick={stopCamera}
          className="w-9 h-9 bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-white/25"
        >
          <X className="w-4 h-4" />
        </button>
        <button onClick={capture} className="btn-primary py-2 px-5 text-sm">
          Capture
        </button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default function SellerOnboarding() {
  const [step, setStep] = useState<OnboardingStep>('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idPhoto, setIdPhoto] = useState<Blob | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<Blob | null>(null);
  const [user, setUser] = useState<AuthUser | null>(auth.currentUser);
  const navigate = useNavigate();

  // Form state
  const [storeName, setStoreName] = useState('');
  const [businessType, setBusinessType] = useState('Individual / Sole Trader');
  const [socialHandle, setSocialHandle] = useState('');
  const [bankName, setBankName] = useState('FNB');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'cheque'>('savings');

  const steps: OnboardingStep[] = ['intro', 'business', 'identity', 'bank', 'success'];
  const currentIndex = steps.indexOf(step);

  // Auth guard
  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) navigate('/auth?next=%2Fseller%2Fonboarding', { replace: true });
  }), [navigate]);

  // Check if already a seller
  useEffect(() => {
    if (!user) return;
    getProfileByUid(user.uid).then(p => {
      if (p?.isSeller) setStep('success');
    }).catch(() => {});
  }, [user]);

  const nextStep = (next: OnboardingStep) => {
    setStep(next);
  };

  const handleCompleteSetup = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await updateProfile(user.uid, { storeName: storeName.trim() || undefined });
      await setUserRole(user.uid, 'seller');
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Failed to complete setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hero-bg min-h-screen pt-16 pb-28 md:pb-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Progress steps */}
        <div className="flex gap-1.5 mb-10">
          {steps.map((s, i) => (
            <div
              key={s}
              className="h-1.5 flex-1 rounded-full transition-all duration-500"
              style={currentIndex >= i ? { background: 'var(--gradient-primary)' } : { background: '#e5e7eb' }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md"
                style={{ background: 'var(--gradient-primary)' }}>
                <ShieldCheck className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
                Become a Verified Seller
              </h1>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                Join the Quirkify ecosystem with Yoco-grade security and fast setup.
              </p>

              <div className="space-y-3 text-left mb-8">
                {[
                  { icon: Building2, title: 'Business Details', desc: 'Tell us about your store' },
                  { icon: User, title: 'ID Verification', desc: 'Secure identity check with AI' },
                  { icon: CreditCard, title: 'Payout Settings', desc: 'Where we send your earnings' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--gradient-primary)' }}>
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => nextStep('business')} className="btn-primary w-full py-3 justify-center">
                Start Onboarding <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 'business' && (
            <motion.div
              key="business"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6">Business Details</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1.5">Store Name</span>
                  <input
                    type="text"
                    value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    className="input"
                    placeholder="e.g. Cape Town Vintage"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1.5">Business Type</span>
                  <select
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                    className="input appearance-none"
                  >
                    <option>Individual / Sole Trader</option>
                    <option>Private Company (Pty) Ltd</option>
                    <option>Non-Profit</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1.5">Website / Social Handle</span>
                  <input
                    type="text"
                    value={socialHandle}
                    onChange={e => setSocialHandle(e.target.value)}
                    className="input"
                    placeholder="@yourstore"
                  />
                </label>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep('intro')} className="btn-secondary flex-1 py-2.5 justify-center">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button onClick={() => nextStep('identity')} className="btn-primary flex-[2] py-2.5 justify-center">
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'identity' && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-1">ID Verification</h2>
              <p className="text-gray-400 text-xs mb-5">Powered by Quirkify AI &amp; Yoco-style security</p>

              <div className="space-y-4">
                {idPhoto ? (
                  <div className="relative aspect-video border border-gray-100 rounded-xl overflow-hidden group">
                    <img src={URL.createObjectURL(idPhoto)} className="w-full h-full object-cover" alt="ID Front" />
                    <button
                      onClick={() => setIdPhoto(null)}
                      className="absolute top-3 right-3 p-1.5 bg-black/40 text-white backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-3 left-3 badge">ID Captured</div>
                  </div>
                ) : (
                  <CameraCapture onCapture={setIdPhoto} label="Capture Front of ID / Passport" />
                )}

                {selfiePhoto ? (
                  <div className="relative aspect-video border border-gray-100 rounded-xl overflow-hidden group">
                    <img src={URL.createObjectURL(selfiePhoto)} className="w-full h-full object-cover" alt="Selfie" />
                    <button
                      onClick={() => setSelfiePhoto(null)}
                      className="absolute top-3 right-3 p-1.5 bg-black/40 text-white backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-3 left-3 badge">Selfie Captured</div>
                  </div>
                ) : (
                  <CameraCapture onCapture={setSelfiePhoto} label="Take a Live Selfie" />
                )}

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex gap-3 items-start">
                  <ShieldCheck className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Your data is encrypted and stored securely. We use biometric matching to verify your identity instantly.
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep('business')} className="btn-secondary flex-1 py-2.5 justify-center">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={() => nextStep('bank')}
                    disabled={!idPhoto || !selfiePhoto}
                    className="btn-primary flex-[2] py-2.5 justify-center disabled:opacity-40"
                  >
                    Verify Identity <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'bank' && (
            <motion.div
              key="bank"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6">Payout Settings</h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1.5">Bank Name</span>
                  <select
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    className="input appearance-none"
                  >
                    <option>FNB</option>
                    <option>Standard Bank</option>
                    <option>Absa</option>
                    <option>Nedbank</option>
                    <option>Capitec</option>
                    <option>TymeBank</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1.5">Account Number</span>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    className="input"
                    placeholder="0000000000"
                  />
                </label>
                <div>
                  <span className="block text-xs font-medium text-gray-600 mb-1.5">Account Type</span>
                  <div className="grid grid-cols-2 gap-3">
                    {(['savings', 'cheque'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAccountType(type)}
                        className={cn(
                          'px-4 py-2.5 rounded-xl font-semibold text-sm transition-all',
                          accountType === type
                            ? 'text-white shadow-sm'
                            : 'text-gray-600 border border-gray-200 bg-white hover:border-gray-300'
                        )}
                        style={accountType === type ? { background: 'var(--gradient-primary)' } : {}}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setStep('identity')} className="btn-secondary flex-1 py-2.5 justify-center">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={handleCompleteSetup}
                    disabled={loading || !storeName.trim()}
                    className="btn-primary flex-[2] py-2.5 justify-center disabled:opacity-50"
                  >
                    {loading ? 'Setting up…' : 'Complete Setup'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md"
                style={{ background: 'linear-gradient(135deg, #4ade80, #22d3ee)' }}>
                <CheckCircle2 className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
                You're all set!
              </h1>
              <p className="text-gray-500 text-sm mb-8">
                Your seller account is now active. Start listing products and earning.
              </p>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 text-left">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Next Steps</h3>
                <ul className="space-y-3">
                  {[
                    'List your first product',
                    'Set up your store profile',
                    'Connect social accounts',
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: 'var(--gradient-primary)' }}>
                        {i + 1}
                      </div>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>

              <button onClick={() => navigate('/profile')} className="btn-primary w-full py-3 justify-center">
                Open Mission Control <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full animate-spin"
                style={{ border: '2.5px solid #e9d5ff', borderTopColor: '#a855f7' }} />
              <p className="text-xs font-medium text-gray-500">Setting up your seller account…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
