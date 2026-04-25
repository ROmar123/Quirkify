import { askGemini } from '../_lib/gemini';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

function summarizeProducts(products: any[] = []) {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    status: product.status,
    stock: product.stock,
    allocStore: product.alloc_store,
    allocAuction: product.alloc_auction,
    allocPacks: product.alloc_packs,
    retailPrice: product.retail_price,
    markdownPercentage: product.markdown_percentage,
    confidenceScore: product.confidence_score,
    updatedAt: product.updated_at,
  }));
}

function summarizeAuctions(auctions: any[] = []) {
  return auctions.map((auction) => ({
    id: auction.id,
    title: auction.title,
    status: auction.status,
    currentBid: auction.current_bid,
    startPrice: auction.start_price,
    bidCount: auction.bid_count,
    startsAt: auction.starts_at,
    endsAt: auction.ends_at,
    updatedAt: auction.updated_at,
  }));
}

function summarizePacks(packs: any[] = []) {
  return packs.map((pack) => ({
    id: pack.id,
    name: pack.name,
    status: pack.status,
    price: pack.price,
    itemCount: pack.item_count,
    totalPacks: pack.total_packs,
    packsRemaining: pack.packs_remaining,
    updatedAt: pack.updated_at,
  }));
}

function summarizeOrders(orders: any[] = []) {
  return orders.map((order) => ({
    id: order.id,
    channel: order.channel,
    status: order.status,
    paymentStatus: order.payment_status,
    total: order.total,
    createdAt: order.created_at,
  }));
}

async function handleIdentify(req: any, res: any) {
  const { base64Image } = req.body ?? {};
  if (!base64Image) return res.status(400).json({ error: 'No image provided' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI not configured' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `You are a product analyst for Quirkify, a gamified social commerce platform. Analyze this product image and respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "name": "product name here",
  "description": "2-3 sentence description",
  "category": "one of: Sneakers, Clothing, Accessories, Electronics, Collectibles, Toys & Games, Books & Media, Beauty & Health, Home & Decor, Sports & Outdoors, Art & Crafts, Vintage & Retro, Other",
  "retailPrice": number_in_ZAR,
  "rarity": "Common|Limited|Rare|Super Rare|Unique",
  "stats": { "quirkiness": 1-100, "rarity": 1-100, "utility": 1-100, "hype": 1-100 },
  "confidenceScore": 0-1
}` },
              { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.json({
        name: 'Product',
        description: text.slice(0, 200),
        category: 'Other',
        retailPrice: 0,
        rarity: 'Common',
        stats: { quirkiness: 50, rarity: 50, utility: 50, hype: 50 },
        confidenceScore: 0.5,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleIntake(req: any, res: any) {
  const { notes, categoryHint, channelHint, base64Image } = req.body || {};
  if (!notes && !base64Image) {
    return res.status(400).json({ error: 'Notes or an image are required for AI intake' });
  }

  const prompt = `
You are the intake analyst for Quirkify, a gamified social commerce platform.
You are drafting an internal review object, not public copy.

Context:
- rough notes: ${notes || 'none'}
- category hint: ${categoryHint || 'none'}
- preferred channel hint: ${channelHint || 'store'}
- image attached as base64? ${base64Image ? 'yes' : 'no'}

Return strict JSON with this shape:
{
  "generatedDraft": {
    "title": "string",
    "description": "string",
    "category": "string",
    "condition": "new|like_new|pre_owned|refurbished",
    "tags": ["string"],
    "suggestedChannel": "store|auction|pack",
    "pricing": {
      "listPrice": 0,
      "salePrice": 0,
      "auctionStartPrice": 0,
      "auctionReservePrice": 0
    },
    "inventory": {
      "onHand": 1,
      "allocated": {
        "store": 0,
        "auction": 0,
        "packs": 0
      }
    },
    "merchandisingNotes": ["string"],
    "rarityNotes": ["string"]
  },
  "aiNotes": ["string"],
  "confidenceMarkers": ["string"],
  "confidenceScore": 0.0
}

Rules:
- if the item feels unique or scarcity-driven, prefer auction
- if the item feels bundle friendly or low-ticket, prefer pack
- otherwise prefer store
- be commercial, operational, and concise
`;

  try {
    const text = await askGemini(prompt);
    return res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to process AI intake' });
  }
}

async function handleCampaign(req: any, res: any) {
  const { goal, constraints } = req.body || {};
  const supabase = getSupabaseAdmin();

  try {
    const [
      { data: products, error: productsError },
      { data: auctions, error: auctionsError },
      { data: packs, error: packsError },
      { data: orders, error: ordersError },
    ] = await Promise.all([
      supabase.from('products').select('*').order('updated_at', { ascending: false }).limit(20),
      supabase.from('auctions').select('*').order('updated_at', { ascending: false }).limit(20),
      supabase.from('packs').select('*').order('updated_at', { ascending: false }).limit(20),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(20),
    ]);

    const firstError = productsError || auctionsError || packsError || ordersError;
    if (firstError) throw new Error(firstError.message);

    const prompt = `
You are the Quirkify growth strategist.
Produce a growth recommendation for Quirkify, a South African curated commerce platform that sells through a store, structured auctions, live auction rooms, and packs.

Business goal:
${goal || 'Increase conversion while protecting premium inventory.'}

Constraints:
${constraints || 'Keep the system operationally realistic and do not over-promise stock.'}

Current product snapshot:
${JSON.stringify(summarizeProducts(products || []), null, 2)}

Current auction snapshot:
${JSON.stringify(summarizeAuctions(auctions || []), null, 2)}

Current pack snapshot:
${JSON.stringify(summarizePacks(packs || []), null, 2)}

Recent orders:
${JSON.stringify(summarizeOrders(orders || []), null, 2)}

Rules:
- Treat the database snapshots as current live operating data, not examples.
- If a list is empty, do not invent inventory. Recommend how the operator should respond to the gap.
- Keep recommendations operationally realistic for homepage merchandising, WhatsApp, TikTok, and live auctions.
- Do not reference products, auctions, or packs that are not present in the snapshots.

Return strict JSON:
{
  "campaign": {
    "summary": "string",
    "recommendation": {
      "heroHeadline": "string",
      "featuredProductIds": ["string"],
      "featuredAuctionIds": ["string"],
      "featuredPackIds": ["string"],
      "promotionalTheme": "string",
      "urgencyMoment": "string",
      "messagingDirection": "string",
      "operationalRecommendations": ["string"]
    }
  }
}
`;

    const text = await askGemini(prompt);
    return res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to generate campaign draft' });
  }
}

async function handlePersonalize(req: any, res: any) {
  const { browsingHistory, cart } = req.body ?? {};
  try {
    const text = await askGemini(
      `You are a personalization engine for Quirkify, a gamified social commerce platform. A user has viewed: ${JSON.stringify(browsingHistory)}. Their cart contains: ${JSON.stringify(cart)}. Suggest 3 products they might like. Respond with ONLY a JSON array of 3 product names/IDs, nothing else.`
    );

    try {
      return res.json({ recommendations: JSON.parse(text) });
    } catch {
      return res.json({ recommendations: [] });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleTalkingPoints(req: any, res: any) {
  const { productName, category } = req.body ?? {};
  if (!productName) return res.status(400).json({ error: 'Missing productName' });

  try {
    const text = await askGemini(
      `You are a live stream host for Quirkify, a gamified social commerce platform. For the product "${productName}" (category: ${category}), generate 5 engaging talking points a host could use during a live auction. Respond with ONLY a JSON array of 5 strings, nothing else. Example: ["Point 1...", "Point 2..."]`
    );

    try {
      const parsed = JSON.parse(text);
      return res.json({ talkingPoints: Array.isArray(parsed) ? parsed.slice(0, 5) : [text] });
    } catch {
      return res.json({ talkingPoints: [text.slice(0, 300)] });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = String(req.query?.action || '').trim();

  if (action === 'identify') return handleIdentify(req, res);
  if (action === 'intake') return handleIntake(req, res);
  if (action === 'campaign') return handleCampaign(req, res);
  if (action === 'personalize') return handlePersonalize(req, res);
  if (action === 'talking-points') return handleTalkingPoints(req, res);

  return res.status(404).json({ error: 'Unknown AI action' });
}
