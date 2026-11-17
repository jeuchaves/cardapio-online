# F7-T8: validação final e regressão da Fase 7

- Data: 2026-11-16
- Base: commit `66e1702` (branch `feat/fase-7-ux`), mais as alterações descritas na seção 2
- Referências: ROADMAP, Fase 7 (F7-T8); [linha de base da F7-T1](F7-T1-linha-de-base.md); [auditoria da F7-T7](F7-T7-auditoria.md); [matriz de cobertura](F6-T1-matriz-de-cobertura.md), seção 11
- Situação: **aguardando aprovação** do relatório da fase
- Escopo: contratos da API, permissões, transições de pedido e segurança inalterados. Sem dependência nova.

## 1. Resumo

Todas as suítes passam e as verificações locais de operação de pedidos, indicador de pedido novo, conflito, experiência do cliente e telas do painel e da plataforma passaram em 320, 390 e 1280 px. A única falha apontada pelos scripts foi uma corrida do próprio script (seção 4); a conferência direta mostrou o comportamento correto. A única verificação **não feita** é o roteiro manual em celular real, que precisa de uma pessoa com o aparelho (seção 6).

## 2. O que mudou na F7-T8

| Arquivo | Mudança |
| --- | --- |
| `apps/web/e2e/panel-orders.spec.mjs` | Teste novo: o staff avança o pedido pela lista, sem abrir o detalhe (variante do fluxo principal "restaurante atualiza o status", prevista na F7-T3 e ainda sem teste permanente) |
| `docs/F6-T1-matriz-de-cobertura.md` | Contagem de E2E (13 para 15), nota sobre a exibição do nome da mesa e nova seção 11 com a cobertura do frontend da Fase 7 |
| `docs/F7-T8-validacao-final.md` | Este relatório |

Nenhum código de produção foi alterado na F7-T8.

O teste novo confere, na visão padrão "Novos": o pedido aparece, o botão `Confirmar #N` (nome exato) avança, o toast "Pedido #N: Confirmado." aparece, o pedido sai de "Novos", o cliente vê "Confirmado" no acompanhamento, e a visão "Confirmados" mostra o pedido com o botão `Preparar #N`.

## 3. Suítes

| Comando | Resultado |
| --- | --- |
| `pnpm lint` | passou |
| `pnpm typecheck` | passou |
| `pnpm test` | **334 de 334** (API, Japa), sem mudança |
| `pnpm build` | passou |
| `pnpm e2e` | **15 de 15** (9 em `order-flow.spec.mjs` e 6 em `panel-orders.spec.mjs`) |

## 4. Verificações locais (scripts fora do repositório)

Scripts com o Playwright já instalado, em `cardapio-online-capturas\f7-referencia\tools\`, sobre o seed do E2E em `cardapio_test`. O `cardapio_dev` não foi tocado. Os scripts não fazem parte do repositório nem são testes permanentes.

**Operação de pedidos e cliente (`t8.mjs`; 390, 320 e 1280 px; 0 problemas em cada largura):**
- Visões da lista (Novos como padrão, Confirmados, Em preparo, Prontos, Todos): `aria-pressed` correto e cada visão só mostra o status esperado.
- Lista sem rolagem horizontal; sem botão de cancelamento na lista (só no detalhe).
- Avanço pela lista: botão com 44 px, acionável por teclado (Enter), com toast anunciado em região viva.
- Conflito 409 na lista (pedido avançado por outra pessoa): mensagem "O status do pedido #N mudou" e a lista recarrega.
- Indicador de pedido novo: com a aba oculta, **0 chamadas à API em 33 s** (ciclo de 15 s); ao voltar à aba, o pedido aparece em cerca de 100 ms; título com contagem `(1) Pedidos`, região viva anunciando "1 novo pedido", selo "Novo" (texto, não só cor); a contagem sobe para `(2)`; "Marcar como vistos" limpa aviso e título.
- Detalhe do pedido com link `tel:` e telefone visível; sem rolagem horizontal.
- Cliente: nome da mesa no cardápio com `?mesa=`, aviso de mesa inválida antes do envio, botão de adicionar rápido (44 × 44 px), barra do carrinho com `safe-area`, acompanhamento com etapa atual (`aria-current="step"`), "Atualizado…", botão de copiar o link, sem rolagem horizontal.
- Página do token: `Cache-Control: no-store`, `Referrer-Policy: no-referrer` e **0 recursos de terceiros**.

**Regressão das tarefas anteriores:**
- `t5.mjs` (F7-T5: cadastros, formulário recolhido, equipe empilhada, configurações, folha de QR): 0 problemas.
- `t6.mjs` (F7-T6, em 390 px): login com mostrar senha e foco no erro, troca de senha com foco no campo inválido, `/painel` com um restaurante, lista de restaurantes da plataforma com a situação visível, diálogo de desativação: tudo correto. O script apontou 1 problema ("← Restaurantes" ausente para quem tem dois restaurantes), que é **corrida do próprio script** (a verificação roda antes de o layout renderizar). Já ocorrera na F7-T6. Conferido de novo com espera pelo carregamento: o link aparece (1 ocorrência, o esperado).
- `t7.mjs` (acessibilidade): seção 5.

## 5. Comparação final com a linha de base da F7-T1 (seção 4)

Mesmos critérios e larguras da linha de base (320, 390, 768 e 1280 px), 33 telas e estados por largura, medição final sobre o commit `66e1702`.

| Medida | Linha de base (F7-T1) | F7-T8 |
| --- | --- | --- |
| Telas com rolagem horizontal da página | 0 em 4 larguras | **0** em 4 larguras |
| Alvos abaixo de 44 px (soma das telas) | 247 de 271 (24 telas) | **148** de 516 (33 telas), todos ações secundárias |
| Alvos abaixo de 24 px | 104 (320 e 390 px) e 129 (768 e 1280 px) | **0** em 390 px e **1** nas demais (link em linha, exceção da WCAG 2.5.8; ver F7-T7, seção 6) |
| Telas com pelo menos um alvo abaixo de 44 px | 23 de 24 | **11 de 33** |
| Telas com o mesmo `<title>` "Cardápio Digital" | 18 de 24 | **0** repetições entre telas distintas (repete só entre estados da mesma tela) |
| Telas sem `<h1>` | 3 | **0** |
| `<nav>` sem rótulo | 1 a 2 por tela autenticada | **0** |
| Skip link | 0 telas | **todas** |
| Campos sem nome acessível | 0 | **0** |
| Imagens sem dimensões | 2 (QR em `mesas`) | **0** |
| Reprovações de contraste de texto | 0 em 2.155 amostras (indicativo) | **0** em 1.125 amostras (320 e 390 px) e 1.140 (768 e 1280 px), mais hover, foco e erro dos controles públicos |

**Ressalvas:** o conjunto de telas cresceu de 24 para 33, e o número de alvos e de amostras depende dos dados do seed (a medição final tinha mais pedidos na lista, o que aumenta o total de alvos; o número de abaixo de 44 px não mudou); a linha de base não registrou a definição exata de "alvo". Os números são comparáveis em ordem de grandeza, não termo a termo (ver [F7-T7, seção 4](F7-T7-auditoria.md)). Os 148 alvos abaixo de 44 px são as ações secundárias de linha (Editar, Excluir, Adicionais, Enviar e Trocar imagem, Remover, Renomear, Baixar PNG, Desativar, Nova senha, Anterior, Próxima e o filtro por categoria), de 28 a 32 px, acima do mínimo de 24 px do critério A6, mais caixas, rádios e switches com área clicável ampliada (30 a 34 px).

## 6. Roteiro manual em celular real: pendente

Não há celular físico neste ambiente, então o roteiro previsto na F7-T8 **não foi executado** e precisa de uma pessoa com o aparelho. Roteiro sugerido (Android e iPhone, rede móvel e Wi-Fi), a ser marcado como aprovado ou com observações:

| # | Verificação | Resultado |
| --- | --- | --- |
| 1 | Abrir o QR Code de uma mesa impressa e ler o cardápio sem zoom nem rolagem lateral | |
| 2 | Adicionar um produto sem adicionais com um toque e um produto com adicionais pelo modal | |
| 3 | Abrir o carrinho com o teclado aberto: a barra do carrinho não cobre o botão de enviar e respeita o entalhe e a barra de gestos | |
| 4 | Enviar o pedido e abrir o acompanhamento; copiar o link e reabri-lo em outro aparelho | |
| 5 | No painel, entrar, avançar um pedido pela lista e abrir o detalhe; tocar no telefone para ligar | |
| 6 | Deixar a aba do painel em segundo plano, receber um pedido e voltar: o aviso aparece na hora | |
| 7 | Girar o aparelho nas telas de pedido, cardápio e painel | |
| 8 | Aumentar o tamanho da fonte do sistema (200%): nada fica cortado | |
| 9 | Ligar o leitor de tela (TalkBack ou VoiceOver) e percorrer o login, a lista de pedidos e o checkout | |
| 10 | Imprimir a folha de QR Codes (A4) e ler um QR impresso com o celular | |

## 7. Relatório da fase

| Tarefa | Entrega | Commit |
| --- | --- | --- |
| F7-T1 | Diagnóstico e linha de base | `c6c32bc` |
| F7-T2 | Fundação de UI (toast, estados de página, navegação responsiva, componentes padronizados) | `4731741` |
| F7-T3 | Operação de pedidos (visões, avanço pela lista, indicador de pedido novo) | `d006c9b` |
| F7-T4 | Experiência do cliente (adicionar rápido, mesa, checkout, acompanhamento) | `b17fa4b` |
| F7-T4a | Direção visual "Papel e tinta" e acabamento | `4276141` |
| F7-T5 | Catálogo e configuração do restaurante; folha de QR Codes para impressão | `b211ee4` |
| F7-T6 | Plataforma, acesso e estrutura da aplicação | `91ce919` |
| F7-T7 | Auditoria final de acessibilidade e responsividade | `66e1702` |
| F7-T8 | Validação final e regressão (este relatório) | a definir |

Princípios mantidos: sem mudança de contrato da API, de permissões ou de transições de pedido; sem dependência npm nova; página do token sem recursos de terceiros, com `no-store` e `no-referrer`; E2E permanente restrito ao fluxo principal e às suas variantes.

## 8. Pendências e melhorias futuras

Nenhuma é bloqueante e nenhuma foi tratada na F7-T8.

| Item | Origem |
| --- | --- |
| Localizar as mensagens de validação da API (hoje saem em inglês, por exemplo no telefone) | F7-T7 |
| Alinhar o limite do telefone: 30 caracteres no frontend e 20 no backend; tarefa específica, com teste de validação | F7-T7 |
| Redesenhar a folha de QR Codes para impressão (hierarquia visual, espaçamento, compatibilidade com A4) e validar o PDF renderizado e a leitura dos QR | F7-T5 |
| Remover `components/ui/table.tsx` e `.table-scroll`, hoje sem uso | F7-T6 |
| Trocar o `window.confirm` de "Nova senha do dono" por diálogo próprio (mantido por decisão) | F7-T5 |
| Nome da mesa e aviso de mesa inválida só têm verificação por script local; o E2E permanente não confere o texto exibido | F7-T8 |
| `<title>` igual entre estados da mesma tela (home, restaurante inativo e slug inexistente) | F7-T7 |
| `apps/api/database/schema.ts` é regenerado pelas migrations dos testes e do E2E, com formatação diferente da versionada; aparece sempre como modificado e fica fora dos commits | recorrente |

## 9. Limitações

- Sem celular físico (seção 6) e sem leitor de tela real: nomes acessíveis, `aria-*` e foco foram verificados por script.
- Os dados são fictícios do seed; conteúdo real pode quebrar linhas de outra forma.
- Os scripts de verificação não fazem parte do repositório; os resultados valem para o estado do commit medido.
- A folha de QR Codes não foi renderizada em PDF; só estrutura e geometria foram analisadas (F7-T5).

## 10. Aprovação

| Item | Situação |
| --- | --- |
| Suítes (`lint`, `typecheck`, `test`, `build`, `e2e`) | passando |
| Verificações locais e comparação com a linha de base | concluídas |
| Roteiro manual em celular real | **pendente** (seção 6) |
| Relatório da fase | **aguardando aprovação** |
| Integração (merge, push, PR) | conforme autorização; nada foi enviado |
