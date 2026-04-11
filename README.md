# AWFood Suporte - Plataforma de Gerenciamento de Tickets

Plataforma interna de gerenciamento de tickets de suporte para atendimento aos clientes da plataforma AWFood. Desenvolvida com Next.js 16, Supabase e TailwindCSS.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui (Base UI) + Radix |
| Auth/DB/Storage/Realtime | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Editor Rich Text | TipTap (ProseMirror) |
| Forms | React Hook Form + Zod |
| Data Fetching | TanStack Query |
| Tabelas | TanStack Table |
| Charts | Recharts |
| i18n | next-intl (pt-BR default) |
| AI/Embeddings | OpenRouter / Claude / OpenAI + pgvector |
| Integracoes | Jira Cloud REST API + GitHub REST API |
| Email | Resend |

## Funcionalidades

### Tickets
- CRUD completo com ciclo de vida (7 estados)
- Editor WYSIWYG (TipTap) para descricao e comentarios
- Classificacao por prioridade, categoria, servico afetado, impacto
- Comentarios com formatacao rica, notas internas, respostas a comentarios especificos
- Upload de anexos (documentos, imagens, videos) via Supabase Storage
- Historico/timeline de alteracoes (audit trail automatico via triggers)
- SLA com politicas configuraveis por prioridade
- Tags e busca

### Templates de Tickets
- Templates pre-definidos com campos dinamicos (placeholders `{{campo}}`)
- 8 templates AWFood incluidos: cadastro de cliente, integracoes (iFood, 99Food, Cardapio Web), modulo fiscal, reporte de bug, impressora, suporte geral
- Gestao via interface (criar, editar, ativar/desativar)
- Seletor de template na criacao de ticket com formulario de preenchimento

### Clientes e Usuarios
- Organizacoes hierarquicas: clientes diretos e whitelabel com sub-clientes
- Usuarios de cliente (org_admin, org_member) com acesso restrito a sua org
- Usuarios internos AWFood (super_admin, admin, agent, viewer)
- Permissoes granulares por papel (20+ permissoes em 6 categorias)
- Convite de usuarios por email

### Integracoes
- **Jira**: configuracao via UI, criar/vincular issues, importar tickets recentes com re-sync, webhooks
- **GitHub**: configuracao via UI, criar/vincular issues/PRs, webhooks
- Credenciais encriptadas (AES-256-GCM) no banco

### Analise Inteligente (IA)
- Diagnostico automatico com contexto da plataforma AWFood
- Analise incremental (considera historico de comentarios e analises anteriores)
- Analise por comentario especifico (extrai insights tecnicos, sugere respostas)
- **Prompt Dev**: gera prompts estruturados para Claude Code com arquivos afetados, abordagem e testes (permissao `ai.dev_prompt`)
- Busca por tickets similares via embeddings (pgvector)
- Knowledge base com busca semantica (RAG)
- Suporte a OpenRouter, Claude (Anthropic) e OpenAI
- Otimizacao de tokens e tracking de custos

### Dashboard e Relatorios
- Cards de resumo: abertos, em progresso, resolvidos, SLA violado
- Graficos: tickets por status, prioridade, tendencia ao longo do tempo
- Tempo medio de primeira resposta e resolucao
- Desempenho por agente
- Filtros por periodo, organizacao, agente

### Email (Resend)
- Notificacao automatica de mudanca de status
- Digest diario (manha e tarde) para usuarios internos
- Templates HTML responsivos

### API Publica (v1)
- Autenticacao via API key (`Authorization: Bearer ak_...`)
- Scopes granulares: `tickets.read`, `tickets.write`, `comments.write`, `orgs.read`, `orgs.write`
- Keys vinculadas a organizacao ou globais
- Endpoints: `/api/v1/tickets`, `/api/v1/organizations`, `/api/v1/tickets/:id/comments`
- Gestao de API keys via interface

### Notificacoes
- Real-time via Supabase Realtime
- Triggers automaticos: atribuicao, novo comentario, mudanca de status
- Sino de notificacoes no header

## Setup

### Pre-requisitos
- Node.js 20+
- Conta no [Supabase](https://supabase.com)
- (Opcional) Conta no [Resend](https://resend.com) para emails

### Instalacao

```bash
cd ticket-management
npm install
cp .env.local.example .env.local
# Preencher as variaveis no .env.local
```

### Configuracao do Supabase

1. Criar projeto no [Supabase Dashboard](https://app.supabase.com)
2. Copiar URL e chaves para `.env.local`
3. No SQL Editor, executar as migrations em ordem:
   ```
   supabase/migrations/00001_initial_schema.sql
   supabase/migrations/00002_rls_policies.sql
   supabase/migrations/00003_seed_data.sql
   supabase/migrations/00004_pgvector_functions.sql
   supabase/migrations/00005_api_keys.sql
   supabase/migrations/00006_enhanced_templates.sql
   supabase/migrations/00007_dev_permissions.sql
   supabase/migrations/00008_comment_replies.sql
   ```
4. Criar bucket `ticket-attachments` no Supabase Storage

### Primeiro usuario

1. Registrar conta em `/register`
2. No SQL Editor do Supabase:
   ```sql
   UPDATE profiles SET is_internal = true
   WHERE id = (SELECT id FROM auth.users WHERE email = 'seu@email.com');

   INSERT INTO org_members (user_id, org_id, role)
   VALUES (
     (SELECT id FROM auth.users WHERE email = 'seu@email.com'),
     '00000000-0000-0000-0000-000000000001',
     'super_admin'
   );
   ```

### Desenvolvimento

```bash
npm run dev    # http://localhost:3000
npm run build  # Build de producao
npm run lint   # Linting
```

### Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Anon key do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Service role key |
| `ENCRYPTION_KEY` | Sim | 32 caracteres para AES-256-GCM |
| `NEXT_PUBLIC_APP_URL` | Sim | URL da aplicacao |
| `RESEND_API_KEY` | Nao | API key do Resend |
| `RESEND_FROM_EMAIL` | Nao | Email remetente |
| `INTERNAL_API_SECRET` | Nao | Secret para endpoints internos |

## Estrutura

```
src/
  app/
    (auth)/              # Login, registro, recuperar senha
    (dashboard)/         # Layout protegido com sidebar
      tickets/           # CRUD de tickets
      clients/           # Gestao de organizacoes
      users/             # Gestao de usuarios e permissoes
      knowledge-base/    # Base de conhecimento
      settings/          # Integracoes, IA, SLA, API keys, templates
      reports/           # Relatorios e metricas
    api/                 # Route handlers internos
    api/v1/              # API publica (API key auth)
  components/
    ui/                  # shadcn/ui primitives
    layout/              # Sidebar, header, notificacoes
    tickets/             # Componentes de tickets
    clients/             # Componentes de clientes
    dashboard/           # Charts e widgets
    settings/            # Componentes de configuracao
    shared/              # Editor WYSIWYG, upload, tag input
  lib/
    supabase/            # Client/server + auth helpers
    integrations/        # Jira, GitHub, encriptacao
    ai/                  # Provider, analyzer, similar finder, dev prompt
    email/               # Resend client, templates, envio
  hooks/                 # useUser context
  types/                 # TypeScript types
supabase/
  migrations/            # 8 migrations SQL
messages/                # i18n (pt-BR, en)
```

## Banco de Dados (18 tabelas)

| Tabela | Descricao |
|--------|-----------|
| `organizations` | Organizacoes (interna + clientes + whitelabel) |
| `profiles` | Perfis de usuario (extends auth.users) |
| `org_members` | Membros de organizacao com papel (RBAC) |
| `permissions` / `role_permissions` | Permissoes granulares |
| `tickets` | Tickets de suporte |
| `ticket_comments` | Comentarios, notas internas, prompts dev, respostas |
| `ticket_history` | Audit trail automatico |
| `ticket_attachments` | Anexos (Supabase Storage) |
| `ticket_watchers` | Observadores de tickets |
| `ticket_external_links` | Links com Jira/GitHub |
| `ticket_templates` | Templates pre-definidos |
| `sla_policies` | Politicas de SLA |
| `notifications` | Notificacoes in-app |
| `integration_configs` | Config Jira/GitHub (encriptadas) |
| `ai_settings` | Config IA (encriptadas) |
| `knowledge_base_articles` | Base de conhecimento com embeddings |
| `ai_analysis_results` | Resultados de analise IA |
| `api_keys` | Chaves de API publica |

## API Publica

```bash
# Criar ticket
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer ak_..." \
  -H "Content-Type: application/json" \
  -d '{"title":"Bug no login","description":"...","priority":"high"}'

# Listar tickets
curl http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer ak_..."

# Atualizar ticket
curl -X PATCH http://localhost:3000/api/v1/tickets/{id} \
  -H "Authorization: Bearer ak_..." \
  -d '{"status":"in_progress"}'

# Adicionar comentario
curl -X POST http://localhost:3000/api/v1/tickets/{id}/comments \
  -H "Authorization: Bearer ak_..." \
  -d '{"body":"Investigando o problema..."}'

# Criar organizacao
curl -X POST http://localhost:3000/api/v1/organizations \
  -H "Authorization: Bearer ak_..." \
  -d '{"name":"Pizzaria do Joao","slug":"pizzaria-joao"}'
```
