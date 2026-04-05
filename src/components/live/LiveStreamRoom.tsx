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
      setError('Camera or Microphone access denied. These are required to host a live stream.');
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
      <div className="fixed inset-0 bg-black z-[70] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 text-center">
          <X className="w-12 h-12 text-hot mx-auto mb-6" />
          <h2 className="text-2xl font-bold tracking-tighter uppercase mb-4">Permissions Required</h2>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-8 leading-relaxed">
            To host a live auction, you must grant access to your camera and microphone.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all"
          >
            Retry Permissions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[70] flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white overflow-hidden shadow-2xl">
        <div className="aspect-video bg-zinc-900 relative">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale" />
          {!stream && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tighter uppercase mb-2">Ready to go Live?</h2>
          <p className="text-zinc-400 text-[8px] font-bold uppercase tracking-widest mb-8">Check your look and sound before the quirkiness begins.</p>
          <div className="flex gap-4">
            <button 
              onClick={() => stream && onReady(stream)}
              disabled={!stream}
              className="flex-1 py-4 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-quirky transition-all flex items-center justify-center gap-2 disabled:bg-zinc-100 disabled:text-zinc-300"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Streaming
            </button>
          </div>
        </div>
      </div>
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
                  const points = await getHostTalkingPoints(auctionData.product);
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
                  className="bg-white p-4 rounded-none border-l-4 border-quirky shadow-2xl max-w-xs"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-zinc-100 rounded-none overflow-hidden border border-zinc-100">
                      <img src={currentAuction.product?.imageUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-tight truncate">{currentAuction.product?.name}</h4>
                      <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">Current Bid</p>
                      <p className="text-lg font-bold text-black">R{currentAuction.currentBid}</p>
                    </div>
                  </div>
                  <button className="w-full py-3 bg-black text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-quirky transition-all flex items-center justify-center gap-2">
                    <Gavel className="w-3 h-3" />
                    BID R{currentAuction.currentBid + 10}
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

      {/* Chat Area */}
      <div className="w-full md:w-[400px] bg-white flex flex-col border-l border-zinc-100">
        {isHost && talkingPoints && (
          <div className="p-6 bg-black text-white border-b border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-quirky" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.3em]">AI Host Assistant</h3>
            </div>
            <div className="space-y-3">
              {talkingPoints.talkingPoints.map((point, i) => (
                <p key={i} className="text-[10px] text-zinc-400 leading-relaxed">• {point}</p>
              ))}
              <div className="mt-4 p-3 bg-zinc-900 border border-zinc-800 italic text-[10px] text-quirky">
                "{talkingPoints.hypePhrase}"
              </div>
            </div>
          </div>
        )}
        
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400">Live Chat</h3>
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-quirky" />
            <span className="text-[8px] font-bold uppercase tracking-widest text-quirky">Aura AI Moderating</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-tight text-black">{msg.senderName}</span>
                <span className="text-[8px] text-zinc-300 font-bold uppercase tracking-widest">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                </span>
              </div>
              <p className={cn(
                "text-xs leading-relaxed",
                msg.type === 'bid' ? "text-quirky font-bold italic" : "text-zinc-600"
              )}>
                {msg.text}
              </p>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-6 bg-zinc-50 border-t border-zinc-100">
          <div className="flex gap-3">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Say something quirky..."
              className="flex-1 bg-white border border-zinc-200 px-4 py-3 text-xs font-medium focus:outline-none focus:border-quirky transition-colors"
            />
            <button 
              type="submit"
              className="w-12 h-12 bg-black text-white flex items-center justify-center hover:bg-quirky transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
