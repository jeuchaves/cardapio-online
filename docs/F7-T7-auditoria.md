# F7-T7: auditoria final de acessibilidade e responsividade

- Data: 2026-11-16
- Base: commit `91ce919` (branch `feat/fase-7-ux`), mais as correções descritas na seção 5
- Referências: ROADMAP, Fase 7 (F7-T7); [relatório da F7-T1](F7-T1-linha-de-base.md) (linha de base, seção 4); critérios A1 a A10 do ROADMAP
- Situação: **revisão aprovada** em 2026-11-16
- Escopo: sem funcionalidade nova e sem dependência. Contratos da API, permissões e transições de pedido não foram alterados.

## 1. Resumo

Nenhuma pendência de severidade alta. A auditoria encontrou quatro pendências reais (contraste do hover do botão primário, ação principal com 36 px nos estados vazio e de erro, imagens sem dimensões e ausência de regra de movimento reduzido); as quatro foram corrigidas (seção 5). Não há rolagem horizontal da página em nenhuma das larguras medidas, nem falha de contraste nas 960 amostras de texto por largura, nem nos estados de hover, foco e erro dos controles públicos. Restam pendências baixas e dois achados fora do escopo (seção 8).

## 2. Método

- **Dados:** seed do E2E no banco `cardapio_test` (restaurantes, pedidos em vários status, produtos com foto, logo, mesas, equipe). O `cardapio_dev` não foi tocado, e a limpeza desfez o seed ao final.
- **Telas:** 33 telas e estados (visitante, dono, atendente, administrador da plataforma), incluindo cardápio, modal do produto, carrinho, checkout com erro, acompanhamento (pendente, pronto, cancelado, token inválido), login com erro, seleção de restaurante, painel completo e plataforma.
- **Larguras:** 320, 390, 768 e 1280 px, como na linha de base, mais **640 px**, que equivale a zoom de 200% em tela de 1280 px (320 px equivale a 400%). 165 medições de página.
- **Medidas por tela:** rolagem horizontal, alvos de toque (altura de `a`, `button`, `input`, `select`, `textarea` e papéis `checkbox`, `radio`, `switch`, `tab`, `button`), `<title>`, `<h1>`, saltos na hierarquia de títulos, `<nav>` sem rótulo, campos sem nome acessível, imagens sem dimensões, skip link, `lang`, contraste do texto visível e das bordas dos campos.
- **Passes complementares:** teclado (Tab em 9 telas), contraste em hover (156 controles), área de toque real de caixas, rádios e switches, CLS, movimento reduzido e contraste dos controles públicos de formulário (modal, checkout) em repouso, hover, foco, marcado e inválido.
- **Skill `web-design-guidelines`:** regras buscadas em `raw.githubusercontent.com/vercel-labs/web-interface-guidelines` (leitura de rede; nada do projeto foi enviado) e aplicadas às telas e aos componentes.
- **Ferramenta:** scripts locais com o Playwright já instalado, fora do repositório (`cardapio-online-capturas\f7-referencia\tools\t7.mjs`, `t7b.mjs`, `t7c.mjs`, `t7d.mjs`; capturas e `metricas*.json` em `shots-t7\`). Sem dependência nova.

## 3. Critérios

| Critério | Uso |
| --- | --- |
| WCAG 1.4.3 (AA) | Texto com pelo menos 4,5:1 (3:1 para texto grande: 24 px, ou 18,66 px em negrito) |
| WCAG 1.4.11 (AA) | Bordas de campos, controles marcados e indicador de foco com pelo menos 3:1 contra o fundo ao redor |
| WCAG 2.5.8 (AA) | Alvo de pelo menos 24 px, com as exceções de espaçamento, equivalente e em linha |
| A6 do ROADMAP | 44 px nas ações principais no celular e 24 px nas demais |
| A7 do ROADMAP | Sem rolagem horizontal da página em 320, 390, 768 e 1280 px |
| Estados desabilitados | Isentos de contraste (WCAG 1.4.3) |

A razão de contraste é calculada por script a partir dos estilos renderizados (cores `oklab` e `color-mix` convertidas por canvas), com composição das transparências sobre o fundo efetivo.

## 4. Resultados e comparação com a linha de base

| Medida | Linha de base (F7-T1) | F7-T7 |
| --- | --- | --- |
| Telas com rolagem horizontal da página | 0 em 4 larguras | **0** em 5 larguras (inclui 640 px) |
| Alvos abaixo de 44 px (soma das telas medidas) | 247 de 271 (24 telas) | **148** de 466 (33 telas), todos ações secundárias |
| Alvos abaixo de 24 px | 104 (320 e 390 px) e 129 (768 e 1280 px) | **0** em 390 px e **1** nas demais (exceção, seção 6) |
| Telas com pelo menos um alvo abaixo de 44 px | 23 de 24 | **11 de 33** |
| Telas com o mesmo `<title>` "Cardápio Digital" | 18 de 24 | **0** repetições entre telas distintas; repete só entre estados da mesma tela (home, restaurante inativo e slug inexistente; estados do acompanhamento) |
| Telas sem `<h1>` | 3 | **0** |
| Saltos na hierarquia de títulos | 0 | **0** |
| `<nav>` sem rótulo | 1 a 2 por tela autenticada | **0** |
| Skip link | 0 telas | **todas**; é a primeira parada do Tab |
| Campos sem nome acessível | 0 | **0** |
| Imagens sem dimensões | 2 (QR em `mesas`) | **0** |
| Reprovações de contraste de texto | 0 em 2.155 amostras (indicativo) | **0** em 960 amostras por largura (975 em 768 e 1280 px) |
| Reprovações de contraste de borda de campo | não medido | **0** |

**Ressalvas da comparação:** a linha de base não registrou a definição exata de "alvo", e o conjunto de telas cresceu de 24 para 33; os números são comparáveis em ordem de grandeza, não termo a termo. A medição atual conta uma só vez as caixas de seleção do Base UI e ignora o `input` oculto que o acompanha.

**Alvos abaixo de 44 px (148):** Editar, Excluir, Adicionais, Enviar imagem, Trocar imagem, Remover, Renomear, Baixar PNG, Desativar, Nova senha, Anterior, Próxima e o filtro por categoria, todos com 28 a 32 px (acima do mínimo de 24 px), mais caixas, rádios e switches. As ações principais têm 44 px. Caixas, rádios e switches têm área clicável ampliada por pseudo-elemento: altura medida de 30 a 34 px (altura visual de 16 a 18 px).

**Teclado:** Tab percorreu 9 telas (entrar 5 paradas, cardápio 16, pedidos 24, produtos 26, mesas 20, equipe 15, configurações 22, plataforma lista 9 e detalhe 11). Todas as paradas têm indicador de foco (borda e anel), e a primeira é o "Pular para o conteúdo".

**CLS (390 px):** cardápio 0,0000; produtos 0,0000; configurações 0,0000; mesas 0,016 (bom é até 0,1).

**Movimento reduzido:** com `prefers-reduced-motion: reduce`, nenhum elemento mantém transição ou animação longa, e os diálogos abrem normalmente.

**Zoom e larguras estreitas:** sem rolagem horizontal da página em 320 px (400%) e 640 px (200%).

## 5. Correções feitas

| Pendência | Medida antes | Correção | Medida depois |
| --- | --- | --- | --- |
| Hover do botão primário | 4,30:1 (branco sobre oliva a 80%), abaixo de 4,5:1 | `hover:bg-primary/90` em `components/ui/button.tsx` | 5,22:1; menor razão entre 156 controles em hover |
| Ação principal "Ver cardápio" (carrinho vazio e pedido não encontrado) | 36 px | `size="lg"` em `checkout.tsx` e `order-tracking.tsx` | 44 px |
| Imagens sem `width` e `height` | 2 imagens (QR) e miniaturas de envio | `width` e `height` em `qr-code-card.tsx` e `image-upload.tsx` | 0 imagens sem dimensões |
| Sem regra de movimento reduzido | transições e animações ativas | regra global `prefers-reduced-motion` em `globals.css` | 0 elementos com movimento longo |

## 6. Exceção: link "QR Codes" em Configurações

| Item | Valor |
| --- | --- |
| Seletor | `main p > a[href$='/mesas']` |
| Tela | Configurações do restaurante, somente para o dono; parágrafo "O QR Code do restaurante está na página QR Codes." |
| Dimensão | 64 × 18 px em 320, 640, 768 e 1280 px; em 390 px o texto quebra em duas linhas e o retângulo mede 288 × 38 px |
| Função | Ponteiro textual para a página QR Codes |

Exceções da WCAG 2.5.8 aplicáveis, todas medidas:

1. **Em linha:** o alvo está dentro de uma frase, e a altura de 18 px vem do `line-height` de 20 px do parágrafo.
2. **Espaçamento:** nenhum outro alvo fica a menos de 12 px do centro dele, então um círculo de 24 px não cruza nenhum alvo vizinho.
3. **Equivalente:** a navegação principal da mesma tela tem o link "QR Codes" com 44 px e o mesmo destino (`/painel/:id/mesas`).

Decisão: mantido sem alteração. O critério A6 do ROADMAP (24 px nas demais ações) trata de ações; este link é um ponteiro redundante dentro de um parágrafo.

## 7. Contraste dos controles de formulário públicos (390 px)

| Elemento | Estado | Valor medido | Critério |
| --- | --- | --- | --- |
| Texto dos campos (Nome, Telefone, Observações) | repouso | 17,12 (`#1f1b16` sobre `#ffffff`) | 4,5 |
| Rótulos e legendas | repouso | 15,48 (sobre o papel `#f7f3ec`) | 4,5 |
| Rótulos de adicionais no modal | repouso | 17,12 | 4,5 |
| Texto de apoio (cinza, 12 e 14 px) | repouso | 5,35 (`#6b6358` sobre o papel) | 4,5 |
| Borda dos campos | repouso | 3,47 sobre o papel; 3,84 sobre branco (`#8a8174`) | 3 |
| Borda do rádio e da caixa | desmarcado | 3,47 (papel); 3,84 (branco) | 3 |
| Rádio e caixa | marcado | fundo oliva 5,98 (papel) e 6,61 (branco); marca branca 6,61 sobre oliva | 3 |
| Botões de quantidade e Fechar | repouso | texto 17,12; borda 3,84 | 4,5 e 3 |
| Botão primário ("Adicionar ao carrinho") | repouso | 6,61 (branco sobre `#56622a`) | 4,5 |
| Botão primário | hover | 5,22 a 5,31 | 4,5 |
| Botões secundários e de quantidade | hover | 14,16 (`#1f1b16` sobre `#efe9dd`) | 4,5 |
| Campos de texto | hover | texto 17,12; borda 3,47 | 4,5 e 3 |
| Campo de texto e textarea | foco | borda `#666b41` com 5,07 | 3 |
| Rádio, caixa e botões | foco | borda de 3,11 a 6,36 | 3 |
| Campo inválido (Telefone) | inválido | borda `#b91c1c` com 5,85 | 3 |
| Mensagem de erro do campo | inválido | 5,85 (sobre o papel) | 4,5 |
| Alerta geral "Dados inválidos." | inválido | 6,47 (sobre branco) | 4,5 |

Os campos públicos não usam `placeholder`, então essa medida não se aplica.

**Distinção importante sobre o foco:** o anel de foco, **isoladamente, não atinge 3:1**: é translúcido e mede de 1,4 a 2,2:1 contra o fundo (por exemplo, 2,24 nas caixas e 2,17 no textarea). O indicador que atende à WCAG 1.4.11 é a **troca da borda para a cor de foco**, que mede de 3,11 a 6,36:1; o anel é reforço visual. Esta auditoria não afirma que o anel, sozinho, cumpre 3:1.

## 8. Limitações

- Nenhuma verificação em celular físico (fica para a F7-T8).
- Os dados são fictícios do seed; o conteúdo real pode quebrar linhas de outra forma.
- O contraste é calculado sobre cores sólidas e sobre o texto visível; não considera imagens de fundo nem estados desabilitados (isentos).
- A auditoria de contraste dos controles públicos cobre o modal do produto e o checkout; o radio "Retirada" desabilitado (variante do E2E) não aparece no seed desta auditoria e não foi medido.
- A folha de QR Codes para impressão não foi renderizada em PDF; só a estrutura e a geometria foram analisadas (limitação já registrada na F7-T5, com o redesenho previsto como melhoria futura).
- Os valores de alvo não são comparáveis termo a termo com a linha de base (seção 4, ressalvas).
- Sem leitor de tela real: nomes acessíveis, `aria-*` e foco foram verificados por script, não por tecnologia assistiva.
- Pendências baixas aceitas: alvos secundários entre 28 e 32 px (acima de 24 px), `<title>` repetido entre estados da mesma tela e link em linha de 18 px (seção 6).

## 9. Achados fora do escopo (pendências futuras)

Não alterados na F7-T7, por serem mudanças de backend ou de regra de entrada, e não de acessibilidade.

1. **Mensagens de validação da API em inglês.** O erro inline do telefone aparece como "The phone field must not be greater than 20 characters". É texto do validador da API; a localização das mensagens fica como melhoria futura (mudança de backend; fica registrada aqui como pendência e, se aprovada, entra à parte em [`evolucoes-futuras-da-api.md`](evolucoes-futuras-da-api.md), que não foi alterado).
2. **Limite do telefone divergente.** O campo do checkout permite 30 caracteres (`apps/web/src/components/checkout.tsx`, `maxLength={30}`), e o servidor aceita 20 (`apps/api/app/validators/order.ts`, `maxLength(20)`). Quem digita de 21 a 30 caracteres recebe o erro em inglês acima. Recomendação: alinhar o frontend ao limite de 20, em tarefa específica e com teste de validação.

Outras melhorias já registradas e não tratadas aqui: redesenho da folha de impressão dos QR Codes (F7-T5) e possível remoção de `components/ui/table.tsx` e de `.table-scroll`, hoje sem uso (F7-T6).
