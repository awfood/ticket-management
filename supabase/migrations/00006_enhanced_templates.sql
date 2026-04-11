-- AWFood Ticket Management - Enhanced Templates

-- Drop existing ticket_templates and recreate with more fields
DROP TABLE IF EXISTS ticket_templates;

CREATE TABLE ticket_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  category        text,
  icon            text DEFAULT 'FileText',
  title_template  text NOT NULL,
  body_template   text NOT NULL,
  default_priority text DEFAULT 'medium',
  default_category text,
  default_service  text,
  default_assigned_to uuid REFERENCES profiles(id),
  default_tags     text[] DEFAULT '{}',
  fields          jsonb DEFAULT '[]',  -- dynamic fields: [{ key, label, placeholder, required }]
  sort_order      integer DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_select" ON ticket_templates FOR SELECT
  USING (true);

CREATE POLICY "templates_manage" ON ticket_templates FOR ALL
  USING (is_internal_user(auth.uid()));

-- Seed default AWFood templates
INSERT INTO ticket_templates (
  name, description, category, icon,
  title_template, body_template,
  default_priority, default_category, default_service,
  default_tags, fields, sort_order, created_by
) VALUES
-- 1. Cadastro de novo cliente
(
  'Cadastro de novo cliente',
  'Solicitacao para cadastrar uma nova empresa/restaurante na plataforma AWFood',
  'onboarding',
  'UserPlus',
  'Cadastro de novo cliente: {{nome_empresa}}',
  '## Dados do Cliente

**Empresa:** {{nome_empresa}}
**CNPJ:** {{cnpj}}
**Responsavel:** {{nome_responsavel}}
**Telefone:** {{telefone}}
**E-mail:** {{email}}

## Endereco
**Endereco completo:** {{endereco}}
**Cidade/UF:** {{cidade_uf}}

## Plano Contratado
**Plano:** {{plano}}
**Modulos:** {{modulos}}

## Observacoes
{{observacoes}}',
  'medium',
  'configuration',
  'painel',
  ARRAY['onboarding', 'novo-cliente'],
  '[
    {"key": "nome_empresa", "label": "Nome da empresa", "placeholder": "Ex: Pizzaria do Joao", "required": true},
    {"key": "cnpj", "label": "CNPJ", "placeholder": "00.000.000/0000-00", "required": true},
    {"key": "nome_responsavel", "label": "Nome do responsavel", "placeholder": "Nome completo", "required": true},
    {"key": "telefone", "label": "Telefone", "placeholder": "(00) 00000-0000", "required": true},
    {"key": "email", "label": "E-mail", "placeholder": "email@empresa.com", "required": true},
    {"key": "endereco", "label": "Endereco completo", "placeholder": "Rua, numero, bairro", "required": true},
    {"key": "cidade_uf", "label": "Cidade/UF", "placeholder": "Sao Paulo/SP", "required": true},
    {"key": "plano", "label": "Plano contratado", "placeholder": "Basico / Profissional / Enterprise", "required": true},
    {"key": "modulos", "label": "Modulos contratados", "placeholder": "PDV, Delivery, Fiscal...", "required": false},
    {"key": "observacoes", "label": "Observacoes", "placeholder": "Informacoes adicionais...", "required": false}
  ]'::jsonb,
  1,
  NULL
),

-- 2. Ativar integracao iFood
(
  'Ativar integracao iFood',
  'Solicitacao para configurar e ativar a integracao com o iFood para um cliente',
  'integration',
  'ShoppingBag',
  'Ativar integracao iFood: {{nome_empresa}}',
  '## Dados da Integracao

**Cliente:** {{nome_empresa}}
**Slug/ID:** {{slug_cliente}}
**ID da loja no iFood:** {{ifood_merchant_id}}

## Credenciais iFood
**Client ID:** {{ifood_client_id}}
**Client Secret:** {{ifood_client_secret}}

## Configuracoes
**Aceite automatico:** {{aceite_automatico}}
**Importar cardapio:** {{importar_cardapio}}

## Observacoes
{{observacoes}}',
  'medium',
  'integration',
  'painel',
  ARRAY['integracao', 'ifood'],
  '[
    {"key": "nome_empresa", "label": "Nome da empresa", "placeholder": "Pizzaria do Joao", "required": true},
    {"key": "slug_cliente", "label": "Slug do cliente na AWFood", "placeholder": "pizzaria-do-joao", "required": true},
    {"key": "ifood_merchant_id", "label": "ID da loja no iFood", "placeholder": "Merchant ID", "required": true},
    {"key": "ifood_client_id", "label": "Client ID iFood", "placeholder": "Fornecido pelo iFood", "required": true},
    {"key": "ifood_client_secret", "label": "Client Secret iFood", "placeholder": "Fornecido pelo iFood", "required": true},
    {"key": "aceite_automatico", "label": "Aceite automatico de pedidos?", "placeholder": "Sim / Nao", "required": true},
    {"key": "importar_cardapio", "label": "Importar cardapio do iFood?", "placeholder": "Sim / Nao", "required": true},
    {"key": "observacoes", "label": "Observacoes", "placeholder": "Informacoes adicionais", "required": false}
  ]'::jsonb,
  2,
  NULL
),

-- 3. Ativar integracao 99Food
(
  'Ativar integracao 99Food',
  'Solicitacao para configurar e ativar a integracao com o 99Food',
  'integration',
  'Bike',
  'Ativar integracao 99Food: {{nome_empresa}}',
  '## Dados da Integracao

**Cliente:** {{nome_empresa}}
**Slug/ID:** {{slug_cliente}}

## Credenciais 99Food
**Store ID:** {{store_id}}
**Token de acesso:** {{access_token}}

## Configuracoes
**Aceite automatico:** {{aceite_automatico}}

## Observacoes
{{observacoes}}',
  'medium',
  'integration',
  'painel',
  ARRAY['integracao', '99food'],
  '[
    {"key": "nome_empresa", "label": "Nome da empresa", "required": true},
    {"key": "slug_cliente", "label": "Slug do cliente", "required": true},
    {"key": "store_id", "label": "Store ID no 99Food", "required": true},
    {"key": "access_token", "label": "Token de acesso", "required": true},
    {"key": "aceite_automatico", "label": "Aceite automatico?", "placeholder": "Sim / Nao", "required": true},
    {"key": "observacoes", "label": "Observacoes", "required": false}
  ]'::jsonb,
  3,
  NULL
),

-- 4. Ativar integracao Cardapio Web
(
  'Ativar integracao Cardapio Web',
  'Solicitacao para configurar o cardapio web (site de delivery proprio) de um cliente',
  'integration',
  'Globe',
  'Ativar Cardapio Web: {{nome_empresa}}',
  '## Dados do Cardapio Web

**Cliente:** {{nome_empresa}}
**Slug/ID:** {{slug_cliente}}
**Dominio desejado:** {{dominio}}
**Subdominio AWFood:** {{subdominio}}.awfood.com.br

## Configuracoes
**Cor primaria:** {{cor_primaria}}
**Logo (URL ou anexar):** {{logo_url}}
**Raio de entrega (km):** {{raio_entrega}}
**Taxa de entrega padrao:** {{taxa_entrega}}
**Formas de pagamento online:** {{pagamento_online}}
**PIX habilitado:** {{pix_habilitado}}

## Observacoes
{{observacoes}}',
  'medium',
  'integration',
  'site',
  ARRAY['integracao', 'cardapio-web', 'site'],
  '[
    {"key": "nome_empresa", "label": "Nome da empresa", "required": true},
    {"key": "slug_cliente", "label": "Slug do cliente", "required": true},
    {"key": "dominio", "label": "Dominio proprio (se houver)", "placeholder": "www.pizzariadojoao.com.br", "required": false},
    {"key": "subdominio", "label": "Subdominio AWFood", "placeholder": "pizzariadojoao", "required": true},
    {"key": "cor_primaria", "label": "Cor primaria da marca", "placeholder": "#FF0000", "required": false},
    {"key": "logo_url", "label": "URL do logo ou anexar arquivo", "required": false},
    {"key": "raio_entrega", "label": "Raio de entrega (km)", "placeholder": "5", "required": true},
    {"key": "taxa_entrega", "label": "Taxa de entrega padrao (R$)", "placeholder": "5.00", "required": true},
    {"key": "pagamento_online", "label": "Formas de pagamento online", "placeholder": "Cartao credito, debito, PIX", "required": true},
    {"key": "pix_habilitado", "label": "PIX habilitado?", "placeholder": "Sim / Nao", "required": true},
    {"key": "observacoes", "label": "Observacoes", "required": false}
  ]'::jsonb,
  4,
  NULL
),

-- 5. Ativar modulo fiscal (NFCe/NFe)
(
  'Ativar modulo fiscal',
  'Solicitacao para configurar e ativar a emissao de NFCe/NFe para um cliente',
  'configuration',
  'FileCheck',
  'Ativar modulo fiscal: {{nome_empresa}}',
  '## Dados Fiscais

**Cliente:** {{nome_empresa}}
**Slug/ID:** {{slug_cliente}}
**CNPJ:** {{cnpj}}
**Inscricao Estadual:** {{inscricao_estadual}}
**Regime tributario:** {{regime_tributario}}

## Certificado Digital
**Tipo:** {{tipo_certificado}}
**Validade:** {{validade_certificado}}
**Arquivo anexado:** (anexar certificado .pfx)
**Senha do certificado:** {{senha_certificado}}

## Configuracoes NFCe
**Ambiente:** {{ambiente}}
**Serie:** {{serie_nfce}}
**CSC (Token):** {{csc_token}}
**ID do CSC:** {{csc_id}}

## Configuracoes NFe (se aplicavel)
**Serie NFe:** {{serie_nfe}}
**Natureza da operacao:** {{natureza_operacao}}

## Observacoes
{{observacoes}}',
  'high',
  'configuration',
  'painel',
  ARRAY['fiscal', 'nfce', 'nfe'],
  '[
    {"key": "nome_empresa", "label": "Nome da empresa", "required": true},
    {"key": "slug_cliente", "label": "Slug do cliente", "required": true},
    {"key": "cnpj", "label": "CNPJ", "required": true},
    {"key": "inscricao_estadual", "label": "Inscricao Estadual", "required": true},
    {"key": "regime_tributario", "label": "Regime tributario", "placeholder": "Simples Nacional / Lucro Presumido / Lucro Real", "required": true},
    {"key": "tipo_certificado", "label": "Tipo do certificado", "placeholder": "A1 / A3", "required": true},
    {"key": "validade_certificado", "label": "Data de validade", "placeholder": "DD/MM/AAAA", "required": true},
    {"key": "senha_certificado", "label": "Senha do certificado", "required": true},
    {"key": "ambiente", "label": "Ambiente", "placeholder": "Producao / Homologacao", "required": true},
    {"key": "serie_nfce", "label": "Serie NFCe", "placeholder": "1", "required": true},
    {"key": "csc_token", "label": "CSC (Token SEFAZ)", "required": true},
    {"key": "csc_id", "label": "ID do CSC", "required": true},
    {"key": "serie_nfe", "label": "Serie NFe", "placeholder": "1", "required": false},
    {"key": "natureza_operacao", "label": "Natureza da operacao", "placeholder": "Venda de mercadoria", "required": false},
    {"key": "observacoes", "label": "Observacoes", "required": false}
  ]'::jsonb,
  5,
  NULL
),

-- 6. Reportar bug
(
  'Reportar bug',
  'Template padrao para reporte de bugs encontrados na plataforma',
  'bug',
  'Bug',
  'Bug: {{titulo_resumido}}',
  '## Descricao do Bug

{{descricao_bug}}

## Passos para Reproduzir
1. {{passo_1}}
2. {{passo_2}}
3. {{passo_3}}

## Comportamento Esperado
{{comportamento_esperado}}

## Comportamento Atual
{{comportamento_atual}}

## Ambiente
**Servico afetado:** {{servico}}
**Navegador/Dispositivo:** {{navegador}}
**URL onde ocorreu:** {{url}}
**Cliente afetado:** {{cliente_afetado}}

## Evidencias
(anexar screenshots ou videos)',
  'high',
  'bug',
  NULL,
  ARRAY['bug'],
  '[
    {"key": "titulo_resumido", "label": "Titulo resumido do bug", "placeholder": "Ex: Erro ao salvar produto", "required": true},
    {"key": "descricao_bug", "label": "Descricao detalhada", "placeholder": "Descreva o que esta acontecendo", "required": true},
    {"key": "passo_1", "label": "Passo 1", "placeholder": "Acessar a pagina X", "required": true},
    {"key": "passo_2", "label": "Passo 2", "placeholder": "Clicar em Y", "required": false},
    {"key": "passo_3", "label": "Passo 3", "placeholder": "Observar o erro Z", "required": false},
    {"key": "comportamento_esperado", "label": "O que deveria acontecer?", "required": true},
    {"key": "comportamento_atual", "label": "O que esta acontecendo?", "required": true},
    {"key": "servico", "label": "Servico afetado", "placeholder": "Painel / PDV / API / Admin / Site", "required": true},
    {"key": "navegador", "label": "Navegador/Dispositivo", "placeholder": "Chrome 120, Android 14...", "required": false},
    {"key": "url", "label": "URL onde ocorreu", "required": false},
    {"key": "cliente_afetado", "label": "Cliente afetado (se especifico)", "required": false}
  ]'::jsonb,
  6,
  NULL
),

-- 7. Configuracao de impressora
(
  'Configuracao de impressora',
  'Solicitacao para configurar impressora termica no PDV do cliente',
  'configuration',
  'Printer',
  'Configurar impressora: {{nome_empresa}}',
  '## Dados da Configuracao

**Cliente:** {{nome_empresa}}
**Slug/ID:** {{slug_cliente}}

## Impressora
**Modelo:** {{modelo_impressora}}
**Tipo de conexao:** {{tipo_conexao}}
**IP da impressora (se rede):** {{ip_impressora}}
**Porta:** {{porta}}

## Configuracoes de Impressao
**Imprimir automaticamente:** {{impressao_automatica}}
**Copias por pedido:** {{copias}}
**Imprimir detalhes do cliente:** {{detalhes_cliente}}

## Observacoes
{{observacoes}}',
  'low',
  'configuration',
  'pdv',
  ARRAY['impressora', 'pdv', 'configuracao'],
  '[
    {"key": "nome_empresa", "label": "Nome da empresa", "required": true},
    {"key": "slug_cliente", "label": "Slug do cliente", "required": true},
    {"key": "modelo_impressora", "label": "Modelo da impressora", "placeholder": "Epson TM-T20X, Elgin i9...", "required": true},
    {"key": "tipo_conexao", "label": "Tipo de conexao", "placeholder": "USB / Rede / Bluetooth", "required": true},
    {"key": "ip_impressora", "label": "IP (se conexao por rede)", "placeholder": "192.168.1.100", "required": false},
    {"key": "porta", "label": "Porta", "placeholder": "9100", "required": false},
    {"key": "impressao_automatica", "label": "Impressao automatica?", "placeholder": "Sim / Nao", "required": true},
    {"key": "copias", "label": "Copias por pedido", "placeholder": "1", "required": true},
    {"key": "detalhes_cliente", "label": "Imprimir dados do cliente?", "placeholder": "Sim / Nao", "required": true},
    {"key": "observacoes", "label": "Observacoes", "required": false}
  ]'::jsonb,
  7,
  NULL
),

-- 8. Suporte geral
(
  'Suporte geral',
  'Template generico para solicitacoes de suporte diversas',
  'support',
  'HelpCircle',
  '{{assunto}}',
  '## Descricao

{{descricao}}

## Informacoes Adicionais
**Cliente:** {{cliente}}
**Servico:** {{servico}}
**Urgencia:** {{urgencia}}

## Observacoes
{{observacoes}}',
  'medium',
  'support',
  NULL,
  ARRAY['suporte'],
  '[
    {"key": "assunto", "label": "Assunto", "placeholder": "Descreva brevemente o problema", "required": true},
    {"key": "descricao", "label": "Descricao detalhada", "placeholder": "Explique o que precisa de ajuda", "required": true},
    {"key": "cliente", "label": "Cliente (se especifico)", "required": false},
    {"key": "servico", "label": "Servico relacionado", "placeholder": "Painel / PDV / API / Admin / Site", "required": false},
    {"key": "urgencia", "label": "Nivel de urgencia", "placeholder": "Baixo / Medio / Alto / Critico", "required": false},
    {"key": "observacoes", "label": "Observacoes adicionais", "required": false}
  ]'::jsonb,
  8,
  NULL
);
