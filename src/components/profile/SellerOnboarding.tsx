import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, User, Building2, CreditCard, ShieldCheck, ArrowRight, ArrowLeft, Camera, Upload, Loader2, X, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

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
      <div className="p-8 bg-red-50 border border-red-100 rounded-2xl text-center">
        <X className="w-8 h-8 text-red-500 mx-auto mb-4" />
        <p className="text-xs font-bold text-red-600 mb-4">{error}</p>
        <button
          onClick={startCamera}
          className="px-6 py-3 rounded-full font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!stream) {
    return (
      <div
        onClick={startCamera}
        className="p-12 border-2 border-dashed border-purple-100 rounded-2xl flex flex-col items-center justify-center text-center hover:border-purple-400 transition-all cursor-pointer group"
      >
        <Camera className="w-8 h-8 text-purple-300 group-hover:text-purple-500 mb-4 transition-colors" />
        <p className="text-xs font-bold text-purple-400">{label}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-purple-950 overflow-hidden rounded-2xl border border-purple-100">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 border-2 border-purple-400/30 rounded-2xl pointer-events-none" />
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
        <button
          onClick={stopCamera}
          className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-white/20"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={capture}
          className="px-6 py-3 rounded-full font-bold text-white text-sm"
          style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
        >
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
  const [idPhoto, setIdPhoto] = useState<Blob | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<Blob | null>(null);
  const navigate = useNavigate();

  const steps: OnboardingStep[] = ['intro', 'business', 'identity', 'bank', 'success'];
  const currentIndex = steps.indexOf(step);

  const nextStep = (next: OnboardingStep) => {
    setLoading(true);
    setTimeout(() => {
      setStep(next);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4" style={{ background: '#FDF4FF' }}>
      <div className="max-w-xl mx-auto">
        {/* Progress Bar */}
        <div className="flex gap-1.5 mb-12">
          {steps.map((s, i) => (
            <div
              key={s}
              className="h-1.5 flex-1 rounded-full transition-all duration-500"
              style={
                currentIndex >= i
                  ? { background: 'linear-gradient(135deg, #F472B6, #A855F7)' }
                  : { background: '#F3E8FF' }
              }
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
              >
                <ShieldCheck className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-black text-purple-900 tracking-tighter mb-4">Become a Verified Seller</h1>
              <p className="text-purple-600 text-sm font-bold mb-12 leading-relaxed">
                Join the Quirkify ecosystem. We use Yoco-inspired <br />
                onboarding for maximum security and speed.
              </p>

              <div className="space-y-4 text-left mb-12">
                {[
                  { icon: Building2, title: "Business Details", desc: "Tell us about your store" },
                  { icon: User, title: "ID Verification", desc: "Secure identity check with AI" },
                  { icon: CreditCard, title: "Payout Settings", desc: "Where we send your earnings" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white rounded-3xl border border-purple-100 shadow-sm p-6">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                    >
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-purple-900">{item.title}</h3>
                      <p className="text-xs text-purple-400 font-bold">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => nextStep('business')}
                className="w-full py-4 rounded-full font-bold text-white text-sm flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
              >
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
              className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6"
            >
              <h2 className="text-2xl font-black text-purple-900 tracking-tighter mb-8">Business Details</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-purple-600 mb-1 block">Store Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400"
                    placeholder="e.g. Cape Town Vintage"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-600 mb-1 block">Business Type</label>
                  <select className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400 appearance-none">
                    <option>Individual / Sole Trader</option>
                    <option>Private Company (Pty) Ltd</option>
                    <option>Non-Profit</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-600 mb-1 block">Website / Social Handle</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400"
                    placeholder="@yourstore"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setStep('intro')}
                    className="flex-1 px-6 py-3 rounded-full font-bold text-purple-600 border-2 border-purple-200 hover:border-purple-400 bg-white text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => nextStep('identity')}
                    className="flex-[2] px-6 py-3 rounded-full font-bold text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                  >
                    Continue
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
              className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6"
            >
              <h2 className="text-2xl font-black text-purple-900 tracking-tighter mb-2">ID Verification</h2>
              <p className="text-purple-400 text-xs font-bold mb-8">Powered by Quirkify AI &amp; Yoco-style security</p>

              <div className="space-y-6">
                {idPhoto ? (
                  <div className="relative aspect-video border border-purple-100 rounded-2xl overflow-hidden group">
                    <img src={URL.createObjectURL(idPhoto)} className="w-full h-full object-cover" alt="ID Front" />
                    <button
                      onClick={() => setIdPhoto(null)}
                      className="absolute top-4 right-4 p-2 bg-purple-900/50 text-white backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-4 left-4 px-3 py-1 text-white text-xs font-bold rounded-full" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>ID Captured</div>
                  </div>
                ) : (
                  <CameraCapture onCapture={setIdPhoto} label="Capture Front of ID / Passport" />
                )}

                {selfiePhoto ? (
                  <div className="relative aspect-video border border-purple-100 rounded-2xl overflow-hidden group">
                    <img src={URL.createObjectURL(selfiePhoto)} className="w-full h-full object-cover" alt="Selfie" />
                    <button
                      onClick={() => setSelfiePhoto(null)}
                      className="absolute top-4 right-4 p-2 bg-purple-900/50 text-white backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-4 left-4 px-3 py-1 text-white text-xs font-bold rounded-full" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>Selfie Captured</div>
                  </div>
                ) : (
                  <CameraCapture onCapture={setSelfiePhoto} label="Take a Live Selfie" />
                )}

                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex gap-4 items-start">
                  <ShieldCheck className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-purple-600 font-bold leading-relaxed">
                    Your data is encrypted and stored securely. We use biometric matching to verify your identity instantly.
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setStep('business')}
                    className="flex-1 px-6 py-3 rounded-full font-bold text-purple-600 border-2 border-purple-200 hover:border-purple-400 bg-white text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => nextStep('bank')}
                    disabled={!idPhoto || !selfiePhoto}
                    className="flex-[2] px-6 py-3 rounded-full font-bold text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                  >
                    Verify Identity
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
              className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6"
            >
              <h2 className="text-2xl font-black text-purple-900 tracking-tighter mb-8">Payout Settings</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-purple-600 mb-1 block">Bank Name</label>
                  <select className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 focus:outline-none focus:border-purple-400 appearance-none">
                    <option>FNB</option>
                    <option>Standard Bank</option>
                    <option>Absa</option>
                    <option>Nedbank</option>
                    <option>Capitec</option>
                    <option>TymeBank</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-600 mb-1 block">Account Number</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-white border-2 border-purple-100 rounded-2xl text-sm font-bold text-purple-800 placeholder:text-purple-300 focus:outline-none focus:border-purple-400"
                    placeholder="0000000000"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-600 mb-1 block">Account Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      className="px-6 py-3 rounded-full font-bold text-white text-sm"
                      style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                    >
                      Savings
                    </button>
                    <button className="px-6 py-3 rounded-full font-bold text-purple-600 border-2 border-purple-200 hover:border-purple-400 bg-white text-sm">
                      Cheque
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setStep('identity')}
                    className="flex-1 px-6 py-3 rounded-full font-bold text-purple-600 border-2 border-purple-200 hover:border-purple-400 bg-white text-sm"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => nextStep('success')}
                    className="flex-[2] px-6 py-3 rounded-full font-bold text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                  >
                    Complete Setup
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8" style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}>
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-4xl font-black text-purple-900 tracking-tighter mb-4">You're All Set!</h1>
              <p className="text-purple-600 text-sm font-bold mb-12 leading-relaxed">
                Your seller account is now active. <br />
                Start listing products and earning.
              </p>

              <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-8 mb-12 text-left">
                <h3 className="text-lg font-black text-purple-900 mb-6">Next Steps</h3>
                <ul className="space-y-4">
                  {[
                    'List your first product',
                    'Set up your store profile',
                    'Connect social accounts'
                  ].map((text, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-bold text-purple-600">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                      >
                        {i + 1}
                      </div>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => navigate('/admin/inventory')}
                className="w-full py-4 rounded-full font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
              >
                Go to Product Intake
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2
                className="w-8 h-8 animate-spin"
                style={{ color: '#A855F7' }}
              />
              <p className="text-xs font-bold text-purple-400">Processing with Aura Vision...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
