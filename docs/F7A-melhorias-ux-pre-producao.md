# Fase 7A: melhorias de UX antes da produção (planejamento)

- Data: 2026-11-17
- Situação: **planejamento, sem implementação**. Nenhuma tarefa abaixo está autorizada para execução; cada uma depende de autorização específica.
- Posição: depois da Fase 7 (concluída, PR #1) e **antes da entrada em produção** (a execução da F8-T6, homologação e publicação, passa a depender desta fase; ver ROADMAP, Fase 8).
- Referências: `CLAUDE.md` seções 1, 3, 7, 9 e 11; ROADMAP seções 5.8, 5.9, 8.3, 9.1 e 10 (Fases 7 e 8); [ADR 0002](decisions/0002-sessao-cors-csrf.md) (adendo 5); [ADR 0004](decisions/0004-rate-limit.md); [ADR 0008](decisions/0008-direcao-visual-papel-e-tinta.md); [evoluções futuras da API](evolucoes-futuras-da-api.md); [relatório da F7-T8](F7-T8-validacao-final.md)
- Origem: levantamento manual de melhorias de UX feito pelo usuário após a conclusão da Fase 7 (12 pontos, A a L).

O ROADMAP (seção 10, Fase 7A) traz a visão da fase e a tabela de tarefas. Este documento traz o detalhe de cada tarefa e **não é repetido no ROADMAP**.

## 1. Por que uma fase intermediária e por que "7A"

- A Fase 8 já tem escopo e finalidade próprios (produção, infraestrutura e operação) e é referenciada por ADRs, relatórios e tabelas de equivalência (F8-T1 a F8-T6; ADRs 0006 e 0007 reservados). Por isso não foi renumerada nem teve o escopo alterado.
- O padrão já usado no projeto para inserir trabalho sem renumerar é o sufixo em letra (F7-T4a). A fase intermediária segue o mesmo padrão: **Fase 7A**, tarefas **F7A-T1 a F7A-T13**.
- **Decisão que exige aprovação (D-01):** o identificador "7A". Alternativa: tratar as tarefas como parte da própria Fase 7 (reabrindo-a), o que contradiz o critério de conclusão já atingido.

## 2. Princípios da fase

- Valem os princípios da Fase 7: contratos de API, permissões, transições de status, segurança e privacidade preservados, **salvo onde uma tarefa disser expressamente o contrário e depender de aprovação e ADR** (F7A-T5b, F7A-T9, F7A-T12).
- Sem dependência npm nova sem aprovação. Bibliotecas citadas (React Hook Form, Zod, drag and drop, máscaras) são **opções a avaliar**, não decisões.
- Identidade visual: parte do [ADR 0008](decisions/0008-direcao-visual-papel-e-tinta.md); a revisão da F7A-T4 **parte dele** e só o supera por novo ADR.
- E2E permanente restrito ao fluxo principal e às suas variantes (CLAUDE.md seção 12; ADR 0005). Seletores protegidos da [F7-T1, seção 6](F7-T1-linha-de-base.md) preservados. O que não for fluxo principal usa script local fora do repositório ou roteiro manual.
- Critérios de acessibilidade A1 a A10 da Fase 7 valem para toda tarefa.
- Definição de pronto: `pnpm lint`, `typecheck`, `test`, `build` e `e2e` passando; commits pequenos; sem push sem autorização.
- Itens que tocam a API ou o banco (F7A-T5b, F7A-T9, F7A-T12, e a F7A-T11 se houver implementação) seguem o CLAUDE.md seção 2: **necessidade comprovada, pedido do usuário e ADR curto**, e o ROADMAP é atualizado antes da implementação.

## 3. Mapa dos 12 pontos para as tarefas

| Ponto | Melhoria | Tarefa |
| --- | --- | --- |
| A | Banner de identificação do restaurante | F7A-T5 (e F7A-T5b, opcional) |
| B | Botão de adicionar produto (posição da imagem) | F7A-T3 |
| C | Design system e paleta do cardápio | F7A-T4 |
| D | Adicionais com quantidade (incrementar e decrementar) | F7A-T9 |
| E | Miniaturas dos produtos no carrinho | F7A-T6 |
| F | Máscaras e padrões de entrada | F7A-T8 |
| G | Padrão de erros de formulário | F7A-T7 |
| H | WebSocket para atualização de pedidos | F7A-T11 |
| I | Animações no acompanhamento do pedido | F7A-T10 |
| J | Navegação mobile do painel | F7A-T2 |
| K | Padronização dos botões | F7A-T1 |
| L | Arrastar e soltar para ordenação | F7A-T12 |
| (fechamento) | Validação final e regressão da fase | F7A-T13 |

## 4. Pendências e decisões já existentes que são reutilizadas (sem duplicar)

| Existente | Onde | Uso nesta fase |
| --- | --- | --- |
| [EV-03](evolucoes-futuras-da-api.md) (aviso de pedido novo com a aba em segundo plano) e ADR 0002, adendo 5 (sem polling em segundo plano) | evoluções futuras; ADR 0002 | Base da F7A-T11. **Não há pendência nem decisão sobre WebSocket**: a busca por WebSocket, SSE, polling e tempo real em `CLAUDE.md`, ROADMAP, ADRs e evoluções futuras só encontrou o ADR 0002, o EV-03, o PEND-22 e a seção 9.1 (recarga periódica do acompanhamento) |
| PEND-22 (indicador de pedido novo, só com a aba visível) | ROADMAP 11.1 | Comportamento atual que a F7A-T11 avalia substituir |
| [EV-04](evolucoes-futuras-da-api.md) (reordenação atômica) e PEND-23 (reordenação por botões não entrou na Fase 7; mantém-se o campo numérico) | evoluções futuras; ROADMAP 11.1 | Base da F7A-T12 |
| PEND-38 (telefone: 30 caracteres no frontend e 20 no backend) | ROADMAP 11.1 | Pré-requisito da F7A-T8 |
| PEND-39 e [EV-07](evolucoes-futuras-da-api.md) (mensagens de validação da API em inglês) | ROADMAP 11.1; evoluções futuras | Entra na avaliação da F7A-T7 |
| PEND-40 (melhorias de baixa severidade da Fase 7) | ROADMAP 11.1 | Não incorporada; só os itens que coincidirem com uma tarefa abaixo |
| PEND-37 (roteiro em celular físico pendente) | ROADMAP 11.1 | Executado na F7A-T13 |
| PEND-25 e [ADR 0008](decisions/0008-direcao-visual-papel-e-tinta.md) (tokens semânticos de status; paleta "Papel e tinta") | ROADMAP; ADR | Ponto de partida da F7A-T4 |

## 5. Ordem e dependências

```
Independentes, podem começar em qualquer ordem:
  F7A-T1 (botões)   F7A-T2 (navegação mobile)   F7A-T3 (botão adicionar)
  F7A-T11 (avaliação de tempo real, só decisão)

Cadeia visual:   F7A-T4 (paleta) --> F7A-T5 (banner) --> F7A-T5b (capa, opcional)
                                 --> F7A-T10 (animações)
                 F7A-T3 --> F7A-T6 (miniaturas no carrinho)

Cadeia de formulários:  PEND-38 --> F7A-T7 (erros) --> F7A-T8 (máscaras)

Dependem de decisão e de mudança de contrato (bloqueadas até aprovação):
  F7A-T9 (adicionais com quantidade)
  F7A-T12 (arrastar e soltar; depende de EV-04)

Fechamento:  F7A-T13 depende de todas as tarefas aprovadas da fase.
```

Tarefas com pouco acoplamento entre si e executáveis em paralelo no planejamento: T1, T2, T3 e T11. A T1 antes da T7 e da T12 reduz retrabalho (botões e estados de loading e disabled), mas não é bloqueio formal.

## 6. Tarefas

### F7A-T1: padronização dos botões (ponto K)

- **Objetivo:** botões do painel com altura, alinhamento, espaçamento e estados consistentes.
- **Problema atual:** em `categorias/page.tsx` o botão "Salvar" usa `size="lg"` e o "Cancelar" usa o tamanho padrão, então têm alturas diferentes. O mesmo padrão pode se repetir em outros formulários do painel (verificar tela a tela).
- **Comportamento esperado:** um critério único por contexto (formulário, linha de lista, diálogo): par primário e secundário com a mesma altura e o mesmo alinhamento; larguras consistentes entre telas; estados de loading, disabled e foco explícitos; alvo de 44 px nas ações primárias e 24 px nas demais (A6), sem aumentar indiscriminadamente.
- **Escopo frontend:** inventário de todos os `Button` dos formulários e diálogos do painel e da plataforma, definição da regra (tamanhos e variantes em `ui/button.tsx` e no uso) e aplicação. Sem componente novo sem repetição real (CLAUDE.md seção 11).
- **Impacto no backend:** nenhum.
- **Dependências:** nenhuma. Convém antes da F7A-T7.
- **Riscos:** regressão nos seletores protegidos do E2E (nomes acessíveis dos botões); correção pontual que cria nova inconsistência (por isso o inventário vem antes).
- **Critérios de aceite:** pares primário e secundário com a mesma altura em todos os formulários do painel e da plataforma; estados loading, disabled e foco verificados; nomes acessíveis inalterados; A1 a A10.
- **Testes:** `pnpm lint`, `typecheck`, `build`, `e2e`; script local de medição das alturas dos botões em 320, 390, 768 e 1280 px; teclado e foco por roteiro manual.

### F7A-T2: navegação mobile do painel (ponto J)

- **Objetivo:** todos os itens de navegação do painel acessíveis em celular, sem corte.
- **Problema atual:** em `painel/[restaurantId]/layout.tsx` a navegação é uma linha com `overflow-x-auto`, ou seja, os itens fora da tela dependem de rolagem horizontal sem indicação (relato do usuário: menu cortado em celular). A causa provável é essa rolagem sem indicação; confirmar nas capturas no início da tarefa.
- **Comportamento esperado:** itens sempre alcançáveis (por exemplo, quebra controlada em linhas, ou um menu recolhível acionado por botão); sem rolagem horizontal da página; foco visível, `aria-current`, alvo de toque adequado; comportamento idêntico para `owner` e `staff` (o `staff` vê menos itens, e a regra de permissão por rota não muda).
- **Escopo frontend:** layout do painel e `nav-link.tsx`; decisão de padrão (linhas ou menu recolhível).
- **Impacto no backend:** nenhum.
- **Dependências:** nenhuma.
- **Riscos:** o cabeçalho já foi reorganizado na F7-T2 e na F7-T4a para não quebrar em três linhas; a nova solução não pode reintroduzir esse problema; menu recolhível exige gerenciamento de foco e `aria-expanded`.
- **Critérios de aceite:** em 320 e 390 px, todos os itens visíveis ou alcançáveis sem rolagem horizontal; `owner` e `staff` verificados; teclado e leitor de tela (nomes e estado); sem rolagem horizontal da página (A7).
- **Testes:** script local nas quatro larguras, com os perfis `owner` e `staff`; roteiro manual de teclado; E2E existente sem alteração.

### F7A-T3: botão de adicionar produto no cardápio (ponto B)

- **Objetivo:** hierarquia coerente entre imagem, texto e botão "+" no cartão de produto.
- **Problema atual:** em `public-product-card.tsx` o cartão tem o texto à esquerda e a imagem à direita (96 px), e o botão rápido "+" é posicionado sobre o cartão (`pr-12` reserva espaço quando não há adicionais). A imagem fica do lado direito do botão, o que o usuário apontou como incoerente. A confirmação do arranjo desejado é decisão de design (D-02).
- **Comportamento esperado:** posição da imagem, do texto e do botão definida em uma hierarquia única (por exemplo, imagem à esquerda ou acima, texto no centro, preço e botão alinhados); botão sem cobrir imagem nem texto; área de interação de 44 px; produto sem imagem com o mesmo alinhamento.
- **Escopo frontend:** `public-product-card.tsx` e, se necessário, estilos do cardápio. O diálogo do produto não muda de função.
- **Impacto no backend:** nenhum.
- **Dependências:** nenhuma. A F7A-T4 pode ajustar tokens depois, sem refazer o layout.
- **Riscos:** regressão do que a F7-T4a corrigiu (sobreposição do "+" sobre foto e descrição); nomes acessíveis usados pelo E2E ("Adicionar …").
- **Critérios de aceite:** em 320, 390, 768 e 1280 px, sem sobreposição; produto com e sem imagem; botão com 44 px e nome acessível preservado; A1 a A10.
- **Testes:** script local de capturas e medição (como na F7-T4a); E2E do fluxo de pedido sem alteração; teclado.

### F7A-T4: revisão da paleta e dos tokens do cardápio (ponto C)

- **Objetivo:** cores com mais contraste e legibilidade e melhor apelo para um cardápio de comida, coerentes entre cardápio, carrinho, checkout e acompanhamento.
- **Problema atual:** a identidade "Papel e tinta" (ADR 0008) é deliberadamente neutra; o usuário avalia que o cardápio precisa de mais contraste, interesse e percepção de qualidade. Não há ainda proposta concreta de paleta.
- **Comportamento esperado:** proposta de paleta com alternativas, **comparada visualmente** (capturas) e calculada (contraste WCAG AA: 4,5:1 texto, 3:1 componentes); alteração feita nos **tokens semânticos** (nomes existentes), nunca em cores soltas nos componentes; consistência nas quatro telas públicas.
- **Escopo frontend:** `globals.css` (tokens), revisão das telas públicas; o painel e a plataforma só mudam se a decisão for estender a mudança (D-03).
- **Impacto no backend:** nenhum.
- **Dependências:** nenhuma de código. Antecede a F7A-T5 e a F7A-T10.
- **Riscos:** o ADR 0008 tem acento oliva único e regras sobre tokens de status; mudar sem registrar contradiz um ADR aprovado (por isso, **novo ADR** que referencie e ajuste o 0008, sem descartá-lo automaticamente); regressão de contraste nos estados de pedido; efeito colateral no painel se os tokens forem compartilhados.
- **Critérios de aceite:** ADR aprovado antes de aplicar; cálculo de contraste de todos os pares de texto, bordas de campo e estados (hover, foco, erro); capturas antes e depois dos mesmos estados, inspecionadas individualmente; nenhuma cor solta nos componentes; contraste AA mantido; A1 a A10.
- **Testes:** script local de contraste por tokens; capturas nas cinco larguras da F7-T4a; `lint`, `typecheck`, `build`, `e2e`.
- **Decisão que exige aprovação (D-03):** escopo da paleta (só área pública ou as três áreas) e a proposta escolhida.

### F7A-T5: banner de identificação do restaurante (ponto A)

- **Objetivo:** banner no topo do cardápio público com identificação do restaurante, legível sobre qualquer fundo.
- **Problema atual:** o cabeçalho do cardápio mostra nome e dados do restaurante sem destaque visual. O contrato público atual só devolve `logo_url`; **não existe imagem de capa** (`GET /public/restaurants/:slug`, ROADMAP 8.4).
- **Comportamento esperado:** banner com imagem ou composição com gradiente, escurecimento mais intenso na parte inferior, nome e informações principais legíveis (contraste AA sobre o fundo); responsivo para proporções variadas e **sem imagem** (fallback por composição com tokens e logo, sem depender de imagem nova).
- **Escopo frontend:** componente do cabeçalho do cardápio; usa **somente os dados atuais** (nome, descrição, telefone e `logo_url`) na F7A-T5. Reserva de espaço para evitar deslocamento de layout.
- **Impacto no backend:** nenhum nesta tarefa. A **capa enviada pelo restaurante** é a F7A-T5b.
- **Dependências:** F7A-T4 (tokens e contraste).
- **Riscos:** texto sobre imagem arbitrária (contraste imprevisível: o gradiente precisa garantir o mínimo); peso da imagem; deslocamento de layout.
- **Critérios de aceite:** legível sobre imagens claras e escuras e sem imagem; sem deslocamento de layout; cinco larguras; contraste AA calculado com o pior caso (fundo claro); A1 a A10.
- **Testes:** script local com logo claro, logo escuro e sem logo; contraste calculado no pior caso; capturas.

### F7A-T5b: imagem de capa do restaurante (ponto A, opcional)

- **Objetivo:** permitir que o restaurante envie uma imagem de capa para o banner.
- **Problema atual:** o modelo de dados e a API não têm esse campo.
- **Escopo:** fora da F7A-T5. Se aprovada: campo e migration (`restaurants`), validação de upload (tipo, extensão e tamanho, nome gerado pelo servidor, caminho isolado por restaurante, ADR 0003), exibição no cardápio e tela de configurações com envio e remoção, contrato público com o novo campo.
- **Impacto no backend:** **sim** (migration, upload, contrato). Exige necessidade comprovada, pedido do usuário e ADR curto (CLAUDE.md seção 2), e atualização do ROADMAP (4.3 e 8.4) antes.
- **Dependências:** F7A-T5; decisão **D-04** (a capa enviada é necessária ou o banner por composição basta?).
- **Riscos:** novo upload (superfície de segurança e armazenamento em produção, ver F8-T2); custo de manutenção.
- **Critérios de aceite e testes:** definidos se for aprovada; ao menos testes de isolamento entre restaurantes (leitura, alteração e exclusão), validação de upload e do contrato.

### F7A-T6: miniaturas dos produtos no carrinho (ponto E)

- **Objetivo:** mostrar a imagem de cada produto no carrinho.
- **Problema atual:** `CartLine` (`lib/cart.tsx`) guarda `productId`, `productName`, `unitPrice`, `addons` e `quantity`, **sem imagem**; o carrinho fica no armazenamento local do navegador, e a cotação do backend não devolve imagem.
- **Comportamento esperado:** miniatura de dimensões fixas (largura e altura declaradas, `object-cover`, sem distorção), fallback para produto sem imagem, sem deslocamento de layout, boa apresentação em 320 px.
- **Escopo frontend:** guardar a URL da imagem na linha do carrinho **ou** resolvê-la a partir do cardápio já carregado (decisão de implementação; preferir a que não exija mudar o formato guardado, ou migrar o armazenamento de forma tolerante a linhas antigas). Componente do carrinho e a barra do carrinho, se aplicável.
- **Impacto no backend:** nenhum (a imagem pública já vem em `image_url` no cardápio). A cotação não muda (seção 5.9).
- **Dependências:** F7A-T3 (consistência com o cartão do produto) e, para tokens, F7A-T4.
- **Riscos:** carrinhos antigos no `localStorage` sem o novo campo (tolerar); imagem removida ou produto indisponível depois de adicionado; peso de várias imagens.
- **Critérios de aceite:** carrinhos antigos continuam funcionando; fallback correto; sem deslocamento de layout; imagem com `alt` vazio (decorativa, nome do produto já presente); 320 a 1280 px; o total continua vindo da cotação (ADR 0001).
- **Testes:** script local com produto com e sem imagem e com carrinho antigo no armazenamento; E2E do fluxo de pedido; medição de deslocamento de layout.

### F7A-T7: padrão de erros de formulário (ponto G)

- **Objetivo:** erros de formulário apresentados de forma consistente pelos componentes do projeto (shadcn e Base UI), próximos aos campos, sem depender das mensagens nativas do HTML5.
- **Problema atual:** o projeto já tem `field.tsx` e `form-error.tsx` e a Fase 7 estabeleceu erros inline e persistentes, mas ainda há uso de validação nativa (`required`, `maxLength`, tipos; 24 ocorrências de `required` em `apps/web/src`, nenhum `noValidate`) como apresentação do erro, inclusive no checkout, e a mensagem do servidor chega em inglês (PEND-39 e EV-07).
- **Comportamento esperado:** erro junto ao campo, `aria-invalid` e `aria-describedby`, foco no primeiro campo inválido, estados visuais consistentes; **três categorias** apresentadas de forma distinta: validação (campo), negócio (por exemplo, `409` e `422`, mensagem do formulário) e falha de comunicação (rede ou `5xx`, com ação de tentar de novo).
- **Escopo frontend:** **avaliação prévia, com recomendação escrita, de React Hook Form e de uma biblioteca de validação (como Zod)**: compatibilidade com os formulários existentes, custo de migração, adoção incremental, integração com os validadores da API (VineJS) e padronização de mensagens e códigos. **Não propor migração geral sem justificativa técnica**: a hipótese inicial é cobrir o padrão com os componentes existentes e só recomendar biblioteca se a avaliação mostrar ganho claro. Depois da aprovação, aplicar o padrão em formulários-piloto e, só então, nos demais.
- **Impacto no backend:** nenhum necessário; se a avaliação recomendar mapear `code` e `details` para mensagens em português no cliente, não muda o contrato. Mensagens em português no servidor são o EV-07 (decisão à parte).
- **Dependências:** F7A-T1 (estados de botão); PEND-38 (limite do telefone) antes da F7A-T8.
- **Riscos:** nova dependência (precisa de aprovação, CLAUDE.md seção 1); duplicação da regra de validação entre cliente e servidor (o servidor continua sendo a fonte de verdade, CLAUDE.md seção 3); mudança de nomes acessíveis usados pelo E2E.
- **Critérios de aceite:** documento de avaliação aprovado; padrão aplicado nos formulários-piloto; erro de campo, de negócio e de comunicação distintos; foco no primeiro inválido; A2 e A10; seletores protegidos preservados.
- **Testes:** script local (cada categoria de erro, leitor de tela por `ariaSnapshot`, teclado); E2E do fluxo de pedido; testes da API não mudam.
- **Decisão que exige aprovação (D-05):** adotar ou não biblioteca de formulários e de validação.

### F7A-T8: máscaras e padrões de entrada (ponto F)

- **Objetivo:** padronizar campos de telefone e numéricos e, onde houver, de valor monetário e identificadores, separando máscara visual de validação de domínio.
- **Problema atual:** os campos são texto simples. Há divergência de tamanho do telefone (30 no frontend, 20 no backend, PEND-38). Não foram identificados campos de CEP ou endereço no domínio (a v1 não coleta endereço); a tarefa confirma isso no inventário.
- **Comportamento esperado:** máscara apenas visual; o valor enviado à API é o normalizado que ela espera; colar, editar no meio e navegar por teclado funcionam; valores monetários trafegam como string decimal (CLAUDE.md seção 7; ADR 0001) e **a máscara não faz aritmética**.
- **Escopo frontend:** inventário dos campos, padrão reutilizável (função de formatação e de normalização, ou componente de campo) criado **somente com repetição real** (3 telas, CLAUDE.md seção 11); verificar os componentes compartilhados existentes antes de propor biblioteca.
- **Impacto no backend:** nenhum, **desde que** o valor normalizado continue compatível com o validador atual. O alinhamento do limite do telefone (PEND-38) é corrigido no frontend para 20, com teste de validação.
- **Dependências:** F7A-T7 (campo e erro padronizados) e PEND-38.
- **Riscos:** máscara que impede edição ou colagem; máscara que descarta dígitos silenciosamente; telefones internacionais (a v1 é nacional, confirmar); autofill do navegador.
- **Critérios de aceite:** envio sempre com valor normalizado; colar, editar e apagar no meio funcionam; leitor de tela anuncia o formato esperado (dica no campo); contratos inalterados; A1, A2 e A10.
- **Testes:** testes unitários simples das funções de normalização (se houver lógica relevante, sem ampliar o E2E); script local de colagem e edição; E2E do fluxo de pedido com telefone.

### F7A-T9: adicionais com controle de quantidade (ponto D)

- **Objetivo:** trocar a seleção por caixa de marcação por um controle de quantidade (incrementar e decrementar), como o já existente no diálogo do produto.
- **Problema atual:** em `public-product-card.tsx` cada adicional é uma `Checkbox` (marcado ou não). **O modelo atual não suporta quantidade de adicional:** os adicionais são "simples e opcionais" (ROADMAP 5.8 e F3-T4); `addon_ids` é uma lista sem repetição; `order_item_addons` **não tem `quantity`** (removido na revisão APR-02) e o cálculo usa a quantidade do item (3 unidades com um adicional de R$ 2,00 geram R$ 6,00); a associação produto-adicional é limitada a 10 e **não há mínimo, máximo nem obrigatoriedade** por adicional.
- **Consequência:** a mudança **não é só visual**. Um controle de quantidade por adicional exige contrato novo na cotação e na criação do pedido (`addons: [{ id, quantity }]`), `quantity` em `order_item_addons` (migration), regra de cálculo no backend com `big.js` (ADR 0001), snapshot e exibição no detalhe do pedido e no acompanhamento, e limites por adicional (mínimo, máximo, obrigatório) no cadastro. Atende ao CLAUDE.md seção 2 como mudança que exige necessidade comprovada, pedido do usuário e ADR.
- **Comportamento esperado (se aprovada):** botões de aumentar e reduzir por adicional, quantidade exibida, respeito a mínimo e máximo, adicionais opcionais e obrigatórios, preço calculado pelo backend, operação por teclado e leitor de tela (`role="group"`, nome por adicional, valor anunciado).
- **Opções a decidir (D-06):** (a) **não fazer**: manter a caixa de marcação; (b) **só visual**: controle que alterna 0 e 1, sem ganho funcional (não recomendado); (c) **quantidade real por adicional**, com a mudança de contrato e de dados descrita acima, dividida em subtarefas (backend e testes primeiro, depois frontend); (d) **adicionais obrigatórios e limites** como evolução separada da quantidade.
- **Dependências:** decisão D-06, ADR, atualização do ROADMAP (4.3, 5.5, 5.8, 8.3 e 8.4) antes de implementar; F7A-T3 e F7A-T7 reduzem retrabalho no mesmo componente.
- **Riscos:** alto: migration em tabela de pedidos, snapshots, cálculo monetário, consistência com pedidos antigos (backfill de `quantity` = 1), regressão nos testes de cálculo e de isolamento, nomes usados pelo E2E.
- **Critérios de aceite (opção c):** cálculo no backend com testes (mesmo resultado para quantidade 1); isolamento entre restaurantes; pedidos antigos inalterados; snapshot correto; teclado e leitor de tela; A1 a A10.
- **Testes (opção c):** testes da API (cotação, criação, limites, snapshot, isolamento); E2E do fluxo de pedido com adicional; script local de teclado.

### F7A-T10: animações no acompanhamento do pedido (ponto I)

- **Objetivo:** transmitir que o pedido está em andamento e tornar as mudanças de estado mais claras, com animações discretas.
- **Problema atual:** a página `order-tracking.tsx` mostra as etapas e o horário de atualização, sem movimento. A F7-T7 já aplicou a regra global de `prefers-reduced-motion`.
- **Comportamento esperado:** destaque animado discreto da etapa atual; transição ao mudar de etapa (só **depois** que a API confirmar o novo status); diferença visual clara entre etapas concluída, atual e futura (texto, ícone e forma, nunca só cor: A5); sem som; sem animação que prejudique a leitura; nada simulado antes da confirmação do backend.
- **Escopo frontend:** `order-tracking.tsx` e CSS; **sem biblioteca de animação** (CSS e recursos já existentes).
- **Impacto no backend:** nenhum. A página do token continua sem scripts, fontes ou imagens de terceiros, com `no-store` e `no-referrer`.
- **Dependências:** F7A-T4 (tokens). Independente da F7A-T11: a animação não depende do mecanismo de atualização.
- **Riscos:** movimento contínuo prejudicando leitura ou atenção; `prefers-reduced-motion` (a animação deve cair para estado estático equivalente); desempenho em aparelhos fracos; anúncio duplicado no leitor de tela.
- **Critérios de aceite:** com `prefers-reduced-motion: reduce`, sem animação e com a mesma informação; etapa atual identificada por texto e `aria-current="step"` (preservado); nenhuma animação antes da confirmação do status; cabeçalhos de segurança e ausência de recursos de terceiros mantidos.
- **Testes:** script local com movimento reduzido ligado e desligado; verificação de cabeçalhos; E2E do acompanhamento sem alteração.

### F7A-T11: avaliação de atualização em tempo real (ponto H; avaliação e decisão, sem implementação)

- **Objetivo:** decidir, com evidência, se e como substituir ou complementar a atualização atual por um canal em tempo real (WebSocket ou alternativa).
- **Situação atual (documentada):**
  - Painel: o indicador de pedido novo atualiza **só com a aba visível**, a cada 15 s, e imediatamente ao voltar à aba (PEND-22). O ADR 0002 (adendo 5) **proíbe polling em segundo plano**, porque toda requisição autenticada renova a inatividade da sessão (ver EV-03).
  - Acompanhamento público: recarga periódica simples, compatível com 30 consultas por minuto (ROADMAP 9.1; ADR 0004), só com a aba visível; a página do token não usa sessão.
  - Não existe pendência nem decisão sobre WebSocket; o EV-03 cita "eventos enviados pelo servidor" e notificações do navegador como opções.
- **Entrega:** **documento de avaliação e proposta de ADR**, sem código. Compara, no mínimo: manter o estado atual; SSE; WebSocket; notificações do navegador. Cada opção é avaliada em:
  - atualização do painel e do acompanhamento público;
  - autenticação e autorização por restaurante e isolamento entre tenants (um canal nunca entrega evento de outro restaurante; o tenant vem do vínculo da sessão ou do token, não do cliente);
  - interação com a renovação da sessão (o canal não pode renovar nem manter a sessão viva indevidamente, nem deixá-la expirar sem aviso);
  - reconexão e recuperação de eventos perdidos (o estado persistido no banco é a fonte de verdade; evento recebido só dispara releitura ou carrega o dado completo);
  - consistência entre o estado recebido e o persistido;
  - segurança do canal (Origin, CSRF no handshake, limites de conexão, rate limit e consumo de recursos; dados mínimos no evento, sem dados pessoais);
  - impacto na infraestrutura e na operação (Nginx e HTTPS na F8-T2, uma instância da API sem Redis, memória, `proxy_read_timeout`; **sem Redis, filas ou worker** sem necessidade comprovada, CLAUDE.md seções 1 e 2).
- **Importante:** WebSocket **não é presumido** como melhor solução. A opção "manter o estado atual" é válida; o custo de infraestrutura e de segurança precisa ser justificado por necessidade operacional comprovada (por exemplo, perda real de pedidos por aba em segundo plano).
- **Impacto no backend:** nenhum na avaliação. Se a decisão for implementar, abre-se tarefa própria, com ADR (substitui ou complementa o adendo 5 do ADR 0002), testes de isolamento e de autorização do canal, e atualização do ROADMAP antes; entra na fase só com aprovação, e pode ir para depois da produção.
- **Dependências:** nenhuma (independente). Se aprovada a implementação, relaciona-se com a F8-T2 (Nginx) e com a F8-T6.
- **Riscos:** complexidade operacional desproporcional ao porte do produto; vazamento entre tenants; esgotamento de conexões; sessão mantida viva por canal aberto.
- **Critérios de aceite:** documento aprovado com recomendação explícita (inclusive "não implementar agora"); ADR proposto; pendência EV-03 atualizada com a decisão.
- **Testes:** não se aplica à avaliação. Se houver implementação: testes de isolamento e de autorização do canal, de reconexão e de consistência.
- **Decisão que exige aprovação (D-07):** a recomendação final e se a implementação entra antes da produção.

### F7A-T12: ordenação por arrastar e soltar (ponto L)

- **Objetivo:** reordenar categorias e produtos arrastando, com alternativa acessível por teclado, persistindo a ordem no backend.
- **Situação atual:** a ordem é o campo numérico `sort_order`, sem unicidade (categorias e produtos; `PATCH` parcial). O PEND-23 manteve o campo numérico na Fase 7. O EV-04 já descreve a reordenação atômica (endpoint que recebe a lista ordenada e grava em uma transação).
- **Comportamento esperado:** arrastar altera a ordem no painel; ao concluir, a nova ordem é gravada de uma vez; a ordem do painel e a do cardápio público coincidem; em falha de rede, o painel volta à ordem anterior e informa (sem ordem parcial); alternativa por teclado (por exemplo, botões "subir" e "descer" ou modo de movimentação por teclado) com anúncio por leitor de tela; o `staff` só reordena se a permissão atual permitir (hoje criar e alterar nome e ordem é permitido ao `staff`, ROADMAP 5.8; confirmar na matriz antes).
- **Escopo frontend:** listas de categorias e de produtos do painel; avaliação da necessidade de **biblioteca de drag and drop** (registrar a avaliação: acessibilidade por teclado e toque, tamanho, manutenção) **sem adicionar dependência sem aprovação**; a alternativa por teclado pode dispensar a biblioteca para o caso de uso.
- **Impacto no backend:** **sim**, para a persistência atômica: endpoint de reordenação (EV-04), com validação de que todos os ids pertencem ao restaurante validado, limite de itens por requisição, transação e controle de concorrência (por exemplo, rejeitar a ordem se a lista enviada diferir do estado atual, ou aplicar "a última gravação vence" documentado); `sort_order` sem unicidade permanece, e o desempate já usa critério estável. Exige necessidade comprovada, pedido do usuário e ADR curto, e atualização do ROADMAP 8.3 antes.
- **Dependências:** EV-04 aprovado (contrato e ADR); decisão **D-08** (biblioteca ou implementação própria); F7A-T1.
- **Riscos:** concorrência entre dois usuários; ordem parcial por falha de rede; acessibilidade de arrastar (toque e teclado); dependência nova; categoria e produto têm escopos de ordenação distintos (produtos dentro da categoria, ou global: definir).
- **Critérios de aceite:** testes da API de atomicidade, isolamento entre restaurantes (leitura, alteração, exclusão) e permissão; ordem do painel igual à do público; alternativa por teclado; falha de rede sem perda; A1 a A10.
- **Testes:** testes da API (Japa) para o endpoint; script local de arrastar e de teclado; concorrência simulada com duas sessões; E2E sem ampliar (fluxo auxiliar).

### F7A-T13: validação final e regressão da fase

- **Objetivo:** validar as tarefas aprovadas e encerrar a fase antes da produção.
- **Entrega:** suítes completas; E2E permanente do fluxo principal mantido; verificação local das alterações de cada tarefa; auditoria de acessibilidade e responsividade nas telas alteradas (A1 a A10, quatro larguras); comparação com a [linha de base da F7-T1](F7-T1-linha-de-base.md) e com a [F7-T8](F7-T8-validacao-final.md); atualização da matriz de cobertura; **execução do roteiro em celular físico** (PEND-37), cobrindo os itens novos (banner, botão de adicionar, carrinho com miniatura, navegação do painel, erros e máscaras, acompanhamento com animação); relatório da fase, com aprovação.
- **Dependências:** todas as tarefas aprovadas da fase.
- **Impacto no backend:** nenhum além do que as tarefas aprovadas tiverem feito.
- **Critérios de aceite:** tudo passando; nenhuma pendência de severidade alta; contratos e regras inalterados, exceto os aprovados por ADR; roteiro em celular físico executado ou registrado como pendência aprovada; relatório aprovado.
- **Testes:** `pnpm lint`, `typecheck`, `test`, `build` e `e2e`.

## 7. Decisões que exigem aprovação técnica

| ID | Decisão | Tarefa |
| --- | --- | --- |
| D-01 | Identificador da fase ("7A") | Toda a fase |
| D-02 | Arranjo desejado de imagem, texto e botão no cartão do produto | F7A-T3 |
| D-03 | Escopo e proposta da paleta (só área pública ou as três áreas); novo ADR que ajusta o 0008 | F7A-T4 |
| D-04 | Capa enviada pelo restaurante é necessária, ou o banner por composição basta? | F7A-T5b |
| D-05 | Adotar ou não biblioteca de formulários e de validação | F7A-T7 |
| D-06 | Adicionais com quantidade: opção (a), (b), (c) ou (d) | F7A-T9 |
| D-07 | Recomendação sobre tempo real e se a implementação entra antes da produção | F7A-T11 |
| D-08 | Arrastar e soltar: biblioteca ou implementação própria; contrato do EV-04 | F7A-T12 |
| D-09 | Quais tarefas entram antes da produção (a ordem de execução e o corte de escopo da fase) | Toda a fase |

## 8. Relação com a preparação para produção

- A Fase 7A termina antes da entrada em produção. A execução da F8-T6 (homologação e publicação) depende da Fase 7A (ver ROADMAP).
- As decisões e a execução da F8-T1 a F8-T5 não dependem das tarefas visuais e podem ocorrer em paralelo. Tarefas que alteram o backend ou a infraestrutura (F7A-T5b, F7A-T9, F7A-T11 se houver implementação, F7A-T12) afetam o que é homologado na F8-T6 e as migrations do deploy; por isso, **devem ser decididas antes do congelamento da F8-T2**.
- Qualquer tarefa que envie arquivos (F7A-T5b) depende do object storage da D2 em produção.
- Se o usuário decidir cortar escopo (D-09), as tarefas que dependem de contrato novo (T5b, T9, T11, T12) são as candidatas naturais a ficar para depois da publicação, sem impedir as demais.

## 9. Não faz parte desta fase

Tudo o que o CLAUDE.md seção 2 lista como fora do escopo (pagamento online, planos, domínios, filas, Redis, notificações externas, relatórios), tema escuro, fonte nova e telas novas. Nenhuma tarefa acima implementa funcionalidade de negócio nova sem decisão e ADR.

## 10. Execução e relatório (2026-11-17)

- Branch `feat/fase-7a`, a partir da `main`. Nada enviado ao remoto.
- **Decisões do usuário:** D-01 (nome "7A" mantido), D-02 (composição do cartão delegada), D-03 (identidade "Papel e tinta" preservada; sem fonte nova, gradiente ou personalização por restaurante; animação só na T10), D-05 (sem biblioteca de formulários) e D-09 (lote da seção 8 do plano; T5b, T9 e T12 fora). D-04, D-06, D-07 e D-08 seguem sem decisão, pois as tarefas estão fora do lote. As decisões de composição e de tokens estão no [ADR 0009](decisions/0009-cardapio-publico-fase-7a.md).

### 10.1 Tarefas

| Tarefa | Situação | Observação |
| --- | --- | --- |
| T1 botões | concluída | Pares Salvar e Cancelar com o mesmo tamanho (44 px) e a mesma largura nos formulários de categorias, adicionais, produtos e mesas; medido no navegador. Os botões de ação de linha (tamanho `sm` ou padrão) não mudaram. |
| T2 navegação mobile | concluída | Menu recolhível (`aria-expanded`, Escape fecha) abaixo de 640 px; em linha a partir daí. `owner` mostra 7 itens e `staff`, 5. |
| T3 cartão do produto | concluída | Linha de menu (ADR 0009). Nomes longos sem espaço corrigidos. |
| T4 tokens | concluída | Só o token "Em preparo" mudou (sem violeta); contraste calculado de 19 pares, todos acima do mínimo. |
| T5 banner | concluída | Superfície sólida, sem imagem de capa e sem gradiente. |
| T6 miniaturas | concluída | `imageUrl` opcional no carrinho, URL do armazenamento validada, carrinho antigo tolerado, carrinhos separados por restaurante. |
| T7 erros | concluída | Padrão em todos os formulários (seção 10.5). |
| T8 máscaras | concluída | `PhoneField` com envio normalizado em checkout, configurações e plataforma (novo e edição); limite alinhado à API (PEND-38). |
| T10 animações | concluída | Entrada da etapa atual e pulso discreto; `prefers-reduced-motion` desliga. |
| T11 tempo real | concluída (documento) | [Recomendação: manter o estado atual](F7A-T11-avaliacao-tempo-real.md). |
| T13 regressão | concluída tecnicamente | Seção 10.3. Roteiro em celular físico segue pendente (PEND-37). |

### 10.2 T5b, T9 e T12 frente ao MVP (verificação pedida na D-09)

- O escopo da v1 (CLAUDE.md seção 2) lista "adicionais simples", categorias, produtos com foto e cardápio por slug. **Nenhuma das três é requisito do MVP:** adicionais com quantidade (T9) contradiz a decisão "simples e opcionais" do ROADMAP 5.8; ordenação por arrastar (T12) tem a alternativa vigente do campo numérico (PEND-23); capa enviada (T5b) não consta no escopo e o banner por composição cumpre a identificação do restaurante.
- Impacto de deixá-las fora: nenhum bloqueio de produção. Ficam como evolução; se aprovadas depois, T9 e T12 exigem migration ou endpoint novo e devem ser decididas antes do congelamento da F8-T2.

### 10.3 Validação

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (334 de 334), `pnpm build` e `pnpm e2e` (15 de 15) passando no estado final.
- Verificação no navegador (Playwright MCP, Chromium, base `cardapio_test` isolada, dois restaurantes fictícios, 12 categorias, 58 produtos com e sem foto (mais 2 no outro restaurante), logo largo, descrição longa e nome sem espaços), em 320, 390, 768, 1024 e 1280 px: cardápio, carrinho vazio e telas do painel do `owner` em todas as larguras, `staff` e plataforma em 320 a 1280 px, sem rolagem horizontal da página; um `<h1>` por tela; o único alvo abaixo de 24 px em telas públicas é o link "Pular para o conteúdo" (invisível até receber foco). Carrinho com linha antiga e com URL maliciosa (`javascript:`), tolerados; carrinho de outro restaurante não se mistura; fluxo pedido, acompanhamento e transição de status com movimento normal e reduzido.
- Defeitos encontrados e corrigidos na validação: nome longo sem espaço sobre a foto (T3), cabeçalho do painel com 5 px de excesso em 305 a 320 px, e expressão regular errada no armazenamento do carrinho (pega pelo lint).

### 10.4 Pendências

| Item | Classe | Observação |
| --- | --- | --- |
| Roteiro em celular físico (PEND-37) | humana | **Não executado, sem aparelho.** Roteiro objetivo em [F7A-roteiro-celular-fisico.md](F7A-roteiro-celular-fisico.md) |
| Mensagens de validação da API em inglês (EV-07) | melhoria futura | Sem mudança de backend |
| Alvos de linha de 28 a 32 px no painel | já aceita | A6 (24 px) atendido; ver F7-T8 |
| Inspeção individual de capturas por um humano | humana | Capturas feitas em 320, 390, 768 e 1280 px e inspecionadas pelo agente; a revisão do usuário (PEND-31) continua útil |
| Cor de acento por restaurante, fonte serifada nos títulos | melhoria futura | Exigem decisão (backend ou nova fonte) |

### 10.5 Rodada complementar: T7 em todos os formulários (2026-11-17)

- **Análise da abstração:** os 9 formulários repetiam o mesmo bloco (estado de erro e de campos, limpar, capturar erro da API, foco), o que justifica extrair. `validateForm` foi adaptado: suporta `select`, ignora campos desabilitados (`willValidate`, caso do `staff` em Configurações), cobre faixa numérica, formato e tamanho mínimo, tira do rótulo qualquer sufixo entre parênteses e acha o rótulo do Select do Base UI pelo `name`. Foi criado `useFormFeedback` (mensagem com categoria, erros por campo, foco no primeiro erro); `report` serve às ações que não são formulário.
- **Aplicado em:** categorias, produtos (inclusive o editor de adicionais), adicionais, mesas (criar e renomear), equipe, configurações (dados e opções), plataforma (novo e edição), login e troca de senha. O checkout usa os mesmos auxiliares, mas mantém o estado próprio por causa do mapeamento `customer.*`.
- **Preservado:** regras de validação, contratos, permissões, estados de carregamento e mensagens de negócio da API. A regra "confirmação diferente da senha" e o mapeamento de slug em uso continuam específicos das telas.
- **Evidências (Playwright MCP, 390 px, base `cardapio_test`):** envio vazio mostra erro junto do campo com `aria-describedby` e foco no primeiro inválido em categorias, produtos (nome, categoria, preço e faixa de ordem), adicionais, mesas, equipe, configurações (dono; `staff` com campos desabilitados não é bloqueado), plataforma (novo e edição) e troca de senha; negócio (nome duplicado, slug em uso, senha inválida) em mensagem própria; falha de rede (requisição abortada) mostra "Falha de comunicação" e mantém o que foi digitado, em categorias e no login; sucesso confirmado por toast em categorias e configurações. `staff`: 7 telas × 5 larguras sem rolagem lateral e com um `<h1>`; plataforma em 4 larguras sem rolagem lateral.
- **Defeito pego na validação:** o rótulo do Select de categoria saía como "Este campo"; corrigido.
- **Suítes no estado final:** `lint`, `typecheck`, `test` (334 de 334), `build` e `e2e` (15 de 15) passando.
- **Pendências restantes:** PEND-37 (roteiro físico), decisões D-04, D-06, D-07 e D-08 (tarefas fora do lote), EV-07 e a revisão humana das capturas.
