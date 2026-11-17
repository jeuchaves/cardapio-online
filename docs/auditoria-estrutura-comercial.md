# Auditoria de funcionalidades e estrutura comercial

- Data: 2026-11-17
- Origem: pedido do usuário de auditar a proposta comercial preliminar (Básico R$ 49,90, Profissional R$ 79,90, Premium R$ 119,90) contra o repositório, antes do lançamento em Campo Grande/MS
- Referências: `CLAUDE.md` seções 1, 2 e 13; ROADMAP seções 1, 2, 11.1 a 11.3; [evolucoes-futuras-da-api.md](evolucoes-futuras-da-api.md); [ADR 0003](decisions/0003-imagens-e-qrcode.md); [ADR 0006](decisions/0006-arquitetura-de-infraestrutura-e-hospedagem.md) (rascunho)
- Natureza: **auditoria e proposta**. Nenhum código foi alterado, nada foi implementado e **nenhum preço foi alterado**. As propostas EV-08 a EV-13 não estão aprovadas.
- **Posição vigente (2026-11-17, PEND-50): ver a seção 9.** O MVP tem uma única oferta comercial (Básico). As referências a "Profissional" e "Premium" nas seções 1 a 8 são a proposta preliminar e **não representam planos ofertados**; onde divergirem da seção 9, vale a seção 9.

## 1. Método e padrão documental encontrado

Padrão preservado, sem criar outro:
- **Planejamento:** `docs/ROADMAP.md` (fases `F<n>-T<n>`, decisões `PEND-nn`, aprovações `APR-nn`, questões `ABERTO-nn`). Autoridade máxima: `CLAUDE.md`, depois o ROADMAP, depois os ADRs e relatórios por fase.
- **Propostas ainda não aprovadas:** `docs/evolucoes-futuras-da-api.md` (`EV-nn`). É onde as lacunas desta auditoria foram registradas.
- **Decisões arquiteturais:** `docs/decisions/NNNN-slug.md`. **Relatórios por fase:** `docs/F<n>-...md`.
- Este documento segue o nome temático em minúsculas de `evolucoes-futuras-da-api.md`, porque não pertence a uma fase.

**Divergências entre fontes** (a de maior autoridade vence):
1. O ROADMAP seção 1 e o `CLAUDE.md` seção 2 colocam **planos, assinaturas, cobrança, relatórios avançados, integrações externas e notificações externas fora do escopo**. A proposta comercial depende de vários deles. Prevalece o `CLAUDE.md`: entrar no escopo exige necessidade comprovada, pedido do usuário e ADR curto (ROADMAP 11.3). **Esta auditoria não altera o escopo; registra a divergência como decisão (ABERTO-09).**
2. A proposta comercial não menciona o que o produto **já entrega e é central**: pedidos persistidos com acompanhamento, mesas, equipe e painel de atendimento (ROADMAP seção 2, F5, F4-T3).
3. "Pedidos pelo WhatsApp" é um modelo diferente do pedido atual (registrado e acompanhado no sistema).

## 2. Matriz de aderência comercial

Estados: CONSOLIDADA, IMPLEMENTADA PARCIALMENTE, PREVISTA NO ROADMAP, DOCUMENTADA, NÃO IDENTIFICADA, OBSOLETA OU DESCARTADA.

| Plano | Funcionalidade | Situação | Evidência | Pendências |
| --- | --- | --- | --- | --- |
| Básico | Cardápio digital | **CONSOLIDADA** (ressalva: celular físico) | Requisito ROADMAP seção 2 (Cliente) e 9.1; F4-T1/T2 (ROADMAP:807-808); rota `GET /public/restaurants/:slug` em `apps/api/start/routes.ts`; `apps/web/src/app/r/[slug]/page.tsx`; testes `apps/api/tests/functional/public_menu.spec.ts`, `menu_isolation.spec.ts`; E2E `apps/web/e2e/order-flow.spec.mjs` | PEND-37 (roteiro em celular físico, [F7A-roteiro-celular-fisico.md](F7A-roteiro-celular-fisico.md)); publicação depende da Fase 8 |
| Básico | QR Code personalizado | **IMPLEMENTADA PARCIALMENTE** | F4-T4 (ROADMAP:810), PEND-11 (1009); `apps/web/src/components/qr-code-card.tsx` (PNG de 600 px, linha 9; download, linha 39); QR do restaurante e da mesa | **"Personalizado" (logo, cor, moldura) não existe**: não há requisito. Folha de impressão a redesenhar (PEND-40). **Nenhum teste automatizado** (busca por "qr" em `apps/web/e2e` e `apps/api/tests` sem resultado) |
| Básico | Categorias e produtos | **CONSOLIDADA** | F3 (ROADMAP seção 10), seção 5.8; rotas `categories`/`products` em `routes.ts`; testes `categories.spec.ts`, `products.spec.ts`, `menu_isolation.spec.ts`, `tenant.spec.ts` | Reordenação só por campo numérico (PEND-23, EV-04, F7A-T12 fora do lote) |
| Básico | Fotos e descrições | **CONSOLIDADA** (ressalva: produção) | ADR 0003; `apps/api/app/controllers/uploads_controller.ts`; `products/:id/image`, `restaurant/logo` em `routes.ts`; teste `images.spec.ts`; `description` em `products` e `restaurants` | Driver S3 **não validado contra nenhum provedor** (ABERTO-02); depende de D2 e da Fase 8 |
| Básico | Link compartilhável | **IMPLEMENTADA PARCIALMENTE** | URL `/r/:slug` (`r/[slug]/page.tsx`), metadados Open Graph (`generateMetadata`, linhas 18-30), F4-T5 (ROADMAP:811) | Sem requisito nem ação no painel para **copiar ou compartilhar** o link (`navigator.clipboard` só aparece no acompanhamento do pedido e na senha temporária). Domínio próprio é questão aberta (ABERTO-03) |
| Profissional | Pedidos pelo WhatsApp | **NÃO IDENTIFICADA** | Busca por `whatsapp`, `wa.me` em `apps/` e `docs/`: sem resultado como funcionalidade. Existe `restaurants.phone` (`schema.ts:323-340`). "Notificações externas" e "integrações" estão fora do MVP (ROADMAP:27) | Todo o requisito. **Não confundir** com o pedido atual no painel (F5). Ver EV-08 |
| Profissional | Adicionais e observações | **CONSOLIDADA** (escopo atual) | ROADMAP 5.8, `product_addons` (4.3); `addons` em `routes.ts`; `addons.spec.ts`, `product_addons_link.spec.ts`; observação do pedido: `notes` até 500 caracteres (`apps/api/app/validators/order.ts:46`, `checkout.tsx:425`) | Adicional sem quantidade (F7A-T9, D-06 pendente). **Observação por item** não existe: ponto de decisão |
| Profissional | Gestão de disponibilidade | **CONSOLIDADA** (escopo atual) | `is_available` em produtos e adicionais (`validators/product.ts:22`, `addon.ts:12`); painel `produtos/page.tsx:285`, `adicionais/page.tsx:120`; teste `availability.spec.ts`; ocultação no cardápio público (F4-T1) | `staff` não pode marcar esgotado (ROADMAP 5.1, EV-05, decisão pendente). Sem disponibilidade por horário ou por categoria (sem requisito) |
| Profissional | Personalização visual | **IMPLEMENTADA PARCIALMENTE** | Só nome, descrição, telefone e **logo** (`restaurant.ts` `toApi`; `configuracoes/page.tsx`). Identidade única para todos (ADR 0008, PEND-36). Capa enviada e tema por restaurante: F7A-T5b / D-03 / D-04, **fora do lote** | Não há requisito do que "personalizar" significa (cores, capa, fonte?). Ver EV-09 |
| Profissional | Relatórios básicos | **NÃO IDENTIFICADA** | Nenhum endpoint, tela ou requisito. "Relatórios avançados" estão fora do MVP (ROADMAP:27); "relatórios básicos" não são citados | Todo o requisito. Há base de dados (`orders`, `order_items`, snapshots, histórico de status). Ver EV-10 |
| Premium | Recursos de inteligência artificial | **NÃO IDENTIFICADA** | Sem código, sem dependência, sem menção em `docs/` | Definição do produto. Ver EV-11 |
| Premium | Atendimento automatizado | **NÃO IDENTIFICADA** | Sem evidência; depende de canal externo (WhatsApp ou similar), fora do escopo (ROADMAP:27) | Definição do canal e do que é "atendimento". Ver EV-11 |
| Premium | Relatórios avançados | **NÃO IDENTIFICADA** como especificação | Apenas **excluídos** do MVP (`CLAUDE.md` seção 2; ROADMAP:27) | Especificação; depende dos básicos (EV-10). Ver EV-12 |
| Premium | Recursos adicionais de gestão | **NÃO IDENTIFICADA** | A proposta comercial não os define | Nada a especificar sem definição do negócio. Ver EV-12 |
| Transversal | Separação por plano (liberar recursos por plano) | **NÃO IDENTIFICADA** (excluída do escopo) | `restaurants` não tem campo de plano (`schema.ts:323-340`); "planos, assinaturas e cobrança" fora do MVP (ROADMAP:27, `CLAUDE.md` seção 2); `platform_admin` sem planos (ROADMAP:35) | Sem isso, **nenhum plano pode ser diferenciado tecnicamente**. Ver EV-13 |

### Verificações por funcionalidade (resumo dos 10 itens pedidos)

| Funcionalidade | Requisito | Roadmap | Backlog | Backend | Frontend | Integração | Testes | Aceite | Doc. operacional |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cardápio digital | sim | sim | sim | sim | sim | não | sim | sim (F4-T1/T2) | parcial (roteiro físico pendente) |
| QR Code personalizado | parcial (sem "personalizado") | sim (F4-T4) | PEND-40 | não precisa | sim | não | **não** | parcial | não |
| Categorias e produtos | sim | sim | sim | sim | sim | não | sim | sim | parcial |
| Fotos e descrições | sim | sim | sim | sim (disco local) | sim | **S3 não validado** | sim | sim | ADR 0003 |
| Link compartilhável | parcial | sim (F4-T5) | não | sim | parcial | não | não | parcial | não |
| Pedidos pelo WhatsApp | **não** | não | não | não | não | **sim (WhatsApp)** | não | não | não |
| Adicionais e observações | sim | sim | F7A-T9 | sim | sim | não | sim | sim | parcial |
| Disponibilidade | sim | sim | EV-05 | sim | sim | não | sim | sim | parcial |
| Personalização visual | **não** | F7A-T5b (fora do lote) | D-03, D-04 | só logo | só logo | não | só logo | não | não |
| Relatórios básicos | **não** | não | não | não | não | não | não | não | não |
| IA e atendimento | **não** | não | não | não | não | **sim** | não | não | não |
| Relatórios avançados | excluído | não | não | não | não | não | não | não | não |
| Gestão adicional | **não definido** | não | não | não | não | ? | não | não | não |
| Planos | excluído | não | não | não | não | cobrança (excluída) | não | não | não |

**Isolamento, permissões e segurança das consolidadas:** isolamento por tenant com testes de leitura, alteração e exclusão (`menu_isolation.spec.ts`, `orders_isolation.spec.ts`; relatório F6-T1); permissões `owner`/`staff` na matriz do ROADMAP 5.1; validação por VineJS; limites e rate limit em memória (ADR 0004); imagens com tipo, tamanho e nome gerado pelo servidor (ADR 0003, `images.spec.ts`); auditoria por log estruturado (APR-06, `audit_log.spec.ts`). **Impacto na infraestrutura:** nenhuma das funcionalidades pendentes foi dimensionada nos ADRs 0006 e 0007 (WhatsApp, relatórios e IA aumentam carga, dependências externas ou custo).

## 3. Resultado por estado

- **Consolidadas (5):** cardápio digital; categorias e produtos; fotos e descrições; adicionais e observações; gestão de disponibilidade.
- **Previstas no roadmap (0):** nenhuma. F7A-T5b (capa) é a única tarefa relacionada e está **fora do lote**, sem autorização.
- **Parcialmente implementadas (3):** QR Code personalizado; link compartilhável; personalização visual.
- **Apenas documentadas (0).**
- **Não identificadas (7):** pedidos pelo WhatsApp; relatórios básicos; IA; atendimento automatizado; relatórios avançados; recursos adicionais de gestão; separação por plano (transversal).
- **Obsoletas ou descartadas (0).** Relatórios avançados, planos e integrações aparecem apenas como exclusões do MVP, não como itens descartados.

## 4. Lacunas: análise (propostas, não decisões)

Cada lacuna virou uma proposta `EV-nn` em [evolucoes-futuras-da-api.md](evolucoes-futuras-da-api.md) (problema, comportamento, regras, riscos, aceite). Resumo, com **prioridade proposta** e justificativa. Nenhuma prioridade existente foi alterada.

| EV | Lacuna | Prioridade | Justificativa |
| --- | --- | --- | --- |
| EV-08 | Pedidos pelo WhatsApp | **P1** | Principal motivo de compra do Profissional para o mercado-alvo; alta dependência de decisão (ver 4.1) |
| EV-09 | Personalização visual | **P1** | Argumento de venda do Profissional; baixo risco se limitada a logo, capa e uma cor |
| EV-10 | Relatórios básicos | **P1** | Dados já existem; sem custo de infraestrutura relevante; precisa de definição de métricas |
| EV-13 | Separação por plano | **P1, condicional** | Só é necessária se os planos forem diferenciados **no produto**; cobrança pode ser manual e fora do sistema no início |
| EV-11 | IA e atendimento automatizado | **P3** | Sem definição, sem requisito e com custo variável; depende de EV-08 |
| EV-12 | Relatórios avançados e gestão adicional | **P3** | Dependem de EV-10 e de definição do negócio |
| (PEND-40) | QR Code: folha de impressão e teste automatizado | **P0 para a promessa "QR Code personalizado" do Básico** | O QR é o produto físico entregue ao restaurante; hoje sem teste automatizado |
| (novo, pequeno) | Ação "copiar link" no painel | **P0** | Fecha o item "link compartilhável"; coberto por EV-08/09 apenas se aprovado; registrado como ponto de decisão |

**P0 do lançamento** (o que impede vender o Básico): Fase 8 (infraestrutura, backup, logs), ABERTO-01 (validação jurídica), PEND-37 (celular físico), o QR Code e o link compartilhável acima.

### 4.1 Pedidos pelo WhatsApp: pontos de decisão (sem inventar comportamento)

O contexto do produto permite duas leituras, e **ambas são ambíguas**:
- **A. Botão que abre o WhatsApp do restaurante com o pedido já descrito** (link `wa.me` com texto), possivelmente além do pedido registrado no sistema. Sem API paga, sem webhook, sem dependência nova. O risco é de privacidade: o texto leva nome, telefone e itens ao WhatsApp e, se levar o link de acompanhamento, o `tracking_token`.
- **B. Integração com a API do WhatsApp Business** (mensagens automáticas, webhooks). **Fora do escopo** (webhooks, notificações externas), com custo por conversa e dependência externa; é também o caminho do "atendimento automatizado".
- **Decisões necessárias:** o pedido continua sendo registrado no sistema (e o Profissional paga pelo WhatsApp **além do** painel) ou o WhatsApp **substitui** o pedido no painel? O cliente pode acompanhar o status? Quem recebe a mensagem (número do restaurante)? Comportamento quando o restaurante está fechado?

## 5. Parecer sobre a estrutura comercial (recomendações, sem alterar preços)

1. **Básico (R$ 49,90): tecnicamente entregável**, com as ressalvas P0. Ele **entrega menos do que o produto já faz** (o produto já tem pedidos no painel, mesas, equipe e acompanhamento). Decisão de negócio: esses recursos ficam no Básico, ou o pedido passa a ser o diferencial do Profissional? Hoje **não há como restringir por plano** (EV-13).
2. **Profissional (R$ 79,90): hoje não entregável.** Dos cinco itens, dois estão consolidados, um é parcial e **dois não existem** (WhatsApp, relatórios básicos). A promessa central ("pedidos pelo WhatsApp") não tem requisito.
3. **Premium (R$ 119,90): não deve ser vendido nem anunciado.** Nenhum dos quatro itens está definido. **IA tem custo variável por uso**: exigiria franquia ou limite por restaurante e controle de consumo (que depende de EV-13). Não é possível sustentar o preço sem custo por restaurante estimado.
4. **Recursos com custo operacional relevante:** IA e atendimento automatizado (custo por uso), WhatsApp Business API (custo por conversa), relatórios avançados (carga no banco). **Candidatos a cobrança separada ou franquia:** IA e mensagens automáticas.
5. **Ausências essenciais na proposta:** suporte e instalação do QR, o número de mesas/usuários por plano, e política de cancelamento e dados (LGPD, ABERTO-01).
6. **Viabilidade da separação:** só depende de um campo de plano e de verificações no backend (EV-13), **mas exige abrir o escopo** (ABERTO-09). Cobrança pode continuar manual (Pix, fora do sistema) até haver necessidade comprovada.
7. **Margem (estimativa, não é dado medido):** a infraestrutura do primeiro projeto foi estimada em ≈ R$ 92 por mês ([F8A-pesquisa-infraestrutura.md](F8A-pesquisa-infraestrutura.md)), sem impostos nem suporte. Isso significa que **dois restaurantes no Básico (R$ 99,80) mal cobrem o servidor**, e a viabilidade depende de volume e de dividir o servidor entre clientes.
8. **Sugestão de abordagem por etapas (a aprovar):** lançar o que existe e está consolidado com um preço único de entrada (o Básico); definir EV-08 a EV-10 antes de comercializar o Profissional; deixar o Premium como "em breve" sem preço fechado.

## 6. Dependências e riscos

- **Dependências:** Fase 8 inteira (servidor, backup, logs), ABERTO-01, ABERTO-02, ABERTO-03; EV-13 antes de qualquer diferenciação por plano; EV-08 antes de EV-11; EV-10 antes de EV-12; D-03/D-04 da Fase 7A antes de EV-09.
- **Riscos:** vender o Profissional ou o Premium antes de existir o produto; WhatsApp expor dados pessoais e o token de acompanhamento (ROADMAP 7.3); custo variável de IA sem limite; ampliar escopo sem ADR (ROADMAP 11.3); infraestrutura de R$ 100 por mês limitando a capacidade de clientes (F8A, seção de capacidade); promessas comerciais sem teste automatizado (QR).

## 7. Pendências de decisão humana

Registradas em ABERTO-09 e PEND-44 no ROADMAP:
1. Aprovar ou não a **abertura do escopo** para planos, WhatsApp, relatórios e IA (hoje fora do MVP).
2. Definir o que **"pedidos pelo WhatsApp"** significa (4.1).
3. Definir o que é **"personalização visual"**, **"relatórios básicos"**, **"atendimento automatizado"** e **"recursos adicionais de gestão"**.
4. Decidir se os recursos já existentes (pedidos, mesas, equipe) ficam no Básico.
5. Decidir se a cobrança é **manual** no início.
6. Decidir se Premium e IA seguem como oferta, e com qual limite por restaurante.
7. Aprovar ou ajustar as prioridades propostas (seção 4).

## 8. Segunda etapa: decisões de 2026-11-17

Registradas em PEND-45 a PEND-48 do ROADMAP e nos ADRs [0010](decisions/0010-promocoes-e-descontos-no-pedido.md), [0011](decisions/0011-fuso-horario-por-restaurante.md) e [0012](decisions/0012-plano-e-capacidades-por-restaurante.md). Esta seção complementa as anteriores e **não repete** o conteúdo dos ADRs. **Atualizada na revisão de consistência de 2026-11-17 (PEND-49).** As seções 1 a 7 descrevem a primeira etapa e permanecem como histórico; onde divergirem desta seção, **vale a seção 8.**

### 8.1 Mudanças em relação à auditoria

- **Entrega (delivery)** passou a fazer parte do MVP (PEND-47). A auditoria a tratava como ausente e fora do escopo. Não está especificada.
- **Promoções**: a lacuna "Não identificada" passou a ter política aprovada (ADR 0010: maior desconto único, desempate determinístico, sem limites nem contador no MVP, cotação identificada), sem implementação. Cupons seguem indefinidos (ABERTO-14).
- **Planos**: a diretriz estrutural (ADR 0012) permanece como **evolução arquitetural**; no MVP há só a oferta Básico (seção 9). A matriz definitiva não será criada nesta etapa (ABERTO-11). **Preços não foram alterados.**
- **Fuso**: decisão aprovada (ADR 0011): identificador IANA por restaurante, `timestamptz` para instantes e `date` para datas comerciais. Migração dos existentes pendente (ABERTO-13).
- **Mesas e equipe** ficam no Básico inicialmente, o que coincide com o estado atual do produto.

### 8.2 Conflitos identificados

| # | Conflito | Tratamento |
| --- | --- | --- |
| 1 | PEND-01, PEND-02 e ROADMAP 5.4 e 7.1 afirmam "sem entrega" | Mantidos como histórico, com anotação de revisão por PEND-47 |
| 2 | APR-02 removeu `orders.subtotal`; descontos exigem representar o valor antes do desconto | Anotada a revisão; campos propostos no ADR 0010, não aprovados |
| 3 | `CLAUDE.md` seção 2 e ROADMAP seção 1: sem planos e plataforma só cadastra restaurantes | **Resolvido em 2026-11-17** pelas decisões do ADR 0012: ajuste mínimo no `CLAUDE.md` (campo de plano permitido; assinaturas e cobrança seguem fora). Revisão do texto pelo usuário pendente (ABERTO-15) |
| 4 | "Promoção esgotada" e "devolver utilização" sem nenhum limite aprovado | **Resolvido (PEND-49, ADR 0010):** sem contador no MVP; "indisponível" = fora da validade ou sem elegibilidade; devolução é evolução futura condicionada a limites (EV-17) |
| 5 | "Informar o cliente e pedir nova confirmação" exige saber qual promoção o cliente viu | **Parcialmente resolvido:** fluxo da cotação identificada aprovado (ADR 0010); formato, prazo, invalidação, erro e idempotência seguem abertos (ABERTO-14) |
| 6 | Cupons não foram decididos nem excluídos | Mantidos pendentes (ABERTO-14) |
| 7 | Homologação do piloto com dados reais de clientes versus validação jurídica pendente (ABERTO-01) | Registrado no ABERTO-12; a homologação não autoriza publicação irrestrita |
| 8 | Fuso fixo `America/Sao_Paulo` no código versus `America/Campo_Grande` do piloto | ADR 0011 |
| 9 | PEND-20 mantém contratos e regras de negócio da Fase 7 como estão | Sem conflito: as mudanças ficam em fase nova proposta (ABERTO-16) |

### 8.3 Entrega: definições operacionais pendentes (ABERTO-10)

Nada abaixo está decidido; são as perguntas mínimas para especificar.
1. **Endereço:** campos (rua, número, bairro, complemento, referência) e validação.
2. **Taxa:** valor fixo, por bairro ou por distância; quem define; se entra em `total` e se promoções incidem sobre ela.
3. **Área de atendimento:** lista de bairros, raio ou outro critério; comportamento fora da área.
4. **Modalidades:** entrega e retirada habilitáveis por restaurante (`accepts_*`); relação com `dine_in`.
5. **Checkout:** dados obrigatórios (nome, telefone, endereço), troco para pagamento em dinheiro.
6. **Acompanhamento e status:** estados da entrega (por exemplo, saiu para entrega), quem altera, o que o cliente vê e se o endereço aparece na página de acompanhamento.
7. **Responsabilidade:** o restaurante entrega com equipe própria; sem logística da plataforma (a confirmar).
8. **Privacidade:** endereço como dado pessoal novo (seção 7 do ROADMAP, retenção, anonimização, logs e backups).

### 8.4 Critérios mínimos propostos para a homologação do piloto (NÃO APROVADOS)

A homologação é controlada e **não equivale a publicação comercial irrestrita** (PEND-46).
1. Infraestrutura mínima da Fase 8 no ambiente usado: HTTPS, backup restaurado e logs sem token.
2. Decisão jurídica sobre dados reais de clientes durante a homologação (ABERTO-01).
3. Fluxo principal funcionando com os dados do piloto: cardápio, pedido, atualização de status e acompanhamento.
4. Promoções reais do piloto cobertas pelos casos de teste do ADR 0010, incluindo a reconfirmação.
5. Fuso `America/Campo_Grande` configurado e testado (virada do dia e janelas de horário).
6. Entrega, se o piloto a usar, **somente depois de especificada e testada** (ABERTO-10).
7. Nenhum bloqueio por plano: o campo `plan` não é implementado no MVP (PEND-50).
8. Roteiro em celular físico (PEND-37) executado.
9. Canal de suporte e registro de problemas durante a homologação.

**Dependem de validação operacional (ABERTO-12):** duração, quem aprova, dados reais ou de teste, métricas de aceite, critérios de saída e critérios de publicação.

### 8.5 Pendências mantidas

ABERTO-10 (entrega), ABERTO-11 (matriz de planos), ABERTO-12 (homologação e publicação), ABERTO-13 (migração do fuso), ABERTO-14 (promoções), ABERTO-15 (`CLAUDE.md`), ABERTO-16 (fase proposta). Também seguem abertos WhatsApp, relatórios, IA e atendimento automatizado (ABERTO-09).

### 8.6 Revisão de consistência (2026-11-17)

- **Alinhado:** ADR 0010, ADR 0011, ADR 0012, ROADMAP (PEND-45 a PEND-49, ABERTO-10 a ABERTO-16, Fase 9), evoluções (EV-14 a EV-17) e esta seção.
- **Homologação:** continua controlada e não autoriza publicação irrestrita; os critérios mínimos da seção 8.4 e os de publicação **seguem pendentes** (ABERTO-12).
- **Classificações:** as funcionalidades "não identificadas" (WhatsApp, relatórios básicos e avançados, IA, atendimento automatizado, gestão adicional) **não mudaram**. Promoções, entrega, fuso e plano estão **decididos e não implementados**; nenhum deles é funcionalidade existente.
- **Fase 9:** continua **não autorizada**; nenhuma tarefa foi marcada como concluída.

## 9. Posicionamento do MVP: oferta única (2026-11-17, PEND-50)

Esta seção é a **posição vigente** e prevalece sobre as seções 1 a 8 no que divergir.

### 9.1 Oferta comercial do MVP

Uma única oferta, **Básico**, preço de referência **R$ 49,90 por mês, ainda sujeito à aprovação comercial definitiva**. Nada que não esteja implementado e homologado é anunciado.

| Funcionalidade da oferta | Situação no código | Pendências conhecidas |
| --- | --- | --- |
| Cardápio digital | Implementada | Roteiro em celular físico (PEND-37); publicação depende da Fase 8 |
| Categorias e produtos | Implementada | — |
| Fotos e descrições | Implementada (disco local) | Driver S3 não validado (ABERTO-02) |
| QR Code | **Parcial** | Sem teste automatizado; folha de impressão a redesenhar (PEND-40) |
| Link compartilhável | **Parcial** | Sem ação "copiar link" no painel |
| Disponibilidade de produtos | Implementada | O `staff` não marca esgotado (EV-05) |
| Carrinho e checkout | Implementada | — |
| Pedidos e acompanhamento | Implementada | — |
| Adicionais e observações | Implementada | Sem quantidade de adicional; observação só do pedido |
| Gestão de mesas | Implementada | — |
| Gestão de equipe | Implementada | — |

**Fora da oferta:** a entrega **não é disponível comercialmente** enquanto não for implementada e homologada (PEND-47 mantém a entrega no escopo técnico). Antes de anunciar qualquer item, ainda valem a Fase 8, a validação jurídica (ABERTO-01) e a homologação do piloto (ABERTO-12).

### 9.2 Evolução técnica (permanece no roadmap e nas evoluções)

Nenhuma é oferta comercial. **Sem prazo e sem prioridade novos.** As prioridades P1 e P3 citadas nas seções anteriores são **propostas não aprovadas**.

| Evolução | Classificação real | Registro |
| --- | --- | --- |
| Promoções automáticas | Planejada | ADR 0010; PEND-45, PEND-49; F9-T4 (não autorizada); EV-14 |
| Descontos percentuais e fixos | Planejada (tipos em proposta) | ADR 0010, "Proposta" |
| Promoções por produtos e categorias | Planejada (condição em proposta) | ADR 0010, "Proposta" |
| Promoções por dia e horário | Planejada (depende do fuso; condições em proposta) | ADR 0010, ADR 0011 |
| Cupons promocionais | **Sem especificação suficiente** | ABERTO-14; EV-14 |
| Reconfirmação por alteração de preço | Planejada (fluxo aprovado, detalhes abertos) | ADR 0010; ABERTO-14 |
| Delivery | **Sem especificação suficiente** | PEND-47; ABERTO-10; F9-T2 e F9-T6; EV-15 |
| Fuso por restaurante | Planejada | ADR 0011; PEND-48; F9-T1; EV-16 |
| Personalização visual ampliada | Parcial hoje (só logo); ampliada **sem especificação** | EV-09 (proposta); F7A-T5b fora do lote |
| WhatsApp | **Sem especificação suficiente** | EV-08 |
| Relatórios básicos | **Sem especificação suficiente** | EV-10 |
| Relatórios avançados | **Sem especificação suficiente** (fora do MVP) | EV-12; `CLAUDE.md` seção 2 |
| Inteligência artificial | **Sem especificação suficiente** | EV-11 |
| Atendimento automatizado | **Sem especificação suficiente** | EV-11 |
| Combos e promoções avançadas | **Sem especificação suficiente** (registrado em 2026-11-17) | EV-18 |
| Gestão e automação avançadas | **Sem especificação suficiente** | EV-12 |
| Limites de utilização de promoções | Evolução futura, não aprovada | EV-17 |
| Estrutura de plano e capacidades | Evolução arquitetural; **não implementar agora** | ADR 0012; PEND-46; F9-T3 (não autorizada); EV-13 |

### 9.3 Planos futuros

- **Profissional e Premium não são planos ofertados no MVP.** As funcionalidades antes associadas a esses nomes são possibilidades de evolução técnica.
- **Nenhuma matriz comercial definitiva é criada** (ABERTO-11 permanece como decisão comercial futura).
- O campo `plan` e as capacidades **não implicam bloqueio de funcionalidades no MVP**, e não há assinatura nem cobrança no sistema.

### 9.4 Ambiguidades corrigidas

1. Havia "planos" propostos como se fossem ofertas; agora só existe o Básico.
2. A disponibilidade e os adicionais apareciam no Profissional na seção 2; agora fazem parte da oferta Básico.
3. O `CLAUDE.md` e o ADR 0012 sugeriam atribuição de plano; agora o plano é evolução arquitetural não implementada.
4. "Entrega" aparecia no `CLAUDE.md` como forma de pagamento presencial e no escopo do MVP; agora está no escopo técnico, mas não disponível comercialmente.
5. Combos e gestão e automação avançadas não tinham registro; agora têm (EV-18, EV-12).
6. Textos "o plano Profissional promete" nas evoluções passaram a "proposta preliminar (histórico)".

### 9.5 Pendências que continuam abertas

ABERTO-01 a ABERTO-16 permanecem (inclusive ABERTO-11, matriz futura, e ABERTO-15, revisão do `CLAUDE.md`). Ainda dependem de decisão: preço definitivo do Básico, critérios de homologação e de publicação (ABERTO-12), especificação de entrega (ABERTO-10), cupons e detalhes de promoção (ABERTO-14) e a relação entre promoções e a homologação do piloto.
