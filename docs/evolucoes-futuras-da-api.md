# Evoluções futuras da API

- Data: 2026-11-16
- Origem: planejamento da Fase 7 (UX), revisão de segurança da F6-T3 e `docs/ROADMAP.md`
- Referências: `CLAUDE.md` seções 1 e 10; ROADMAP seções 5, 8 e 10; ADR 0002

**Este documento só registra propostas.** Nenhum item está aprovado nem implementado. Cada um exige necessidade comprovada, decisão explícita do usuário e, quando mudar contrato, dependência ou regra de negócio, ADR curto, e a ROADMAP é atualizada antes da implementação (ROADMAP 11.3). Na Fase 7, os contratos da API e as regras de negócio permanecem como estão.

| ID | Evolução | Tipo | Origem |
| --- | --- | --- | --- |
| EV-01 | Filtro de vários status e contagem por status em `GET /tenant/:restaurantId/orders` | Contrato | F7-T3 |
| EV-02 | Mesa e quantidade de itens na lista de pedidos | Contrato | F7-T3 |
| EV-03 | Aviso de pedido novo com a aba em segundo plano | Arquitetura e ADR | F7-T3 |
| EV-04 | Reordenação atômica de categorias e produtos | Contrato | F7-T5 |
| EV-05 | `staff` marcar produto como esgotado | Regra de negócio | ROADMAP 5.1 |
| EV-06 | Separar a operação administrativa da autenticação do `owner` | Segurança e regra de negócio | F6-T3 (S-06) |
| EV-07 | Mensagens de validação da API em português | Contrato (texto das mensagens) | F7-T7 |

## EV-01: filtro de vários status e contagem por status

- **Necessidade:** a equipe precisa ver os pedidos em andamento (pendente, confirmado, em preparo e pronto) de uma vez e saber quantos há em cada status.
- **Situação atual:** `GET /orders` aceita um único `status`. Mostrar os ativos e contadores exigiria quatro consultas a cada atualização, o que foi descartado na Fase 7.
- **Proposta:** aceitar uma lista de status no filtro e/ou devolver, em `meta`, a contagem por status do restaurante, sempre filtrada por `restaurant_id` do tenant validado.
- **Cuidados:** manter o isolamento por tenant e a ausência de dados pessoais além do que a lista já devolve; testes de isolamento; custo da agregação no PostgreSQL.

## EV-02: mesa e quantidade de itens na lista de pedidos

- **Necessidade:** reconhecer um pedido pelo cartão da lista, sem abrir o detalhe.
- **Situação atual:** o contrato da lista tem `id`, `order_number`, `status`, `customer_name`, `fulfillment_type`, `total` e `created_at`.
- **Proposta:** acrescentar `table_name` (snapshot) e `items_count`.
- **Cuidados:** a lista já expõe o nome do cliente; avaliar se a mesa e a quantidade ampliam a exposição de dados e atualizar a ROADMAP 8.5.

## EV-03: aviso de pedido novo com a aba em segundo plano

- **Necessidade:** quem deixa o painel em segundo plano não é avisado de pedidos novos.
- **Situação atual:** o ADR 0002 (adendo 5) proíbe o polling em segundo plano, porque toda requisição autenticada renova a inatividade da sessão. O aviso funciona só com a aba visível e se atualiza ao voltar a ela.
- **Proposta (a avaliar):** um canal de notificação que não renove a sessão, por exemplo eventos enviados pelo servidor ou notificações do navegador, ou uma consulta leve que não conte como atividade.
- **Cuidados:** revisar o ADR 0002 com novo ADR; respeitar o escopo (notificações externas estão fora do MVP); não registrar dados pessoais em notificações.

## EV-04: reordenação atômica

- **Necessidade:** reordenar categorias e produtos sem digitar números.
- **Situação atual:** a ordem é o campo numérico `sort_order`, sem unicidade. Trocar duas posições exigiria dois `PATCH` não atômicos, com risco de ordem inconsistente se um falhar.
- **Proposta:** endpoint que receba a lista ordenada e grave tudo em uma transação, com validação de que todos os ids pertencem ao restaurante.
- **Cuidados:** limite de itens por requisição; teste de isolamento e de atomicidade.

## EV-05: `staff` marcar produto como esgotado

- **Necessidade:** durante o atendimento, o `staff` não consegue marcar um produto como esgotado, porque `is_available` é restrito ao `owner`.
- **Situação atual:** consequência registrada na ROADMAP 5.1.
- **Proposta:** permitir ao `staff` apenas a alteração de `is_available`, mantendo restritos a exclusão e `is_active`.
- **Cuidados:** é uma mudança da matriz de permissões; exige decisão explícita, atualização da ROADMAP 5.1 e dos testes de permissão e de isolamento.

## EV-06: separar a operação administrativa da autenticação do `owner` (S-06)

- **Necessidade:** hoje o `platform_admin` recebe a senha temporária do `owner` ao redefini-la e pode entrar como ele, acessando pedidos e dados pessoais do restaurante, o que contorna na prática a regra APR-04. O risco **não foi aceito**.
- **Situação atual:** a ação gera log de auditoria e exige a troca de senha no primeiro acesso, mas não impede o acesso.
- **Direções a avaliar:** entregar a credencial ou o link de redefinição diretamente ao `owner`, por um canal que o `platform_admin` não veja; ou um acesso de suporte com escopo limitado e auditoria. Sem recuperação por e-mail na v1, qualquer solução precisa de um canal de entrega definido.
- **Cuidados:** é mudança de segurança e de regra de negócio; ADR, testes de autenticação e de isolamento e atualização das seções 5.2 e 8.2 da ROADMAP.

## EV-07: mensagens de validação da API em português

- **Necessidade:** a validação do backend devolve mensagens em inglês (por exemplo, no telefone do pedido), e o frontend as exibe como chegam; o restante da interface está em português.
- **Situação atual:** achado da F7-T7, não corrigido na Fase 7 porque exige mudar o backend (validador do Adonis).
- **Direções a avaliar:** mensagens personalizadas nos validators ou tradução centralizada no validator do Adonis; alternativa só no frontend, mapeando o `code` do erro, sem mudar o backend.
- **Cuidados:** manter o formato de erro `{ code, message, details? }` e os testes da API que conferem mensagens; avaliar junto o alinhamento do limite do telefone (PEND-38).
