-- 012_order_lifecycle_and_courier.sql
-- Adds full README order lifecycle statuses and courier_shipments table.

-- ─── Extend order_status enum ────────────────────────────────────────────────

DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed';           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'packed';              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'courier_booked';      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready_for_collection'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_collection'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'collected';           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'completed';           EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add fulfilment_method column to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfilment_method TEXT DEFAULT 'delivery'
    CHECK (fulfilment_method IN ('delivery', 'collection'));

-- ─── courier_shipments table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.courier_shipments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL DEFAULT 'courier_guy',
  booking_status   TEXT NOT NULL DEFAULT 'pending'
                     CHECK (booking_status IN ('pending','booked','failed','cancelled')),
  tracking_number  TEXT,
  waybill_number   TEXT,
  courier_status   TEXT,
  booked_at        TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  raw_response     JSONB,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courier_shipments_order_idx ON public.courier_shipments(order_id);
ALTER TABLE public.courier_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins manage courier shipments"
  ON public.courier_shipments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Customers can view their own shipments
CREATE POLICY IF NOT EXISTS "Customers view own shipments"
  ON public.courier_shipments FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      JOIN public.profiles p ON p.id = o.profile_id
      WHERE p.id = auth.uid()
    )
  );

-- ─── Helper: advance order status with event log ─────────────────────────────

CREATE OR REPLACE FUNCTION public.advance_order_status(
  p_order_id      UUID,
  p_new_status    public.order_status,
  p_note          TEXT DEFAULT NULL,
  p_tracking      TEXT DEFAULT NULL,
  p_carrier       TEXT DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   public.orders%ROWTYPE;
  v_prev    public.order_status;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

  v_prev := v_order.status;

  UPDATE public.orders
  SET status     = p_new_status,
      updated_at = now(),
      -- persist tracking if provided
      payment_id = CASE WHEN p_tracking IS NOT NULL THEN p_tracking ELSE payment_id END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  PERFORM public.log_order_event(
    p_order_id, 'status_advanced', v_prev, p_new_status,
    COALESCE(p_note, 'Status updated by admin'),
    jsonb_strip_nulls(jsonb_build_object('tracking', p_tracking, 'carrier', p_carrier))
  );

  RETURN v_order;
END;
$$;
