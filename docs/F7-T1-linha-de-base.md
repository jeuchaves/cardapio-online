# F7-T1: diagnóstico e linha de base de UX

- Data: 2026-11-16
- Base: commit `a935ff5` (branch `feat/fase-7-ux`)
- Referências: ROADMAP, Fase 7 (F7-T1); `CLAUDE.md` seções 1, 3 e 12; ADRs 0001, 0002 e 0005
- Situação: **aprovada tecnicamente em 2026-11-16**; refinamentos 1 a 4 aprovados (seção 8)
- Tarefa: **somente diagnóstico.** Nenhum código, dependência, banco de dados de desenvolvimento ou documento de referência foi alterado.

## 1. Resumo

O diagnóstico por leitura de código foi **confirmado visualmente** em quase todos os pontos. Há também boas notícias: **não há rolagem horizontal em nenhum dos 4 tamanhos de tela (320, 390, 768 e 1280 px)**, a verificação indicativa de contraste não reprovou nenhuma das 2.155 amostras de texto, todo controle de formulário tem nome acessível e o console só registrou o 404 esperado do cardápio inexistente.

Os problemas mais relevantes, por impacto:

| ID | Gravidade | Resumo | Tarefa |
| --- | --- | --- | --- |
| B-01 | **Alta** | 247 de 271 alvos de toque (91%) têm menos de 44 px e 104 têm menos de 24 px, no painel, na plataforma e no checkout | T2 a T6 |
| B-02 | Média | **Equipe e plataforma: colunas e ações ficam fora da tela** em 390 px (a coluna "Ações" da equipe nem aparece), sem indício de rolagem | T5, T6 |
| B-03 | Média | 18 de 24 telas têm o mesmo `<title>` ("Cardápio Digital") | T2 |
| B-04 | Média | 3 telas sem `<h1>` (entrar, trocar senha, novo restaurante) | T2, T6 |
| B-05 | Média | Navegação do painel: `<nav>` sem rótulo em todas as telas autenticadas (dois nas telas do restaurante), links com 20 px de altura, cabeçalho e navegação quebrando em 3 linhas em 390 px | T2 |
| B-06 | Média | Container fixo de 768 px: em 1280 px a tela de pedidos usa metade da largura, e a navegação ainda quebra | T2, T3 |
| B-07 | Média | Lista de pedidos mistura ativos e finalizados (8 pedidos ocupam cerca de 900 px em 390 px) | T3 |
| B-08 | Média | Formulário "Novo…" aberto no topo empurra a lista (em Produtos, a lista só começa a cerca de 770 px do topo) | T5 |
| B-09 | Baixa | Imagens sem `width` e `height`; sem skip link; sem `color-scheme`, `theme-color` e `safe-area`; sem `prefers-reduced-motion`; demais itens da seção 5 | T2, T4, T7 |

## 2. Método e limitações

- **Capturas:** 24 telas e estados × 4 tamanhos (320, 390, 768 e 1280 px) = **96 capturas** de página inteira, com métricas coletadas no navegador em cada uma (rolagem horizontal, alvos de toque, nomes acessíveis, títulos, estrutura, imagens, contraste indicativo e erros de console).
- **Dados:** seed do E2E no banco `cardapio_test`, com 6 pedidos em status diferentes, um produto indisponível, uma categoria inativa e um segundo restaurante. O `cardapio_dev` não foi tocado. A limpeza removeu tudo o que o script criou, e o repositório permaneceu sem alterações.
- **Perfis:** visitante, `owner`, `staff` (2 telas) e `platform_admin`.
- **Limitações:**
  - Navegador de teste com locale en-US: o campo de data aparece como `mm/dd/yyyy`; isso é artefato da captura, não um achado.
  - O seed não tem imagens de produto nem de logo: o deslocamento de layout (CLS) das imagens não foi medido, só apontado pelo código.
  - Estados de erro, vazio e carregando só foram observados quando ocorreram de forma natural; os demais constam por leitura do código.
  - Contraste calculado sobre cores sólidas (não considera imagens de fundo, `placeholder` nem estados desabilitados); é indicativo, e a verificação completa fica na F7-T7.
  - Nenhuma verificação em celular físico.
- **Auditoria `web-design-guidelines`:** regras buscadas em `raw.githubusercontent.com/vercel-labs/web-interface-guidelines` (leitura de rede autorizada, nada do projeto foi enviado) e aplicadas por mim aos arquivos das telas principais. Foram desconsideradas duas regras de redação específicas do inglês (Title Case e "&").
- **Reprodução:** script `capture.mjs` e `analyze.mjs`, fora do repositório (seção 9).

## 3. Confirmação dos achados do diagnóstico

| Achado | Resultado | Evidência |
| --- | --- | --- |
| X1: sem `loading.tsx`; só `r/[slug]` tem `error` e `not-found`; "Carregando…" em texto simples | Confirmado por código | `session-gate.tsx:53`, `checkout.tsx:154`, `order-tracking.tsx:56`; nenhum `loading.tsx` em `app/` |
| X2: navegação do painel sem página atual, sem rótulo, quebrando no celular | **Confirmado visual e por métrica** | Painel em 390 px: cabeçalho em 2 linhas e navegação em 3; `<nav>` sem rótulo em todas as telas autenticadas (dois nas telas do restaurante); links com 20 px de altura |
| X3: duplicação entre cadastros | Confirmado por código | `categorias/page.tsx` e `adicionais/page.tsx` com 237 e 236 linhas; fluxo idêntico |
| X4: controles nativos misturados | Confirmado por código | `pedidos/page.tsx:78` (`select`), `checkout.tsx:301,329,342`, `plataforma/.../novo:115`, `[id]:135` |
| X5: alvos de toque pequenos | **Confirmado por métrica** (B-01) | 247 de 271 alvos abaixo de 44 px em 390 px |
| X6: feedback de sucesso preso ao topo | Confirmado por código | `SuccessMessage` em `form-error.tsx`; sem toast |
| X7: mesmo `<title>` | **Confirmado por métrica** (B-03) | 18 de 24 telas |
| X8: sem skip link, sem foco no erro, `CardTitle` é `div` | **Confirmado por métrica** | `skipLink: false` em todas as telas; `h1` ausente em 3 telas |
| X9: modo escuro sem ativação | Confirmado por código | Tokens `.dark` em `globals.css`; sem alternador |
| X10: `<img>` sem dimensões | Confirmado (métrica e código) | `r/[slug]/page.tsx:44`, `public-product-card.tsx:69,81`; 2 de 2 imagens de QR sem dimensões |
| X11: `/` mostra "API disponível" | **Confirmado visual** | Captura `home` |
| Cardápio: produto exige abrir o modal | Confirmado por código | `public-product-card.tsx:57` (todo o cartão é o gatilho) |
| Cardápio: sem `safe-area` | Confirmado por código | 0 ocorrências |
| Pedidos: lista mistura status; avançar exige abrir o detalhe | **Confirmado visual** | `pedidos__390.png`: pedidos recebidos, em preparo, prontos e concluídos misturados |
| Pedidos: container de 768 px em tela larga | **Confirmado visual** | `pedidos__1280.png`: lista ocupa a coluna central; navegação quebra ("Equipe" na 2ª linha) |
| Produtos: formulário "Novo…" aberto no topo | **Confirmado visual** | `produtos__390.png` |
| Mesas: só "Baixar PNG" por mesa, sem nome na imagem | Confirmado visual | `mesas-qr__390.png` |
| Plataforma: desativar sem confirmação | Confirmado por código | `plataforma/restaurantes/[id]/page.tsx:156` |
| Acompanhamento: status só em texto | **Confirmado visual** | `acompanhamento__390.png`: "Recebido" sem progresso; sem "atualizado há…" nem copiar link |

**Correções ao diagnóstico anterior:**
- O diagnóstico não podia afirmar que as tabelas "precisavam ser conferidas em 390 px". Agora está confirmado que **Equipe e plataforma perdem colunas** (B-02).
- "Sem rolagem horizontal fora das tabelas" é **verdadeiro nos 4 tamanhos**: o contêiner das tabelas rola, mas a página não.
- O contraste, que era dúvida, **não reprovou**.

## 4. Métricas (linha de base numérica)

| Medida | 320 | 390 | 768 | 1280 |
| --- | --- | --- | --- | --- |
| Telas com rolagem horizontal da página | 0 | 0 | 0 | 0 |
| Alvos de toque abaixo de 44 px (soma das 24 telas) | 247 | 247 | 247 | 247 |
| Alvos abaixo de 24 px (soma) | 104 | 104 | 129 | 129 |
| Telas com pelo menos um alvo abaixo de 44 px | 23 de 24 | 23 de 24 | 23 de 24 | 23 de 24 |

Valores independentes do tamanho de tela (390 px): 271 alvos no total, 18 de 24 telas com `<title>` "Cardápio Digital", 3 telas sem `<h1>` (`entrar`, `conta-senha`, `plataforma-novo`), 0 telas com salto na hierarquia de títulos, 1 a 2 `<nav>` sem rótulo em cada tela autenticada (dois nas telas do restaurante), 0 campos sem nome, 0 reprovações de contraste em 2.155 amostras, `lang="pt-BR"` em todas as capturas, 0 telas com skip link e 2 imagens sem dimensões (QR em `mesas-qr`).

Os mesmos números devem ser medidos de novo na F7-T7 e na F7-T8 para comparação.

## 5. Auditoria `web-design-guidelines`

Formato `arquivo:linha - problema`, por arquivo. Gravidade: **A** alta, **M** média, **B** baixa. `✓` indica regras da categoria que passaram.

**`app/layout.tsx`**
- `:18-28` - M - sem link "pular para o conteúdo" antes do conteúdo principal.
- `:18-28` - B - sem `color-scheme`, `theme-color` nem `viewport` explícito.

**`app/r/[slug]/page.tsx`**
- `:44` - B - `<img>` do logo sem `width` e `height` (risco de deslocamento de layout).
- ✓ `<nav aria-label>`, `scroll-mt-14` nos títulos, âncoras `<a>` para as categorias, `alt=""` decorativo.

**`components/public-product-card.tsx`**
- `:69,81` - B - `<img>` sem `width` e `height` (`:69` já tem `loading="lazy"`).
- ✓ `<output aria-live="polite">` (`:138`), botões de ícone com `aria-label`, ícones Lucide com `aria-hidden` por padrão (lucide-react 1.73).

**`components/cart-bar.tsx`**
- `:13` - M - barra `fixed bottom-0` sem `env(safe-area-inset-bottom)`.

**`components/checkout.tsx`**
- `:154` - B - carregamento só como texto ("Carregando…"), sem esqueleto.
- `:301,329,342` - B - radios e `textarea` nativos, fora do padrão visual dos demais campos.
- `:318` - B - erro de modalidade sem foco automático no campo.
- ✓ `fieldset` e `legend`, `autocomplete`, `inputMode="tel"`, rótulos, erro com `role="alert"`, botão desabilitado só durante o envio.

**`components/order-tracking.tsx`**
- `:56` - B - carregamento só como texto.
- `:50` - atualização a cada 15 s só com a aba visível (alinhado ao ADR 0002).
- ✓ `role="status"` no status; mensagens de erro com `role="alert"`.

**`app/painel/[restaurantId]/layout.tsx`**
- `:15` - M - `<nav>` sem `aria-label`; links com 20 px de altura; sem indicação da página atual.

**`components/session-gate.tsx`**
- `:58` - M - `<nav>` sem `aria-label`.
- `:53` - B - carregamento só como texto.
- `:76` - M - `<main>` com `max-w-3xl` para todas as telas.

**`app/painel/[restaurantId]/pedidos/page.tsx`**
- `:28-30` - B - filtros e página só em estado local (não vão para a URL, e uma recarga perde o filtro).
- `:58` - M - atualização periódica sem região `aria-live` (o conteúdo muda sem aviso para leitor de tela).
- `:78` - B - `<select>` nativo (cores explícitas ausentes para o tema escuro do Windows).

**`app/painel/[restaurantId]/pedidos/[orderId]/page.tsx`**
- `:61` - atualização periódica com o mesmo comportamento; `:110` status só em `Badge`.

**`components/field.tsx`**
- `:14-15` - M - o erro (`<p>`) não é associado ao campo (sem `id` nem `aria-describedby`), e o foco não vai ao primeiro erro.

**`app/entrar/page.tsx`**
- `:41`, `conta/senha/page.tsx:56`, `plataforma/restaurantes/novo/page.tsx:81` - M - título em `CardTitle` (`div`): a tela não tem `<h1>`.
- `entrar/page.tsx:45`, `equipe/page.tsx:118`, `plataforma/.../novo:108` - B - e-mail sem `spellCheck={false}`.

**Confirmações de exclusão** (`categorias:222`, `adicionais:221`, `mesas:197`, `produtos:454`)
- B - aspas retas `"` no texto do título; em português o recomendado é usar aspas curvas.

**`app/plataforma/restaurantes/[id]/page.tsx`**
- `:156` - **A** - desativar restaurante, ação destrutiva que tira o cardápio do ar, sem confirmação.
- `:135` e `novo/page.tsx:115` - B - `checkbox` nativo.

**`app/plataforma/restaurantes/page.tsx`**
- `:53` - B - `placeholder` sem reticências.

**`components/ui/button.tsx:6`, `badge.tsx:7`, `switch.tsx:18`**
- B - `transition-all` (código gerado pelo shadcn); sem `prefers-reduced-motion` em nenhum ponto do projeto.

**`lib/api.ts:134-136`**
- ✓ preço como texto, **exceção consciente à regra de `Intl.NumberFormat`** (ADR 0001 proíbe converter valores monetários para `number`); datas usam `Intl.DateTimeFormat` em `lib/panel-orders.ts:59`.

**Sem achados nas categorias:** rótulos de formulário (`htmlFor` em todos os campos), foco visível, `autoFocus`, `user-scalable`, `onPaste`, navegação por `<a>` e `<Link>`, listas longas (a lista de produtos é paginada).

## 6. Seletores do E2E protegidos

72 seletores nos dois arquivos (63 `getBy*` e 9 `locator`). Qualquer tarefa que altere estes elementos deve atualizar o teste **no mesmo commit**.

**Cliente (`order-flow.spec.mjs`)**

| Seletor | Linhas | Elemento na interface | Risco |
| --- | --- | --- | --- |
| botão `/Hambúrguer E2E/`, `/Suco E2E/` | 14, 116, 126 | cartão do produto (`public-product-card.tsx:57`) | T4: o botão de adicionar rápido não pode mudar o nome acessível do cartão |
| checkbox `/Bacon E2E/` | 15 | adicional no modal | T2 (checkbox) |
| botão "Aumentar quantidade", "Adicionar ao carrinho" | 16, 17, 117, 127 | modal do produto | T4 |
| link "Ver carrinho (N)" | 18, 118, 135 | `cart-bar.tsx` | T4 |
| label "Nome", "Telefone"; atributo `required` | 23, 122, 139 | `Field` do checkout | T2 (`Field`) |
| botão "Enviar pedido" | 24, 104, 140, 150 | `checkout.tsx:358` | T2, T4 |
| labels `/Consumo no local/`, `/Retirada/` (marcado e desabilitado) | 37, 120, 121 | radios do checkout | **T2 (radio)**: manter rótulo, `checked` e `disabled` |
| `data-testid` `cart-total`, `cart-total-pending` | 36, 66, 79 | `checkout.tsx:249,253` | T4 |
| `data-testid` `order-total`, `order-number`, `order-status` | 41-43, 69, 82, 111, 151 | `order-tracking.tsx:82,85,105` | **T4 (progresso visual)**: manter os três |
| `form [role=alert]`, `[role=alert]`, `[data-unavailable]` | 103, 143-149, 163-164, 175 | checkout (`:181` para o atributo) | T2 e T4 |
| botão "Remover Suco E2E" | 148 | `aria-label` do botão no checkout | T4 |

**Painel (`panel-orders.spec.mjs`)**

| Seletor | Linhas | Elemento | Risco |
| --- | --- | --- | --- |
| labels "E-mail", "Senha"; botão "Entrar" | 17-19 | `entrar/page.tsx` | T6 (mostrar senha não pode renomear o rótulo) |
| link `/Pedido #N/` | 75, 102, 122, 138, 150 | cartão da lista de pedidos | **T3** |
| `data-testid` `order-status` (detalhe), `order-total` | 59, 76, 78, 88, 105, 108, 123, 129, 141 | `pedidos/[orderId]/page.tsx:110,173` | T3 |
| botões `ACTIONS`: "Confirmar pedido", "Iniciar preparo", "Marcar como pronto", "Concluir pedido", "Cancelar pedido" | 64, 87, 93, 110, 126, 130, 139 | botões do detalhe | **T3**: se o avanço também ficar na lista, manter estes no detalhe |
| `alertdialog` e botão "Cancelar pedido" dentro dele | 104-106 | `ConfirmDelete` | T3 |
| texto "11999990000" | 77 | telefone no detalhe | **T3**: o link `tel:` deve manter o texto visível |
| texto "Pronto → Concluído" | 94 | histórico do pedido | T3 |
| `[role=alert]` com "O status deste pedido mudou" | 128 | conflito 409 | T2 (padrão de erro) e T3 |
| label "Status" com `selectOption` | 152, 154 | `<select>` nativo da lista | **T2/T3**: o `ui/select` do Base UI não é nativo, então o teste muda junto |

**Textos dependentes:** `STATUS_LABELS` ("Recebido", "Confirmado", "Em preparo", "Pronto", "Concluído", "Cancelado") em `lib/public-order.ts:95-102`.

## 7. Toast: conferência do registro

| Item | Resultado |
| --- | --- |
| Instalação (página do shadcn, versão Base UI) | `pnpm dlx shadcn@latest add toast`; `<Toaster />` no `app/layout.tsx` (`import { Toaster } from "@/components/ui/toast"`); uso por `toast.add({ title, description })` |
| Registro (`registry/styles/base-nova/toast.json`) | `dependencies`: **`cn` e `@base-ui/react`**; `registryDependencies`: **`button`**; arquivo único `registry/base-nova/ui/toast.tsx` |
| Dependências npm do projeto | `cn` (^0.5.2) e `@base-ui/react` (^1.9.0) **já instalados**; `@base-ui/react/toast` presente na versão 1.9.0 (verificado em `node_modules`) |
| `button` | Já existe em `components/ui/button.tsx`. **O CLI não deve sobrescrevê-lo** (ele foi ajustado no projeto): conferir antes e recusar a substituição |
| Arquivos existentes | `components/ui/` tem 13 componentes; **não existe** `toast.tsx`; `app/layout.tsx` não tem `Toaster` |
| Conclusão | **Sem pacote npm novo.** |

**Ressalva:** conferi só os metadados do registro (nome, dependências e caminho do arquivo); a resposta que recebi omitiu o conteúdo do `toast.tsx`. A F7-T2 deve ler o arquivo que o CLI for criar e conferir se há importações fora das dependências acima antes de usá-lo, e interromper e pedir aprovação se houver pacote novo.

## 8. Refinamentos ao escopo (aprovados em 2026-11-16)

Os quatro refinamentos propostos neste relatório foram **aprovados**. O texto original de cada proposta foi mantido, e o resultado da decisão está indicado em cada item.

1. **Tabelas em 320 a 390 px (T5 e T6):** a "rolagem horizontal controlada" aprovada não basta quando a ação principal fica fora da tela. Em `equipe`, a coluna "Ações" não aparece em 390 px, e na lista da plataforma a "Situação" também fica de fora. Proponho definir "controlada" como: indicador visível de rolagem e as ações essenciais acessíveis sem rolar (por exemplo, linha empilhada em telas estreitas).
   **Aprovado**, com a regra: (a) indicador visual quando houver rolagem horizontal; (b) ações essenciais acessíveis sem depender da rolagem; (c) apresentação empilhada em telas estreitas quando preservar a clareza; (d) nenhuma ação ou informação operacional essencial oculta. A regra entra na F7-T5 e na F7-T6, sem criar um componente genérico desnecessário.
2. **Cabeçalho (T2):** em 390 px o cabeçalho quebra em 2 linhas e a navegação em 3. Incluir a reorganização do cabeçalho na estrutura responsiva da T2, que já prevê a navegação.
   **Aprovado.** O objetivo é evitar as três linhas de navegação observadas em 390 px e manter os controles acessíveis.
3. **Linha de base (T7 e T8):** usar a seção 4 como valores de referência.
   **Aprovado.** Os resultados da F7-T7 e da F7-T8 são comparados com a seção 4, com os mesmos critérios e larguras.
4. **Seed de imagens:** para a F7-T4, o script de capturas deve incluir um produto e um logo com imagem, para medir o deslocamento de layout.
   **Aprovado.**

**Ressalvas técnicas aprovadas junto com a F7-T1:**

- **Toast:** a F7-T2 lê o código completo do componente gerado antes de integrá-lo (imports, API, acessibilidade e compatibilidade com Base UI). Se exigir qualquer pacote npm novo, interrompe e solicita autorização.
- **B-01 (alvos de toque):** prioridade transversal. O critério de 44 px vale para os controles primários, sem aumentar indiscriminadamente elementos que não precisam dessa dimensão.
- **B-02 (colunas ocultas):** a correção não pode consistir apenas em adicionar `overflow-x-auto`. A equipe continua conseguindo executar todas as suas ações, e a plataforma exibe a situação de cada restaurante de forma acessível.
- **Desativação de restaurante:** permanece exclusivamente na F7-T6, com confirmação antes da ação destrutiva.
- **Contraste:** permanece como resultado indicativo; a auditoria definitiva é a F7-T7.

## 9. Evidências

Fora do repositório, na pasta temporária da sessão (pode ser apagada; indique outra pasta se quiser mantê-las):

- Capturas (96 PNG, 3,9 MB): `C:\Users\JECHAV~1\AppData\Local\Temp\claude\0b0e5683b705d829\d9eefa4d-a12b-4c29-92b9-1dbc5155b664\scratchpad\f7t1\shots\<tela>__<largura>.png`
- Métricas: `...\scratchpad\f7t1\metrics.json`
- Scripts: `...\scratchpad\f7t1\capture.mjs` e `analyze.mjs`
- Execução: `...\scratchpad\f7t1\run.log`

Para reproduzir: `node capture.mjs <pasta-de-saída>` (usa o seed do E2E no `cardapio_test`, a API em 3401 e o Next em 3400, e limpa tudo ao final) e depois `node analyze.mjs` na pasta de saída.

## 10. Critérios de aceite da F7-T1

| Critério (ROADMAP) | Situação |
| --- | --- |
| Relatório de linha de base com evidências | **Atendido** (seções 3 a 5 e 9) |
| Lista de seletores protegidos | **Atendido** (seção 6) |
| Toast confirmado sem pacote npm novo, ou o motivo contrário | **Atendido**, com a ressalva da seção 7 |
| Nenhuma alteração de código; nenhuma dependência | **Atendido** |
