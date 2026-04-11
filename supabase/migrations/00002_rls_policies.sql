-- AWFood Ticket Management - Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_external_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_results ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- Helper: check if user is internal
------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_internal_user(uid uuid)
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_internal FROM profiles WHERE id = uid),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

------------------------------------------------------------
-- Helper: get user orgs
------------------------------------------------------------
CREATE OR REPLACE FUNCTION user_org_ids(uid uuid)
RETURNS SETOF uuid AS $$
  SELECT org_id FROM org_members WHERE user_id = uid AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

------------------------------------------------------------
-- Profiles
------------------------------------------------------------
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR is_internal_user(auth.uid()));

------------------------------------------------------------
-- Organizations
------------------------------------------------------------
CREATE POLICY "organizations_select" ON organizations FOR SELECT
  USING (
    deleted_at IS NULL AND (
      is_internal_user(auth.uid())
      OR id IN (SELECT user_org_ids(auth.uid()))
      OR parent_org_id IN (SELECT user_org_ids(auth.uid()))
    )
  );

CREATE POLICY "organizations_insert" ON organizations FOR INSERT
  WITH CHECK (is_internal_user(auth.uid()));

CREATE POLICY "organizations_update" ON organizations FOR UPDATE
  USING (is_internal_user(auth.uid()));

------------------------------------------------------------
-- Org Members
------------------------------------------------------------
CREATE POLICY "org_members_select" ON org_members FOR SELECT
  USING (
    is_internal_user(auth.uid())
    OR org_id IN (SELECT user_org_ids(auth.uid()))
  );

CREATE POLICY "org_members_insert" ON org_members FOR INSERT
  WITH CHECK (
    is_internal_user(auth.uid())
    OR (
      org_id IN (SELECT user_org_ids(auth.uid()))
      AND EXISTS (
        SELECT 1 FROM org_members
        WHERE user_id = auth.uid() AND org_id = org_members.org_id AND role = 'org_admin'
      )
    )
  );

CREATE POLICY "org_members_update" ON org_members FOR UPDATE
  USING (
    is_internal_user(auth.uid())
    OR (
      org_id IN (SELECT user_org_ids(auth.uid()))
      AND EXISTS (
        SELECT 1 FROM org_members om
        WHERE om.user_id = auth.uid() AND om.org_id = org_members.org_id AND om.role = 'org_admin'
      )
    )
  );

------------------------------------------------------------
-- Tickets
------------------------------------------------------------
CREATE POLICY "tickets_select" ON tickets FOR SELECT
  USING (
    deleted_at IS NULL AND (
      is_internal_user(auth.uid())
      OR (
        org_id IN (SELECT user_org_ids(auth.uid()))
        AND (
          created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM org_members
            WHERE user_id = auth.uid() AND org_id = tickets.org_id AND role = 'org_admin'
          )
        )
      )
    )
  );

CREATE POLICY "tickets_insert" ON tickets FOR INSERT
  WITH CHECK (
    is_internal_user(auth.uid())
    OR org_id IN (SELECT user_org_ids(auth.uid()))
  );

CREATE POLICY "tickets_update" ON tickets FOR UPDATE
  USING (
    is_internal_user(auth.uid())
    OR (
      org_id IN (SELECT user_org_ids(auth.uid()))
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM org_members
          WHERE user_id = auth.uid() AND org_id = tickets.org_id AND role = 'org_admin'
        )
      )
    )
  );

------------------------------------------------------------
-- Ticket Comments
------------------------------------------------------------
CREATE POLICY "comments_select" ON ticket_comments FOR SELECT
  USING (
    deleted_at IS NULL AND (
      is_internal_user(auth.uid())
      OR (
        NOT is_internal
        AND ticket_id IN (
          SELECT id FROM tickets WHERE org_id IN (SELECT user_org_ids(auth.uid()))
        )
      )
    )
  );

CREATE POLICY "comments_insert" ON ticket_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND (
      is_internal_user(auth.uid())
      OR ticket_id IN (
        SELECT id FROM tickets WHERE org_id IN (SELECT user_org_ids(auth.uid()))
      )
    )
  );

------------------------------------------------------------
-- Ticket History
------------------------------------------------------------
CREATE POLICY "history_select" ON ticket_history FOR SELECT
  USING (
    is_internal_user(auth.uid())
    OR ticket_id IN (
      SELECT id FROM tickets WHERE org_id IN (SELECT user_org_ids(auth.uid()))
    )
  );

------------------------------------------------------------
-- Ticket Attachments
------------------------------------------------------------
CREATE POLICY "attachments_select" ON ticket_attachments FOR SELECT
  USING (
    is_internal_user(auth.uid())
    OR ticket_id IN (
      SELECT id FROM tickets WHERE org_id IN (SELECT user_org_ids(auth.uid()))
    )
  );

CREATE POLICY "attachments_insert" ON ticket_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      is_internal_user(auth.uid())
      OR ticket_id IN (
        SELECT id FROM tickets WHERE org_id IN (SELECT user_org_ids(auth.uid()))
      )
    )
  );

------------------------------------------------------------
-- Ticket Watchers
------------------------------------------------------------
CREATE POLICY "watchers_select" ON ticket_watchers FOR SELECT
  USING (
    is_internal_user(auth.uid())
    OR ticket_id IN (
      SELECT id FROM tickets WHERE org_id IN (SELECT user_org_ids(auth.uid()))
    )
  );

CREATE POLICY "watchers_manage" ON ticket_watchers FOR ALL
  USING (
    user_id = auth.uid()
    OR is_internal_user(auth.uid())
  );

------------------------------------------------------------
-- Notifications (user can only see own)
------------------------------------------------------------
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

------------------------------------------------------------
-- Internal-only tables
------------------------------------------------------------
CREATE POLICY "integration_configs_all" ON integration_configs FOR ALL
  USING (is_internal_user(auth.uid()));

CREATE POLICY "ai_settings_all" ON ai_settings FOR ALL
  USING (is_internal_user(auth.uid()));

CREATE POLICY "ai_analysis_select" ON ai_analysis_results FOR SELECT
  USING (is_internal_user(auth.uid()));

CREATE POLICY "ai_analysis_insert" ON ai_analysis_results FOR INSERT
  WITH CHECK (is_internal_user(auth.uid()));

------------------------------------------------------------
-- External Links (visible to org members, editable by internal)
------------------------------------------------------------
CREATE POLICY "external_links_select" ON ticket_external_links FOR SELECT
  USING (
    is_internal_user(auth.uid())
    OR ticket_id IN (
      SELECT id FROM tickets WHERE org_id IN (SELECT user_org_ids(auth.uid()))
    )
  );

CREATE POLICY "external_links_manage" ON ticket_external_links FOR ALL
  USING (is_internal_user(auth.uid()));

------------------------------------------------------------
-- Knowledge Base (published articles visible to all, editable by internal)
------------------------------------------------------------
CREATE POLICY "kb_select" ON knowledge_base_articles FOR SELECT
  USING (
    deleted_at IS NULL AND (
      is_internal_user(auth.uid())
      OR is_published = true
    )
  );

CREATE POLICY "kb_manage" ON knowledge_base_articles FOR ALL
  USING (is_internal_user(auth.uid()));

------------------------------------------------------------
-- SLA Policies & Templates (internal only)
------------------------------------------------------------
CREATE POLICY "sla_select" ON sla_policies FOR SELECT
  USING (is_internal_user(auth.uid()));

CREATE POLICY "sla_manage" ON sla_policies FOR ALL
  USING (is_internal_user(auth.uid()));

CREATE POLICY "templates_select" ON ticket_templates FOR SELECT
  USING (true); -- all authenticated users can see templates

CREATE POLICY "templates_manage" ON ticket_templates FOR ALL
  USING (is_internal_user(auth.uid()));

------------------------------------------------------------
-- Permissions (readable by all, manageable by internal)
------------------------------------------------------------
CREATE POLICY "permissions_select" ON permissions FOR SELECT
  USING (true);

CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT
  USING (true);

CREATE POLICY "role_permissions_manage" ON role_permissions FOR ALL
  USING (is_internal_user(auth.uid()));
