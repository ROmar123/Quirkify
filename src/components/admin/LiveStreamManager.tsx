import { useState } from 'react';
import { motion } from 'motion/react';
import { Video, Users, MessageCircle, Zap, Play, StopCircle, Settings, Share2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function LiveStreamManager() {
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Live Stream Studio</h1>
          <p className="text-gray-400 text-sm mt-0.5">Broadcast your products to the world in real-time.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all text-sm font-medium',
            isLive
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-gray-50 border-gray-200 text-gray-500'
          )}>
            <div className={cn('w-1.5 h-1.5 rounded-full', isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-400')} />
            {isLive ? 'LIVE' : 'Offline'}
          </div>
          {isLive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-600">
              <Users className="w-3.5 h-3.5" />
              <span className="font-medium">{viewerCount} Viewers</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Stream preview */}
          <div className="aspect-video bg-gray-900 rounded-2xl relative overflow-hidden shadow-lg">
            {!isLive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 border border-white/20">
                  <Video className="w-8 h-8 text-white/60" />
                </div>
                <h3 className="text-white/90 text-base font-semibold mb-2">Ready to go live?</h3>
                <p className="text-white/50 text-sm max-w-xs mx-auto leading-relaxed mb-6">
                  Connect your camera and microphone to start broadcasting your latest drops.
                </p>
                <button
                  onClick={() => {
                    setIsLive(true);
                    setViewerCount(Math.floor(Math.random() * 100) + 50);
                  }}
                  className="btn-primary px-8 py-3"
                >
                  <Play className="w-4 h-4 fill-current" />
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
                <div className="absolute top-4 left-4 flex gap-2">
                  <div className="px-3 py-1 bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 rounded-full">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    LIVE
                  </div>
                  <div className="px-3 py-1 bg-black/40 backdrop-blur-md text-white text-xs font-medium rounded-full">
                    00:42:15
                  </div>
                </div>
                <div className="absolute bottom-4 right-4">
                  <button
                    onClick={() => setIsLive(false)}
                    className="p-3 bg-red-600 text-white hover:bg-red-700 transition-colors rounded-xl"
                  >
                    <StopCircle className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Settings, label: 'Stream Settings', sub: 'Configure audio/video' },
              { icon: Share2, label: 'Share Stream', sub: 'Invite your audience' },
              { icon: Sparkles, label: 'AI Enhancements', sub: 'Auto-highlight products' },
            ].map(({ icon: Icon, label, sub }) => (
              <button key={label} className="admin-card text-left hover:border-gray-200 transition-all group">
                <Icon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 mb-3 transition-colors" />
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div className="bg-white border border-gray-100 rounded-2xl flex flex-col h-[520px] shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="section-label">Live Chat</span>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-400 font-medium">42 New</span>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {[
              { user: 'Sarah M.', text: 'Is the leather jacket still available?' },
              { user: 'John D.', text: 'Love the vintage vibes today!' },
              { user: 'Aura AI', text: 'Yes Sarah! Only 2 units left in stock.', isAI: true },
              { user: 'Mike R.', text: 'Just copped the sneakers, fire!' },
            ].map((msg, i) => (
              <div key={i} className={cn(
                'p-3 rounded-xl text-sm',
                msg.isAI
                  ? 'text-white'
                  : 'bg-gray-50 border border-gray-100 text-gray-800'
              )}
              style={msg.isAI ? { background: 'var(--gradient-primary)' } : {}}>
                <span className={cn('font-semibold text-xs block mb-0.5', msg.isAI ? 'text-white/70' : 'text-gray-500')}>
                  {msg.user}
                </span>
                {msg.text}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type a message…"
                className="input flex-1 py-2 text-sm"
              />
              <button className="btn-primary px-3 py-2">
                <Zap className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
