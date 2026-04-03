import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Send, ShoppingCart, CreditCard, Truck, CheckCircle2, Smartphone, Zap, Sparkles } from 'lucide-react';
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
        
        if (step === 0) {
          auraText = 'Perfect. I am sending a secure payment link now.';
          type = 'payment';
        } else if (step === 1) {
          auraText = 'Payment confirmed! Please select your delivery option.';
          type = 'delivery';
        } else if (step === 2) {
          auraText = 'All set. Your order is being processed for delivery tomorrow.';
        }
        
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
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-16">
        <h1 className="text-5xl font-bold tracking-tighter mb-2 text-black uppercase">Social Commerce</h1>
        <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.3em]">TikTok sales routed to WhatsApp with automated Aura AI.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-none border border-zinc-100 overflow-hidden flex flex-col h-[700px] shadow-2xl shadow-zinc-100/50">
            <div className="p-6 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black rounded-none flex items-center justify-center text-white">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-widest">WhatsApp Business</h3>
                  <p className="text-[8px] text-green-600 font-bold uppercase tracking-[0.3em]">Aura AI Active</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-white border border-zinc-100">
                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-[0.2em]">LIVE SESSION</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-zinc-50/20">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "max-w-[80%] p-5 rounded-none text-[11px] shadow-sm leading-relaxed",
                    msg.sender === 'user' ? "bg-zinc-100 ml-auto border border-zinc-200" : 
                    msg.sender === 'aura' ? "bg-black text-white font-medium" : 
                    "bg-white text-zinc-400 mx-auto text-center border border-zinc-100 text-[8px] uppercase tracking-[0.3em] font-bold py-3 px-8"
                  )}
                >
                  {msg.text}
                  {msg.type === 'payment' && (
                    <div className="mt-4 p-4 bg-white/10 rounded-none border border-white/20 flex items-center justify-between group cursor-pointer hover:bg-white/20 transition-all">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4" />
                        <span className="font-bold tracking-tight">Pay R1,250.00</span>
                      </div>
                      <span className="text-[8px] font-bold underline uppercase tracking-[0.2em]">SECURE CHECKOUT</span>
                    </div>
                  )}
                  {msg.type === 'delivery' && (
                    <div className="mt-4 space-y-3">
                      <div className="p-4 bg-white/10 rounded-none border border-white/20 flex items-center justify-between group cursor-pointer hover:bg-white/20 transition-all">
                        <div className="flex items-center gap-3">
                          <Truck className="w-4 h-4" />
                          <span className="font-bold tracking-tight">Standard Delivery</span>
                        </div>
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">R50.00</span>
                      </div>
                    </div>
                  )}
                  <span className="block text-[8px] mt-3 opacity-40 font-bold uppercase tracking-widest">{msg.timestamp}</span>
                </motion.div>
              ))}
            </div>

            <div className="p-6 bg-zinc-50 border-t border-zinc-100">
              <div className="flex gap-4">
                <div className="flex-1 bg-white border border-zinc-100 rounded-none px-6 py-4 text-[10px] text-zinc-300 font-bold uppercase tracking-[0.3em] flex items-center">
                  Aura AI is responding...
                </div>
                <button className="w-14 h-14 bg-black text-white rounded-none flex items-center justify-center hover:bg-zinc-800 transition-all">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="p-8 bg-white rounded-none border border-zinc-100 shadow-xl shadow-zinc-100/50">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-8">Simulation Controls</h3>
            <div className="space-y-3">
              {steps.map((s, i) => (
                <button
                  key={i}
                  onClick={handleNextStep}
                  disabled={step !== i || loading}
                  className={cn(
                    "w-full p-5 rounded-none border text-left flex items-center justify-between transition-all group",
                    step === i ? "bg-black border-black text-white shadow-xl shadow-black/10" : 
                    step > i ? "bg-zinc-50 border-zinc-100 text-zinc-300" : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-300"
                  )}
                >
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold">{s.text}</span>
                  {step > i ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Zap className={cn("w-4 h-4", step === i ? "text-white" : "text-zinc-200")} />}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8 bg-black text-white rounded-none relative overflow-hidden group">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-8 relative z-10">TikTok Feed</h3>
            <div className="space-y-6 relative z-10">
              <div className="aspect-[9/16] bg-zinc-900 border border-zinc-800 relative overflow-hidden group/video">
                <img 
                  src="https://picsum.photos/seed/fashion1/400/700" 
                  className="w-full h-full object-cover opacity-60 group-hover/video:opacity-100 transition-opacity duration-700 grayscale group-hover/video:grayscale-0" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-white rounded-none" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">@AuraStyle</span>
                  </div>
                  <p className="text-[10px] font-medium leading-relaxed text-zinc-200">Check out our latest vintage drop. Limited stock! #AuraVibes #CapeTownFashion</p>
                </div>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-none flex items-center justify-center border border-white/10">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <span className="text-[8px] font-bold uppercase tracking-widest">42.8k</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-none flex items-center justify-center border border-white/10">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className="text-[8px] font-bold uppercase tracking-widest">1.2k</span>
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


