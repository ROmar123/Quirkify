import type { Context } from "hono";
import crypto from "crypto";
import { sendOrderStatusEmail } from "../../_lib/orderNotifications";
import { normalizeEnvValue } from "../../_lib/env.js";
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin.js";

// In-memory idempotency cache with 24hr TTL
// For production, replace with Redis or Firestore-based tracking
const processedEvents = new Map<string, number>();
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

function cleanExpiredEvents(): void {
  const now = Date.now();
  for (const [eventId, timestamp] of processedEvents) {
    if (now - timestamp > EVENT_TTL_MS) {
      processedEvents.delete(eventId);
    }
  }
}

function markProcessed(eventId: string): void {
  cleanExpiredEvents();
  processedEvents.set(eventId, Date.now());
}

function isAlreadyProcessed(eventId: string): boolean {
  cleanExpiredEvents();
  return processedEvents.has(eventId);
}

function verifyYocoSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!secret) {
    console.error("YOCO_SECRET_KEY is not configured");
    return false;
  }

  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

interface YocoEvent {
  id: string;
  type: string;
  createdAt: number;
  data: {
    id: string;
    amount?: number;
    currency?: string;
    createdAt?: string;
    metadata?: {
      orderId?: string;
      [key: string]: unknown;
    };
    failureReason?: string;
  };
}

async function handlePaymentCompleted(event: YocoEvent): Promise<void> {
  const orderId = event.data?.metadata?.orderId;
  if (!orderId) {
    console.warn(`[${event.id}] payment.completed: No orderId in metadata`);
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: currentOrder, error: orderReadError } = await supabase
      .from("orders")
      .select("id, status, source_ref, profile_id, total")
      .eq("id", orderId)
      .maybeSingle();

    if (orderReadError) {
      throw new Error(orderReadError.message);
    }

    const shouldCreditWallet =
      currentOrder?.status === "pending" &&
      currentOrder?.source_ref === "wallet_topup" &&
      !!currentOrder.profile_id;

    const { error } = await supabase.rpc("mark_order_payment_succeeded", {
      p_order_id: orderId,
      p_payment_id: event.data.id,
      p_payment_status: "completed",
      p_provider_event_id: event.id,
      p_payload: {
        amount: event.data.amount,
        currency: event.data.currency,
        createdAt: event.data.createdAt,
        metadata: event.data.metadata || {},
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (shouldCreditWallet && currentOrder?.profile_id) {
      const { data: profile, error: profileReadError } = await supabase
        .from("profiles")
        .select("id, balance")
        .eq("id", currentOrder.profile_id)
        .single();

      if (profileReadError) {
        throw new Error(profileReadError.message);
      }

      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ balance: Number(profile?.balance || 0) + Number(currentOrder.total || 0) })
        .eq("id", currentOrder.profile_id);

      if (balanceError) {
        throw new Error(balanceError.message);
      }
    }

    // Add purchased products to buyer's collection vault
    if (!shouldCreditWallet && currentOrder?.profile_id) {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, unit_price, quantity")
        .eq("order_id", orderId);

      if (items && items.length > 0) {
        const collectionRows = items.flatMap((item: { product_id: string; unit_price: number; quantity: number }) =>
          Array.from({ length: item.quantity ?? 1 }, () => ({
            profile_id: currentOrder.profile_id,
            product_id: item.product_id,
            purchase_price: Number(item.unit_price) || 0,
            acquired_at: new Date().toISOString(),
          }))
        );
        await supabase.from("collection_items").insert(collectionRows);
      }
    }

    try {
      await sendOrderStatusEmail(orderId, "paid");
    } catch (emailError) {
      console.error(`[${event.id}] Paid email send failed for order ${orderId}:`, emailError);
    }
    console.log(`[${event.id}] Order ${orderId} payment confirmed in Supabase`);
  } catch (error) {
    console.error(`[${event.id}] Failed to update order ${orderId}:`, error);
    throw error; // Re-throw so caller knows it failed
  }
}

async function handlePaymentFailed(event: YocoEvent): Promise<void> {
  const orderId = event.data?.metadata?.orderId;
  if (!orderId) {
    console.warn(`[${event.id}] payment.failed: No orderId in metadata`);
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.rpc("mark_order_payment_failed", {
      p_order_id: orderId,
      p_payment_status: event.data.failureReason || "failed",
      p_provider_event_id: event.id,
      p_payload: {
        failureReason: event.data.failureReason || null,
        metadata: event.data.metadata || {},
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    try {
      await sendOrderStatusEmail(orderId, "payment_failed");
    } catch (emailError) {
      console.error(`[${event.id}] Failed-payment email send failed for order ${orderId}:`, emailError);
    }
    console.log(`[${event.id}] Order ${orderId} marked as payment_failed in Supabase`);
  } catch (error) {
    console.error(`[${event.id}] Failed to update failed order ${orderId}:`, error);
    throw error;
  }
}

async function processEvent(event: YocoEvent): Promise<void> {
  const eventId = event.id;

  if (isAlreadyProcessed(eventId)) {
    console.log(`[${eventId}] Already processed, skipping`);
    return;
  }

  console.log(`[${eventId}] Processing event type=${event.type}`);

  try {
    switch (event.type) {
      case "payment.completed":
        await handlePaymentCompleted(event);
        break;

      case "payment.failed":
        await handlePaymentFailed(event);
        break;

      default:
        console.log(`[${eventId}] Unknown event type: ${event.type}`);
    }

    markProcessed(eventId);
  } catch (error) {
    console.error(`[${eventId}] Error processing event:`, error);
    throw error;
  }
}

// Extracted handler for use in Next.js API route
export async function handleYocoWebhook(
  body: YocoEvent,
  rawBody: Buffer,
  signatureHeader: string | null
): Promise<{ status: number; body: object }> {
  // Validate signature header presence
  if (!signatureHeader) {
    console.warn("Missing x-yoco-signature header");
    return { status: 401, body: { error: "Missing signature header" } };
  }

  // Always verify signature (no NODE_ENV bypass)
  const secret = normalizeEnvValue(process.env.YOCO_SECRET_KEY);
  if (!secret) {
    console.error("YOCO_SECRET_KEY environment variable is not set");
    // In production this should never happen - fail closed
    return { status: 500, body: { error: "Server configuration error" } };
  }

  // Verify HMAC-SHA256 signature using raw body bytes
  const isValid = verifyYocoSignature(rawBody, signatureHeader, secret);
  if (!isValid) {
    console.warn("Invalid webhook signature");
    return { status: 401, body: { error: "Invalid signature" } };
  }

  // Validate event structure
  if (!body?.id || !body?.type) {
    console.warn("Invalid event structure: missing id or type");
    return { status: 400, body: { error: "Invalid event structure" } };
  }

  console.log(`[${body.id}] Received webhook: type=${body.type}, createdAt=${body.createdAt}`);
  return { status: 200, body: { received: true } };
}

// Default export for Next.js API route
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get raw body for signature verification
  // Next.js parses this from req.body when using express-like middleware
  // If rawBody is not available, use Buffer from JSON stringify
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const signatureHeader = req.headers["x-yoco-signature"] as string | null;

  // Verify first, then process before responding so Vercel does not drop work.
  const { status, body } = await handleYocoWebhook(req.body, rawBody, signatureHeader);
  if (status !== 200) {
    return res.status(status).json(body);
  }

  try {
    await processEvent(req.body);
    return res.status(200).json(body);
  } catch (error) {
    console.error(`[${req.body?.id || "unknown"}] Webhook processing failed before response:`, error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
