# ADR 0010 — Promoções e descontos no pedido

- Status: **política aprovada em 2026-11-17**, com **complemento técnico aprovado na revisão de consistência da mesma data** (PEND-49). **Os campos financeiros e os detalhes de contrato marcados como proposta não estão aprovados.** Nenhuma implementação autorizada. **Posicionamento (PEND-50): evolução técnica, fora da oferta comercial do MVP (somente o Básico).**
- Referências: [ADR 0001](0001-biblioteca-decimal.md); [ADR 0011](0011-fuso-horario-por-restaurante.md); `CLAUDE.md` seção 7; ROADMAP seções 4.3, 5.5, 5.9, 8.4, APR-02, PEND-45, PEND-49 e ABERTO-14; [EV-14 e EV-17](../evolucoes-futuras-da-api.md); [auditoria comercial](../auditoria-estrutura-comercial.md)

## Contexto

O restaurante piloto trabalha com promoções por dia da semana, e isso é requisito estratégico para a validação do piloto. É evolução técnica, **fora da oferta comercial do MVP** (PEND-50). Hoje o pedido **não admite desconto**: `orders.total` é a soma de `order_items.subtotal`, `orders.subtotal` foi removido (APR-02) e a migration de `orders` registra "não há subtotal, taxa nem desconto". O cálculo de valores está em uma função única, `priceCart` (`apps/api/app/support/order_cart.ts`), usada pela cotação e pela criação do pedido, em `big.js` (ADR 0001).

## Decisões aprovadas

1. Aplica-se **somente o maior desconto financeiro por pedido**. **Não há acúmulo.**
2. **Desempate (determinístico):** com descontos de mesmo valor, vence a promoção de **maior prioridade configurada**; se a prioridade também for igual, vence o **identificador estável da promoção** como critério final.
3. **Adicionais não recebem desconto** na primeira versão.
4. **Sem limite de utilização por cliente, sem limite por campanha, sem contador de utilização e sem mecanismo de esgotamento por quantidade no MVP.**
5. Uma promoção está **indisponível** quando está **fora da validade** ou **deixa de atender às condições de elegibilidade**. A promoção indisponível perde o benefício.
6. O cálculo usa `priceCart` (cálculo central). O backend é a **única autoridade** sobre cálculo e validação dos descontos. O frontend não determina descontos nem totais, e o cliente não envia valores considerados confiáveis.
7. O pedido preserva os valores financeiros e os dados da promoção aplicada no momento da compra.
8. A **APR-02** (`orders.subtotal`) deve ser revista, e os campos financeiros documentados (ver "Proposta").
9. **Sem motor genérico de regras** sem necessidade comprovada.
10. **Reconfirmação por cotação identificada, com prazo de validade** (fluxo abaixo).

### Fluxo da cotação identificada (aprovado)

1. O cliente solicita a cotação.
2. O backend calcula os valores e as promoções elegíveis.
3. O backend devolve uma **identificação da cotação** e o **prazo de validade**.
4. O cliente envia a identificação ao confirmar o pedido.
5. O backend **valida a cotação e recalcula** os valores.
6. Se houver **alteração financeira**, o pedido **não é confirmado**.
7. O backend devolve os **novos valores** e exige **nova confirmação** do cliente.

Requisitos aprovados: a cotação é vinculada ao **restaurante** e ao **conteúdo relevante do carrinho**; tem **prazo de validade**; a validação final é do backend; a **estratégia de invalidação** considera alterações nas condições promocionais e nos preços; **idempotência e integridade transacional são preservadas**.

### Devolução de utilização: evolução futura

A devolução da utilização após o cancelamento confirmado **não é comportamento do MVP**, porque não existe contador de utilização. Permanece como **evolução futura, condicionada à existência de limites de utilização** (EV-17). Quando limites forem aprovados, o consumo deve ser atômico na transação do pedido (padrão de `next_order_number`: `UPDATE ... WHERE usos < limite RETURNING`), a devolução ocorre na transação do cancelamento, com bloqueios em ordem de id, replay idempotente sem novo consumo e teste de concorrência. Isso **não está implementado nem autorizado**. Enquanto isso, o snapshot de um pedido cancelado permanece imutável.

## Proposta técnica (NÃO APROVADA)

- **Arredondamento:** `ROUND_HALF_UP` em duas casas, por linha, e depois soma. O desconto nunca excede o valor dos itens elegíveis, e o total nunca fica negativo (`CHECK total >= 0` existente).
- **Condições da v1 (colunas tipadas):** dias da semana, janela de horário e datas de início e fim no **fuso do restaurante** (ADR 0011), produtos ou categorias elegíveis, percentual ou valor fixo, valor mínimo do carrinho, quantidade mínima e prioridade. A ativação é calculada na avaliação, **sem job nem cron**.
- **Campos financeiros no pedido:** `orders.subtotal` (volta, antes do desconto), `orders.discount_total` e, em cada item, o preço original e o desconto da linha. O total é `subtotal − discount_total`. Pedidos antigos têm desconto zero e **não são recalculados**.
- **Snapshot da promoção aplicada:** nome, tipo, valor configurado, condição atendida e valor descontado, sem depender de a promoção continuar existindo.
- **Isolamento:** `restaurant_id` e chaves compostas por restaurante em todas as tabelas novas; teste de isolamento (leitura, alteração e exclusão) obrigatório.

## Questões técnicas ainda abertas (ABERTO-14)

Estas questões **não foram decididas** e não devem ser tratadas como parte do fluxo aprovado:
- Formato da identificação da cotação (token opaco gravado, ou assinado) e se a cotação é persistida.
- Duração do prazo de validade.
- O que compõe o "conteúdo relevante do carrinho" vinculado à cotação (itens, quantidades, adicionais, modalidade) e a regra de comparação.
- Estratégia de invalidação (por versão das promoções e dos preços, por data de alteração ou por recálculo).
- Código e formato do erro de reconfirmação e o corpo com os novos valores.
- Tratamento da `Idempotency-Key` e do `idempotency_hash` quando o pedido é recusado para reconfirmação e quando é reenviado com nova cotação (ADR 0010 não altera a regra do PEND-14).
- Rate limit e resposta uniforme para cotações inválidas ou vencidas.
- Cupons (não decididos).
- Interação com o desconto sobre a taxa de entrega (ABERTO-10).

## Consequências

- Revisa a APR-02 e as seções 4.3 (`orders`, `order_items`), 5.5, 5.9 e 8.4 do ROADMAP quando for implementado. Em particular, a seção 5.9 hoje descreve a cotação como informativa e sem identificação: a cotação identificada muda esse contrato.
- Cria um módulo `promotions` na API, o que exige tarefa própria (`CLAUDE.md` seção 4).
- O frontend continua sem aritmética monetária.
- Sem contador de utilização, **não há concorrência de consumo** a tratar no MVP; a concorrência passa a ser requisito apenas se limites forem aprovados (EV-17).
