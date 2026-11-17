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
| EV-08 | Pedidos pelo WhatsApp (P1) | Escopo, contrato e ADR | Auditoria comercial |
| EV-09 | Personalização visual por restaurante (P1) | Escopo, contrato e ADR | Auditoria comercial, F7A-T5b |
| EV-10 | Relatórios básicos (P1) | Escopo e contrato | Auditoria comercial |
| EV-11 | IA e atendimento automatizado (P3) | Escopo, arquitetura e ADR | Auditoria comercial |
| EV-12 | Relatórios avançados e recursos adicionais de gestão (P3) | Escopo | Auditoria comercial |
| EV-13 | Separação de recursos por plano (P1, condicional) | Escopo, modelo de dados e ADR | Auditoria comercial |
| EV-14 | Promoções e descontos no pedido (aprovada em parte: ADR 0010) | Escopo, contrato, modelo e ADR | Piloto, auditoria comercial |
| EV-15 | Entrega (delivery) no MVP (escopo aprovado, sem especificação) | Escopo, contrato, modelo e ADR | Piloto |
| EV-16 | Fuso horário por restaurante (aprovada: ADR 0011) | Contrato e modelo | Piloto |
| EV-17 | Limites de utilização de promoções e devolução no cancelamento (evolução futura, não aprovada) | Escopo, modelo e concorrência | Piloto |
| EV-18 | Combos e promoções avançadas (sem especificação) | Escopo | Posicionamento do MVP |

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
- **Planejamento:** a avaliação (WebSocket, SSE, notificações do navegador ou manter o estado atual) está prevista na F7A-T11 ([F7A-melhorias-ux-pre-producao.md](F7A-melhorias-ux-pre-producao.md)); sem implementação aprovada.
- **Avaliação concluída (2026-11-17):** [F7A-T11-avaliacao-tempo-real.md](F7A-T11-avaliacao-tempo-real.md) recomenda manter o estado atual; SSE seria a primeira opção se houver necessidade comprovada. Decisão D-07 do usuário pendente.

## EV-04: reordenação atômica

- **Necessidade:** reordenar categorias e produtos sem digitar números.
- **Situação atual:** a ordem é o campo numérico `sort_order`, sem unicidade. Trocar duas posições exigiria dois `PATCH` não atômicos, com risco de ordem inconsistente se um falhar.
- **Proposta:** endpoint que receba a lista ordenada e grave tudo em uma transação, com validação de que todos os ids pertencem ao restaurante.
- **Cuidados:** limite de itens por requisição; teste de isolamento e de atomicidade.
- **Planejamento:** base da F7A-T12 (arrastar e soltar; [F7A-melhorias-ux-pre-producao.md](F7A-melhorias-ux-pre-producao.md)); continua sem aprovação do contrato.

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

## EV-08 a EV-13: lacunas da estrutura comercial (proposta, 2026-11-17)

Origem: [auditoria-estrutura-comercial.md](auditoria-estrutura-comercial.md), que traz a matriz de aderência, o parecer e as justificativas de prioridade. **Todas estão fora do escopo da v1 (ROADMAP seção 1), sem aprovação e sem tarefa no ROADMAP.** Dependem da decisão ABERTO-09. As prioridades são propostas e não alteram nenhuma prioridade existente. **Atualização de 2026-11-17 (PEND-50):** são evoluções técnicas; Profissional e Premium **não são planos ofertados no MVP**, e as prioridades P1 e P3 indicadas são **propostas não aprovadas**, sem prazo atribuído.

## EV-08: pedidos pelo WhatsApp (P1)

- **Necessidade:** a proposta preliminar do plano Profissional previa (histórico; não é oferta do MVP, PEND-50) "pedidos pelo WhatsApp"; não existe requisito nem código.
- **Situação atual:** o pedido é registrado no sistema e acompanhado por token (F5). Não há integração externa.
- **Atores:** cliente e restaurante (`owner` e `staff`).
- **Direções a avaliar:** (A) botão que abre o WhatsApp do restaurante com o texto do pedido (`wa.me`), sem API paga nem dependência; (B) API do WhatsApp Business, fora do escopo (webhooks e notificações externas).
- **Decisões:** o WhatsApp complementa ou substitui o pedido no painel; o texto leva o link de acompanhamento; comportamento com o restaurante fechado.
- **Regras e cuidados:** só dados do próprio pedido; **nunca** enviar o `tracking_token` sem decisão sobre a privacidade (ROADMAP 7.3); número do restaurante vindo do banco e validado, nunca do cliente; texto montado com os valores já calculados pelo backend (ADR 0001).
- **Módulos:** `orders`, `restaurants` (telefone para WhatsApp) e `apps/web` (checkout e acompanhamento).
- **Riscos:** privacidade; dependência de aplicativo externo; custo e termos do WhatsApp Business (opção B).
- **Aceite proposto:** o cliente abre o WhatsApp com o pedido correto sem expor dados de outros pedidos; teste de conteúdo da mensagem e de isolamento; o E2E existente continua passando.

## EV-09: personalização visual por restaurante (P1)

- **Necessidade:** a proposta preliminar do plano Profissional previa (histórico; não é oferta do MVP, PEND-50) "personalização visual"; hoje só existe o logo e a identidade é única (ADR 0008).
- **Situação atual:** capa enviada (F7A-T5b, D-04) e tema por restaurante (D-03) não aprovados.
- **Direções a avaliar:** limitar a logo, capa e **uma** cor de destaque escolhida de uma lista com contraste AA garantido; sem CSS livre.
- **Regras e cuidados:** upload com as regras do ADR 0003; validação de contraste; nenhum HTML ou CSS enviado pelo restaurante.
- **Módulos:** `restaurants` (migration e contrato) e `apps/web` (público e painel). Muda o contrato e o modelo; exige ADR e novo teste de isolamento.
- **Aceite proposto:** o restaurante A não altera o visual do B; contraste AA em todas as cores permitidas; cardápio legível sem imagem.

## EV-10: relatórios básicos (P1)

- **Necessidade:** a proposta preliminar do plano Profissional previa (histórico; não é oferta do MVP, PEND-50) "relatórios básicos"; as métricas não estão definidas.
- **Situação atual:** existem `orders`, `order_items`, snapshots e `order_status_history`.
- **Proposta (a definir com o negócio):** consultas somente leitura, por período, para o `owner` do próprio restaurante (por exemplo, pedidos por status, total vendido no período e itens mais pedidos).
- **Regras e cuidados:** valores monetários somados no PostgreSQL ou com decimal, **nunca como `number`** (CLAUDE.md seção 7); filtro por `restaurant_id` em cada consulta; sem dados pessoais no relatório; `platform_admin` sem acesso (APR-04); considerar a retenção e a anonimização (ABERTO-01); limite de período e índices.
- **Aceite proposto:** totais conferem com os pedidos; isolamento A × B; `staff` conforme a decisão de permissões.

## EV-11: IA e atendimento automatizado (P3)

- **Necessidade:** a proposta preliminar do plano Premium previa (histórico; não é oferta do MVP, PEND-50) "recursos de inteligência artificial" e "atendimento automatizado, caso previsto". **Nenhum comportamento está definido.**
- **Decisões antes de qualquer especificação:** que problema do restaurante a IA resolve; canal do atendimento (depende de EV-08); modelo, fornecedor e custo por uso; franquia por restaurante; tratamento de dados pessoais enviados a terceiros (LGPD, transferência internacional).
- **Cuidados:** a IA **não** calcula preços nem altera pedidos (CLAUDE.md seção 7); sem dados pessoais de clientes no prompt antes da validação jurídica; controle de custo por restaurante; nova dependência exige ADR.
- **Riscos:** custo variável sem teto; resposta incorreta ao cliente; vazamento de dados.

## EV-12: relatórios avançados e recursos adicionais de gestão (P3)

- **Situação atual:** relatórios avançados estão **expressamente fora do MVP**; "recursos adicionais de gestão" não são definidos pela proposta comercial.
- **Dependências:** EV-10 em uso e feedback de clientes reais. Sem definição do negócio, não há o que especificar.
- **Gestão e automação avançadas** (itens antes associados ao Premium) entram aqui: sem definição do negócio, **sem especificação suficiente**.

## EV-13: separação de recursos por plano (P1, condicional)

- **Necessidade:** para diferenciar Básico, Profissional e Premium no produto, o backend precisa saber o plano do restaurante. Hoje `restaurants` não tem plano (ROADMAP 4.3) e a plataforma não administra planos (ROADMAP seção 2).
- **Proposta mínima (a avaliar):** um campo de plano definido **apenas pelo `platform_admin`**, com verificação no backend em cada recurso restrito. **Sem cobrança, gateway ou assinatura no sistema**; a cobrança pode ser manual e externa.
- **Regras e cuidados:** a verificação é do backend (esconder botões não é autorização); o cliente nunca escolhe o plano; mudanças de plano registradas em log (APR-06); teste de que um recurso de plano superior é recusado no plano inferior.
- **Dependência:** só faz sentido depois de decidir quais recursos são restringidos (ABERTO-09). **Não implementar enquanto os planos não forem diferenciados no produto.**

## Atualização de 2026-11-17: decisões da segunda etapa (EV-13 a EV-16)

Decisões aprovadas em PEND-45 a PEND-48 e nos ADRs 0010, 0011 e 0012. **Continuam sem tarefa autorizada.** O texto de EV-08 a EV-12 não mudou; a decisão ABERTO-09 foi parcialmente atendida.

**EV-13 (atualização):** a diretriz estrutural foi aprovada ([ADR 0012](decisions/0012-plano-e-capacidades-por-restaurante.md)): campo `plan`, capacidades centralizadas, controle de acesso central, comportamento seguro para existentes e atribuição pelo `platform_admin`. **Bloqueios comerciais continuam proibidos até a matriz definitiva (ABERTO-11).** Em conflito com `CLAUDE.md` seção 2 (ABERTO-15). **Em 2026-11-17 (PEND-50) passou a evolução arquitetural:** não implementar agora, sem bloqueios por plano, sem assinatura nem cobrança; Profissional e Premium não são planos ofertados.

## EV-14: promoções e descontos no pedido (aprovada em parte)

- **Necessidade:** o restaurante piloto trabalha com promoções por dia da semana; requisito estratégico para a validação do piloto; **evolução técnica, fora da oferta comercial do MVP** (PEND-50).
- **Aprovado:** [ADR 0010](decisions/0010-promocoes-e-descontos-no-pedido.md): maior desconto financeiro único por pedido, sem acúmulo, desempate por prioridade configurada e depois por identificador estável, adicionais sem desconto, **sem limites e sem contador de utilização no MVP**, indisponível = fora da validade ou sem elegibilidade, **cotação identificada com prazo de validade** e reconfirmação quando há alteração financeira, integração em `priceCart`, backend como única autoridade, snapshot da promoção no pedido e revisão da APR-02.
- **Pendente (ABERTO-14):** regras reais do piloto, cupons, formato e prazo da cotação, invalidação, erro de reconfirmação, idempotência e campos financeiros do pedido. **Cupons promocionais** continuam sem especificação suficiente.
- **Cuidados:** valores só em decimal no backend (ADR 0001); isolamento por restaurante; sem motor genérico; cotação sem rastro no banco; pedidos antigos sem recálculo.
- **Módulos:** `orders`, novo módulo `promotions`, `apps/web` (painel e carrinho).
- **Riscos:** o endpoint público de pedido pode ser usado para criar pedidos falsos; sem limites de uso isso não consome promoção, mas o risco volta quando limites forem aprovados.

## EV-15: entrega (delivery) no MVP (escopo aprovado, sem especificação)

- **Situação:** incluída no MVP em 2026-11-17 (PEND-47). Hoje `fulfillment_type` aceita só `dine_in` e `pickup` (CHECK em `orders`), sem endereço, taxa ou área.
- **Pendências obrigatórias antes de qualquer implementação (ABERTO-10):** endereço, taxa, área de atendimento, modalidades de entrega e retirada, dados do checkout, acompanhamento e responsabilidade pelo status.
- **Impactos já identificados:** novo dado pessoal (endereço) na seção 7 do ROADMAP, na retenção e anonimização e na redação de logs; composição do total (itens, desconto e taxa); possível novo estado ou transição (APR-01); pagamento na entrega; telefone obrigatório; página de acompanhamento sem expor o endereço sem decisão.
- **Não considerar especificada ou concluída** enquanto os itens acima não forem documentados. **Não é disponível comercialmente** até ser implementada e homologada (PEND-50).

## EV-16: fuso horário por restaurante (aprovada)

- **Aprovado:** [ADR 0011](decisions/0011-fuso-horario-por-restaurante.md): identificador IANA por restaurante; piloto em `America/Campo_Grande`; instantes em `timestamptz`; datas comerciais em `date`; conversões no backend; sem deslocamento UTC fixo.
- **Hoje:** fuso fixo `America/Sao_Paulo` em `orders_controller.ts` e `panel-orders.ts`.
- **Pendente (ABERTO-13):** plano de migração dos restaurantes existentes, lista de identificadores, quem altera, efeito sobre campanhas.

## EV-17: limites de utilização de promoções e devolução no cancelamento (evolução futura, não aprovada)

- **Situação:** **fora do MVP** (PEND-49, ADR 0010). Não há limite por cliente, limite por campanha, contador de utilização nem esgotamento por quantidade.
- **Necessidade a comprovar:** o piloto pode precisar de "os primeiros N pedidos" ou de limite diário (ABERTO-14). Só então esta evolução é reavaliada.
- **Condição:** a **devolução da utilização após o cancelamento confirmado** só existe se houver limites de utilização.
- **Requisitos se aprovada:** consumo atômico na transação do pedido (padrão `next_order_number`, `UPDATE ... WHERE usos < limite RETURNING`); devolução na transação do cancelamento; bloqueios em ordem de id; replay idempotente sem novo consumo; isolamento entre restaurantes; limite diário no fuso do restaurante (ADR 0011); teste de concorrência com pedidos simultâneos.
- **Limite por cliente:** não há identidade de cliente (só nome e telefone por pedido), então qualquer limite por cliente seria burlável.
- **Risco:** o endpoint público de pedido permitiria consumir uma promoção limitada com pedidos falsos.

## EV-18: combos e promoções avançadas (sem especificação)

- **Situação:** proposta preliminar associada ao antigo "Premium"; **evolução técnica, não oferta do MVP** (PEND-50). Não existia nenhum registro anterior; este é o registro.
- **Sem especificação suficiente:** o que é um combo (preço fechado, "compre X leve Y", combinação obrigatória), como interage com a regra aprovada de **maior desconto único, sem acúmulo** (ADR 0010) e como é representado no pedido.
- **Dependências:** EV-14 (promoções) implementada e validada com o piloto.
- **Cuidados:** cálculo só no backend (ADR 0001); não cria acúmulo sem decisão; isolamento por restaurante.
- **Prioridade e prazo:** **não atribuídos.**
