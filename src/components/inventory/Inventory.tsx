import { useEffect, useMemo, useState } from 'react';
import { uploadProductImage } from '../../services/storageService';
import { createAuctionFromProduct, createLiveSession, listAuctions, listLiveSessions } from '../../services/auctionService';
import {
  createCatalogProduct,
  createPack,
  subscribeToInventory,
  subscribeToReviewQueue,
  updateProduct,
} from '../../services/catalogService';
import { requestAiIntake } from '../../services/gemini';
import { useSession } from '../../hooks/useSession';
import { currency, defaultAllocations, emptyReservations, slugify } from '../../lib/quirkify';
import type { LiveSession, Pack, Product, ProductCondition, ReviewEntry, SalesChannel } from '../../types';

type Tab = 'manual' | 'ai' | 'review' | 'packs' | 'live';

const tabs: Tab[] = ['manual', 'ai', 'review', 'packs', 'live'];

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

export default function Inventory() {
  const { profile } = useSession();
  const [tab, setTab] = useState<Tab>('manual');
  const [products, setProducts] = useState<Product[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewEntry[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [manualFiles, setManualFiles] = useState<File[]>([]);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [manualForm, setManualForm] = useState({
    title: '',
    description: '',
    category: '',
    price: 0,
    quantity: 1,
    condition: 'New' as ProductCondition,
    channel: 'store' as SalesChannel,
    tags: '',
    auctionStartsAt: '',
    auctionEndsAt: '',
  });

  const [aiForm, setAiForm] = useState({
    notes: '',
    categoryHint: '',
    channelHint: 'store' as SalesChannel,
  });

  const [packForm, setPackForm] = useState({
    title: '',
    description: '',
    price: 0,
    selectedProductIds: [] as string[],
  });

  const [liveForm, setLiveForm] = useState({
    title: '',
    spotlightMessage: '',
    selectedAuctionIds: [] as string[],
  });

  const [auctions, setAuctions] = useState<any[]>([]);
  const [selectedReview, setSelectedReview] = useState<ReviewEntry | null>(null);
  const [reviewDraft, setReviewDraft] = useState<any>(null);

  useEffect(() => subscribeToInventory(setProducts), []);
  useEffect(() => subscribeToReviewQueue(setReviewQueue), []);

  useEffect(() => {
    void Promise.all([listLiveSessions(), listAuctions()]).then(([sessions, auctionRows]) => {
      setLiveSessions(sessions);
      setAuctions(auctionRows);
    });
  }, []);

  useEffect(() => {
    if (!selectedReview) {
      setReviewDraft(null);
      return;
    }

    setReviewDraft({
      ...selectedReview.generatedDraft,
      tags: selectedReview.generatedDraft.tags.join(', '),
    });
  }, [selectedReview]);

  const packEligible = useMemo(
    () =>
      products.filter(
        (item) =>
          (item.status === 'approved' || item.status === 'active') &&
          (item.inventory?.allocated.packs || item.allocations?.packs || 0) > 0
      ),
    [products]
  );

  async function handleManualSubmit() {
    if (!profile) return;

    const productId = crypto.randomUUID();
    const media = await Promise.all(
      manualFiles.map(async (file) => ({ url: await uploadProductImage(productId, file) }))
    );

    const product = await createCatalogProduct(
      {
        id: productId,
        slug: slugify(manualForm.title),
        title: manualForm.title,
        name: manualForm.title,
        description: manualForm.description,
        category: manualForm.category,
        condition: manualForm.condition,
        source: 'manual',
        listingType: manualForm.channel === 'auction' ? 'auction' : 'store',
        pricing: {
          listPrice: manualForm.price,
          salePrice: manualForm.price,
          auctionStartPrice: manualForm.channel === 'auction' ? manualForm.price : undefined,
        },
        inventory: {
          onHand: manualForm.quantity,
          allocated: defaultAllocations(manualForm.channel, manualForm.quantity),
          reserved: emptyReservations(),
          sold: emptyReservations(),
        },
        media,
        tags: manualForm.tags.split(',').map((item) => item.trim()).filter(Boolean),
        createdBy: profile.id,
        authorUid: profile.firebaseUid,
      },
      'approved'
    );

    if (manualForm.channel === 'auction' && manualForm.auctionStartsAt && manualForm.auctionEndsAt) {
      await createAuctionFromProduct({
        product,
        startsAt: manualForm.auctionStartsAt,
        endsAt: manualForm.auctionEndsAt,
        startPrice: manualForm.price,
        createdBy: profile.id,
      });
    }

    setManualForm({
      title: '',
      description: '',
      category: '',
      price: 0,
      quantity: 1,
      condition: 'New',
      channel: 'store',
      tags: '',
      auctionStartsAt: '',
      auctionEndsAt: '',
    });
    setManualFiles([]);
    setMessage('Manual intake item created in the catalog database.');
  }

  async function handleAiSubmit() {
    if (!profile || aiFiles.length === 0) return;

    const base64Image = await fileToBase64(aiFiles[0]);
    const aiResult = await requestAiIntake({ ...aiForm, base64Image });
    const productId = crypto.randomUUID();
    const media = await Promise.all(aiFiles.map(async (file) => ({ url: await uploadProductImage(productId, file) })));
    const quantity = Number(aiResult.generatedDraft.inventory?.onHand || 1);

    await createCatalogProduct(
      {
        id: productId,
        slug: slugify(aiResult.generatedDraft.title),
        title: aiResult.generatedDraft.title,
        name: aiResult.generatedDraft.title,
        description: aiResult.generatedDraft.description,
        category: aiResult.generatedDraft.category,
        condition:
          aiResult.generatedDraft.condition === 'like_new'
            ? 'Like New'
            : aiResult.generatedDraft.condition === 'pre_owned'
              ? 'Pre-owned'
              : aiResult.generatedDraft.condition === 'refurbished'
                ? 'Refurbished'
                : 'New',
        source: 'ai',
        listingType: aiResult.generatedDraft.suggestedChannel === 'auction' ? 'auction' : 'store',
        pricing: aiResult.generatedDraft.pricing,
        inventory: {
          onHand: quantity,
          allocated: aiResult.generatedDraft.inventory?.allocated || defaultAllocations(aiResult.generatedDraft.suggestedChannel, quantity),
          reserved: emptyReservations(),
          sold: emptyReservations(),
        },
        media,
        tags: aiResult.generatedDraft.tags || [],
        merchandisingNotes: aiResult.generatedDraft.merchandisingNotes || [],
        rarityNotes: aiResult.generatedDraft.rarityNotes || [],
        aiConfidence: aiResult.confidenceScore,
        confidenceScore: aiResult.confidenceScore,
        aiNotes: aiResult.aiNotes,
        createdBy: profile.id,
        authorUid: profile.firebaseUid,
      },
      'pending'
    );

    setAiForm({ notes: '', categoryHint: '', channelHint: 'store' });
    setAiFiles([]);
    setMessage('AI intake submitted into the Postgres review queue.');
  }

  async function approveReview() {
    if (!profile || !selectedReview || !reviewDraft) return;

    const quantity = Number(reviewDraft.inventory.onHand || 1);
    const route = reviewDraft.suggestedChannel as SalesChannel;
    const updatedProduct = await updateProduct(selectedReview.id, {
      title: reviewDraft.title,
      name: reviewDraft.title,
      slug: slugify(reviewDraft.title),
      description: reviewDraft.description,
      category: reviewDraft.category,
      condition:
        reviewDraft.condition === 'like_new'
          ? 'Like New'
          : reviewDraft.condition === 'pre_owned'
            ? 'Pre-owned'
            : reviewDraft.condition === 'refurbished'
              ? 'Refurbished'
              : reviewDraft.condition,
      status: 'approved',
      pricing: {
        listPrice: Number(reviewDraft.pricing.listPrice || reviewDraft.pricing.salePrice || 0),
        salePrice: Number(reviewDraft.pricing.salePrice || 0),
        auctionStartPrice: Number(reviewDraft.pricing.auctionStartPrice || reviewDraft.pricing.salePrice || 0),
        auctionReservePrice: Number(reviewDraft.pricing.auctionReservePrice || reviewDraft.pricing.listPrice || 0),
      },
      inventory: {
        onHand: quantity,
        allocated: defaultAllocations(route, quantity),
        reserved: emptyReservations(),
        sold: emptyReservations(),
      },
      listingType: route === 'auction' ? 'auction' : 'store',
      tags: String(reviewDraft.tags || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });

    if (route === 'auction') {
      const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await createAuctionFromProduct({
        product: updatedProduct,
        startsAt: start,
        endsAt: end,
        startPrice: Number(reviewDraft.pricing.auctionStartPrice || reviewDraft.pricing.salePrice || 0),
        createdBy: profile.id,
      });
    }

    setSelectedReview(null);
    setReviewDraft(null);
    setMessage('Review item approved and published from Postgres inventory.');
  }

  async function rejectReview() {
    if (!profile || !selectedReview) return;
    await updateProduct(selectedReview.id, { status: 'rejected' });
    setSelectedReview(null);
    setReviewDraft(null);
    setMessage('Review item rejected.');
  }

  async function createPackFromForm() {
    if (!profile) return;
    const pack: Pack = {
      id: crypto.randomUUID(),
      title: packForm.title,
      name: packForm.title,
      description: packForm.description,
      price: packForm.price,
      componentCount: packForm.selectedProductIds.length,
      components: packForm.selectedProductIds.map((productId) => ({ productId, quantity: 1 })),
      active: true,
      createdBy: profile.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await createPack(pack);
    setPackForm({ title: '', description: '', price: 0, selectedProductIds: [] });
    setMessage('Pack created from allocated inventory.');
  }

  async function createLiveSessionFromForm() {
    if (!profile) return;
    const session: LiveSession = {
      id: crypto.randomUUID(),
      title: liveForm.title,
      status: 'scheduled',
      hostId: profile.id,
      hostName: profile.displayName,
      auctionQueue: liveForm.selectedAuctionIds,
      currentAuctionId: liveForm.selectedAuctionIds[0] || null,
      spotlightMessage: liveForm.spotlightMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await createLiveSession(session);
    setLiveSessions((current) => [session, ...current]);
    setLiveForm({ title: '', spotlightMessage: '', selectedAuctionIds: [] });
    setMessage('Live session created.');
  }

  return (
    <section className="hero-bg px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-white">
          <p className="text-[11px] uppercase tracking-[0.35em] text-purple-400">Admin View</p>
          <h1 className="mt-4 text-4xl font-black">Inventory, intake, review, packs, and live selling</h1>
          {message ? <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-white/80">{message}</div> : null}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item ? 'bg-purple-500 text-white' : 'border border-white/10 bg-white/5 text-white/75'}`}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === 'manual' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              <h2 className="text-2xl font-black">Manual intake</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <input value={manualForm.title} onChange={(e) => setManualForm((current) => ({ ...current, title: e.target.value }))} className="input bg-gray-50 md:col-span-2" placeholder="Title" />
                <textarea value={manualForm.description} onChange={(e) => setManualForm((current) => ({ ...current, description: e.target.value }))} className="input h-28 bg-gray-50 md:col-span-2" placeholder="Description" />
                <input value={manualForm.category} onChange={(e) => setManualForm((current) => ({ ...current, category: e.target.value }))} className="input bg-gray-50" placeholder="Category" />
                <input value={manualForm.tags} onChange={(e) => setManualForm((current) => ({ ...current, tags: e.target.value }))} className="input bg-gray-50" placeholder="Tags, comma separated" />
                <input type="number" value={manualForm.price} onChange={(e) => setManualForm((current) => ({ ...current, price: Number(e.target.value) }))} className="input bg-gray-50" placeholder="Price" />
                <input type="number" value={manualForm.quantity} onChange={(e) => setManualForm((current) => ({ ...current, quantity: Number(e.target.value) }))} className="input bg-gray-50" placeholder="Quantity" />
                <select value={manualForm.condition} onChange={(e) => setManualForm((current) => ({ ...current, condition: e.target.value as ProductCondition }))} className="input bg-gray-50">
                  <option value="New">New</option>
                  <option value="Like New">Like new</option>
                  <option value="Pre-owned">Pre-owned</option>
                  <option value="Refurbished">Refurbished</option>
                </select>
                <select value={manualForm.channel} onChange={(e) => setManualForm((current) => ({ ...current, channel: e.target.value as SalesChannel }))} className="input bg-gray-50">
                  <option value="store">Store</option>
                  <option value="auction">Auction</option>
                  <option value="pack">Pack component</option>
                </select>
                {manualForm.channel === 'auction' && (
                  <>
                    <input type="datetime-local" value={manualForm.auctionStartsAt} onChange={(e) => setManualForm((current) => ({ ...current, auctionStartsAt: e.target.value }))} className="input bg-gray-50" />
                    <input type="datetime-local" value={manualForm.auctionEndsAt} onChange={(e) => setManualForm((current) => ({ ...current, auctionEndsAt: e.target.value }))} className="input bg-gray-50" />
                  </>
                )}
                <input type="file" multiple accept="image/*" onChange={(e) => setManualFiles(Array.from(e.target.files || []))} className="input bg-gray-50 md:col-span-2" />
              </div>
              <button onClick={() => void handleManualSubmit()} className="mt-6 rounded-full bg-purple-900 px-5 py-3 text-sm font-bold text-white">Create manual listing</button>
            </div>
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              <h2 className="text-2xl font-black">Inventory snapshot</h2>
              <div className="mt-6 space-y-3">
                {products.slice(0, 8).map((product) => (
                  <div key={product.id} className="rounded-2xl bg-gray-50 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{product.title || product.name}</span>
                      <span>{currency(product.pricing?.salePrice || product.discountPrice || 0)}</span>
                    </div>
                    <div className="mt-2 text-gray-500">
                      On hand {product.inventory?.onHand || product.stock || 0} · Store {product.inventory?.allocated.store || 0} · Auction {product.inventory?.allocated.auction || 0} · Packs {product.inventory?.allocated.packs || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              <h2 className="text-2xl font-black">AI intake</h2>
              <p className="mt-3 text-sm leading-6 text-gray-500">
                Upload rough imagery and notes. Gemini drafts the title, description, category, pricing guidance, tags, rarity cues, and suggested channel, then routes the item into review.
              </p>
              <div className="mt-6 grid gap-4">
                <textarea value={aiForm.notes} onChange={(e) => setAiForm((current) => ({ ...current, notes: e.target.value }))} className="input h-32 bg-gray-50" placeholder="Rough notes, provenance, defects, special context" />
                <input value={aiForm.categoryHint} onChange={(e) => setAiForm((current) => ({ ...current, categoryHint: e.target.value }))} className="input bg-gray-50" placeholder="Category hint (optional)" />
                <select value={aiForm.channelHint} onChange={(e) => setAiForm((current) => ({ ...current, channelHint: e.target.value as SalesChannel }))} className="input bg-gray-50">
                  <option value="store">Store hint</option>
                  <option value="auction">Auction hint</option>
                  <option value="pack">Pack hint</option>
                </select>
                <input type="file" multiple accept="image/*" onChange={(e) => setAiFiles(Array.from(e.target.files || []))} className="input bg-gray-50" />
              </div>
              <button onClick={() => void handleAiSubmit()} className="mt-6 rounded-full bg-purple-900 px-5 py-3 text-sm font-bold text-white">Submit to review queue</button>
            </div>
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              <h2 className="text-2xl font-black">Pending review queue</h2>
              <div className="mt-6 space-y-3">
                {reviewQueue.filter((item) => item.status === 'pending').slice(0, 8).map((entry) => (
                  <button key={entry.id} onClick={() => setSelectedReview(entry)} className="block w-full rounded-2xl bg-gray-50 p-4 text-left">
                    <p className="text-xs uppercase tracking-[0.25em] text-purple-600">{entry.generatedDraft.suggestedChannel}</p>
                    <p className="mt-2 text-lg font-black">{entry.generatedDraft.title}</p>
                    <p className="mt-2 text-sm text-gray-500">Confidence {Math.round(entry.confidenceScore * 100)}%</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'review' && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              <h2 className="text-2xl font-black">Review queue</h2>
              <div className="mt-6 space-y-3">
                {reviewQueue.map((entry) => (
                  <button key={entry.id} onClick={() => setSelectedReview(entry)} className={`block w-full rounded-2xl p-4 text-left ${selectedReview?.id === entry.id ? 'btn-primary' : 'bg-gray-50'}`}>
                    <p className="text-xs uppercase tracking-[0.25em]">{entry.status}</p>
                    <p className="mt-2 text-lg font-black">{entry.generatedDraft.title}</p>
                    <p className="mt-2 text-sm opacity-70">{entry.generatedDraft.category}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              {!selectedReview || !reviewDraft ? (
                <p className="text-sm text-gray-500">Select a queued AI submission to inspect, edit, approve, or reject.</p>
              ) : (
                <>
                  <h2 className="text-2xl font-black">Review decision</h2>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <input value={reviewDraft.title} onChange={(e) => setReviewDraft((current: any) => ({ ...current, title: e.target.value }))} className="input bg-gray-50 md:col-span-2" />
                    <textarea value={reviewDraft.description} onChange={(e) => setReviewDraft((current: any) => ({ ...current, description: e.target.value }))} className="input h-28 bg-gray-50 md:col-span-2" />
                    <input value={reviewDraft.category} onChange={(e) => setReviewDraft((current: any) => ({ ...current, category: e.target.value }))} className="input bg-gray-50" />
                    <input value={reviewDraft.tags} onChange={(e) => setReviewDraft((current: any) => ({ ...current, tags: e.target.value }))} className="input bg-gray-50" />
                    <select value={reviewDraft.condition} onChange={(e) => setReviewDraft((current: any) => ({ ...current, condition: e.target.value }))} className="input bg-gray-50">
                      <option value="New">New</option>
                      <option value="Like New">Like new</option>
                      <option value="Pre-owned">Pre-owned</option>
                      <option value="Refurbished">Refurbished</option>
                    </select>
                    <select value={reviewDraft.suggestedChannel} onChange={(e) => setReviewDraft((current: any) => ({ ...current, suggestedChannel: e.target.value as SalesChannel }))} className="input bg-gray-50">
                      <option value="store">Store</option>
                      <option value="auction">Auction</option>
                      <option value="pack">Pack component</option>
                    </select>
                    <input type="number" value={reviewDraft.pricing.salePrice} onChange={(e) => setReviewDraft((current: any) => ({ ...current, pricing: { ...current.pricing, salePrice: Number(e.target.value), listPrice: Number(e.target.value) } }))} className="input bg-gray-50" />
                    <input type="number" value={reviewDraft.inventory.onHand} onChange={(e) => setReviewDraft((current: any) => ({ ...current, inventory: { ...current.inventory, onHand: Number(e.target.value) } }))} className="input bg-gray-50" />
                  </div>
                  <div className="mt-6 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
                    <p><strong>AI notes:</strong> {selectedReview.aiNotes.join(' · ') || 'No notes returned.'}</p>
                    <p className="mt-2"><strong>Confidence markers:</strong> {selectedReview.confidenceMarkers.join(' · ') || 'Confidence markers not stored separately in Postgres review mode.'}</p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button onClick={() => void approveReview()} className="rounded-full bg-purple-900 px-5 py-3 text-sm font-bold text-white">Approve and publish</button>
                    <button onClick={() => void rejectReview()} className="rounded-full border border-red-200 px-5 py-3 text-sm font-bold text-red-600">Reject</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'packs' && (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              <h2 className="text-2xl font-black">Pack builder</h2>
              <div className="mt-6 grid gap-4">
                <input value={packForm.title} onChange={(e) => setPackForm((current) => ({ ...current, title: e.target.value }))} className="input bg-gray-50" placeholder="Pack title" />
                <textarea value={packForm.description} onChange={(e) => setPackForm((current) => ({ ...current, description: e.target.value }))} className="input h-28 bg-gray-50" placeholder="Pack description" />
                <input type="number" value={packForm.price} onChange={(e) => setPackForm((current) => ({ ...current, price: Number(e.target.value) }))} className="input bg-gray-50" placeholder="Pack price" />
              </div>
              <div className="mt-6 space-y-2">
                {packEligible.map((product) => (
                  <label key={product.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={packForm.selectedProductIds.includes(product.id)}
                      onChange={(e) =>
                        setPackForm((current) => ({
                          ...current,
                          selectedProductIds: e.target.checked
                            ? [...current.selectedProductIds, product.id]
                            : current.selectedProductIds.filter((id) => id !== product.id),
                        }))
                      }
                    />
                    <span className="font-bold">{product.title || product.name}</span>
                  </label>
                ))}
              </div>
              <button onClick={() => void createPackFromForm()} className="mt-6 rounded-full bg-purple-900 px-5 py-3 text-sm font-bold text-white">Create pack</button>
            </div>
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              <h2 className="text-2xl font-black">Pack-eligible inventory</h2>
              <div className="mt-6 space-y-3">
                {packEligible.map((product) => (
                  <div key={product.id} className="rounded-2xl bg-gray-50 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{product.title || product.name}</span>
                      <span>{currency(product.pricing?.salePrice || product.discountPrice || 0)}</span>
                    </div>
                    <p className="mt-2 text-gray-500">Pack allocation: {product.inventory?.allocated.packs || 0}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'live' && (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              <h2 className="text-2xl font-black">Live session planning</h2>
              <div className="mt-6 grid gap-4">
                <input value={liveForm.title} onChange={(e) => setLiveForm((current) => ({ ...current, title: e.target.value }))} className="input bg-gray-50" placeholder="Session title" />
                <textarea value={liveForm.spotlightMessage} onChange={(e) => setLiveForm((current) => ({ ...current, spotlightMessage: e.target.value }))} className="input h-28 bg-gray-50" placeholder="Spotlight message" />
              </div>
              <div className="mt-6 space-y-2">
                {auctions.map((auction) => (
                  <label key={auction.id} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={liveForm.selectedAuctionIds.includes(auction.id)}
                      onChange={(e) =>
                        setLiveForm((current) => ({
                          ...current,
                          selectedAuctionIds: e.target.checked
                            ? [...current.selectedAuctionIds, auction.id]
                            : current.selectedAuctionIds.filter((id) => id !== auction.id),
                        }))
                      }
                    />
                    <span className="font-bold">{auction.title}</span>
                  </label>
                ))}
              </div>
              <button onClick={() => void createLiveSessionFromForm()} className="mt-6 rounded-full bg-purple-900 px-5 py-3 text-sm font-bold text-white">Create live session</button>
            </div>
            <div className="rounded-[2rem] border border-black/8 bg-white p-8">
              <h2 className="text-2xl font-black">Upcoming and live sessions</h2>
              <div className="mt-6 space-y-3">
                {liveSessions.map((session) => (
                  <div key={session.id} className="rounded-2xl bg-gray-50 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{session.title}</span>
                      <span>{session.status}</span>
                    </div>
                    <p className="mt-2 text-gray-500">{session.spotlightMessage || 'No spotlight message set.'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
