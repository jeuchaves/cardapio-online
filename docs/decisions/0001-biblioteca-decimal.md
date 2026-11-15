# ADR 0001 — Cálculo monetário com `big.js` e `NUMERIC(10,2)`

- Status: aprovado — tarefa F0-T5
- Data: 2026-11-15
- Referências: `CLAUDE.md` seção 7; ROADMAP seções 4.1, 5.5 e PEND-10

## Contexto

O backend recalcula todos os valores do pedido (subtotais e total). `number` do JavaScript é ponto flutuante binário e produz erros como `0.1 + 0.2 !== 0.3`. O `CLAUDE.md` exige `NUMERIC` no PostgreSQL, biblioteca decimal no backend e valores como string decimal.

## Decisão

1. **Banco:** todo valor monetário é `NUMERIC(10,2)` com `CHECK (>= 0)`. O valor máximo é `99999999.99`.
2. **Backend:** `big.js` em todo cálculo monetário (subtotal do item, adicionais por unidade, total do pedido). A dependência é instalada apenas na Fase 3 (F3-T3), quando surgir o primeiro uso real.
3. **Representação:** valores trafegam na API e entre API e banco como **string decimal** (`"12.50"`). O driver `pg` já devolve `NUMERIC` como string; nenhuma conversão para `number` é feita.
4. **Entrada:** preço aceito somente como string que case com `^\d{1,8}(\.\d{1,2})?$`. Mais de duas casas, sinal, notação científica ou `number` JSON são rejeitados com `422`. Por isso nenhum arredondamento é necessário: preço (2 casas) × quantidade (inteiro) não gera casas extras.
5. **Saída:** valores serializados sempre com duas casas (`toFixed(2)` do `big.js`).
6. **Interface (frontend):** valores monetários são tratados como **strings decimais** em todo o fluxo: o que a API devolve é exibido como string, e o que o usuário digita em formulários (preço de produto ou adicional) é enviado como string, sem conversão para `number`. O frontend não é fonte de cálculo monetário e não define nenhum valor oficial. **O backend é a única fonte de cálculo monetário**; o total oficial é sempre o devolvido por ele.
7. **Cliente não envia valores:** qualquer campo monetário no payload do pedido é rejeitado (ROADMAP 8.4).

## Consequências

- Uma dependência nova no backend (`big.js`), já aprovada no ROADMAP (seção 1).
- O Lucid não deve mapear colunas monetárias para `number`: os models mantêm essas colunas como `string`.
- Testes obrigatórios (F3-T3, F5-T2): precisão decimal preservada ida e volta, total com adicional por unidade, valor com mais de duas casas rejeitado e total enviado pelo cliente ignorado.
- Se o limite de `NUMERIC(10,2)` deixar de bastar, a mudança exige nova migration e novo ADR.
