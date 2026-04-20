import { useState } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Send, CreditCard, Truck, CheckCircle2, Zap, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'aura' | 'system';
  timestamp: string;
  type?: 'text' | 'payment' | 'delivery';
}

export default function SocialIntegration() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'TikTok Sale Detected: "Vintage Leather Jacket" via @AuraStyle', sender: 'system', timestamp: new Date().toLocaleTimeString() },
    { id: '2', text: 'Routing to WhatsApp...', sender: 'system', timestamp: new Date().toLocaleTimeString() },
    { id: '3', text: 'Hi! I saw your jacket on TikTok. Is it still available?', sender: 'user', timestamp: new Date().toLocaleTimeString() },
    { id: '4', text: 'Hi there! Yes, it is. Aura AI has verified the condition. Would you like to proceed with the purchase?', sender: 'aura', timestamp: new Date().toLocaleTimeString() },
  ]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const steps = [
    { text: 'Confirm Availability', response: 'Great! I want to buy it.' },
    { text: 'Send Payment Link', response: 'Payment received. R1,250.00' },
    { text: 'Select Delivery', response: 'Delivery set to: Cape Town City Bowl' },
    { text: 'Complete Order', response: 'Order #AURA-9921 confirmed.' }
  ];

  const handleNextStep = () => {
    if (step >= steps.length) return;
    setLoading(true);

    setTimeout(() => {
      const userMsg: Message = {
        id: Math.random().toString(),
        text: steps[step].response,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, userMsg]);
      setStep(prev => prev + 1);
      setLoading(false);

      setTimeout(() => {
        let auraText = '';
        let type: 'text' | 'payment' | 'delivery' = 'text';

        if (step === 0) { auraText = 'Perfect. I am sending a secure payment link now.'; type = 'payment'; }
        else if (step === 1) { auraText = 'Payment confirmed! Please select your delivery option.'; type = 'delivery'; }
        else if (step === 2) { auraText = 'All set. Your order is being processed for delivery tomorrow.'; }

        if (auraText) {
          setMessages(prev => [...prev, {
            id: Math.random().toString(),
            text: auraText,
            sender: 'aura',
            timestamp: new Date().toLocaleTimeString(),
            type
          }]);
        }
      }, 1000);
    }, 800);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-800 font-medium">
          <span className="font-bold">Coming Soon —</span> TikTok and WhatsApp APIs are not yet connected. This is an interactive preview of the planned Social Commerce flow.
        </p>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Social Commerce</h1>
        <p className="text-gray-400 text-sm mt-0.5">TikTok sales routed to WhatsApp with automated Aura AI.</p>
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
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-full">
                <div className="live-dot" />
                <span className="text-xs font-medium text-gray-500">Live Session</span>
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
                  Aura AI is responding...
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
            <p className="section-label mb-4">Simulation Controls</p>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={handleNextStep}
                  disabled={step !== i || loading}
                  className={cn(
                    'w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all text-sm font-medium',
                    step === i
                      ? 'text-white border-transparent'
                      : step > i
                      ? 'bg-gray-50 border-gray-100 text-gray-400'
                      : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                  )}
                  style={step === i ? { background: 'var(--gradient-primary)' } : {}}
                >
                  <span>{s.text}</span>
                  {step > i
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <Zap className={cn('w-4 h-4', step === i ? 'text-white' : 'text-gray-300')} />}
                </button>
              ))}
            </div>
          </div>

          {/* TikTok feed preview */}
          <div className="p-4 rounded-2xl relative overflow-hidden noise"
            style={{ background: 'var(--gradient-primary)' }}>
            <p className="section-label text-white/70 mb-3 relative z-10">TikTok Feed</p>
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
