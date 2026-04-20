import { useState, useEffect } from 'react';
import type { Product, Campaign } from '../../types';
import { subscribeToProductsAdmin } from '../../services/adminProductService';
import { subscribeToCampaignsAdmin, createCampaignAdmin } from '../../services/adminCampaignService';
import { suggestCampaign } from '../../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, CheckCircle2, TrendingUp, Megaphone, Database, ExternalLink } from 'lucide-react';

export default function CampaignManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [setupSql, setSetupSql] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ title: string; description: string; strategy: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  useEffect(() => {
    const unsubProducts = subscribeToProductsAdmin('approved', setProducts);
    const unsubCampaigns = subscribeToCampaignsAdmin(undefined, (c, exists, sql) => {
      setCampaigns(c);
      setTableExists(exists);
      if (sql) setSetupSql(sql);
    });
    return () => { unsubProducts(); unsubCampaigns(); };
  }, []);

  const handleSuggest = async () => {
    if (products.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      setSuggestion(await suggestCampaign(products.slice(0, 5)));
    } catch (e: any) {
      setError(e?.message || 'Failed to generate suggestion');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!suggestion) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createCampaignAdmin({
        title: suggestion.title,
        description: suggestion.description,
        strategy: suggestion.strategy,
        type: 'sale',
        status: 'active',
      });
      if (result.setupRequired) {
        setTableExists(false);
        if (result.setupSql) setSetupSql(result.setupSql);
        setError('Campaigns table not set up yet — see the setup panel below.');
      } else if (result.error) {
        setError(result.error);
      } else {
        setSuggestion(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const copySql = () => {
    if (!setupSql) return;
    navigator.clipboard.writeText(setupSql).then(() => {
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Campaign Automation</h1>
          <p className="text-gray-400 text-sm mt-0.5">Aura AI analyses top sellers to suggest strategies.</p>
        </div>
        <button
          onClick={handleSuggest}
          disabled={loading || products.length === 0}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Suggestion
        </button>
      </div>

      {/* Setup banner — shown when table is confirmed missing */}
      {tableExists === false && setupSql && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">One-time database setup required</p>
              <p className="text-xs text-amber-700 mt-1">Copy this SQL and run it in your Supabase SQL editor once to enable campaigns.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={copySql}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors">
                  {sqlCopied ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copied!</> : 'Copy SQL'}
                </button>
                <a href="https://supabase.com/dashboard/project/mvoigokzsaybwiogjpvr/sql/new"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50 transition-colors">
                  Open SQL Editor <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <pre className="mt-3 text-[10px] text-amber-800 bg-amber-100 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-48">
                {setupSql}
              </pre>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">{error}</div>
          )}

          <AnimatePresence mode="wait">
            {suggestion ? (
              <motion.div key="suggestion"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                    style={{ background: 'var(--gradient-primary)' }}>
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="section-label">Aura AI Suggestion</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{suggestion.title}</h2>
                <p className="text-gray-500 text-sm mb-5 leading-relaxed">{suggestion.description}</p>
                {suggestion.strategy && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-5">
                    <p className="section-label mb-2">Strategy</p>
                    <p className="text-gray-700 text-sm leading-relaxed">"{suggestion.strategy}"</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={handleLaunch} disabled={loading}
                    className="btn-primary flex-1 justify-center py-3 disabled:opacity-50">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Launching…</> : 'Launch Campaign'}
                  </button>
                  <button onClick={() => setSuggestion(null)}
                    className="btn-secondary px-6 py-3 justify-center">
                    Discard
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-gray-300" />
                </div>
                <p className="section-label">No active suggestions</p>
                {products.length === 0 && tableExists !== false && (
                  <p className="text-xs text-gray-400 mt-1">Add approved products to generate a suggestion</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <p className="section-label mb-3">Active Campaigns</p>
            {tableExists === false ? (
              <p className="text-gray-400 text-sm">Complete setup above to enable campaigns.</p>
            ) : campaigns.length === 0 ? (
              <p className="text-gray-400 text-sm">No campaigns active.</p>
            ) : (
              <div className="space-y-2">
                {campaigns.map(c => (
                  <div key={c.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-900">{c.title}</h4>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{c.status} · {c.type}</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-100 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs font-medium text-green-700">Running</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="section-label mb-4">Market Insights</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <span className="text-xs text-gray-500">CPT Trend</span>
                <span className="text-sm font-semibold text-gray-900">+14% Growth</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-gray-500">Top Category</span>
                <span className="text-sm font-semibold text-gray-900">Streetwear</span>
              </div>
            </div>
          </div>

          <div className="p-5 text-white rounded-2xl relative overflow-hidden noise"
            style={{ background: 'var(--gradient-primary)' }}>
            <div className="absolute -top-4 -right-4 opacity-10">
              <Megaphone className="w-24 h-24" />
            </div>
            <p className="section-label text-white/70 mb-2 relative z-10">Social Reach</p>
            <p className="text-xs text-white/80 mb-4 leading-relaxed relative z-10">
              TikTok integration is analysing trending sounds for your products.
            </p>
            <div className="h-1 bg-white/20 rounded-full overflow-hidden relative z-10">
              <motion.div initial={{ width: 0 }} animate={{ width: '65%' }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="h-full bg-white rounded-full" />
            </div>
            <span className="text-xs text-white/70 mt-2 block relative z-10">65% Optimised</span>
          </div>
        </div>
      </div>
    </div>
  );
}
