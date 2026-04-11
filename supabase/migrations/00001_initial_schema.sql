-- AWFood Ticket Management - Initial Schema
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

------------------------------------------------------------
-- 1. Organizations
------------------------------------------------------------
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  type            text NOT NULL CHECK (type IN ('internal', 'client', 'whitelabel')),
  parent_org_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  logo_url        text,
  settings        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_organizations_parent ON organizations(parent_org_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_type ON organizations(type);

------------------------------------------------------------
-- 2. Profiles (extends auth.users)
------------------------------------------------------------
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  avatar_url      text,
  is_internal     boolean DEFAULT false,
  phone           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 3. Organization Members (RBAC)
------------------------------------------------------------
CREATE TABLE org_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN (
    'super_admin', 'admin', 'agent', 'viewer',
    'org_admin', 'org_member'
  )),
  is_active       boolean DEFAULT true,
  invited_by      uuid REFERENCES profiles(id),
  joined_at       timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, org_id)
);

CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);

------------------------------------------------------------
-- 4. Permissions
------------------------------------------------------------
CREATE TABLE permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text UNIQUE NOT NULL,
  description     text,
  category        text NOT NULL
);

CREATE TABLE role_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role            text NOT NULL,
  permission_id   uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE (role, permission_id)
);

------------------------------------------------------------
-- 5. Tickets
------------------------------------------------------------
CREATE TABLE tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   text UNIQUE NOT NULL,
  org_id          uuid NOT NULL REFERENCES organizations(id),
  title           text NOT NULL,
  description     text NOT NULL,
  description_html text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'waiting_client', 'waiting_internal',
    'resolved', 'closed', 'cancelled'
  )),
  priority        text NOT NULL DEFAULT 'medium' CHECK (priority IN (
    'critical', 'high', 'medium', 'low'
  )),
  category        text,
  subcategory     text,
  affected_service text,
  environment     text,
  impact          text,
  steps_to_reproduce text,
  expected_behavior  text,
  actual_behavior    text,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  assigned_to     uuid REFERENCES profiles(id),
  resolved_by     uuid REFERENCES profiles(id),
  closed_by       uuid REFERENCES profiles(id),
  due_date        timestamptz,
  first_response_at timestamptz,
  resolved_at     timestamptz,
  closed_at       timestamptz,
  sla_breach      boolean DEFAULT false,
  tags            text[] DEFAULT '{}',
  metadata        jsonb DEFAULT '{}',
  embedding       vector(1536),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_tickets_org ON tickets(org_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);

-- Ticket number sequence and trigger
CREATE SEQUENCE ticket_number_seq;

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS trigger AS $$
BEGIN
  NEW.ticket_number := 'TK-' || to_char(now(), 'YYYY') || '-' ||
                       lpad(nextval('ticket_number_seq')::text, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION generate_ticket_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

------------------------------------------------------------
-- 6. Ticket Comments
------------------------------------------------------------
CREATE TABLE ticket_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id       uuid NOT NULL REFERENCES profiles(id),
  body            text NOT NULL,
  body_html       text,
  is_internal     boolean DEFAULT false,
  comment_type    text DEFAULT 'reply' CHECK (comment_type IN (
    'reply', 'internal_note', 'status_change', 'system', 'ai_analysis'
  )),
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_comments_author ON ticket_comments(author_id);
CREATE INDEX idx_comments_created ON ticket_comments(created_at);

------------------------------------------------------------
-- 7. Ticket History (Audit Trail)
------------------------------------------------------------
CREATE TABLE ticket_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  changed_by      uuid NOT NULL REFERENCES profiles(id),
  field_name      text NOT NULL,
  old_value       text,
  new_value       text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_history_ticket ON ticket_history(ticket_id);
CREATE INDEX idx_history_created ON ticket_history(created_at);

-- Auto-track ticket changes
CREATE OR REPLACE FUNCTION track_ticket_changes()
RETURNS trigger AS $$
DECLARE
  col text;
  old_val text;
  new_val text;
  tracked_cols text[] := ARRAY[
    'status', 'priority', 'category', 'assigned_to',
    'due_date', 'title', 'affected_service', 'impact'
  ];
BEGIN
  FOREACH col IN ARRAY tracked_cols LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col, col)
      INTO old_val, new_val
      USING OLD, NEW;
    IF old_val IS DISTINCT FROM new_val THEN
      INSERT INTO ticket_history (ticket_id, changed_by, field_name, old_value, new_value)
      VALUES (NEW.id, COALESCE(NEW.assigned_to, NEW.created_by), col, old_val, new_val);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_changes_trigger
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION track_ticket_changes();

------------------------------------------------------------
-- 8. Ticket Attachments
------------------------------------------------------------
CREATE TABLE ticket_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid REFERENCES tickets(id) ON DELETE SET NULL,
  comment_id      uuid REFERENCES ticket_comments(id) ON DELETE SET NULL,
  uploaded_by     uuid NOT NULL REFERENCES profiles(id),
  file_name       text NOT NULL,
  file_path       text NOT NULL,
  file_size       bigint NOT NULL,
  mime_type       text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  CHECK (ticket_id IS NOT NULL OR comment_id IS NOT NULL)
);

CREATE INDEX idx_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX idx_attachments_comment ON ticket_attachments(comment_id);

------------------------------------------------------------
-- 9. Ticket Watchers
------------------------------------------------------------
CREATE TABLE ticket_watchers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (ticket_id, user_id)
);

------------------------------------------------------------
-- 10. SLA Policies
------------------------------------------------------------
CREATE TABLE sla_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  org_id          uuid REFERENCES organizations(id),
  priority        text NOT NULL,
  first_response_hours integer NOT NULL,
  resolution_hours     integer NOT NULL,
  business_hours_only  boolean DEFAULT true,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_sla_org ON sla_policies(org_id);

------------------------------------------------------------
-- 11. Ticket Templates
------------------------------------------------------------
CREATE TABLE ticket_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text,
  title_template  text,
  body_template   text NOT NULL,
  default_priority text DEFAULT 'medium',
  created_by      uuid NOT NULL REFERENCES profiles(id),
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 12. Notifications
------------------------------------------------------------
CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticket_id       uuid REFERENCES tickets(id) ON DELETE CASCADE,
  type            text NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  is_read         boolean DEFAULT false,
  read_at         timestamptz,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

------------------------------------------------------------
-- 13. Integration Configs
------------------------------------------------------------
CREATE TABLE integration_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL CHECK (provider IN ('jira', 'github')),
  config          jsonb NOT NULL DEFAULT '{}',
  is_active       boolean DEFAULT true,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  last_synced_at  timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (provider)
);

------------------------------------------------------------
-- 14. Ticket External Links
------------------------------------------------------------
CREATE TABLE ticket_external_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('jira', 'github')),
  external_id     text NOT NULL,
  external_url    text NOT NULL,
  external_status text,
  link_type       text DEFAULT 'related' CHECK (link_type IN (
    'created_from', 'related', 'blocks', 'blocked_by'
  )),
  sync_enabled    boolean DEFAULT true,
  last_synced_at  timestamptz,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (ticket_id, provider, external_id)
);

CREATE INDEX idx_external_links_ticket ON ticket_external_links(ticket_id);
CREATE INDEX idx_external_links_provider ON ticket_external_links(provider);

------------------------------------------------------------
-- 15. AI Settings
------------------------------------------------------------
CREATE TABLE ai_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL CHECK (provider IN ('openrouter', 'claude', 'openai')),
  api_key_encrypted text NOT NULL,
  default_model   text,
  is_active       boolean DEFAULT true,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (provider)
);

------------------------------------------------------------
-- 16. Knowledge Base Articles
------------------------------------------------------------
CREATE TABLE knowledge_base_articles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  content         text NOT NULL,
  content_html    text,
  category        text,
  tags            text[] DEFAULT '{}',
  is_published    boolean DEFAULT true,
  embedding       vector(1536),
  created_by      uuid NOT NULL REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_kb_category ON knowledge_base_articles(category);

------------------------------------------------------------
-- 17. AI Analysis Results
------------------------------------------------------------
CREATE TABLE ai_analysis_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  analysis_type   text NOT NULL,
  result          jsonb NOT NULL,
  model_used      text NOT NULL,
  tokens_used     integer,
  cost_usd        decimal(10,6),
  created_by      uuid NOT NULL REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_ticket ON ai_analysis_results(ticket_id);
CREATE INDEX idx_ai_type ON ai_analysis_results(analysis_type);

------------------------------------------------------------
-- 18. Auto-create profile on signup
------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

------------------------------------------------------------
-- 19. Notification trigger on ticket events
------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_ticket_assigned()
RETURNS trigger AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND
     (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    INSERT INTO notifications (user_id, ticket_id, type, title, body)
    VALUES (
      NEW.assigned_to,
      NEW.id,
      'ticket_assigned',
      'Ticket atribuído a você',
      'O ticket ' || NEW.ticket_number || ' foi atribuído a você: ' || NEW.title
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_assigned_notification
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_assigned();

CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS trigger AS $$
DECLARE
  t record;
  watcher record;
BEGIN
  SELECT * INTO t FROM tickets WHERE id = NEW.ticket_id;

  -- Notify ticket creator if commenter is different
  IF t.created_by != NEW.author_id THEN
    INSERT INTO notifications (user_id, ticket_id, type, title, body)
    VALUES (
      t.created_by,
      NEW.ticket_id,
      'new_comment',
      'Novo comentário no ticket',
      'Novo comentário no ticket ' || t.ticket_number || ': ' || t.title
    );
  END IF;

  -- Notify assigned agent if different from commenter and creator
  IF t.assigned_to IS NOT NULL
     AND t.assigned_to != NEW.author_id
     AND t.assigned_to != t.created_by THEN
    INSERT INTO notifications (user_id, ticket_id, type, title, body)
    VALUES (
      t.assigned_to,
      NEW.ticket_id,
      'new_comment',
      'Novo comentário no ticket',
      'Novo comentário no ticket ' || t.ticket_number || ': ' || t.title
    );
  END IF;

  -- Notify watchers
  FOR watcher IN
    SELECT user_id FROM ticket_watchers
    WHERE ticket_id = NEW.ticket_id
      AND user_id != NEW.author_id
      AND user_id != t.created_by
      AND user_id != COALESCE(t.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    INSERT INTO notifications (user_id, ticket_id, type, title, body)
    VALUES (
      watcher.user_id,
      NEW.ticket_id,
      'new_comment',
      'Novo comentário no ticket',
      'Novo comentário no ticket ' || t.ticket_number || ': ' || t.title
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_notification
  AFTER INSERT ON ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();
