import { useState } from 'react';
import { motion } from 'motion/react';
import { Video, Users, MessageCircle, Zap, Play, StopCircle, Settings, Share2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function LiveStreamManager() {
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-black uppercase">Live Stream Studio</h1>
          <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold">Broadcast your products to the world in real-time.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-none border transition-all",
            isLive ? "bg-red-50 border-red-100 text-red-600" : "bg-zinc-50 border-zinc-100 text-zinc-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", isLive ? "bg-red-600 animate-pulse" : "bg-zinc-300")} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{isLive ? 'LIVE' : 'OFFLINE'}</span>
          </div>
          {isLive && (
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-none">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{viewerCount} Viewers</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-6">
          <div className="aspect-video bg-black rounded-none relative overflow-hidden group border border-zinc-100 shadow-2xl">
            {!isLive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                <div className="w-20 h-20 bg-zinc-900 rounded-none flex items-center justify-center mb-6 border border-zinc-800">
                  <Video className="w-10 h-10 text-zinc-700" />
                </div>
                <h3 className="text-white text-sm font-bold uppercase tracking-[0.3em] mb-4">Ready to go live?</h3>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest max-w-xs mx-auto leading-relaxed mb-8">
                  Connect your camera and microphone to start broadcasting your latest drops to the Quirkify community.
                </p>
                <button 
                  onClick={() => {
                    setIsLive(true);
                    setViewerCount(Math.floor(Math.random() * 100) + 50);
                  }}
                  className="px-12 py-4 bg-white text-black text-[10px] font-bold uppercase tracking-[0.4em] hover:bg-zinc-100 transition-all flex items-center gap-3"
                >
                  <Play className="w-4 h-4" />
                  Start Broadcast
                </button>
              </div>
            ) : (
              <>
                <img 
                  src="https://picsum.photos/seed/stream/1920/1080" 
                  className="w-full h-full object-cover opacity-80" 
                  alt="Stream Preview"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-6 left-6 flex gap-3">
                  <div className="px-3 py-1 bg-red-600 text-white text-[8px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                    LIVE
                  </div>
                  <div className="px-3 py-1 bg-black/50 backdrop-blur-md text-white text-[8px] font-bold uppercase tracking-widest">
                    00:42:15
                  </div>
                </div>
                <div className="absolute bottom-6 right-6">
                  <button 
                    onClick={() => setIsLive(false)}
                    className="p-3 bg-red-600 text-white hover:bg-red-700 transition-all"
                  >
                    <StopCircle className="w-6 h-6" />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-6">
            <button className="p-6 bg-white border border-zinc-100 rounded-none hover:border-black transition-all group text-left">
              <Settings className="w-5 h-5 text-zinc-400 group-hover:text-black mb-4" />
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-1">Stream Settings</h4>
              <p className="text-[8px] text-zinc-400 uppercase tracking-widest">Configure audio/video</p>
            </button>
            <button className="p-6 bg-white border border-zinc-100 rounded-none hover:border-black transition-all group text-left">
              <Share2 className="w-5 h-5 text-zinc-400 group-hover:text-black mb-4" />
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-1">Share Stream</h4>
              <p className="text-[8px] text-zinc-400 uppercase tracking-widest">Invite your audience</p>
            </button>
            <button className="p-6 bg-white border border-zinc-100 rounded-none hover:border-black transition-all group text-left">
              <Sparkles className="w-5 h-5 text-zinc-400 group-hover:text-black mb-4" />
              <h4 className="text-[10px] font-bold uppercase tracking-widest mb-1">AI Enhancements</h4>
              <p className="text-[8px] text-zinc-400 uppercase tracking-widest">Auto-highlight products</p>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-zinc-100 rounded-none flex flex-col h-[600px] shadow-sm">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-widest">Live Chat</h3>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-zinc-400" />
                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">42 New</span>
              </div>
            </div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-zinc-50/30">
              {[
                { user: 'Sarah M.', text: 'Is the leather jacket still available?' },
                { user: 'John D.', text: 'Love the vintage vibes today!' },
                { user: 'Aura AI', text: 'Yes Sarah! Only 2 units left in stock.', system: true },
                { user: 'Mike R.', text: 'Just copped the sneakers, fire!' },
              ].map((msg, i) => (
                <div key={i} className={cn(
                  "p-3 rounded-none text-[10px] leading-relaxed",
                  msg.system ? "bg-black text-white" : "bg-white border border-zinc-100"
                )}>
                  <span className={cn("font-bold uppercase tracking-widest block mb-1", msg.system ? "text-zinc-500" : "text-black")}>
                    {msg.user}
                  </span>
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-100">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-50 border border-zinc-100 px-4 py-2 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-black"
                />
                <button className="p-2 bg-black text-white">
                  <Zap className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
