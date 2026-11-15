# ADR 0004 — Rate limit com `@adonisjs/limiter` (store em memória)

- Status: aprovado — Fase 2 (decisão D1)
- Data: 2026-11-15
- Referências: `CLAUDE.md` seções 1, 7 e 9; ADR 0002; ROADMAP seção 6 (Rate limit) e PEND-15

## Contexto

O login e, nas fases seguintes, a criação de pedido, o acompanhamento e a cotação do carrinho precisam de limite de requisições. A API roda em **uma instância** (PEND-15), sem Redis. A regra de dependências do CLAUDE.md pede verificar antes se a stack já resolve: o AdonisJS tem pacote oficial para isso, compatível com o core 7.6.0 (`@adonisjs/limiter` 3.0.1), com store `memory`.

## Decisão

- Usar `@adonisjs/limiter` com o store `memory`. Sem Redis nem tabela de banco.
- Cada regra é independente e tem chave própria, formada por identificadores normalizados. Nunca entram na chave senha, cookie ou token.
- Fase 2:

| Regra | Chave | Padrão |
| --- | --- | --- |
| Login por IP e e-mail | `login:ip-email:{ip}:{email normalizado}` | 5/min |
| Login por IP | `login:ip:{ip}` | 20/min |
| Troca de senha | `password:{id do usuário}` | 5/min |

- E-mail normalizado: minúsculas e sem espaços nas pontas. Para não guardar o e-mail em memória sem necessidade, a chave usa o hash SHA-256 dele.
- Limites e janela configuráveis por variáveis de ambiente (`RATE_LIMIT_LOGIN_IP_EMAIL`, `RATE_LIMIT_LOGIN_IP`, `RATE_LIMIT_PASSWORD`). Os padrões acima valem sem configuração.
- Excedido o limite: `429 RATE_LIMITED`, com `Retry-After`.
- As regras de login e as demais operações têm contadores separados. Uma regra não consome o limite de outra.
- Fases seguintes (pedido, acompanhamento, cotação) apenas adicionam regras com os valores do ROADMAP seção 6.

## Consequências

- Reiniciar o processo zera os contadores. Um atacante pode ganhar tentativas extras a cada reinício ou implantação.
- Só vale para **uma instância**. Com mais de uma, cada processo conta separadamente e o limite efetivo se multiplica; antes de escalar, trocar o store (Redis ou banco) em novo ADR.
- O IP depende do proxy confiável configurado no AdonisJS e no Nginx. Se o proxy não repassar o IP real, todos os clientes compartilham um contador. Conferir em F6-T4.
- O limite por IP pode afetar usuários atrás do mesmo NAT; por isso existe o limite por IP e e-mail, mais baixo, e o por IP, mais alto.
- O Nginx aplica limites complementares, sem substituir a aplicação.
- Nova dependência: `@adonisjs/limiter` (oficial, sem dependências de infraestrutura).
