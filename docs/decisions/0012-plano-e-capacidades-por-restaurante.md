# ADR 0012 — Plano e capacidades por restaurante

- Status: **evolução arquitetural, não implementada** (PEND-50, 2026-11-17). A diretriz estrutural aprovada em 2026-11-17 e mantida na revisão de consistência (PEND-49) continua registrada, mas **não é necessária para a oferta única do MVP**. **Sem bloqueios por plano, sem assinatura e sem cobrança.** Matriz comercial de planos futuros **não criada** (ABERTO-11).
- Referências: ROADMAP PEND-46, ABERTO-09 e ABERTO-11; [EV-13](../evolucoes-futuras-da-api.md); [auditoria comercial](../auditoria-estrutura-comercial.md); `CLAUDE.md` seções 1 e 2

## Contexto

A auditoria constatou que `restaurants` não tem plano e que a plataforma não administra planos (ROADMAP seção 2). A proposta comercial preliminar previa três planos (histórico, com valores preliminares não aprovados; no MVP só existe a oferta Básico). Cobrança, assinatura e gateway continuam fora do escopo.

## Posicionamento do MVP (PEND-50, aprovado em 2026-11-17)

- O MVP tem **uma única oferta comercial, o Básico**. **Profissional e Premium não são planos ofertados**; as funcionalidades antes associadas a esses nomes são evolução técnica.
- O campo `plan` e as capacidades centralizadas são **evolução arquitetural**: **não implementar agora, não criar bloqueios por plano e não exigir assinatura ou cobrança.**
- A distribuição comercial futura **não está aprovada**.
- As decisões abaixo foram tomadas antes deste posicionamento e **permanecem registradas como direção técnica futura**; "mesas e equipe no Básico" passa a ser parte da oferta do MVP.

## Decisões aprovadas (direção técnica futura)

1. Mesas e equipe permanecem no plano **Básico** inicialmente.
2. A estrutura técnica prevê: **campo `plan`** associado ao restaurante; **definição centralizada das capacidades por plano**; **controle centralizado de acesso** às funcionalidades; **comportamento seguro para restaurantes existentes**; **atribuição administrativa de plano** (inclusive ao piloto).
3. **Não implementar bloqueios comerciais** antes da aprovação da matriz definitiva.

## Direção técnica (referência, não aprovada em detalhe)

- Um único ponto de definição de capacidades e limites por plano e uma única verificação usada pelos controllers; nenhuma regra comercial espalhada.
- O plano é definido **só pelo `platform_admin`**; o cliente e o `owner` não o escolhem; mudanças registradas em log (APR-06).
- "Comportamento seguro" para existentes: **definição pendente**. Princípio proposto: nenhum restaurante perde, por causa da introdução do campo, recurso que já usa.
- Sem cobrança, assinatura ou gateway no sistema.

## Conflito com as regras do projeto

O `CLAUDE.md` seção 2 dizia "Painel de plataforma: apenas cadastrar e administrar restaurantes. Sem planos, assinaturas ou cobrança", e o ROADMAP seção 1 lista "planos, assinaturas e cobrança" fora do MVP. A decisão de 2026-11-17 admite **apenas o campo de plano e o controle de capacidades**, sem cobrança. **Na revisão de consistência de 2026-11-17, o `CLAUDE.md` seção 2 recebeu um ajuste mínimo** (atribuição de plano pelo painel de plataforma; assinaturas e cobrança seguem fora; nenhum bloqueio antes da matriz aprovada). Em seguida (PEND-50), o ajuste foi **reduzido**: o `CLAUDE.md` descreve o MVP sem planos, com oferta única, e trata a estrutura de plano como evolução arquitetural não implementada. A **revisão do texto pelo usuário segue pendente** (ABERTO-15).

## Consequências

Migration em `restaurants`, contrato de plataforma e testes de autorização (nenhum recurso de plano superior acessível indevidamente) quando houver bloqueio. Isso **só ocorrerá depois da matriz aprovada**.

## Pendências

Matriz definitiva por plano; valor para existentes; limites numéricos; quando o primeiro bloqueio entra em vigor. Ver ABERTO-11.
