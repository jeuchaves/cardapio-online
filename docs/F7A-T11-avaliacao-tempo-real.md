# F7A-T11: avaliação de atualização em tempo real

- Data: 2026-11-17
- Situação: **avaliação e proposta, sem implementação**. Recomendação final: **manter o estado atual** (a decisão D-07 continua do usuário).
- Referências: [F7A](F7A-melhorias-ux-pre-producao.md) T11; [EV-03](evolucoes-futuras-da-api.md); [ADR 0002](decisions/0002-sessao-cors-csrf.md) (adendo 5); [ADR 0004](decisions/0004-rate-limit.md); `CLAUDE.md` seções 1 e 2

## 1. Estado atual (conferido no código)

- **Painel de pedidos:** o indicador de pedido novo atualiza a cada 15 s **só com a aba visível** e na hora ao voltar a ela (PEND-22). Medido na F7-T8: 0 chamadas à API em 33 s com a aba oculta.
- **Acompanhamento do cliente** (`order-tracking.tsx`): `POLL_MS = 15000`, só com a aba visível e só até o status final; compatível com o limite de 30 consultas por minuto por IP.
- **Sessão:** cada requisição autenticada renova a inatividade (2 h), por isso não há polling em segundo plano (ADR 0002, adendo 5).

## 2. Opções

| Critério | A. Manter o estado atual | B. SSE | C. WebSocket | D. Notificações do navegador |
| --- | --- | --- | --- | --- |
| Painel recebe aviso com a aba em segundo plano | Não (aviso ao voltar) | Sim | Sim | Sim (precisa de permissão e de um canal que as dispare) |
| Acompanhamento do cliente | Atualização a cada 15 s com a aba visível | Sim | Sim | Pouco útil sem app instalado |
| Isolamento entre restaurantes | Já garantido pelas rotas | Exige canal por restaurante validado no servidor | Idem, mais o handshake | Depende do canal que as envia |
| Sessão | Não muda | Conexão aberta não pode renovar a sessão nem mantê-la viva: exige regra nova | Idem | Idem |
| Reconexão e eventos perdidos | Não se aplica (cada consulta lê o banco) | Reconexão nativa; o evento só dispara releitura | Reconexão manual; idem | Não garante entrega |
| Infraestrutura | Nenhuma | Nginx sem buffering, `proxy_read_timeout`, uma conexão por aba, memória de uma instância sem Redis | Idem, mais upgrade de protocolo | Service worker, servidor de push (fora do MVP: notificações externas) |
| Segurança | Nenhuma nova | Origin e CSRF no handshake, limite de conexões, dados mínimos no evento | Idem | Dados em notificações |
| Complexidade | Nenhuma | Média | Alta | Alta e fora do escopo |

## 3. Recomendação

1. **Manter o estado atual.** Não há evidência de perda real de pedidos: o aviso funciona com a aba visível e a recuperação é imediata ao voltar. O custo de um canal em tempo real (regras de sessão, isolamento por tenant, Nginx, limites de conexão) é desproporcional ao porte do produto na v1.
2. Se, depois da publicação, houver relato comprovado de pedidos perdidos por aba em segundo plano, a **primeira opção a considerar é SSE** (unidirecional, sobre HTTP, mesma origem, sem biblioteca), com ADR próprio que substitua ou complemente o adendo 5 do ADR 0002 e com estas condições mínimas: canal autenticado pelo vínculo da sessão (nunca pelo cliente), evento só com o identificador do pedido (a tela relê pela API), conexão que não renova a sessão e tem teto de duração, e testes de isolamento e de autorização do canal.
3. Não adotar WebSocket (comunicação bidirecional desnecessária) nem notificações externas (fora do escopo, CLAUDE.md seção 2).

## 4. Consequências

- Nenhum código, dependência ou ADR de implementação é criado nesta tarefa.
- O EV-03 passa a apontar para este documento com a recomendação "não implementar agora".
