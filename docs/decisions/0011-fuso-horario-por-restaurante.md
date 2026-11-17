# ADR 0011 — Fuso horário configurável por restaurante

- Status: **decisão aprovada em 2026-11-17**, com **complemento técnico aprovado na revisão de consistência da mesma data** (PEND-49); **migração dos dados existentes pendente** (ABERTO-13). Nenhuma implementação autorizada. **Posicionamento (PEND-50): evolução técnica, fora da oferta comercial do MVP.**
- Referências: [ADR 0010](0010-promocoes-e-descontos-no-pedido.md); ROADMAP seção 4.1 (datas `timestamptz`), PEND-48, PEND-49 e ABERTO-13; [EV-16](../evolucoes-futuras-da-api.md)

## Contexto

O fuso está fixo no código: `BUSINESS_ZONE = 'America/Sao_Paulo'` em `apps/api/app/controllers/orders_controller.ts` e `timeZone: "America/Sao_Paulo"` em `apps/web/src/lib/panel-orders.ts`; o `.env.example` define `TZ=UTC`. Não existe fuso nem horário de funcionamento em `restaurants`. O restaurante piloto fica em Campo Grande/MS. Os instantes de negócio (`created_at` e `updated_at` das tabelas) já são `timestamptz` (ROADMAP seção 4.1); a coluna `sessions.expires_at` é `timestamp` simples por ser infraestrutura do pacote de sessão e não é dado de negócio.

## Decisões aprovadas

1. Cada restaurante possui um **identificador de fuso horário IANA**, configurável.
2. O restaurante piloto usa **`America/Campo_Grande`**.
3. **Instantes** são armazenados em **`timestamptz`**.
4. **Datas comerciais sem horário** são armazenadas em **`date`**.
5. As **conversões de horário são feitas no backend**, com o fuso do restaurante.
6. **Não se usa deslocamento UTC fixo** como substituto do identificador IANA.
7. A **migração dos dados existentes deve ser planejada antes da implementação.**

## Impactos (a tratar na implementação)

| Área | Impacto |
| --- | --- |
| Promoções por dia e horário | Dia da semana e janela de horário avaliados no fuso do restaurante, nunca no fuso do servidor |
| Validade de campanhas | Início e fim como data (`date`) e horário local do restaurante, convertidos no backend |
| Registro e consulta de pedidos | O instante continua em `timestamptz`; a lista "de hoje" do painel, hoje fixa em `America/Sao_Paulo`, passa a usar o fuso do restaurante |
| Relatórios futuros | Agrupamento por dia e por hora segue o fuso do restaurante |
| Restaurantes existentes | Precisam de valor inicial: **migração pendente** |

## Pendências (ABERTO-13)

- **Plano de migração** dos restaurantes existentes (valor inicial, reversibilidade conforme `CLAUDE.md` seção 11, verificação de pedidos já registrados). **Valor padrão para existentes não decidido.**
- Lista de identificadores aceitos e validação contra nomes IANA.
- Quem altera o fuso (`owner` ou `platform_admin`) e o efeito sobre campanhas em andamento.
- Se o horário de funcionamento será modelado (não aprovado).
- Como o frontend recebe o fuso (pela API) e formata datas.

## Consequências

Muda o modelo de `restaurants` e o contrato do restaurante; exige migration reversível, validação no backend e testes de virada do dia e de promoção por horário. Elimina o fuso global fixo do código quando implementado; até lá, o fuso fixo atual descreve o comportamento existente.
