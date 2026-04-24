import { useState, useEffect } from 'react';
import type { Campaign } from '../../types';
import { supabase } from '../../supabase';
import { subscribeToCampaignsAdmin, createCampaignAdmin } from '../../services/adminCampaignService';
import { suggestCampaign } from '../../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, CheckCircle2, TrendingUp, Megaphone, Database, ExternalLink, Package, BarChart3, AlertTriangle } from 'lucide-react';

interface TopProduct { id: string; name: string; category: string; revenue: number; unitsSold: number }
interface Analytics {
  totalRevenue30d: number;
  topCategory: string;
  topProducts: TopProduct[];
  lowStock: { id: string; name: string; stock: number }[];
}

async function fetchAnalytics(): Promise<Analytics> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: items } = await supabase
    .from('order_items')
    .select('product_id, quantity, unit_price, products(name, category), orders!inner(status, created_at)')
    .gte('orders.created_at', since);

  const productMap: Record<string, TopProduct> = {};
  let totalRevenue30d = 0;

  (items || []).forEach((item: any) => {
    const status = item.orders?.status;
    if (!['paid', 'processing', 'shipped', 'delivered', 'completed'].includes(status)) return;
    const id = item.product_id;
    const revenue = Number(item.unit_price) * Number(item.quantity);
    totalRevenue30d += revenue;
    if (!productMap[id]) {
      productMap[id] = {
        id,
        name: item.products?.name ?? 'Unknown',
        category: item.products?.category ?? '',
        revenue: 0,
        unitsSold: 0,
      };
    }
    productMap[id].revenue += revenue;
    productMap[id].unitsSold += Number(item.quantity);
  });

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const categoryRevenue: Record<string, number> = {};
  topProducts.forEach(p => {
    if (p.category) categoryRevenue[p.category] = (categoryRevenue[p.category] ?? 0) + p.revenue;
  });
  const topCategory = Object.entries(categoryRevenue).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const { data: lowStockData } = await supabase
    .from('products')
    .select('id, name, stock')
    .eq('status', 'approved')
    .lte('stock', 3)
    .gt('stock', 0)
    .order('stock', { ascending: true })
    .limit(5);

  return {
    totalRevenue30d,
    topCategory,
    topProducts,
    lowStock: (lowStockData || []) as { id: string; name: string; stock: number }[],
  };
}

export default function CampaignManager() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [setupSql, setSetupSql] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ title: string; description: string; strategy: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);

  useEffect(() => {
    fetchAnalytics()
      .then(setAnalytics)
      .finally(() => setAnalyticsLoading(false));

    const unsubCampaigns = subscribeToCampaignsAdmin(undefined, (c, exists, sql) => {
      setCampaigns(c);
      setTableExists(exists);
      if (sql) setSetupSql(sql);
    });
    return () => { unsubCampaigns(); };
  }, []);

  const handleSuggest = async () => {
    if (!analytics) return;
    setLoading(true);
    setError(null);
    try {
      const month = new Date().toLocaleString('en', { month: 'long' });
      const topSellers = analytics.topProducts.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        revenue: p.revenue,
      }));
      const fallback = [{ id: '', name: 'General Products', category: 'Mixed', revenue: 0 }];
      setSuggestion(await suggestCampaign(topSellers.length ? topSellers : fallback, { month }));
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Growth & Campaigns</h1>
          <p className="text-gray-400 text-sm mt-0.5">Real data from your store, powering AI campaign suggestions.</p>
        </div>
        <button
          onClick={handleSuggest}
          disabled={loading || analyticsLoading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate Suggestion
        </button>
      </div>

      {/* Analytics stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {analyticsLoading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton rounded-2xl" />)
        ) : analytics ? (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="section-label mb-1">Revenue (30d)</p>
              <p className="text-xl font-black gradient-text">R{analytics.totalRevenue30d.toFixed(0)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="section-label mb-1">Top Category</p>
              <p className="text-xl font-black text-gray-900">{analytics.topCategory}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="section-label mb-1">Top Products</p>
              <p className="text-xl font-black text-gray-900">{analytics.topProducts.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="section-label mb-1">Low Stock</p>
              <p className={`text-xl font-black ${analytics.lowStock.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {analytics.lowStock.length}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Setup banner */}
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

          {/* Top Performers */}
          {!analyticsLoading && analytics && analytics.topProducts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-gray-400" />
                <p className="section-label">Top Performers (30 days)</p>
              </div>
              <div className="space-y-2">
                {analytics.topProducts.map((p, i) => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-400 flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.category} · {p.unitsSold} sold</p>
                    </div>
                    <p className="font-black text-sm gradient-text flex-shrink-0">R{p.revenue.toFixed(0)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Campaign Suggestion */}
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
                className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-gray-300" />
                </div>
                <p className="section-label">No active suggestion</p>
                <p className="text-xs text-gray-400 mt-1">Click "Generate Suggestion" to get an AI-powered campaign based on your top sellers</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Campaigns */}
          <div>
            <p className="section-label mb-3">Active Campaigns</p>
            {tableExists === false && setupSql ? (
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

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Real market insights */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="section-label mb-4">Market Insights</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <span className="text-xs text-gray-500">Revenue (30d)</span>
                <span className="text-sm font-semibold text-gray-900">
                  {analyticsLoading ? '…' : `R${(analytics?.totalRevenue30d ?? 0).toFixed(0)}`}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <span className="text-xs text-gray-500">Top Category</span>
                <span className="text-sm font-semibold text-gray-900">
                  {analyticsLoading ? '…' : (analytics?.topCategory ?? '—')}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-gray-500">Active Campaigns</span>
                <span className="text-sm font-semibold text-gray-900">{campaigns.length}</span>
              </div>
            </div>
          </div>

          {/* Low stock alerts */}
          {!analyticsLoading && analytics && analytics.lowStock.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="section-label text-amber-800">Low Stock Alert</p>
              </div>
              <div className="space-y-2">
                {analytics.lowStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-xs text-amber-800 font-medium truncate flex-1 mr-2">{p.name}</span>
                    <span className="text-xs font-black text-amber-700 flex-shrink-0">{p.stock} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campaign tips */}
          <div className="p-5 text-white rounded-2xl relative overflow-hidden noise"
            style={{ background: 'var(--gradient-primary)' }}>
            <div className="absolute -top-4 -right-4 opacity-10">
              <Megaphone className="w-24 h-24" />
            </div>
            <p className="section-label text-white/70 mb-2 relative z-10">Campaign Tips</p>
            <ul className="text-xs text-white/80 space-y-1.5 relative z-10">
              <li>• Target your top category first</li>
              <li>• Run sales on low-stock items to clear</li>
              <li>• Monthly campaigns get 2× engagement</li>
            </ul>
            <div className="mt-4 flex items-center gap-2 relative z-10">
              <Package className="w-3.5 h-3.5 text-white/70" />
              <span className="text-xs text-white/70">{campaigns.length} campaigns launched</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
