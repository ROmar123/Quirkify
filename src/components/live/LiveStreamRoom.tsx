import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { LiveSession, ChatMessage, Auction } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Users, Heart, Share2, X, Gavel, TrendingUp, Sparkles, Camera, Mic, MicOff, CameraOff, Play } from 'lucide-react';
import { cn } from '../../lib/utils';

import { getHostTalkingPoints } from '../../services/hostService';

function HostSetup({ onReady }: { onReady: (stream: MediaStream) => void }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startSetup = async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Host setup error:', err);
      setError('Camera or microphone access denied. Grant permissions to host a live stream.');
    }
  };

  useEffect(() => {
    startSetup();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full bg-white rounded-2xl p-8 text-center shadow-2xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <X className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Permissions Required</h2>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full py-3 justify-center">
            Retry Permissions
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="aspect-video bg-gray-900 relative">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!stream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full animate-spin"
                style={{ border: '2.5px solid rgba(255,255,255,0.2)', borderTopColor: '#fff' }} />
              <p className="text-white/60 text-xs font-medium">Accessing camera…</p>
            </div>
          )}
        </div>
        <div className="p-6 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Ready to go live?</h2>
          <p className="text-gray-400 text-xs mb-5">Check your look before the session begins.</p>
          <button
            onClick={() => stream && onReady(stream)}
            disabled={!stream}
            className="btn-primary w-full py-3 justify-center disabled:opacity-40"
          >
            <Play className="w-4 h-4 fill-current" />
            Start Streaming
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function LiveStreamRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentAuction, setCurrentAuction] = useState<Auction | null>(null);
  const [likes, setLikes] = useState(0);
  const [talkingPoints, setTalkingPoints] = useState<{ talkingPoints: string[], hypePhrase: string } | null>(null);
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hostVideoRef = useRef<HTMLVideoElement>(null);

  const isHost = auth.currentUser?.uid === session?.hostId;

  useEffect(() => {
    if (isReady && hostStream && hostVideoRef.current) {
      hostVideoRef.current.srcObject = hostStream;
    }
  }, [isReady, hostStream]);

  useEffect(() => {
    if (!sessionId) return;

    // Fetch session
    const sessionRef = doc(db, 'live_sessions', sessionId);
    let unsubscribeAuction: (() => void) | null = null;

    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const sessionData = { id: docSnap.id, ...docSnap.data() } as LiveSession;
        setSession(sessionData);

        // If there's a current auction, fetch it
        if (sessionData.currentAuctionId) {
          // Clean up previous auction listener if exists
          if (unsubscribeAuction) {
            unsubscribeAuction();
          }

          const auctionRef = doc(db, 'auctions', sessionData.currentAuctionId);
          unsubscribeAuction = onSnapshot(auctionRef, async (auctionSnap) => {
            if (auctionSnap.exists()) {
              const auctionData = { id: auctionSnap.id, ...auctionSnap.data() } as Auction;
              setCurrentAuction(auctionData);

              // Get AI talking points if host
              if (auth.currentUser?.uid === sessionData.hostId && auctionData.product) {
                try {
                  const points = await getHostTalkingPoints(
                    auctionData.product.name,
                    auctionData.product.category || 'General'
                  );
                  setTalkingPoints(points);
                } catch (err) {
                  console.error('Failed to get talking points:', err);
                }
              }
            }
          }, (error) => {
            console.error('Error fetching auction:', error);
          });
        } else {
          // No active auction, clean up listener if exists
          if (unsubscribeAuction) {
            unsubscribeAuction();
            unsubscribeAuction = null;
          }
        }
      } else {
        navigate('/auctions');
      }
    }, (error) => {
      console.error('Error fetching session:', error);
    });

    // Fetch chat messages
    const q = query(
      collection(db, 'live_sessions', sessionId, 'chat'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribeChat = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
    }, (error) => {
      console.error('Error fetching chat messages:', error);
    });

    return () => {
      unsubscribeSession();
      unsubscribeChat();
      if (unsubscribeAuction) {
        unsubscribeAuction();
      }
    };
  }, [sessionId, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || !sessionId) return;

    try {
      await addDoc(collection(db, 'live_sessions', sessionId, 'chat'), {
        sessionId,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Anonymous',
        text: newMessage,
        timestamp: serverTimestamp(),
        type: 'text'
      });
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleLike = () => {
    setLikes(prev => prev + 1);
    // In a real app, we'd sync this to Firestore
  };

  if (!session) return null;

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col md:flex-row overflow-hidden font-sans">
      {isHost && !isReady && (
        <HostSetup onReady={(stream) => {
          setHostStream(stream);
          setIsReady(true);
        }} />
      )}

      {/* Video Area (Vertical) */}
      <div className="relative flex-1 bg-zinc-900 flex items-center justify-center overflow-hidden">
        {isHost && isReady ? (
          <video 
            ref={hostVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-auto object-cover aspect-[9/16] shadow-2xl grayscale"
          />
        ) : (
          <img 
            src={session.thumbnailUrl || `https://picsum.photos/seed/${sessionId}/1080/1920`} 
            className="h-full w-auto object-cover aspect-[9/16] shadow-2xl"
            referrerPolicy="no-referrer"
            alt="Live Stream"
          />
        )}
        
        {/* Overlays */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
          {/* Top Bar */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-2 pr-4 rounded-full border border-white/10">
              <div className="w-10 h-10 rounded-full bg-quirky flex items-center justify-center text-white font-bold">
                {session.hostName[0]}
              </div>
              <div>
                <p className="text-[10px] font-bold text-white uppercase tracking-widest">{session.hostName}</p>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[8px] text-white/60 font-bold uppercase tracking-widest">LIVE</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-black/40 backdrop-blur-md px-3 py-2 rounded-full border border-white/10 flex items-center gap-2">
                <Users className="w-3 h-3 text-white" />
                <span className="text-[10px] font-bold text-white">{session.viewerCount + likes}</span>
              </div>
              <button 
                onClick={() => navigate('/auctions')}
                className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-white/20 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bottom Overlay (Auction Info) */}
          <div className="space-y-4 pointer-events-auto">
            <AnimatePresence>
              {currentAuction && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border-l-4 border-purple-500 shadow-2xl max-w-xs"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      {currentAuction.product?.imageUrl && (
                        <img src={currentAuction.product.imageUrl} className="w-full h-full object-cover" alt="" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-gray-900 truncate">{currentAuction.product?.name}</h4>
                      <p className="text-[10px] text-gray-400">Current Bid</p>
                      <p className="text-lg font-bold text-gray-900">R{currentAuction.currentBid}</p>
                    </div>
                  </div>
                  <button className="btn-primary w-full py-2 justify-center text-sm">
                    <Gavel className="w-3.5 h-3.5" />
                    Bid R{currentAuction.currentBid + 10}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={handleLike}
                className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-hot hover:border-hot transition-all group"
              >
                <Heart className={cn("w-6 h-6 transition-transform group-active:scale-150", likes > 0 && "fill-current")} />
              </button>
              <button className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-white/20 transition-all">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <div className="w-full md:w-[360px] bg-white flex flex-col border-l border-gray-100">
        {isHost && talkingPoints && (
          <div className="p-4 bg-gray-950 text-white border-b border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-400">AI Host Assistant</span>
            </div>
            <div className="space-y-2">
              {talkingPoints.talkingPoints.map((point, i) => (
                <p key={i} className="text-[11px] text-white/60 leading-relaxed">• {point}</p>
              ))}
              <div className="mt-3 p-2.5 bg-white/5 rounded-lg border border-white/10 text-[11px] text-purple-300 italic">
                "{talkingPoints.hypePhrase}"
              </div>
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="section-label">Live Chat</span>
          <div className="flex items-center gap-1.5">
            <span className="live-dot" />
            <span className="text-[10px] font-semibold text-purple-500">AI Moderating</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id}>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-xs font-semibold text-gray-900">{msg.senderName}</span>
                <span className="text-[10px] text-gray-400">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '…'}
                </span>
              </div>
              <p className={cn(
                'text-xs leading-relaxed',
                msg.type === 'bid' ? 'text-purple-600 font-semibold' : 'text-gray-600'
              )}>
                {msg.text}
              </p>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-3 bg-gray-50 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Say something quirky…"
              className="input flex-1 py-2 text-sm"
            />
            <button
              type="submit"
              className="btn-primary px-3 py-2"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
