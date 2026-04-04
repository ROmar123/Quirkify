import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Product, Campaign } from '../../types';
import { suggestCampaign } from '../../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, CheckCircle2, TrendingUp, Megaphone } from 'lucide-react';

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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-16">
        <div>
          <h1 className="text-5xl font-black tracking-tighter mb-2 text-purple-900 uppercase">Campaign Automation</h1>
          <p className="text-purple-400 text-[10px] font-bold uppercase tracking-[0.3em]">Aura AI analyzes top sellers to suggest strategies.</p>
        </div>
        <button
          onClick={handleSuggest}
          disabled={loading}
          className="px-6 py-3 rounded-full font-bold text-white text-sm flex items-center gap-3 disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
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
                className="p-12 bg-white rounded-3xl border border-purple-100 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div
                    className="w-8 h-8 rounded-2xl flex items-center justify-center text-white"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-[8px] font-bold tracking-[0.3em] uppercase text-purple-400">Aura AI Suggestion</span>
                </div>

                <h2 className="text-4xl font-black mb-6 uppercase tracking-tight leading-tight text-purple-900">{suggestion.title}</h2>
                <p className="text-purple-600 text-xs mb-10 leading-relaxed font-medium">{suggestion.description}</p>

                <div className="bg-purple-50 p-8 rounded-2xl border border-purple-100 mb-10">
                  <h4 className="text-[8px] font-bold text-purple-400 uppercase tracking-[0.3em] mb-4">Strategy Details</h4>
                  <p className="text-purple-700 italic text-sm font-medium">"{suggestion.strategy}"</p>
                </div>

                <div className="flex gap-6">
                  <button
                    onClick={handleLaunch}
                    className="flex-1 px-6 py-3 rounded-full font-bold text-white text-sm hover:opacity-90 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
                  >
                    Launch Campaign
                  </button>
                  <button
                    onClick={() => setSuggestion(null)}
                    className="px-10 py-3 bg-purple-50 text-purple-400 rounded-full font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-purple-100 transition-all border border-purple-100"
                  >
                    Discard
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="p-24 text-center bg-white rounded-3xl border border-purple-100 border-dashed shadow-sm">
                <TrendingUp className="w-12 h-12 mx-auto mb-6 text-purple-200" />
                <h3 className="text-[10px] font-bold text-purple-300 uppercase tracking-[0.3em]">No active suggestions</h3>
              </div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-900 mb-8 border-b border-purple-100 pb-4">Active Campaigns</h3>
            {campaigns.length === 0 ? (
              <p className="text-purple-300 text-[8px] font-bold uppercase tracking-[0.3em]">No campaigns active.</p>
            ) : (
              <div className="space-y-4">
                {campaigns.map(c => (
                  <div key={c.id} className="p-6 bg-white rounded-3xl border border-purple-100 flex items-center justify-between hover:border-purple-300 transition-all shadow-sm">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-widest text-purple-900">{c.title}</h4>
                      <p className="text-[8px] text-purple-400 font-bold uppercase tracking-[0.2em] mt-1">{c.status} • {c.type}</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-100 rounded-full">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-green-600">Running</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="p-8 bg-white rounded-3xl border border-purple-100 shadow-sm">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-400 mb-8">Market Insights</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <span className="text-[8px] text-purple-400 font-bold uppercase tracking-[0.2em]">CPT Trend</span>
                <span className="text-[10px] font-bold text-purple-900 uppercase tracking-tight">+14% Growth</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <span className="text-[8px] text-purple-400 font-bold uppercase tracking-[0.2em]">Top Category</span>
                <span className="text-[10px] font-bold uppercase tracking-tight text-purple-900">Streetwear</span>
              </div>
            </div>
          </div>

          <div
            className="p-10 text-white rounded-3xl relative overflow-hidden group"
            style={{ background: 'linear-gradient(135deg, #F472B6, #A855F7)' }}
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
              <Megaphone className="w-20 h-20" />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-6 relative z-10">Social Reach</h3>
            <p className="text-[10px] text-white/70 mb-8 leading-relaxed font-medium relative z-10">TikTok integration is currently analyzing trending sounds for your products.</p>
            <div className="h-1 bg-white/20 rounded-full overflow-hidden relative z-10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '65%' }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="h-full bg-white rounded-full"
              />
            </div>
            <span className="text-[8px] font-bold mt-4 block uppercase tracking-[0.3em] relative z-10">65% Optimized</span>
          </div>
        </div>
      </div>
    </div>
  );
}
