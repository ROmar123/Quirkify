-- Migration 024: Audit log table + secure log_audit RPC.
-- Captures business-level state changes (product CRUD, order status, wallet
-- credits/debits, withdrawals) so admins can trace who did what when. Stock
-- movements remain in inventory_movements; this is the higher-level layer.

CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_label  text,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text,
  before       jsonb,
  after        jsonb,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx  ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx  ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx   ON audit_logs (actor_id) WHERE actor_id IS NOT NULL;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins read everything, users see only their own actor rows.
CREATE POLICY "admins_read_audit"
  ON audit_logs FOR SELECT
  USING (auth_is_admin());

CREATE POLICY "users_read_own_audit"
  ON audit_logs FOR SELECT
  USING (actor_id = auth_profile_id());

CREATE POLICY "service_writes_audit"
  ON audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated callers must use log_audit() (SECURITY DEFINER) to insert.
CREATE OR REPLACE FUNCTION log_audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   text,
  p_before      jsonb,
  p_after       jsonb,
  p_metadata    jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_lbl  text;
  v_log_id     uuid;
BEGIN
  v_actor_id := auth_profile_id();
  IF v_actor_id IS NOT NULL THEN
    SELECT COALESCE(display_name, email, id::text) INTO v_actor_lbl
    FROM profiles WHERE id = v_actor_id;
  END IF;

  INSERT INTO audit_logs (actor_id, actor_label, action, entity_type, entity_id, before, after, metadata)
  VALUES (v_actor_id, v_actor_lbl, p_action, p_entity_type, p_entity_id, p_before, p_after, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_audit(text, text, text, jsonb, jsonb, jsonb) TO authenticated;
