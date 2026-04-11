-- AWFood Ticket Management - Seed Data

------------------------------------------------------------
-- 1. Internal Organization (AWFood)
------------------------------------------------------------
INSERT INTO organizations (id, name, slug, type, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'AWFood',
  'awfood',
  'internal',
  '{"theme": "default"}'
);

------------------------------------------------------------
-- 2. Default Permissions
------------------------------------------------------------
INSERT INTO permissions (name, description, category) VALUES
  -- Tickets
  ('tickets.create', 'Criar tickets', 'tickets'),
  ('tickets.view', 'Visualizar tickets', 'tickets'),
  ('tickets.update', 'Atualizar tickets', 'tickets'),
  ('tickets.assign', 'Atribuir tickets', 'tickets'),
  ('tickets.close', 'Fechar tickets', 'tickets'),
  ('tickets.delete', 'Excluir tickets', 'tickets'),
  -- Users
  ('users.view', 'Visualizar usuários', 'users'),
  ('users.manage', 'Gerenciar usuários', 'users'),
  ('users.invite', 'Convidar usuários', 'users'),
  -- Organizations
  ('orgs.view', 'Visualizar organizações', 'organizations'),
  ('orgs.manage', 'Gerenciar organizações', 'organizations'),
  -- Settings
  ('settings.view', 'Visualizar configurações', 'settings'),
  ('settings.manage', 'Gerenciar configurações', 'settings'),
  ('settings.integrations', 'Configurar integrações', 'integrations'),
  -- AI
  ('ai.analyze', 'Executar análise IA', 'ai'),
  ('ai.configure', 'Configurar IA', 'ai'),
  -- Reports
  ('reports.view', 'Visualizar relatórios', 'reports'),
  ('reports.export', 'Exportar relatórios', 'reports'),
  -- Knowledge Base
  ('kb.view', 'Visualizar base de conhecimento', 'knowledge_base'),
  ('kb.manage', 'Gerenciar base de conhecimento', 'knowledge_base');

-- Grant all permissions to super_admin
INSERT INTO role_permissions (role, permission_id)
SELECT 'super_admin', id FROM permissions;

-- Grant most permissions to admin (except settings.manage and ai.configure)
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
WHERE name NOT IN ('settings.manage', 'ai.configure');

-- Grant operational permissions to agent
INSERT INTO role_permissions (role, permission_id)
SELECT 'agent', id FROM permissions
WHERE name IN (
  'tickets.create', 'tickets.view', 'tickets.update', 'tickets.assign', 'tickets.close',
  'users.view', 'orgs.view', 'ai.analyze', 'reports.view', 'kb.view'
);

-- Grant view-only permissions to viewer
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions
WHERE name IN ('tickets.view', 'users.view', 'orgs.view', 'reports.view', 'kb.view');

------------------------------------------------------------
-- 3. Default SLA Policies
------------------------------------------------------------
INSERT INTO sla_policies (name, priority, first_response_hours, resolution_hours, business_hours_only) VALUES
  ('Crítico', 'critical', 1, 4, false),
  ('Alto', 'high', 4, 24, true),
  ('Médio', 'medium', 8, 48, true),
  ('Baixo', 'low', 24, 120, true);
