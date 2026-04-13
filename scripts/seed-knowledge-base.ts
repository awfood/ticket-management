/**
 * Script de seed da base de conhecimento do AW Food
 *
 * Uso: npx tsx scripts/seed-knowledge-base.ts
 *
 * Requer:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Alternativa: usar a API pública v1:
 *   curl -X POST https://tickets.awfood.com.br/api/v1/knowledge-base/bulk \
 *     -H "Authorization: Bearer ak_..." \
 *     -H "Content-Type: application/json" \
 *     -d @scripts/kb-articles.json
 */

interface Article {
  title: string
  content: string
  category: string
  tags: string[]
  slug: string
  sort_order: number
  is_published: boolean
  source: string
  review_status: string
}

const articles: Article[] = [
  // ==========================================
  // CATEGORIA: GERAL - Primeiros Passos
  // ==========================================
  {
    title: 'Bem-vindo ao AW Food — Visão Geral da Plataforma',
    content: `O AW Food é uma plataforma completa de gestão para restaurantes, lanchonetes, pizzarias e dark kitchens. A plataforma é composta por 4 módulos principais que trabalham integrados:

**Painel de Gestão (Retaguarda)**
O painel é onde você gerencia todo o seu restaurante: cardápio, pedidos, financeiro, estoque, fiscal (NFC-e/NF-e), integrações com marketplaces e configurações gerais. Acesse pelo navegador em qualquer dispositivo.

**PDV (Ponto de Venda)**
O PDV é o sistema usado no balcão para registrar vendas, controlar mesas e comandas, emitir NFC-e e gerenciar o caixa. Funciona tanto online quanto offline (modo contingência).

**Cardápio Digital**
Seu cardápio online personalizado onde seus clientes fazem pedidos diretamente, sem comissão de marketplace. Funciona como um site/app do seu restaurante.

**App de Delivery**
Aplicativo para seus clientes fazerem pedidos de delivery com rastreamento em tempo real.

**Como funciona a integração?**
Todos os módulos compartilham os mesmos dados. Quando você cadastra um produto no painel, ele aparece automaticamente no PDV e no cardápio digital. Quando um pedido chega pelo cardápio digital ou por um marketplace (iFood, Rappi, etc.), ele aparece em tempo real no PDV.

**Teste Grátis**
Ao se cadastrar, você recebe 7 dias de teste grátis com acesso completo a todas as funcionalidades. Não é necessário cartão de crédito.`,
    category: 'geral',
    tags: ['inicio', 'visao-geral', 'plataforma', 'modulos'],
    slug: 'bem-vindo-visao-geral',
    sort_order: 1,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'Primeiro Acesso — Como Configurar Seu Restaurante',
    content: `Após o cadastro, siga estes passos para configurar seu restaurante no AW Food:

**1. Acesse o Painel**
Use o link, e-mail e senha que você recebeu por e-mail e WhatsApp. O endereço do painel segue o formato: https://www.awfood.com.br/seu-restaurante

**2. Complete as Informações Básicas**
No menu Configurações > Informações, preencha:
- Nome do restaurante
- CNPJ
- Endereço completo
- Telefone e e-mail de contato
- Logo do restaurante (recomendado: 500x500px, PNG ou JPG)

**3. Configure os Horários de Funcionamento**
Em Configurações > Horários, defina os dias e horários que seu restaurante opera. Isso controla quando o cardápio digital fica disponível para pedidos.

**4. Monte Seu Cardápio**
Acesse Cardápio > Categorias para criar as categorias (ex: Hambúrgueres, Bebidas, Sobremesas). Depois, em Cardápio > Produtos, cadastre os itens com nome, descrição, preço e foto.

**5. Configure os Meios de Pagamento**
Em Configurações > Meios de Pagamento, ative os métodos que seu restaurante aceita (Dinheiro, PIX, Cartão de Crédito, etc.).

**6. Configure a Área de Entrega (se aplicável)**
Se você trabalha com delivery, acesse Configurações > Área de Entrega para definir os bairros ou raio de entrega e as taxas.

**7. Ative o Cardápio Digital**
Após configurar o cardápio e as formas de pagamento, seu cardápio digital já estará disponível no endereço: https://pedidos.awfood.com.br/seu-restaurante`,
    category: 'geral',
    tags: ['primeiro-acesso', 'configuracao', 'setup', 'inicio'],
    slug: 'primeiro-acesso-configuracao',
    sort_order: 2,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'Como Acessar o PDV (Ponto de Venda)',
    content: `O PDV do AW Food é acessado pelo navegador e possui um usuário separado do painel.

**Endereço de Acesso**
https://pdv.awfood.com.br/seu-restaurante

**Credenciais Padrão**
- Usuário: operador
- Senha: a mesma informada no cadastro (geralmente os 6 primeiros dígitos do CNPJ)

**Requisitos**
- Navegador atualizado (Chrome, Edge ou Firefox)
- Conexão com internet (para receber pedidos em tempo real)
- Para impressão: instalar o QZ Tray (software de impressão térmica)

**Primeiro Uso**
1. Faça login com as credenciais acima
2. O sistema pedirá para selecionar o caixa (se houver mais de um configurado)
3. Abra o caixa informando o valor de fundo de troco
4. Pronto! Você já pode registrar vendas e receber pedidos

**Modo Offline**
O PDV funciona mesmo sem internet para registro de vendas locais. Quando a conexão voltar, os dados são sincronizados automaticamente.

**Dica:** Você pode criar usuários adicionais para o PDV no Painel, em Cadastros > Usuários, com diferentes níveis de permissão.`,
    category: 'pdv',
    tags: ['pdv', 'ponto-de-venda', 'acesso', 'login'],
    slug: 'como-acessar-pdv',
    sort_order: 3,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: CARDÁPIO
  // ==========================================
  {
    title: 'Como Cadastrar Produtos no Cardápio',
    content: `Para cadastrar produtos no seu cardápio digital:

**Criando Categorias**
1. Acesse Cardápio > Categorias
2. Clique em "Nova Categoria"
3. Informe o nome (ex: Hambúrgueres, Pizzas, Bebidas)
4. Defina a ordem de exibição
5. Salve

**Cadastrando Produtos**
1. Acesse Cardápio > Produtos
2. Clique em "Novo Produto"
3. Preencha:
   - Nome do produto
   - Descrição detalhada (aparece no cardápio digital)
   - Categoria
   - Preço de venda
   - Foto do produto (recomendado: 800x600px, máx 2MB)
4. Na aba "Variações", adicione tamanhos ou opções se necessário
5. Na aba "Complementos", configure adicionais (ex: queijo extra, bacon)
6. Salve

**Variações de Produto**
Variações permitem que um produto tenha diferentes tamanhos/tipos com preços diferentes. Exemplo: Pizza Margherita — Pequena R$30, Média R$45, Grande R$60.

**Complementos e Adicionais**
Grupos de complementos permitem que o cliente personalize o pedido. Você pode definir quantidade mínima e máxima de seleções, e preço adicional por item.

**Importação de Cardápio**
Se você já tem um cardápio no iFood, pode importá-lo automaticamente. Acesse Integrações > iFood > Importar Cardápio.

**Dica:** Produtos com foto vendem até 30% mais. Invista em boas fotos!`,
    category: 'cardapio',
    tags: ['produtos', 'cardapio', 'categorias', 'variacoes', 'complementos'],
    slug: 'como-cadastrar-produtos',
    sort_order: 10,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'Como Configurar Variações e Complementos',
    content: `Variações e complementos permitem personalizar seus produtos no cardápio.

**Variações (Grupos de Variação)**
Use variações quando um produto tem diferentes versões com preços diferentes.

Exemplos comuns:
- Pizza: Pequena, Média, Grande, Família
- Açaí: 300ml, 500ml, 700ml
- Marmita: P, M, G

Como criar:
1. Edite o produto
2. Vá na aba "Variações"
3. Crie um grupo (ex: "Tamanho")
4. Adicione as opções com seus respectivos preços
5. Salve

**Complementos (Grupos de Complementos)**
Use complementos para adicionais opcionais ou obrigatórios.

Exemplos:
- Adicionais de hambúrguer: Queijo extra (R$3), Bacon (R$4), Ovo (R$2)
- Borda de pizza: Catupiry (R$8), Cheddar (R$8)
- Molhos: Ketchup, Mostarda, Maionese (grátis)

Como criar:
1. Edite o produto
2. Vá na aba "Complementos"
3. Crie um grupo (ex: "Adicionais")
4. Defina:
   - Quantidade mínima (0 = opcional, 1+ = obrigatório)
   - Quantidade máxima de seleções
5. Adicione os itens com nome e preço
6. Salve

**Sincronização com Marketplaces**
Variações e complementos são sincronizados automaticamente com iFood, Rappi e outros marketplaces conectados. Qualquer alteração no AW Food é refletida nos marketplaces.

**Dica:** Organize os complementos na ordem que faz sentido para o cliente. Itens obrigatórios devem aparecer primeiro.`,
    category: 'cardapio',
    tags: ['variacoes', 'complementos', 'adicionais', 'personalizacao'],
    slug: 'variacoes-complementos',
    sort_order: 11,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'Como Gerenciar Múltiplos Cardápios',
    content: `O AW Food permite criar múltiplos cardápios para diferentes contextos.

**Quando usar múltiplos cardápios?**
- Cardápio de almoço vs. jantar
- Menu principal vs. menu de delivery
- Cardápio de segunda a sexta vs. fim de semana
- Menu promocional temporário

**Como criar um novo cardápio:**
1. Acesse Cardápio > Cardápios
2. Clique em "Novo Cardápio"
3. Dê um nome descritivo (ex: "Almoço Executivo")
4. Selecione os produtos que fazem parte deste cardápio
5. Configure os horários de disponibilidade
6. Salve

**Vinculando cardápios a canais:**
Você pode definir qual cardápio é exibido em cada canal:
- Cardápio Digital: o cardápio padrão do seu site
- iFood: pode ter um cardápio específico com preços diferentes
- Balcão/PDV: acesso a todos os produtos

**Disponibilidade de Produtos**
Além dos cardápios, você pode pausar produtos individualmente quando estiverem em falta. No PDV, use o botão de "Pausar" ao lado do produto. A pausa é refletida no cardápio digital e nos marketplaces.`,
    category: 'cardapio',
    tags: ['cardapios', 'multiplos-menus', 'disponibilidade'],
    slug: 'multiplos-cardapios',
    sort_order: 12,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: INTEGRAÇÕES
  // ==========================================
  {
    title: 'Como Conectar o iFood ao AW Food',
    content: `A integração com o iFood permite receber pedidos diretamente no PDV e sincronizar seu cardápio.

**Pré-requisitos:**
- Ter uma conta ativa no iFood Portal do Parceiro
- Ter o Merchant ID do iFood (disponível no Portal do Parceiro)

**Passo a passo:**
1. No Painel, acesse Integrações > iFood
2. Clique em "Conectar iFood"
3. Você será redirecionado para o iFood para autorizar a conexão
4. Após autorizar, o sistema sincronizará automaticamente:
   - Seu cardápio (produtos, categorias, preços)
   - Meios de pagamento
   - Status da loja (aberta/fechada)

**Recebendo Pedidos**
Após a conexão, os pedidos do iFood aparecem automaticamente no PDV em tempo real. O sistema toca um alerta sonoro e o pedido aparece na lista.

**Fluxo do pedido iFood:**
1. Cliente faz pedido no iFood
2. Pedido aparece no PDV do AW Food
3. Você aceita/prepara o pedido
4. Atualiza o status (em preparo → pronto → saiu para entrega)
5. O status é refletido no app do cliente no iFood

**Sincronização de Cardápio**
Quando você altera um produto no AW Food (preço, descrição, disponibilidade), a alteração é enviada automaticamente ao iFood. Não é necessário atualizar manualmente nos dois lugares.

**Importação do Cardápio do iFood**
Se você já tem um cardápio montado no iFood e está começando no AW Food, pode importá-lo: Integrações > iFood > Importar Cardápio. Todos os produtos, variações e complementos serão criados automaticamente.

**Solução de Problemas:**
- Se os pedidos não aparecem, verifique se a loja está aberta no iFood
- Se a sincronização falhou, tente reconectar em Integrações > iFood
- Em caso de erro de autenticação, o token do iFood pode ter expirado — reconecte a integração`,
    category: 'integracao',
    tags: ['ifood', 'marketplace', 'integracao', 'pedidos'],
    slug: 'conectar-ifood',
    sort_order: 20,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'Integrações com Marketplaces — Visão Geral',
    content: `O AW Food se integra com os principais marketplaces de delivery do Brasil, centralizando todos os pedidos em um único painel.

**Marketplaces Suportados:**
- iFood (integração completa com OAuth)
- Rappi
- Anota Aí
- Accon
- Cardápio Web
- Delivery Direto
- Keeta
- 99Food
- Aiqfome

**O que a integração faz:**
1. **Recebe pedidos** automaticamente no PDV
2. **Sincroniza cardápio** (produtos, preços, disponibilidade)
3. **Atualiza status** dos pedidos em tempo real
4. **Sincroniza meios de pagamento**
5. **Consolida relatórios** de todos os canais

**Como ativar:**
Cada marketplace tem seu processo de conexão. Acesse Integrações no Painel e selecione o marketplace desejado. Siga as instruções de autenticação específicas de cada um.

**Gestão centralizada:**
Com todos os marketplaces conectados, você pode:
- Ver todos os pedidos de todos os canais em uma única tela no PDV
- Pausar produtos em todos os marketplaces de uma vez
- Gerar relatórios consolidados por canal de venda
- Comparar performance entre canais

**Dica:** Não precisa conectar todos de uma vez. Comece com o marketplace onde você já vende mais e vá adicionando os outros gradualmente.`,
    category: 'integracao',
    tags: ['marketplaces', 'integracao', 'ifood', 'rappi', 'delivery'],
    slug: 'integracoes-marketplaces',
    sort_order: 21,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: PDV
  // ==========================================
  {
    title: 'Como Usar o PDV — Guia Completo',
    content: `O PDV (Ponto de Venda) do AW Food é seu sistema de caixa para o dia a dia do restaurante.

**Abrindo o Caixa**
1. Faça login no PDV
2. Selecione o caixa (se houver mais de um)
3. Informe o valor de fundo de troco
4. Clique em "Abrir Caixa"

**Registrando uma Venda**
1. Selecione o tipo de atendimento: Balcão, Mesa ou Delivery
2. Busque o produto pelo nome ou código
3. Selecione variações/complementos se necessário
4. Adicione ao pedido
5. Repita para outros itens
6. Clique em "Finalizar"
7. Selecione o meio de pagamento
8. Confirme a venda

**Gestão de Mesas**
Se seu restaurante trabalha com mesas:
1. Clique na aba "Mesas"
2. Selecione uma mesa disponível
3. Registre os itens do pedido
4. A mesa fica marcada como "ocupada"
5. Você pode adicionar mais itens a qualquer momento
6. Quando o cliente pedir a conta, feche a mesa e registre o pagamento

**Comandas Eletrônicas**
Para restaurantes que usam comandas:
1. Abra uma nova comanda
2. Associe a um nome ou número
3. Registre os itens consumidos
4. Feche a comanda quando o cliente for pagar

**Fechamento de Caixa**
1. Clique em "Fechar Caixa"
2. O sistema mostra o resumo: vendas por meio de pagamento, total esperado vs. informado
3. Registre o valor em espécie contado
4. Confirme o fechamento
5. O relatório de fechamento é salvo automaticamente

**Impressão de Pedidos**
O PDV imprime automaticamente os pedidos na impressora térmica (cozinha e/ou balcão), se configurada. Para configurar impressoras, veja o artigo sobre QZ Tray.`,
    category: 'pdv',
    tags: ['pdv', 'vendas', 'caixa', 'mesas', 'comandas'],
    slug: 'guia-completo-pdv',
    sort_order: 30,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'Como Configurar Impressoras Térmicas (QZ Tray)',
    content: `O AW Food utiliza o QZ Tray para comunicação com impressoras térmicas.

**O que é o QZ Tray?**
É um software que permite que o navegador se comunique com impressoras térmicas USB ou de rede. Ele roda em segundo plano no computador do caixa.

**Instalação:**
1. Baixe o QZ Tray em: https://qz.io/download/
2. Instale no computador onde o PDV será usado
3. Após instalar, o QZ Tray aparecerá na bandeja do sistema (ícone ao lado do relógio)
4. Mantenha-o sempre rodando

**Configuração no AW Food:**
1. No Painel, acesse Configurações > Impressoras
2. Clique em "Nova Impressora"
3. Selecione o tipo: Cozinha, Balcão ou Caixa
4. Informe o nome da impressora (como aparece no sistema operacional)
5. Configure o tamanho do papel (58mm ou 80mm)
6. Salve

**Tipos de Impressão:**
- **Caixa**: Cupom de venda para o cliente
- **Cozinha**: Pedido com detalhes de preparo
- **Balcão**: Resumo do pedido para retirada

**Múltiplas Impressoras:**
Você pode configurar várias impressoras para diferentes setores. Por exemplo: uma impressora na cozinha para pratos quentes e outra no bar para bebidas. Cada categoria de produto pode ser vinculada a uma impressora específica.

**Solução de Problemas:**
- Impressora não encontrada: verifique se o QZ Tray está rodando (ícone na bandeja)
- Caracteres estranhos: verifique a codificação (CP860 para português)
- Impressão cortada: ajuste a largura do papel nas configurações`,
    category: 'pdv',
    tags: ['impressora', 'termica', 'qz-tray', 'configuracao'],
    slug: 'configurar-impressoras',
    sort_order: 31,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'KDS — Kitchen Display System (Painel da Cozinha)',
    content: `O KDS (Kitchen Display System) substitui as impressoras de pedidos na cozinha por uma tela digital.

**O que é?**
É uma tela (pode ser um tablet, TV ou monitor) que exibe os pedidos em tempo real para a equipe da cozinha. Quando um pedido é feito no PDV ou chega de um marketplace, ele aparece automaticamente na tela.

**Vantagens sobre impressoras:**
- Sem custo de papel e bobinas
- Atualização em tempo real (status do pedido)
- Visão geral de todos os pedidos pendentes
- Controle de tempo de preparo
- Alerta visual para pedidos atrasados

**Como ativar:**
1. No Painel, acesse Configurações > PDV
2. Ative a opção "KDS - Painel da Cozinha"
3. No dispositivo da cozinha, acesse o PDV e selecione o modo "KDS"

**Fluxo de trabalho:**
1. Pedido chega → aparece no KDS com cor verde
2. Cozinheiro começa o preparo → arrasta para "Em preparo" (amarelo)
3. Pedido pronto → arrasta para "Pronto" (azul)
4. Se o pedido exceder o tempo estimado → fica vermelho

**Dica:** Use um tablet fixado na parede da cozinha ou um monitor dedicado. O KDS funciona no navegador, não precisa instalar nada.`,
    category: 'pdv',
    tags: ['kds', 'cozinha', 'display', 'pedidos'],
    slug: 'kds-painel-cozinha',
    sort_order: 32,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: FINANCEIRO
  // ==========================================
  {
    title: 'Gestão Financeira — Visão Geral',
    content: `O módulo financeiro do AW Food permite controlar todo o fluxo de caixa do seu restaurante.

**Funcionalidades Principais:**

**Fluxo de Caixa**
Visualize todas as entradas e saídas em tempo real ou projetado. O fluxo de caixa é alimentado automaticamente pelas vendas registradas no PDV e pelos pagamentos de contas cadastrados manualmente.

**Contas a Pagar e Receber**
Cadastre contas futuras (aluguel, fornecedores, folha de pagamento) e acompanhe os recebimentos pendentes. O sistema alerta sobre vencimentos próximos.

**DRE (Demonstração de Resultado)**
Relatório contábil que mostra receitas, custos e lucro do período selecionado. Essencial para entender a saúde financeira do negócio.

**Meios de Pagamento**
Configure todos os meios de pagamento aceitos (Dinheiro, PIX, Cartão de Crédito/Débito, Vale Refeição) e acompanhe o recebimento por cada meio.

**Contas Bancárias**
Cadastre suas contas bancárias para conciliação financeira. O sistema suporta importação de extratos OFX para facilitar a conciliação.

**Custos Fixos**
Cadastre custos recorrentes (aluguel, energia, internet, etc.) para que o DRE e o fluxo de caixa projetado sejam mais precisos.

**Fechamento de Caixa**
O relatório de fechamento de caixa mostra todas as vendas do turno, divididas por meio de pagamento, com comparação entre o valor esperado e o valor contado.

**Dica:** Mantenha as contas a pagar sempre atualizadas para ter uma projeção de caixa confiável.`,
    category: 'financeiro',
    tags: ['financeiro', 'caixa', 'contas', 'dre', 'fluxo-de-caixa'],
    slug: 'gestao-financeira-visao-geral',
    sort_order: 40,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'Como Configurar Meios de Pagamento',
    content: `Configure os meios de pagamento que seu restaurante aceita para vendas no PDV e no cardápio digital.

**Meios de Pagamento no PDV:**
1. Acesse Configurações > Meios de Pagamento
2. Ative/desative os métodos desejados:
   - Dinheiro
   - PIX
   - Cartão de Crédito
   - Cartão de Débito
   - Vale Refeição / Vale Alimentação
   - Conta (fiado)
3. Para cada método, você pode configurar:
   - Nome de exibição
   - Se aceita troco (apenas dinheiro)
   - Taxa de processamento (para cálculo de custo)

**Pagamento Online (Cardápio Digital):**
Para aceitar pagamentos online no cardápio digital:
1. Acesse Configurações > Pagamento Online
2. Escolha o gateway de pagamento:
   - MercadoPago (PIX + Cartão)
   - PagSeguro (PIX + Cartão)
   - Stripe (Cartão internacional)
3. Insira as credenciais da sua conta no gateway
4. Ative os métodos desejados
5. Teste uma transação antes de abrir ao público

**Sincronização com Marketplaces:**
Os meios de pagamento dos marketplaces (iFood, Rappi, etc.) são sincronizados automaticamente. O pagamento nesses casos é processado pelo marketplace, e o AW Food apenas registra o meio utilizado para fins de relatório.

**Dica:** Mantenha pelo menos Dinheiro, PIX e Cartão ativos para não perder vendas.`,
    category: 'pagamento',
    tags: ['pagamento', 'meios-pagamento', 'pix', 'cartao', 'online'],
    slug: 'configurar-meios-pagamento',
    sort_order: 41,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: ESTOQUE
  // ==========================================
  {
    title: 'Controle de Estoque — Como Funciona',
    content: `O módulo de estoque do AW Food permite controlar insumos, matérias-primas e produtos prontos.

**Conceitos Básicos:**
- **Item de Estoque**: matéria-prima ou insumo (ex: farinha, queijo, frango)
- **Movimento**: entrada ou saída de estoque (compra, consumo, ajuste, transferência)
- **Regra de Consumo**: relação entre produto vendido e insumos consumidos
- **Estoque Mínimo**: quantidade mínima de alerta para reposição

**Cadastrando Itens:**
1. Acesse Estoque > Itens
2. Clique em "Novo Item"
3. Preencha: nome, unidade de medida (kg, litro, unidade), categoria
4. Defina o estoque mínimo para alerta
5. Salve

**Regras de Consumo:**
Vincule insumos aos produtos vendidos:
- Exemplo: Hambúrguer Clássico consome 200g de carne, 1 pão, 30g de queijo
- Quando um hambúrguer é vendido, o estoque desses itens é baixado automaticamente

**Movimentos de Estoque:**
- **Entrada**: compra de fornecedor, devolução, ajuste positivo
- **Saída**: consumo (automático pela venda), perda, ajuste negativo
- **Transferência**: entre locais de armazenamento

**Pedidos de Compra:**
Crie pedidos de compra para seus fornecedores diretamente no sistema. Quando a mercadoria chega, dê entrada no estoque referenciando o pedido.

**Importação via NF-e:**
Se seu fornecedor emite NF-e, você pode importar a nota diretamente para dar entrada no estoque. O sistema lê a NF-e e cria os movimentos automaticamente.

**CMV (Custo de Mercadoria Vendida):**
Com as regras de consumo configuradas, o sistema calcula automaticamente o CMV de cada produto, ajudando a definir preços e margens.`,
    category: 'estoque',
    tags: ['estoque', 'inventario', 'insumos', 'cmv', 'compras'],
    slug: 'controle-estoque',
    sort_order: 50,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: FISCAL
  // ==========================================
  {
    title: 'NFC-e — Como Emitir Nota Fiscal ao Consumidor',
    content: `O AW Food permite emitir NFC-e (Nota Fiscal de Consumidor Eletrônica) diretamente do PDV.

**Pré-requisitos:**
- Certificado Digital A1 (arquivo .pfx)
- Inscrição Estadual ativa
- CSC (Código de Segurança do Contribuinte) fornecido pela SEFAZ do seu estado
- Cadastro no ambiente de produção da SEFAZ

**Configuração Inicial:**
1. No Painel, acesse Fiscal > Configurações
2. Faça upload do Certificado Digital A1
3. Informe a senha do certificado
4. Preencha o CSC e o ID do CSC
5. Configure as informações fiscais:
   - CNPJ e Inscrição Estadual
   - Regime tributário (Simples Nacional, Lucro Presumido, etc.)
   - Código CNAE
6. Configure as regras de ICMS por produto

**Emitindo NFC-e pelo PDV:**
1. Finalize a venda normalmente
2. Na tela de pagamento, clique em "Emitir NFC-e"
3. O sistema gera a NFC-e automaticamente com os dados da venda
4. A nota é enviada à SEFAZ para autorização
5. Após autorização, o cupom fiscal é impresso na impressora térmica

**Contingência Offline:**
Se a internet cair, o sistema entra em modo de contingência:
1. As notas são geradas localmente com número de contingência
2. Quando a internet voltar, são transmitidas automaticamente à SEFAZ

**Cancelamento:**
- NFC-e pode ser cancelada em até 24h após a emissão
- Acesse Fiscal > NFC-e > selecione a nota > "Cancelar"

**Regras de ICMS:**
Em Fiscal > Regras de ICMS, configure as alíquotas por produto ou categoria. O sistema aplica automaticamente a regra correta na emissão.

**Dica:** Teste no ambiente de homologação antes de emitir em produção. Em Fiscal > Configurações, você pode alternar entre homologação e produção.`,
    category: 'fiscal',
    tags: ['nfce', 'nota-fiscal', 'fiscal', 'sefaz', 'icms'],
    slug: 'emitir-nfce',
    sort_order: 60,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'NF-e — Emissão de Nota Fiscal Eletrônica',
    content: `Além da NFC-e (consumidor final), o AW Food também permite emitir NF-e (Nota Fiscal Eletrônica) para operações entre empresas.

**Quando usar NF-e:**
- Vendas para outras empresas (B2B)
- Devoluções de mercadoria
- Transferências entre filiais
- Operações que exigem destaque de ICMS

**Pré-requisitos:**
- Certificado Digital A1 (o mesmo da NFC-e)
- Configurações fiscais preenchidas (CNPJ, IE, regime tributário)
- Dados do destinatário (CNPJ, IE, endereço)

**Emitindo NF-e:**
1. No Painel, acesse Fiscal > NF-e
2. Clique em "Nova NF-e"
3. Preencha os dados do destinatário
4. Adicione os produtos com NCM, CFOP e regras de ICMS
5. Confira os totais e impostos
6. Clique em "Emitir"
7. A nota é transmitida à SEFAZ

**XML e DANFE:**
Após a autorização, o sistema gera:
- XML (arquivo fiscal obrigatório — armazenado automaticamente)
- DANFE (Documento Auxiliar — pode ser impresso ou enviado por e-mail)

**Importação de NF-e de Fornecedores:**
Em Estoque > NF-e, você pode importar NF-e recebidas de fornecedores para dar entrada automática no estoque.`,
    category: 'fiscal',
    tags: ['nfe', 'nota-fiscal', 'fiscal', 'sefaz', 'xml'],
    slug: 'emitir-nfe',
    sort_order: 61,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: CONFIGURAÇÃO
  // ==========================================
  {
    title: 'Como Configurar Área de Entrega e Taxas',
    content: `Configure as áreas onde seu restaurante faz entregas e as taxas por região.

**Métodos de Configuração:**

**1. Por Bairro:**
1. Acesse Configurações > Área de Entrega
2. Clique em "Novo Bairro"
3. Informe o nome do bairro e a taxa de entrega
4. Repita para cada bairro atendido

**2. Por Raio (Distância):**
1. Acesse Configurações > Área de Entrega
2. Selecione o modo "Raio"
3. Defina faixas de distância e taxas:
   - 0-3km: R$5,00
   - 3-6km: R$8,00
   - 6-10km: R$12,00
4. O sistema calcula a distância automaticamente usando o endereço do cliente

**3. Por Arquivo KML (Mapa):**
1. Desenhe suas áreas de entrega no Google My Maps
2. Exporte como KML
3. Importe no AW Food em Configurações > Área de Entrega

**Configurações Adicionais:**
- **Pedido mínimo por área**: defina um valor mínimo de pedido para cada região
- **Tempo estimado**: informe o tempo médio de entrega por área
- **Entrega grátis**: defina um valor de pedido acima do qual a entrega é gratuita

**Grupo de Entregadores:**
Se você usa entregadores próprios, cadastre-os em Cadastros > Entregadores. O PDV permite atribuir pedidos de delivery a entregadores específicos.

**Dica:** Comece com áreas menores e vá expandindo conforme a demanda. É melhor entregar rápido e bem em uma área menor do que demorar para atender uma área grande.`,
    category: 'configuracao',
    tags: ['delivery', 'entrega', 'taxa', 'area', 'configuracao'],
    slug: 'configurar-area-entrega',
    sort_order: 70,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'Gestão de Usuários e Permissões',
    content: `O AW Food permite criar múltiplos usuários com diferentes níveis de acesso.

**Criando Usuários:**
1. No Painel, acesse Cadastros > Usuários
2. Clique em "Novo Usuário"
3. Preencha: nome, e-mail, senha
4. Selecione o perfil de acesso (papel/role)
5. Salve

**Perfis de Acesso Padrão:**

**Administrador**
Acesso total ao painel e PDV. Pode configurar tudo, ver relatórios financeiros e gerenciar outros usuários.

**Gerente**
Acesso ao painel e PDV. Pode gerenciar cardápio, pedidos, estoque e ver relatórios. Não pode alterar configurações críticas.

**Operador de Caixa**
Acesso apenas ao PDV. Pode registrar vendas, abrir/fechar caixa e imprimir pedidos. Sem acesso ao painel.

**Cozinha**
Acesso apenas ao KDS (Kitchen Display System). Vê os pedidos e atualiza o status de preparo.

**Permissões Granulares:**
Além dos perfis padrão, você pode personalizar permissões por módulo:
- Cardápio (ver, editar, excluir)
- Financeiro (ver, registrar, estornar)
- Estoque (ver, movimentar, ajustar)
- Fiscal (emitir, cancelar)
- Relatórios (ver, exportar)

**Dica:** Crie um usuário separado para cada funcionário. Isso permite rastrear quem fez cada operação nos relatórios de auditoria.`,
    category: 'configuracao',
    tags: ['usuarios', 'permissoes', 'acesso', 'seguranca'],
    slug: 'usuarios-permissoes',
    sort_order: 71,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: PROMOÇÕES
  // ==========================================
  {
    title: 'Como Criar Promoções e Cupons de Desconto',
    content: `O AW Food oferece diversas ferramentas de promoção para aumentar suas vendas.

**Promoções de Desconto:**
1. Acesse Promoções > Promoções
2. Clique em "Nova Promoção"
3. Configure:
   - Nome da promoção
   - Tipo de desconto: percentual (%) ou valor fixo (R$)
   - Valor do desconto
   - Produtos que participam (todos ou selecionados)
   - Período de vigência
   - Dias da semana (ex: terça e quarta)
4. Ative a promoção

**Cupons/Vouchers:**
1. Acesse Promoções > Vouchers
2. Clique em "Novo Voucher"
3. Defina:
   - Código do cupom (ex: PRIMEIRACOMPRA)
   - Tipo de desconto
   - Valor mínimo do pedido
   - Quantidade máxima de usos
   - Validade
4. Compartilhe o código com seus clientes

**Programa de Pontos:**
1. Acesse Promoções > Programa de Pontos
2. Configure:
   - Quanto vale cada ponto
   - Quantos pontos o cliente ganha por real gasto
   - Mínimo de pontos para resgate
3. Os clientes acumulam pontos automaticamente

**Programa de Fidelidade:**
Configure cartões fidelidade digitais (ex: a cada 10 pedidos, o 11° é grátis).

**Cashback:**
Configure um percentual de cashback sobre as compras. O saldo fica disponível para o cliente usar em pedidos futuros.

**Dica:** Combine promoções com divulgação no WhatsApp para máximo impacto. Use cupons exclusivos para medir a efetividade de cada canal.`,
    category: 'promocoes',
    tags: ['promocoes', 'cupons', 'vouchers', 'desconto', 'fidelidade'],
    slug: 'criar-promocoes-cupons',
    sort_order: 80,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: RELATÓRIOS
  // ==========================================
  {
    title: 'Relatórios Disponíveis e Como Usá-los',
    content: `O AW Food oferece relatórios detalhados para acompanhar o desempenho do seu restaurante.

**Relatórios de Vendas:**
- **Vendas por período**: total de vendas por dia, semana ou mês
- **Vendas por produto**: ranking de produtos mais vendidos
- **Vendas por categoria**: desempenho de cada categoria do cardápio
- **Vendas por canal**: comparação entre Balcão, Delivery, iFood, Rappi, etc.
- **Ticket médio**: valor médio por pedido, por período

**Relatórios Financeiros:**
- **Fluxo de caixa**: entradas e saídas por período
- **DRE**: receitas, custos e lucro
- **Contas a pagar/receber**: previsão financeira
- **Fechamento de caixa**: detalhamento por turno/operador

**Relatórios de Estoque:**
- **Posição de estoque**: quantidade atual de cada item
- **Movimentações**: histórico de entradas e saídas
- **CMV**: custo de mercadoria vendida por produto
- **Itens em alerta**: itens abaixo do estoque mínimo

**Relatórios Fiscais:**
- **NFC-e emitidas**: listagem com status e valores
- **NF-e emitidas**: listagem com destinatários
- **Resumo fiscal**: totalização por CFOP e CST

**Relatórios de Delivery:**
- **Entregas por entregador**: quantidade e valores
- **Tempo médio de entrega**: por bairro/região
- **Taxa de entrega arrecadada**: por período

**Exportação:**
Todos os relatórios podem ser exportados em Excel (XLSX) ou CSV para análise externa.

**Dica:** Acompanhe os relatórios de vendas semanalmente e o DRE mensalmente para tomar decisões baseadas em dados.`,
    category: 'relatorios',
    tags: ['relatorios', 'vendas', 'financeiro', 'analise', 'export'],
    slug: 'relatorios-disponiveis',
    sort_order: 90,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: TROUBLESHOOTING
  // ==========================================
  {
    title: 'Problemas Comuns e Soluções',
    content: `Guia rápido para resolver os problemas mais frequentes no AW Food.

**Não consigo fazer login**
- Verifique se o endereço está correto (www.awfood.com.br/seu-restaurante)
- Confira se o e-mail e senha estão corretos (diferencia maiúsculas/minúsculas)
- Tente "Esqueci minha senha" para redefinir
- Se o problema persistir, entre em contato pelo WhatsApp

**Impressora não imprime**
- Verifique se o QZ Tray está rodando (ícone na bandeja do sistema)
- Confira se a impressora está ligada e conectada
- No PDV, tente imprimir um teste em Configurações > Impressoras > Testar
- Reinicie o QZ Tray se necessário

**Pedidos do iFood não chegam**
- Verifique se a loja está aberta no iFood Portal do Parceiro
- Confirme que a integração está ativa em Integrações > iFood
- Verifique sua conexão com a internet
- Tente reconectar a integração

**PDV está lento**
- Limpe o cache do navegador (Ctrl+Shift+Delete)
- Verifique sua conexão com a internet
- Feche outras abas do navegador
- Reinicie o navegador

**Erro ao emitir NFC-e**
- Verifique se o certificado digital não expirou
- Confira se o CSC está correto nas configurações fiscais
- Verifique se os produtos têm NCM e CFOP configurados
- Consulte o status da SEFAZ do seu estado (pode estar fora do ar)

**Cardápio digital não atualiza**
- As alterações podem levar até 5 minutos para refletir
- Limpe o cache do navegador e acesse novamente
- Verifique se o produto está marcado como "Ativo"

**Boleto/fatura não gerado**
- Verifique se seus dados de cobrança estão corretos em Faturamento
- Se o problema persistir, entre em contato pelo WhatsApp

**Precisa de mais ajuda?**
Entre em contato pelo WhatsApp: nosso suporte funciona de segunda a sábado, das 8h às 20h.`,
    category: 'troubleshooting',
    tags: ['problemas', 'erros', 'solucoes', 'suporte', 'faq'],
    slug: 'problemas-comuns-solucoes',
    sort_order: 100,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
  {
    title: 'Como Redefinir Minha Senha',
    content: `Se você esqueceu sua senha de acesso ao Painel ou PDV, siga os passos abaixo.

**Redefinição pelo Painel:**
1. Acesse a página de login do seu restaurante
2. Clique em "Esqueci minha senha"
3. Informe o e-mail cadastrado
4. Você receberá um e-mail com o link de redefinição
5. Clique no link e defina uma nova senha
6. Faça login com a nova senha

**Redefinição pelo Administrador:**
Se você é operador de caixa ou não tem acesso ao e-mail:
1. Peça ao administrador do restaurante para acessar Cadastros > Usuários
2. O administrador pode redefinir sua senha diretamente

**Senha do PDV:**
A senha do PDV é a mesma do painel. Se você redefinir a senha no painel, ela será atualizada automaticamente no PDV.

**Dicas de Segurança:**
- Use uma senha com pelo menos 8 caracteres
- Combine letras, números e caracteres especiais
- Não compartilhe sua senha com outros funcionários
- Cada funcionário deve ter seu próprio usuário`,
    category: 'troubleshooting',
    tags: ['senha', 'login', 'acesso', 'redefinir'],
    slug: 'redefinir-senha',
    sort_order: 101,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: CADASTROS
  // ==========================================
  {
    title: 'Como Cadastrar e Gerenciar Clientes',
    content: `O AW Food mantém um cadastro de clientes que é alimentado automaticamente pelas vendas.

**Cadastro Automático:**
Quando um cliente faz um pedido pelo cardápio digital, seus dados (nome, telefone, endereço) são salvos automaticamente. Nos próximos pedidos, os dados são preenchidos automaticamente.

**Cadastro Manual:**
1. Acesse Cadastros > Clientes
2. Clique em "Novo Cliente"
3. Preencha: nome, telefone, e-mail, endereço
4. Salve

**Informações do Cliente:**
Para cada cliente, o sistema registra:
- Histórico de pedidos
- Valor total gasto
- Frequência de compra
- Último pedido
- Endereço(s) de entrega

**Importação em Massa:**
Se você tem uma lista de clientes, pode importá-la via Excel:
1. Acesse Cadastros > Clientes > Importar
2. Baixe o modelo de planilha
3. Preencha com os dados dos clientes
4. Faça o upload da planilha

**LGPD e Exclusão de Dados:**
O AW Food atende à LGPD. Clientes podem solicitar a exclusão dos seus dados pessoais. A exclusão pode ser feita pelo próprio cliente na página de exclusão de dados ou pelo administrador no painel.

**Dica:** Use o histórico de clientes para identificar seus melhores clientes e criar promoções direcionadas.`,
    category: 'cadastros',
    tags: ['clientes', 'cadastro', 'historico', 'lgpd'],
    slug: 'cadastrar-gerenciar-clientes',
    sort_order: 110,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // CATEGORIA: DELIVERY
  // ==========================================
  {
    title: 'Cardápio Digital — Como Personalizar Sua Loja Online',
    content: `O cardápio digital é sua loja online própria, sem comissão de marketplace.

**Endereço:**
Seu cardápio digital fica disponível em: https://pedidos.awfood.com.br/seu-restaurante

**Personalização:**
1. No Painel, acesse Configurações > Site
2. Personalize:
   - Logo do restaurante
   - Cor principal (tema)
   - Banners promocionais (até 5 imagens rotativas)
   - Mensagem de boas-vindas
   - Informações de contato

**Funcionalidades para o Cliente:**
- Navegar pelo cardápio com fotos e descrições
- Buscar produtos por nome
- Personalizar pedido (variações e complementos)
- Aplicar cupom de desconto
- Escolher forma de pagamento (dinheiro, PIX, cartão online)
- Rastrear o pedido em tempo real
- Ver histórico de pedidos anteriores

**Compartilhamento:**
Compartilhe o link do cardápio digital nas suas redes sociais, WhatsApp e impressos. Você também pode gerar um QR Code para colocar na mesa ou na fachada.

**Vantagem Principal:**
Diferente dos marketplaces que cobram comissão de 12-27% por pedido, o cardápio digital é 100% seu. Você paga apenas a taxa do gateway de pagamento (quando há pagamento online).

**Dica:** Coloque o link do cardápio digital na bio do Instagram e no perfil do WhatsApp Business do seu restaurante.`,
    category: 'delivery',
    tags: ['cardapio-digital', 'loja-online', 'delivery', 'personalizacao'],
    slug: 'cardapio-digital-personalizar',
    sort_order: 120,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // MULTI-LOJAS
  // ==========================================
  {
    title: 'Multi-Lojas — Gerenciando Várias Unidades',
    content: `Se você tem mais de uma unidade do seu restaurante, o AW Food permite gerenciá-las a partir de uma conta central.

**Como funciona:**
Cada unidade (loja) tem seu próprio banco de dados, cardápio, estoque e configurações. Isso garante independência total entre as unidades — uma não interfere na outra.

**Criando uma nova unidade:**
1. No Painel principal, acesse Multi-Lojas > Unidades
2. Clique em "Nova Unidade"
3. Preencha os dados da nova unidade
4. A unidade é criada com um painel e PDV independentes

**Gestão Centralizada:**
Com a funcionalidade multi-lojas, você pode:
- Alternar entre unidades no mesmo painel
- Copiar cardápio de uma unidade para outra
- Ver relatórios consolidados (todas as unidades) ou individuais
- Gerenciar promoções por unidade ou para todas

**Central de Atendimento:**
Para redes maiores, a Central de Atendimento permite:
- Receber chamadas e pedidos telefônicos
- Identificar o cliente pelo telefone
- Direcionar o pedido para a unidade mais próxima
- Centralizar o atendimento via WhatsApp

**Dica:** Mantenha o cardápio padronizado entre as unidades para consistência da marca, mas ajuste preços e áreas de entrega conforme a localização de cada uma.`,
    category: 'configuracao',
    tags: ['multi-lojas', 'unidades', 'rede', 'central-atendimento'],
    slug: 'multi-lojas-varias-unidades',
    sort_order: 130,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },

  // ==========================================
  // PLANOS E FATURAMENTO
  // ==========================================
  {
    title: 'Planos e Faturamento — Entenda Seu Plano',
    content: `O AW Food oferece planos que se adaptam ao tamanho do seu negócio.

**Planos Disponíveis:**

**Starter (R$29,90/mês)**
- 1 usuário
- Cardápio digital
- PDV básico
- Relatórios essenciais
- Ideal para quem está começando

**Essencial (R$149,90/mês)**
- 3 usuários
- Tudo do Starter +
- Integrações com marketplaces (iFood, Rappi)
- Gestão financeira básica
- Suporte prioritário

**Profissional (R$279,90/mês)**
- 10 usuários
- Tudo do Essencial +
- Controle de estoque completo
- NFC-e / NF-e
- KDS (Painel da Cozinha)
- Promoções e fidelidade
- Relatórios avançados

**Completo (R$399,90/mês)**
- Usuários ilimitados
- Tudo do Profissional +
- Multi-lojas
- Central de atendimento
- API para integrações customizadas
- Suporte dedicado

**Teste Grátis:**
Todos os planos incluem 7 dias de teste grátis com acesso completo. Não é necessário cartão de crédito para testar.

**Formas de Pagamento:**
- PIX (desconto de 5%)
- Cartão de crédito
- Boleto bancário

**Upgrade/Downgrade:**
Você pode trocar de plano a qualquer momento em Faturamento > Meu Plano. A diferença é calculada proporcionalmente.

**Cancelamento:**
Pode ser feito a qualquer momento em Faturamento > Cancelar Assinatura. Seus dados ficam disponíveis por 30 dias após o cancelamento.`,
    category: 'geral',
    tags: ['planos', 'precos', 'faturamento', 'assinatura'],
    slug: 'planos-faturamento',
    sort_order: 140,
    is_published: false,
    source: 'auto_generated',
    review_status: 'pending_review',
  },
]

// Export for use as JSON or direct execution
export { articles }

// Main execution
async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.log('Variaveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nao definidas.')
    console.log('Exportando artigos como JSON para uso via API...\n')

    // Output as JSON for bulk API import
    const jsonOutput = { articles }
    const fs = await import('fs')
    const path = await import('path')
    const outputPath = path.join(__dirname, 'kb-articles.json')
    fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2), 'utf-8')
    console.log(`Arquivo salvo em: ${outputPath}`)
    console.log(`Total de artigos: ${articles.length}`)
    console.log('\nPara importar via API:')
    console.log('curl -X POST https://seu-dominio/api/v1/knowledge-base/bulk \\')
    console.log('  -H "Authorization: Bearer ak_..." \\')
    console.log('  -H "Content-Type: application/json" \\')
    console.log(`  -d @${outputPath}`)
    return
  }

  // Direct Supabase insert
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Check for existing admin user to set as created_by
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_internal', true)
    .limit(1)
    .single()

  if (!adminProfile) {
    console.error('Nenhum usuario interno encontrado. Crie um primeiro.')
    process.exit(1)
  }

  const prepared = articles.map(a => ({
    ...a,
    created_by: adminProfile.id,
  }))

  console.log(`Inserindo ${prepared.length} artigos...`)

  const { data, error } = await supabase
    .from('knowledge_base_articles')
    .insert(prepared)
    .select('id, title, slug')

  if (error) {
    console.error('Erro:', error.message)
    process.exit(1)
  }

  console.log(`${data?.length ?? 0} artigos criados com sucesso!`)
  console.log('\nArtigos criados:')
  data?.forEach(a => console.log(`  - [${a.slug}] ${a.title}`))
  console.log('\nTodos os artigos foram criados com review_status=pending_review.')
  console.log('Acesse o painel de tickets para revisar e aprovar cada um.')
}

main().catch(console.error)
