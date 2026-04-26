import { useState } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Send, CreditCard, Truck, CheckCircle2, Zap, Sparkles, RotateCcw, ExternalLink, Webhook } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'aura' | 'system';
  timestamp: string;
  type?: 'text' | 'payment' | 'delivery';
}

const DEMO_STEPS = [
  { label: 'Confirm Availability', response: 'Great! I want to buy it.' },
  { label: 'Send Payment Link', response: 'Payment received. R1,250.00' },
  { label: 'Select Delivery', response: 'Delivery set to: Cape Town City Bowl' },
  { label: 'Complete Order', response: 'Order #AURA-9921 confirmed.' },
] as const;

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: 'TikTok Sale Detected: "Vintage Leather Jacket" via @AuraStyle', sender: 'system', timestamp: new Date().toLocaleTimeString() },
  { id: '2', text: 'Routing to WhatsApp…', sender: 'system', timestamp: new Date().toLocaleTimeString() },
  { id: '3', text: 'Hi! I saw your jacket on TikTok. Is it still available?', sender: 'user', timestamp: new Date().toLocaleTimeString() },
  { id: '4', text: 'Hi there! Yes, it is. Aura AI has verified the condition. Would you like to proceed with the purchase?', sender: 'aura', timestamp: new Date().toLocaleTimeString() },
];

export default function SocialIntegration() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleNextStep = () => {
    if (step >= DEMO_STEPS.length || loading) return;
    setLoading(true);

    setTimeout(() => {
      const userMsg: Message = {
        id: Math.random().toString(),
        text: DEMO_STEPS[step].response,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages(prev => [...prev, userMsg]);
      const nextStep = step + 1;
      setStep(nextStep);
      setLoading(false);

      setTimeout(() => {
        let auraText = '';
        let type: 'text' | 'payment' | 'delivery' = 'text';

        if (step === 0) { auraText = 'Perfect. I am sending a secure payment link now.'; type = 'payment'; }
        else if (step === 1) { auraText = 'Payment confirmed! Please select your delivery option.'; type = 'delivery'; }
        else if (step === 2) { auraText = 'All set. Your order is being processed for delivery tomorrow.'; }
        else if (step === 3) {
          auraText = 'Order complete! Thank you for shopping with Quirkify. Your tracking number will arrive shortly.';
          setCompleted(true);
        }

        if (auraText) {
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            text: auraText,
            sender: 'aura',
            timestamp: new Date().toLocaleTimeString(),
            type,
          }]);
        }
      }, 1000);
    }, 800);
  };

  const handleReset = () => {
    setMessages(INITIAL_MESSAGES);
    setStep(0);
    setLoading(false);
    setCompleted(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-800 font-medium">
          <span className="font-bold">Coming Soon —</span> TikTok and WhatsApp APIs are not yet connected. The webhook endpoint is live at <code className="font-mono bg-amber-100 px-1 rounded">/api/social/webhook</code>. This is an interactive preview of the planned flow.
        </p>
      </div>

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Social Commerce</h1>
          <p className="text-gray-400 text-sm mt-0.5">TikTok sales routed to WhatsApp with automated Aura AI.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat simulator */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col h-[600px] shadow-sm">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ background: 'var(--gradient-primary)' }}>
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">WhatsApp Business</p>
                  <p className="text-xs text-gray-400">Aura AI Active</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {completed && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 border border-gray-200 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-full">
                  <div className={cn('w-1.5 h-1.5 rounded-full', completed ? 'bg-green-500' : 'bg-blue-400 animate-pulse')} />
                  <span className="text-xs font-medium text-gray-500">{completed ? 'Order Complete' : 'Live Session'}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'max-w-[80%] px-4 py-3 rounded-2xl text-sm',
                    msg.sender === 'user'
                      ? 'bg-gray-50 ml-auto border border-gray-100 text-gray-800'
                      : msg.sender === 'aura'
                      ? 'text-white'
                      : 'bg-amber-50 mx-auto border border-amber-100 text-amber-700 text-xs text-center py-2 px-5'
                  )}
                  style={msg.sender === 'aura' ? { background: 'var(--gradient-primary)' } : {}}
                >
                  {msg.text}
                  {msg.type === 'payment' && (
                    <div className="mt-3 p-3 bg-white/20 rounded-xl border border-white/30 flex items-center justify-between cursor-pointer hover:bg-white/30 transition-all">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span className="font-semibold text-sm">Pay R1,250.00</span>
                      </div>
                      <span className="text-xs font-medium underline opacity-80">Secure Checkout</span>
                    </div>
                  )}
                  {msg.type === 'delivery' && (
                    <div className="mt-3 p-3 bg-white/20 rounded-xl border border-white/30 flex items-center justify-between cursor-pointer hover:bg-white/30 transition-all">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        <span className="font-semibold text-sm">Standard Delivery</span>
                      </div>
                      <span className="text-xs font-medium opacity-80">R50.00</span>
                    </div>
                  )}
                  <span className="block text-[10px] mt-2 opacity-50">{msg.timestamp}</span>
                </motion.div>
              ))}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <div className="flex gap-3">
                <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-400 flex items-center">
                  {completed ? 'Order completed — reset to replay' : 'Aura AI is responding…'}
                </div>
                <button className="btn-primary px-4">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Simulation controls */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="section-label mb-4">Demo Flow Controls</p>
            <div className="space-y-2">
              {DEMO_STEPS.map((s, i) => (
                <button
                  key={i}
                  onClick={handleNextStep}
                  disabled={step !== i || loading || completed}
                  className={cn(
                    'w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all text-sm font-medium',
                    step === i && !completed
                      ? 'text-white border-transparent'
                      : step > i || completed
                      ? 'bg-gray-50 border-gray-100 text-gray-400'
                      : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                  )}
                  style={(step === i && !completed) ? { background: 'var(--gradient-primary)' } : {}}
                >
                  <span>{s.label}</span>
                  {step > i || completed
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <Zap className={cn('w-4 h-4', step === i ? 'text-white' : 'text-gray-300')} />}
                </button>
              ))}
            </div>
            {completed && (
              <button
                onClick={handleReset}
                className="w-full mt-3 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-700 py-2 border border-gray-200 rounded-xl transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Replay Demo
              </button>
            )}
          </div>

          {/* Webhook status */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="section-label mb-4 flex items-center gap-1.5">
              <Webhook className="w-3 h-3" /> Webhook Endpoints
            </p>
            <div className="space-y-3">
              {[
                { name: 'TikTok Events', path: '/api/social/webhook', status: 'ready' },
                { name: 'WhatsApp Messages', path: '/api/social/webhook', status: 'ready' },
              ].map(({ name, path, status }) => (
                <div key={name} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{name}</p>
                    <p className="text-[10px] font-mono text-gray-400">{path}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      status === 'ready' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
                    )}>
                      {status === 'ready' ? 'Endpoint Ready' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-50">
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Configure <code className="font-mono">TIKTOK_WEBHOOK_SECRET</code> and <code className="font-mono">WHATSAPP_APP_SECRET</code> in Vercel env vars to enable signature verification.
                </p>
              </div>
            </div>
          </div>

          {/* TikTok feed preview */}
          <div className="p-4 rounded-2xl relative overflow-hidden noise"
            style={{ background: 'var(--gradient-primary)' }}>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <p className="section-label text-white/70">TikTok Feed</p>
              <button className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white/80 transition-colors">
                <ExternalLink className="w-3 h-3" />
                Connect
              </button>
            </div>
            <div className="relative z-10">
              <div className="aspect-[9/16] bg-black/30 rounded-xl relative overflow-hidden">
                <img
                  src="https://picsum.photos/seed/fashion1/400/700"
                  className="w-full h-full object-cover opacity-70"
                  referrerPolicy="no-referrer"
                  alt=""
                />
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-white/30 backdrop-blur-sm rounded-full" />
                    <span className="text-xs font-semibold text-white">@AuraStyle</span>
                  </div>
                  <p className="text-xs text-white/90 leading-relaxed">Check out our latest vintage drop. Limited stock! #AuraVibes</p>
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] font-bold text-white">42.8k</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] font-bold text-white">1.2k</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
