import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product, Campaign } from '../../types';
import { suggestCampaign } from '../../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Send, CheckCircle2, TrendingUp, Megaphone } from 'lucide-react';
import { cn } from '../../lib/utils';

import { handleFirestoreError, OperationType } from '../../firebase';

export default function CampaignManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const unsubscribeCampaigns = onSnapshot(collection(db, 'campaigns'), (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'campaigns');
    });

    return () => {
      unsubscribe();
      unsubscribeCampaigns();
    };
  }, []);

  const handleSuggest = async () => {
    if (products.length === 0) {
      alert('Need approved products to suggest a campaign.');
      return;
    }
    setLoading(true);
    try {
      const result = await suggestCampaign(products.slice(0, 5));
      setSuggestion(result);
    } catch (err) {
      console.error(err);
      alert('AI failed to suggest a campaign.');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!suggestion) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'campaigns'), {
        title: suggestion.title,
        description: suggestion.description,
        suggestedProducts: suggestion.featuredProductIds,
        type: 'sale',
        status: 'active',
        createdAt: new Date().toISOString()
      });
      setSuggestion(null);
      alert('Campaign launched successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to launch campaign.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-16">
        <div>
          <h1 className="text-5xl font-bold tracking-tighter mb-2 text-black uppercase">Campaign Automation</h1>
          <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.3em]">Aura AI analyzes top sellers to suggest strategies.</p>
        </div>
        <button
          onClick={handleSuggest}
          disabled={loading}
          className="px-8 py-4 bg-black text-white rounded-none font-bold uppercase tracking-[0.3em] text-[10px] flex items-center gap-3 hover:bg-zinc-800 transition-all disabled:opacity-50 shadow-xl shadow-black/10"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Suggestion
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <div className="lg:col-span-2 space-y-12">
          <AnimatePresence mode="wait">
            {suggestion ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-12 bg-white rounded-none border border-zinc-100 shadow-2xl shadow-zinc-100/50"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 bg-black rounded-none flex items-center justify-center text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-[8px] font-bold tracking-[0.3em] uppercase text-zinc-400">Aura AI Suggestion</span>
                </div>

                <h2 className="text-4xl font-bold mb-6 uppercase tracking-tight leading-tight">{suggestion.title}</h2>
                <p className="text-zinc-500 text-xs mb-10 leading-relaxed font-medium">{suggestion.description}</p>

                <div className="bg-zinc-50 p-8 rounded-none border border-zinc-100 mb-10">
                  <h4 className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.3em] mb-4">Strategy Details</h4>
                  <p className="text-zinc-600 italic text-sm font-medium">"{suggestion.strategy}"</p>
                </div>

                <div className="flex gap-6">
                  <button
                    onClick={handleLaunch}
                    className="flex-1 py-5 bg-black text-white rounded-none font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-zinc-800 transition-all shadow-xl shadow-black/10"
                  >
                    Launch Campaign
                  </button>
                  <button
                    onClick={() => setSuggestion(null)}
                    className="px-10 py-5 bg-zinc-100 text-zinc-400 rounded-none font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-zinc-200 transition-all"
                  >
                    Discard
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="p-24 text-center border border-zinc-100 rounded-none bg-zinc-50 border-dashed">
                <TrendingUp className="w-12 h-12 mx-auto mb-6 text-zinc-200" />
                <h3 className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.3em]">No active suggestions</h3>
              </div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-black mb-8 border-b border-zinc-100 pb-4">Active Campaigns</h3>
            {campaigns.length === 0 ? (
              <p className="text-zinc-300 text-[8px] font-bold uppercase tracking-[0.3em]">No campaigns active.</p>
            ) : (
              <div className="space-y-4">
                {campaigns.map(c => (
                  <div key={c.id} className="p-6 bg-white rounded-none border border-zinc-100 flex items-center justify-between hover:border-black transition-all group">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-widest">{c.title}</h4>
                      <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-[0.2em] mt-1">{c.status} • {c.type}</p>
                    </div>
                    <div className="flex items-center gap-3 text-black">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Running</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="p-8 bg-white rounded-none border border-zinc-100 shadow-xl shadow-zinc-100/50">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-8">Market Insights</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-none border border-zinc-100">
                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-[0.2em]">CPT Trend</span>
                <span className="text-[10px] font-bold text-black uppercase tracking-tight">+14% Growth</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-none border border-zinc-100">
                <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Top Category</span>
                <span className="text-[10px] font-bold uppercase tracking-tight text-black">Streetwear</span>
              </div>
            </div>
          </div>

          <div className="p-10 bg-black text-white rounded-none relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Megaphone className="w-20 h-20" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-6 relative z-10">Social Reach</h3>
            <p className="text-[10px] text-zinc-400 mb-8 leading-relaxed font-medium relative z-10">TikTok integration is currently analyzing trending sounds for your products.</p>
            <div className="h-1 bg-zinc-800 rounded-none overflow-hidden relative z-10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '65%' }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="h-full bg-white"
              />
            </div>
            <span className="text-[8px] font-bold mt-4 block uppercase tracking-[0.3em] relative z-10">65% Optimized</span>
          </div>
        </div>
      </div>
    </div>
  );
}

