-- AWFood Ticket Management - API Keys for Public API

CREATE TABLE api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  key_hash        text UNIQUE NOT NULL,
  key_prefix      text NOT NULL,
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  scopes          text[] DEFAULT '{}',
  is_active       boolean DEFAULT true,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_org ON api_keys(org_id);

-- RLS: only internal users can manage API keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_all" ON api_keys FOR ALL
  USING (is_internal_user(auth.uid()));
