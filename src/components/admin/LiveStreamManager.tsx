import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Video, Users, MessageCircle, Zap, Play, StopCircle, Settings, Share2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { auth, db, isFirebaseConfigured } from '../../firebase';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';

interface StreamMessage {
  id: string;
  user: string;
  text: string;
  isAI?: boolean;
  createdAt: string;
}

interface StreamSession {
  isLive: boolean;
  viewerCount: number;
  startedAt: string | null;
  hostId: string;
}

export default function LiveStreamManager() {
  const [session, setSession] = useState<StreamSession | null>(null);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [starting, setStarting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewerSimRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubSessionRef = useRef<(() => void) | null>(null);
  const unsubMessagesRef = useRef<(() => void) | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const sessionIdRef = useRef('');
  const viewerCountRef = useRef(0);

  const isLive = session?.isLive ?? false;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (viewerSimRef.current) clearInterval(viewerSimRef.current);
      unsubSessionRef.current?.();
      unsubMessagesRef.current?.();
    };
  }, []);

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const startBroadcast = async () => {
    setStarting(true);
    try {
      const user = auth.currentUser;
      const sessionId = `stream_${Date.now()}`;
      sessionIdRef.current = sessionId;
      viewerCountRef.current = 0;

      if (isFirebaseConfigured) {
        await setDoc(doc(db, 'streamSessions', sessionId), {
          isLive: true,
          viewerCount: 0,
          startedAt: serverTimestamp(),
          hostId: user?.uid ?? 'admin',
          hostName: user?.displayName ?? user?.email ?? 'Host',
          createdAt: serverTimestamp(),
        });

        await addDoc(collection(db, 'streamSessions', sessionId, 'messages'), {
          user: 'Aura AI',
          text: 'Stream is live! Welcome everyone to Quirkify Live.',
          isAI: true,
          createdAt: new Date().toISOString(),
        });

        unsubSessionRef.current = onSnapshot(doc(db, 'streamSessions', sessionId), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            viewerCountRef.current = data.viewerCount ?? 0;
            setSession({
              isLive: data.isLive ?? false,
              viewerCount: data.viewerCount ?? 0,
              startedAt: data.startedAt?.toDate?.()?.toISOString() ?? null,
              hostId: data.hostId ?? '',
            });
          }
        });

        unsubMessagesRef.current = onSnapshot(
          query(
            collection(db, 'streamSessions', sessionId, 'messages'),
            orderBy('createdAt', 'asc'),
            limit(50),
          ),
          (snap) => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as StreamMessage)));
          }
        );

        viewerSimRef.current = setInterval(async () => {
          const delta = Math.floor(Math.random() * 6) - 1;
          const next = Math.max(0, viewerCountRef.current + delta);
          viewerCountRef.current = next;
          try {
            await updateDoc(doc(db, 'streamSessions', sessionId), { viewerCount: next });
          } catch { /* ignore — session may have ended */ }
        }, 8000);
      } else {
        setSession({ isLive: true, viewerCount: 47, startedAt: new Date().toISOString(), hostId: 'local' });
        setMessages([{
          id: '1',
          user: 'Aura AI',
          text: 'Stream is live! Welcome everyone to Quirkify Live.',
          isAI: true,
          createdAt: new Date().toISOString(),
        }]);
      }

      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    } catch (err) {
      console.error('Failed to start stream:', err);
    } finally {
      setStarting(false);
    }
  };

  const stopBroadcast = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (viewerSimRef.current) clearInterval(viewerSimRef.current);
    unsubSessionRef.current?.();
    unsubMessagesRef.current?.();

    if (isFirebaseConfigured && sessionIdRef.current) {
      try {
        await updateDoc(doc(db, 'streamSessions', sessionIdRef.current), {
          isLive: false,
          endedAt: serverTimestamp(),
        });
      } catch { /* ignore */ }
    }

    setSession(null);
    setMessages([]);
    setElapsedSeconds(0);
    sessionIdRef.current = '';
    viewerCountRef.current = 0;
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !isLive) return;
    const text = messageText.trim();
    setMessageText('');

    const msgData = {
      user: auth.currentUser?.displayName ?? auth.currentUser?.email ?? 'Host',
      text,
      isAI: false,
      createdAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && sessionIdRef.current) {
      try {
        await addDoc(collection(db, 'streamSessions', sessionIdRef.current, 'messages'), msgData);
      } catch { /* ignore */ }
    } else {
      setMessages(prev => [...prev, { id: Math.random().toString(), ...msgData }]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {!isLive && (
        <div className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            <span className="font-bold">Preview Mode —</span> Stream sessions are stored in Firestore with real-time chat. Camera feed requires a WebRTC server integration.
          </p>
        </div>
      )}

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
              <span className="font-medium">{session?.viewerCount ?? 0} Viewers</span>
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
                  onClick={startBroadcast}
                  disabled={starting}
                  className="btn-primary px-8 py-3 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {starting ? 'Starting…' : 'Start Broadcast'}
                </button>
              </div>
            ) : (
              <>
                <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/10">
                      <Video className="w-10 h-10 text-white/30" />
                    </div>
                    <p className="text-white/20 text-sm">Camera feed not connected</p>
                  </div>
                </div>
                <div className="absolute top-4 left-4 flex gap-2">
                  <div className="px-3 py-1 bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 rounded-full">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    LIVE
                  </div>
                  <div className="px-3 py-1 bg-black/40 backdrop-blur-md text-white text-xs font-medium rounded-full">
                    {formatElapsed(elapsedSeconds)}
                  </div>
                </div>
                <div className="absolute bottom-4 right-4">
                  <button
                    onClick={stopBroadcast}
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
              <span className="text-xs text-gray-400 font-medium">{messages.length} Messages</span>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-xs text-gray-300 text-center mt-8 leading-relaxed">
                Go live to start real-time chat.<br />Messages are stored in Firestore.
              </p>
            )}
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-3 rounded-xl text-sm',
                  msg.isAI ? 'text-white' : 'bg-gray-50 border border-gray-100 text-gray-800'
                )}
                style={msg.isAI ? { background: 'var(--gradient-primary)' } : {}}
              >
                <span className={cn('font-semibold text-xs block mb-0.5', msg.isAI ? 'text-white/70' : 'text-gray-500')}>
                  {msg.user}
                </span>
                {msg.text}
              </motion.div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder={isLive ? 'Type a message…' : 'Go live to chat…'}
                disabled={!isLive}
                className="input flex-1 py-2 text-sm disabled:opacity-40"
              />
              <button
                onClick={sendMessage}
                disabled={!isLive || !messageText.trim()}
                className="btn-primary px-3 py-2 disabled:opacity-40"
              >
                <Zap className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
