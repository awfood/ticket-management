-- Developer-specific permissions and comment type

-- New permission
INSERT INTO permissions (name, description, category) VALUES
  ('ai.dev_prompt', 'Gerar prompts de desenvolvimento via IA', 'ai')
ON CONFLICT (name) DO NOTHING;

-- Grant to super_admin only by default (devs need explicit grant)
INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin', id FROM permissions WHERE name = 'ai.dev_prompt'
ON CONFLICT (role, permission_id) DO NOTHING;

-- Allow 'dev_note' as comment_type
ALTER TABLE ticket_comments DROP CONSTRAINT IF EXISTS ticket_comments_comment_type_check;
ALTER TABLE ticket_comments ADD CONSTRAINT ticket_comments_comment_type_check
  CHECK (comment_type IN (
    'reply', 'internal_note', 'status_change', 'system', 'ai_analysis', 'dev_note', 'ai_dev_prompt'
  ));
