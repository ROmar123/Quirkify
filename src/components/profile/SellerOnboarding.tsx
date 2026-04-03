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
      console.error('Camera access error:', err);
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
      <div className="p-8 bg-red-50 border border-red-100 text-center">
        <X className="w-8 h-8 text-red-500 mx-auto mb-4" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-4">{error}</p>
        <button 
          onClick={startCamera}
          className="px-6 py-2 bg-black text-white text-[8px] font-bold uppercase tracking-widest"
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
        className="p-12 border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center text-center hover:border-black transition-all cursor-pointer group"
      >
        <Camera className="w-8 h-8 text-zinc-200 group-hover:text-black mb-4 transition-colors" />
        <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">{label}</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-black overflow-hidden border border-zinc-100">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="w-full h-full object-cover grayscale"
      />
      <div className="absolute inset-0 border-2 border-quirky/30 pointer-events-none" />
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
        <button 
          onClick={stopCamera}
          className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-white/20"
        >
          <X className="w-4 h-4" />
        </button>
        <button 
          onClick={capture}
          className="px-6 py-2 bg-white text-black text-[8px] font-bold uppercase tracking-widest hover:bg-quirky hover:text-white transition-all"
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

  const nextStep = (next: OnboardingStep) => {
    setLoading(true);
    setTimeout(() => {
      setStep(next);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Progress Bar */}
        <div className="flex gap-1 mb-12">
          {['intro', 'business', 'identity', 'bank', 'success'].map((s, i) => (
            <div 
              key={s} 
              className={cn(
                "h-1 flex-1 transition-all duration-500",
                ['intro', 'business', 'identity', 'bank', 'success'].indexOf(step) >= i ? "bg-black" : "bg-zinc-100"
              )} 
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
              <div className="w-20 h-20 bg-zinc-50 border border-zinc-100 flex items-center justify-center mx-auto mb-8">
                <ShieldCheck className="w-10 h-10 text-black" />
              </div>
              <h1 className="text-4xl font-bold tracking-tighter mb-4 uppercase">Become a Verified Seller</h1>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-12 leading-relaxed">
                Join the Quirkify ecosystem. We use Yoco-inspired <br />
                onboarding for maximum security and speed.
              </p>
              
              <div className="space-y-4 text-left mb-12">
                {[
                  { icon: Building2, title: "Business Details", desc: "Tell us about your store" },
                  { icon: User, title: "ID Verification", desc: "Secure identity check with AI" },
                  { icon: CreditCard, title: "Payout Settings", desc: "Where we send your earnings" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-zinc-50 border border-zinc-100">
                    <item.icon className="w-5 h-5 text-zinc-400" />
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-widest">{item.title}</h3>
                      <p className="text-[8px] text-zinc-400 uppercase tracking-widest">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => nextStep('business')}
                className="w-full py-5 bg-black text-white font-bold uppercase tracking-[0.3em] text-[10px] flex items-center justify-center gap-2 hover:bg-quirky transition-all"
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
            >
              <h2 className="text-2xl font-bold tracking-tighter mb-8 uppercase">Business Details</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Store Name</label>
                  <input type="text" className="w-full p-4 bg-zinc-50 border border-zinc-100 focus:border-black outline-none transition-all text-xs font-bold" placeholder="e.g. Cape Town Vintage" />
                </div>
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Business Type</label>
                  <select className="w-full p-4 bg-zinc-50 border border-zinc-100 focus:border-black outline-none transition-all text-xs font-bold appearance-none">
                    <option>Individual / Sole Trader</option>
                    <option>Private Company (Pty) Ltd</option>
                    <option>Non-Profit</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Website / Social Handle</label>
                  <input type="text" className="w-full p-4 bg-zinc-50 border border-zinc-100 focus:border-black outline-none transition-all text-xs font-bold" placeholder="@yourstore" />
                </div>
                
                <div className="flex gap-4 pt-8">
                  <button onClick={() => setStep('intro')} className="flex-1 py-4 border border-zinc-100 font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-50 transition-all">Back</button>
                  <button onClick={() => nextStep('identity')} className="flex-[2] py-4 bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-quirky transition-all">Continue</button>
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
            >
              <h2 className="text-2xl font-bold tracking-tighter mb-2 uppercase">ID Verification</h2>
              <p className="text-zinc-400 text-[8px] font-bold uppercase tracking-widest mb-8">Powered by Quirkify AI & Yoco-style security</p>
              
              <div className="space-y-6">
                {idPhoto ? (
                  <div className="relative aspect-video border border-zinc-100 overflow-hidden group">
                    <img src={URL.createObjectURL(idPhoto)} className="w-full h-full object-cover grayscale" alt="ID Front" />
                    <button 
                      onClick={() => setIdPhoto(null)}
                      className="absolute top-4 right-4 p-2 bg-black/50 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-4 left-4 px-2 py-1 bg-green-500 text-white text-[6px] font-bold uppercase tracking-widest">ID Captured</div>
                  </div>
                ) : (
                  <CameraCapture onCapture={setIdPhoto} label="Capture Front of ID / Passport" />
                )}

                {selfiePhoto ? (
                  <div className="relative aspect-video border border-zinc-100 overflow-hidden group">
                    <img src={URL.createObjectURL(selfiePhoto)} className="w-full h-full object-cover grayscale" alt="Selfie" />
                    <button 
                      onClick={() => setSelfiePhoto(null)}
                      className="absolute top-4 right-4 p-2 bg-black/50 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-4 left-4 px-2 py-1 bg-green-500 text-white text-[6px] font-bold uppercase tracking-widest">Selfie Captured</div>
                  </div>
                ) : (
                  <CameraCapture onCapture={setSelfiePhoto} label="Take a Live Selfie" />
                )}

                <div className="bg-zinc-50 p-4 border border-zinc-100 flex gap-4 items-start">
                  <ShieldCheck className="w-5 h-5 text-green-500 mt-1" />
                  <p className="text-[8px] text-zinc-400 uppercase tracking-widest leading-relaxed">
                    Your data is encrypted and stored securely. We use biometric matching to verify your identity instantly.
                  </p>
                </div>

                <div className="flex gap-4 pt-8">
                  <button onClick={() => setStep('business')} className="flex-1 py-4 border border-zinc-100 font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-50 transition-all">Back</button>
                  <button 
                    onClick={() => nextStep('bank')} 
                    disabled={!idPhoto || !selfiePhoto}
                    className="flex-[2] py-4 bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-quirky transition-all disabled:bg-zinc-100 disabled:text-zinc-300"
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
            >
              <h2 className="text-2xl font-bold tracking-tighter mb-8 uppercase">Payout Settings</h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Bank Name</label>
                  <select className="w-full p-4 bg-zinc-50 border border-zinc-100 focus:border-black outline-none transition-all text-xs font-bold appearance-none">
                    <option>FNB</option>
                    <option>Standard Bank</option>
                    <option>Absa</option>
                    <option>Nedbank</option>
                    <option>Capitec</option>
                    <option>TymeBank</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Account Number</label>
                  <input type="text" className="w-full p-4 bg-zinc-50 border border-zinc-100 focus:border-black outline-none transition-all text-xs font-bold" placeholder="0000000000" />
                </div>
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">Account Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button className="p-4 border border-black text-[10px] font-bold uppercase tracking-widest">Savings</button>
                    <button className="p-4 border border-zinc-100 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:border-black hover:text-black transition-all">Cheque</button>
                  </div>
                </div>

                <div className="flex gap-4 pt-8">
                  <button onClick={() => setStep('identity')} className="flex-1 py-4 border border-zinc-100 font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-50 transition-all">Back</button>
                  <button onClick={() => nextStep('success')} className="flex-[2] py-4 bg-black text-white font-bold uppercase tracking-widest text-[10px] hover:bg-quirky transition-all">Complete Setup</button>
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
              <div className="w-24 h-24 bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h1 className="text-4xl font-bold tracking-tighter mb-4 uppercase">You're All Set!</h1>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-12 leading-relaxed">
                Your seller account is now active. <br />
                Start listing products and earning.
              </p>

              <div className="p-8 bg-zinc-50 border border-zinc-100 mb-12 text-left">
                <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4">Next Steps</h3>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3 text-[8px] font-bold uppercase tracking-widest text-zinc-500">
                    <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[6px]">1</div>
                    List your first product
                  </li>
                  <li className="flex items-center gap-3 text-[8px] font-bold uppercase tracking-widest text-zinc-500">
                    <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[6px]">2</div>
                    Set up your store profile
                  </li>
                  <li className="flex items-center gap-3 text-[8px] font-bold uppercase tracking-widest text-zinc-500">
                    <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[6px]">3</div>
                    Connect social accounts
                  </li>
                </ul>
              </div>

              <button 
                onClick={() => navigate('/admin/intake')}
                className="w-full py-5 bg-black text-white font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-quirky transition-all"
              >
                Go to Product Intake
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-black" />
              <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-zinc-400">Processing with Aura Vision...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
