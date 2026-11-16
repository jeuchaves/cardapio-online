# ADR 0008 — Direção visual "Papel e tinta" (Fase 7, F7-T4a)

- Status: aprovado — Fase 7, planejamento da F7-T4a
- Data: 2026-11-16
- Referências: `CLAUDE.md` seções 1, 3 e 11; ROADMAP seção 10 (Fase 7) e PEND-25, PEND-26 e PEND-35; [relatório da F7-T1](../F7-T1-linha-de-base.md)
- Numeração: os ADRs 0006 (topologia) e 0007 (backup) estão reservados à Fase 8 (PEND-28). Este ADR usa o 0008 para não alterar essa reserva.

## Contexto

A Fase 7 começou com identidade visual neutra e sem novos tokens de cor (PEND-25). Concluídas a F7-T1 a F7-T4, foram capturadas as três áreas (cardápio público, painel do restaurante e painel da plataforma) em 320, 390, 768 e 1280 px, com dados fictícios controlados e em ambiente isolado (`cardapio_test`). As capturas ficam fora do repositório. Foram examinadas individualmente 64 de 160 imagens; as demais foram verificadas só por métrica de rolagem horizontal. Problemas observados:

- **Identidade:** as três áreas são branco e preto, com o mesmo peso de título, sem marca no cabeçalho do painel e da plataforma, e a página inicial é só um título e um link. O cardápio não tem apelo de comida além das fotos.
- **Superfícies:** cartões brancos sobre fundo branco, separados só por um contorno de 1 px quase invisível.
- **Status de pedidos:** Confirmado, Em preparo e Pronto são quase iguais (cinza com ícone); só Recebido e Cancelado se destacam. O botão preto de largura total se repete em todos os cartões da lista.
- **Defeitos de layout:** o botão "+" cobre a foto do produto e, em telas estreitas, a descrição; o botão de fechar o diálogo de produto fica sobre a foto escura, pequeno e quase invisível; as tabelas de Equipe e da plataforma cortam a coluna de ações ou de situação em 320 e 390 px; as abas do painel quebram em duas ou três linhas.
- **Consistência:** a altura dos campos passa de cerca de 44 px (até 768 px) para cerca de 32 px (1280 px); botões primários de formulário têm largura diferente de uma tela para outra; a barra do carrinho e os avisos não seguem a coluna de conteúdo; a lista de pedidos tem filtros duplicados (botões de status e seletor); a página de produtos repete o texto de upload e a caixa "Sem imagem" em cada item e tem controles de cerca de 32 px.

Não houve estouro horizontal da página em nenhuma largura; os cortes ocorrem dentro dos contêineres das tabelas.

## Decisão

### Direção e identidade

- **Direção A — Papel e tinta.** Identidade neutra quente: fundo de "papel", texto de "tinta" e **um único acento oliva**. A mesma identidade vale para as três áreas (público, painel e plataforma); não há tema próprio por área.
- O acento oliva é usado em ações primárias, foco, item de navegação ativo e destaques pontuais. A interface permanece predominantemente neutra, e o acento não é usado como cor de status.
- O vermelho do token `destructive` continua reservado a erro e ação destrutiva.

### Paleta (valores de partida)

Valores de partida, ajustáveis na F7-T4a desde que mantenham os mínimos de contraste da seção "Acessibilidade". As razões foram calculadas pela fórmula de luminância relativa da WCAG 2.

| Papel | Valor | Observação |
| --- | --- | --- |
| Papel (fundo da página) | `#F7F3EC` | |
| Superfície (cartões) | `#FFFFFF` | um degrau acima do papel |
| Tinta (texto) | `#1F1B16` | 15,5:1 sobre o papel; 17,1:1 sobre a superfície |
| Texto secundário | `#6B6358` | 5,4:1 sobre o papel; 5,9:1 sobre a superfície |
| Acento oliva | `#56622A` | branco sobre oliva 6,6:1; oliva sobre o papel 6,0:1 |
| Oliva suave (fundo de destaque) | `#E9EBD3` | tinta sobre oliva suave 14,1:1 |
| Oliva escuro (texto sobre oliva suave) | `#3F4A1B` | 7,8:1 sobre oliva suave |
| Borda decorativa de cartão | `#D9D1C2` | não é componente interativo |
| Borda de campo e controle | `#8A8174` | 3,8:1 sobre a superfície; 3,5:1 sobre o papel |

Os tokens atuais do shadcn (`--background`, `--card`, `--primary` etc.) são reaproveitados pelo nome; a mudança é de valor, sem cores soltas nos componentes. Os tokens do tema escuro (`.dark`) e os de gráfico e barra lateral existentes **não são removidos** nem alterados nesta etapa.

### Tipografia

- Mantém-se a **Geist**. Não se adiciona fonte serifada nem qualquer fonte nova nesta etapa.
- A hierarquia vem de tamanho, peso e espaçamento: título de página, título de seção, texto de corpo (16 px) e texto auxiliar, aplicados do mesmo modo nas três áreas.

### Superfícies e hierarquia

- Cartão **um degrau acima do papel**, com borda de 1 px; a separação não depende só do contorno.
- Cabeçalho do painel e da plataforma com a marca (nome do produto) e o acento oliva no item ativo.
- Uma ação primária por contexto; ações repetidas em listas (como o avanço de status de cada pedido) usam peso visual menor que a ação primária da tela.
- Escala de espaçamento e de raio única; formulários com largura limitada (cerca de 640 px em telas largas) e botões de formulário com o mesmo critério de largura em todas as telas.
- Sem efeitos, sombras decorativas, movimento ou fotografia de apoio.

### Tokens semânticos de status

Regra para os estados de pedido (Recebido, Confirmado, Em preparo, Pronto, Concluído e Cancelado):

1. Cada status mostra **texto, ícone e diferenciação visual**; a cor nunca é o único sinal.
2. Primeiro se usam as variantes já existentes (preenchida, contornada, secundária, `destructive`) e a forma do ícone.
3. **Só se as variantes existentes forem insuficientes** para distinguir os estados à primeira vista, a F7-T4a pode criar tokens semânticos de status, no máximo um par (fundo e texto) por status que precise, nomeados pelo significado e não pela cor, e com a necessidade justificada com as capturas.
4. O token de status não reutiliza o oliva do acento (o "Pronto" não pode depender de verde, para não se confundir com o acento).
5. Cada par de status tem contraste mínimo de 4,5:1 entre texto e fundo.

Isto **resolve a PEND-25 de forma restrita**: a exceção ao "sem novos tokens de cor" vale somente para esses tokens semânticos de status e não autoriza novas cores em nenhum outro lugar.

### Acessibilidade e contraste

- WCAG AA: 4,5:1 para texto e 3:1 para componentes e bordas de campos (critério A8 da fase).
- O contraste é **calculado a partir dos tokens finais** por script local fora do repositório, em todos os pares usados (incluindo estados desativados, foco, links e acento sobre papel e sobre oliva suave).
- Foco visível em todos os controles (anel com contraste de 3:1) e verificação por teclado. A regra B-01 permanece: 44 px nos controles primários, sem aumentar indiscriminadamente os demais (24 px nas demais ações).

### Uso das skills consultadas

A `taste-skill` é aprovada **só para princípios aplicáveis a um produto SaaS**: composição, tipografia, cores, espaçamento e hierarquia (escala de espaçamento e de raio, interface 90 a 95% neutra com um acento, cartão um degrau acima da página, texto de 16 px). **Não** se aprova o hook Stop (`gate.mjs`) nem os padrões de site institucional (uma seção por tela, hero, fotografia, momentos de movimento, efeitos). As skills e as referências públicas consultadas são **referências, não especificações**: nenhuma identidade visual de terceiros é copiada, e nada é instalado.

## Consequências

- A F7-T4a é inserida entre a F7-T4 e a F7-T5 e altera só `apps/web` (tokens, componentes e telas). Nenhum contrato da API, permissão ou transição de pedido muda; nenhuma dependência npm é adicionada.
- O trabalho de tabelas estreitas da Equipe e da plataforma (B-02) é antecipado para a F7-T4a, e as F7-T5 e F7-T6 passam a confirmar e a tratar as demais telas.
- Os 63 seletores protegidos do E2E (F7-T1, seção 6) devem permanecer; as mudanças de rótulo ou de estrutura que os afetem exigem atualização do teste na mesma tarefa.
- As capturas de 2026-11-16 servem de "antes"; a largura de 1024 px, que não estava nelas, é capturada antes de qualquer alteração.
- O custo é um acabamento visual de toda a interface antes da F7-T5, com risco de regressão visual e de acessibilidade; por isso a tarefa exige comparação com os mesmos estados e dados e inspeção individual das capturas.
- Limitações conhecidas: as 96 imagens não examinadas ainda podem esconder defeitos; o teste foi só em Chromium, sem dados reais; foco, teclado, hover e contraste medido não foram avaliados na referência. A paleta acima é um ponto de partida e pode mudar dentro dos mínimos de contraste.

## Fora do escopo

- Modo escuro (os tokens `.dark` existentes ficam como estão) e remoção de qualquer token existente.
- Fonte serifada ou qualquer nova fonte; ícones ou imagens de terceiros na página do token do pedido.
- Fotografia, ilustração, animação, efeitos e momentos de movimento.
- Mudança de contrato da API, de permissões, de transições de pedido ou de regras de negócio.
- Reordenação por botões, novos recursos de cardápio ou de pedido e qualquer funcionalidade nova.
- Nova dependência npm, instalação de skills e uso do hook Stop da `taste-skill`.
- Novas cores além do acento oliva e dos tokens semânticos de status previstos nesta decisão.
