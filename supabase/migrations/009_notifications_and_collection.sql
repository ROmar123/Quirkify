-- ============================================================
-- Migration 009: Notifications + Collection Items
-- Moves notifications and collection tracking from Firestore
-- to Supabase so all non-realtime data lives in one place.
-- Run in: Supabase dashboard → SQL editor
-- ============================================================

-- ── Notifications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid  text        NOT NULL,  -- Supabase auth UID (same as profiles.firebase_uid)
  title         text        NOT NULL,
  message       text        NOT NULL,
  type          text        NOT NULL DEFAULT 'system',
  read          boolean     NOT NULL DEFAULT false,
  link          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_firebase_uid_idx
  ON notifications (firebase_uid);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (firebase_uid, read)
  WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
DROP POLICY IF EXISTS "Users read own notifications"   ON notifications;
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (firebase_uid = auth.uid()::text);

-- Users can mark their own notifications as read / delete them
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (firebase_uid = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own notifications" ON notifications;
CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE
  USING (firebase_uid = auth.uid()::text);

-- Service role can insert (from API routes / webhooks)
DROP POLICY IF EXISTS "Service insert notifications"   ON notifications;
CREATE POLICY "Service insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime for instant bell-icon updates
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- ── Collection Items ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS collection_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  product_id     uuid        REFERENCES products (id) ON DELETE SET NULL,
  acquired_at    timestamptz NOT NULL DEFAULT now(),
  purchase_price numeric(10, 2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS collection_items_profile_id_idx
  ON collection_items (profile_id);

ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- Users can read their own collection
DROP POLICY IF EXISTS "Users read own collection"  ON collection_items;
CREATE POLICY "Users read own collection"
  ON collection_items FOR SELECT
  USING (
    profile_id = (
      SELECT id FROM profiles WHERE firebase_uid = auth.uid()::text LIMIT 1
    )
  );

-- Service role can insert (triggered by order payment webhook)
DROP POLICY IF EXISTS "Service insert collection" ON collection_items;
CREATE POLICY "Service insert collection"
  ON collection_items FOR INSERT
  WITH CHECK (true);

-- Enable realtime so vault updates live after purchase
ALTER PUBLICATION supabase_realtime ADD TABLE collection_items;
