import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Megaphone, Package2, Radio, Sparkles, Target } from 'lucide-react';
import { requestGrowthPlan } from '../../services/gemini';
import { useSession } from '../../hooks/useSession';
import type { Auction, CampaignDraft, GrowthRecommendation, Pack, Product } from '../../types';
import { availableUnits, currency } from '../../lib/quirkify';
import { listActiveProducts, listCampaignDrafts, listPacks, saveCampaignDraft } from '../../services/catalogService';
import { listAuctions } from '../../services/auctionService';

type OpportunitySnapshot = {
  staleProducts: Product[];
  auctionCandidates: Product[];
  packCandidates: Product[];
  liveAuctions: Auction[];
  scheduledAuctions: Auction[];
  availablePacks: Pack[];
  siteFeatured: Product[];
};

function buildOpportunitySnapshot(products: Product[], packs: Pack[], auctions: Auction[]): OpportunitySnapshot {
  const activeProducts = products.filter((product) => ['approved', 'active'].includes(product.status) && availableUnits(product, 'store') > 0);
  const staleProducts = [...activeProducts]
    .filter((product) => (product.markdownPercentage || 0) > 0 || availableUnits(product, 'store') > 1)
    .sort((left, right) => availableUnits(right, 'store') - availableUnits(left, 'store'))
    .slice(0, 5);

  const auctionCandidates = [...activeProducts]
    .filter((product) => (product.allocations?.auction || product.inventory?.allocated.auction || 0) > 0)
    .sort((left, right) => (right.priceRange?.max || right.retailPrice || 0) - (left.priceRange?.max || left.retailPrice || 0))
    .slice(0, 4);

  const packCandidates = [...activeProducts]
    .filter((product) => (product.allocations?.packs || product.inventory?.allocated.packs || 0) > 0)
    .sort((left, right) => (right.stock || 0) - (left.stock || 0))
    .slice(0, 4);

  const liveAuctions = auctions.filter((auction) => auction.status === 'live' || auction.status === 'active');
  const scheduledAuctions = auctions.filter((auction) => auction.status === 'scheduled');
  const availablePacks = packs.filter((pack) => pack.active).slice(0, 4);
  const siteFeatured = [...activeProducts]
    .sort((left, right) => (right.aiConfidence || 0) - (left.aiConfidence || 0))
    .slice(0, 6);

  return {
    staleProducts,
    auctionCandidates,
    packCandidates,
    liveAuctions,
    scheduledAuctions,
    availablePacks,
    siteFeatured,
  };
}

function recommendationList(recommendation: GrowthRecommendation) {
  return [
    { label: 'Homepage hero', value: recommendation.heroHeadline },
    { label: 'Promotional theme', value: recommendation.promotionalTheme },
    { label: 'Urgency moment', value: recommendation.urgencyMoment },
    { label: 'Messaging direction', value: recommendation.messagingDirection },
  ];
}

export default function GrowthPage() {
  const { profile } = useSession();
  const [goal, setGoal] = useState('Increase weekly sell-through on stale stock while protecting premium auction items.');
  const [constraints, setConstraints] = useState('Avoid discounting top-tier auction inventory. Push packs only where component allocation already exists.');
  const [draft, setDraft] = useState<{ summary: string; recommendation: GrowthRecommendation } | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignDraft[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [campaignRows, productRows, packRows, auctionRows] = await Promise.all([
          listCampaignDrafts(),
          listActiveProducts(),
          listPacks(),
          listAuctions(),
        ]);

        if (!active) return;
        setCampaigns(campaignRows);
        setProducts(productRows);
        setPacks(packRows);
        setAuctions(auctionRows);
      } catch (loadError) {
        if (!active) return;
        setCampaigns([]);
        setProducts([]);
        setPacks([]);
        setAuctions([]);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load growth data');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const snapshot = useMemo(() => buildOpportunitySnapshot(products, packs, auctions), [auctions, packs, products]);
  const approvedCampaigns = useMemo(() => campaigns.filter((campaign) => campaign.status === 'approved'), [campaigns]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await requestGrowthPlan({ goal, constraints });
      setDraft(result.campaign);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Failed to generate campaign plan');
    } finally {
      setBusy(false);
    }
  }

  async function save(status: 'approved' | 'rejected' | 'draft') {
    if (!draft || !profile) return;
    const saved = await saveCampaignDraft({
      status,
      goal,
      constraints,
      authoredBy: profile.id,
      approvedBy: status === 'approved' ? profile.id : undefined,
      approvedAt: status === 'approved' ? new Date().toISOString() : undefined,
      aiSummary: draft.summary,
      recommendation: draft.recommendation,
    });
    setCampaigns((current) => [saved, ...current]);
    setDraft(null);
  }

  return (
    <section className="hero-bg px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Live auctions', value: snapshot.liveAuctions.length, tone: 'btn-primary', icon: Radio },
            { label: 'Pack offers', value: snapshot.availablePacks.length, tone: 'bg-purple-50 text-purple-900 text-gray-900', icon: Package2 },
            { label: 'Featured products', value: snapshot.siteFeatured.length, tone: 'bg-white text-gray-900', icon: Sparkles },
            { label: 'Campaign drafts', value: campaigns.length, tone: 'bg-emerald-50 text-emerald-900 text-gray-900', icon: Megaphone },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className={`rounded-[2rem] border border-black/8 p-6 shadow-[0_20px_70px_rgba(15,21,30,0.08)] ${card.tone}`}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.35em] opacity-70">{card.label}</p>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-8 text-4xl font-black">{card.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <p className="text-[11px] uppercase tracking-[0.35em] text-purple-600">Growth</p>
              <h1 className="mt-4 text-4xl font-black">Campaign operating surface</h1>
              <p className="mt-4 text-sm leading-6 text-gray-500">
                Generate campaigns from live catalogue pressure, keep approval human, and align the site, auctions, and pack push to one commercial story.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">Goal</span>
                  <textarea value={goal} onChange={(e) => setGoal(e.target.value)} className="input h-32 bg-gray-50" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">Constraints</span>
                  <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} className="input h-32 bg-gray-50" />
                </label>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => void generate()} disabled={busy} className="rounded-full bg-purple-900 px-5 py-3 text-sm font-bold text-white">
                  {busy ? 'Generating...' : 'Generate campaign draft'}
                </button>
                <div className="rounded-full border border-black/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
                  Channels: site, WhatsApp, TikTok, live auctions
                </div>
                <div className="rounded-full border border-black/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-gray-400">
                  Approval gate: operator only
                </div>
              </div>
              {error ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Operator snapshot</h2>
                <ArrowUpRight className="h-5 w-5 text-gray-900/40" />
              </div>
              {loading ? (
                <p className="mt-4 text-sm text-gray-500">Loading growth context...</p>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.6rem] bg-gray-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">Stale stock pressure</p>
                    <div className="mt-4 space-y-3">
                      {snapshot.staleProducts.length ? snapshot.staleProducts.map((product) => (
                        <div key={product.id} className="flex items-start justify-between gap-3 text-sm">
                          <div>
                            <p className="font-bold text-gray-900">{product.title || product.name}</p>
                            <p className="text-gray-500">{product.category}</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900">
                            {availableUnits(product, 'store')} ready
                          </span>
                        </div>
                      )) : <p className="text-sm text-gray-500">No immediate stale-stock pressure.</p>}
                    </div>
                  </div>
                  <div className="rounded-[1.6rem] bg-[#eff5ff] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#37558f]">Auction focus</p>
                    <div className="mt-4 space-y-3">
                      {snapshot.auctionCandidates.length ? snapshot.auctionCandidates.map((product) => (
                        <div key={product.id} className="flex items-start justify-between gap-3 text-sm">
                          <div>
                            <p className="font-bold text-gray-900">{product.title || product.name}</p>
                            <p className="text-gray-500">Potential premium lot</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900">
                            {currency(product.priceRange?.max || product.retailPrice || 0)}
                          </span>
                        </div>
                      )) : <p className="text-sm text-gray-500">No auction-allocated catalogue currently available.</p>}
                    </div>
                  </div>
                  <div className="rounded-[1.6rem] bg-[#f3ede3] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">Pack opportunities</p>
                    <div className="mt-4 space-y-3">
                      {snapshot.packCandidates.length ? snapshot.packCandidates.map((product) => (
                        <div key={product.id} className="flex items-start justify-between gap-3 text-sm">
                          <div>
                            <p className="font-bold text-gray-900">{product.title || product.name}</p>
                            <p className="text-gray-500">Allocated for bundle merchandising</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900">
                            {(product.allocations?.packs || product.inventory?.allocated.packs || 0)} units
                          </span>
                        </div>
                      )) : <p className="text-sm text-gray-500">No pack allocations currently live.</p>}
                    </div>
                  </div>
                  <div className="rounded-[1.6rem] bg-[#e8f3eb] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#35664a]">Campaign runway</p>
                    <div className="mt-4 space-y-3 text-sm text-gray-900/70">
                      <p>{snapshot.liveAuctions.length} live auctions and {snapshot.scheduledAuctions.length} scheduled lots are ready for promotional support.</p>
                      <p>{snapshot.availablePacks.length} active packs can be pushed through homepage placements and WhatsApp promotions.</p>
                      <p>{snapshot.siteFeatured.length} product candidates are ready for featured slots.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-purple-600" />
                <h2 className="text-2xl font-black">Launch mix recommendations</h2>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: 'Homepage hero',
                    copy: snapshot.staleProducts[0]
                      ? `Lead with ${snapshot.staleProducts[0].title || snapshot.staleProducts[0].name} to convert high-ready store stock.`
                      : 'No urgent homepage push required right now.',
                  },
                  {
                    title: 'Auction energy',
                    copy: snapshot.liveAuctions[0]
                      ? `Support ${snapshot.liveAuctions[0].title} with urgency language while bids are live.`
                      : 'Use scheduled auction teasers to build anticipation before the next lot opens.',
                  },
                  {
                    title: 'Pack attachment',
                    copy: snapshot.availablePacks[0]
                      ? `Pair campaigns with ${snapshot.availablePacks[0].title} to raise average order value.`
                      : 'No active pack offer yet. Keep the next campaign product-led.',
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-[1.5rem] bg-gray-50 p-5">
                    <p className="text-sm font-black text-gray-900">{item.title}</p>
                    <p className="mt-3 text-sm leading-6 text-gray-900/62">{item.copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <h2 className="text-2xl font-black">Draft output</h2>
              {!draft ? (
                <p className="mt-4 text-sm text-gray-500">No draft generated yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-6 text-gray-900/70">{draft.summary}</p>
                  <div className="grid gap-3">
                    {recommendationList(draft.recommendation).map((item) => (
                      <div key={item.label} className="rounded-2xl bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-600">{item.label}</p>
                        <p className="mt-2 text-sm font-bold text-gray-900">{item.value}</p>
                      </div>
                    ))}
                    <div className="rounded-2xl bg-purple-900 p-4 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Operational recommendations</p>
                      <ul className="mt-3 space-y-2 text-sm text-white/80">
                        {draft.recommendation.operationalRecommendations?.map((item, index) => (
                          <li key={`${item}-${index}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => void save('approved')} className="rounded-full bg-purple-900 px-4 py-2 text-sm font-bold text-white">Approve</button>
                    <button onClick={() => void save('draft')} className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold text-gray-900">Save draft</button>
                    <button onClick={() => void save('rejected')} className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600">Reject</button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <h2 className="text-2xl font-black">Approved campaigns</h2>
              <div className="mt-4 space-y-3">
                {approvedCampaigns.length ? approvedCampaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-2xl bg-[#eef5f1] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-[#35664a]">{campaign.status}</p>
                      <p className="text-xs text-gray-400">{new Date(campaign.createdAt).toLocaleDateString('en-ZA')}</p>
                    </div>
                    <p className="mt-2 text-lg font-black">{campaign.recommendation.heroHeadline}</p>
                    <p className="mt-2 text-sm text-gray-500">{campaign.aiSummary}</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-black/10 p-5 text-sm text-gray-400">
                    No approved campaigns yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_20px_70px_rgba(15,21,30,0.08)]">
              <h2 className="text-2xl font-black">Saved campaigns</h2>
              <div className="mt-4 space-y-3">
                {campaigns.length ? campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-2xl bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-purple-600">{campaign.status}</p>
                      <p className="text-xs text-gray-400">{new Date(campaign.createdAt).toLocaleDateString('en-ZA')}</p>
                    </div>
                    <p className="mt-2 text-lg font-black">{campaign.recommendation.heroHeadline}</p>
                    <p className="mt-2 text-sm text-gray-500">{campaign.aiSummary}</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-black/10 p-5 text-sm text-gray-400">
                    No saved campaigns yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
