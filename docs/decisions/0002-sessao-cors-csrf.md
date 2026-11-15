# ADR 0002 — Sessão, CORS e CSRF

- Status: aprovado — tarefa F0-T6
- Data: 2026-11-15 (revisado em 2026-11-15, após verificar o código do `@adonisjs/session` 8.3.0 e atualizar o ROADMAP, seção 4.3)
- Referências: `CLAUDE.md` seção 6; ROADMAP seções 3, 6 e 8, PEND-08, PEND-09 e PEND-15

## Contexto

O painel usa login com cookie de sessão. `HttpOnly` impede a leitura do cookie por JavaScript, mas não impede que outro site faça o navegador enviar requisições com esse cookie (CSRF), nem substitui a política de CORS. Esta decisão precisa existir antes de qualquer rota autenticada que altere estado.

## Decisão

### Mesma origem, sem CORS

- Produção: o Nginx serve a web e encaminha `/api` ao AdonisJS no mesmo domínio.
- Desenvolvimento: o Next.js faz rewrite de `/api` para a API.
- Nenhuma configuração de CORS é habilitada. Se um dia houver origens diferentes, será necessário um novo ADR (allowlist explícita, `credentials: include`, `Secure` e `SameSite` revisados). Nunca `*` com credenciais.

### Sessão: armazenamento e cookie

- Guard de sessão do AdonisJS, com a sessão guardada **no servidor**, na tabela `sessions` do driver `database` oficial do `@adonisjs/session` (esquema na seção 4.3 do ROADMAP). O cookie carrega apenas o identificador da sessão, nunca dados do usuário.
- O identificador é um UUID v4 gerado pelo pacote com `randomUUID()` (fonte criptográfica), com **122 bits aleatórios**. É imprevisível na prática, e não há geração própria de identificador.
- `sessions.user_id` guarda a **representação textual do UUID de `users.id`** (`String(user.id)`), o formato que o pacote exige para o *session tagging*. Não há FK, e o ROADMAP documenta essa compatibilidade.
- Cookie: `HttpOnly`, `Secure` em produção, `SameSite=Lax`, `Path=/`, sem atributo `Domain` (restrito ao host). O nome vem de variável de ambiente. O pacote não aceita `maxAge` nem `expires`: o tempo de vida do cookie vem de `age` e de `clearWithBrowser`, e a validade real é sempre decidida pelo servidor.
- Senha com o hash padrão do AdonisJS.
- A autorização consulta o banco a cada requisição (vínculo ativo e perfil, ROADMAP seção 6). Vínculo desativado perde o acesso ao restaurante na requisição seguinte, sem esperar a sessão expirar.

### Sessão: expiração

Dois limites independentes, ambos aplicados no servidor a cada requisição autenticada. Os valores são configuráveis por variável de ambiente; os padrões são:

| Limite | Padrão | Comportamento |
| --- | --- | --- |
| Inatividade | 2 horas (`age`) | A tabela `sessions` não tem `last_activity_at`. O driver grava `expires_at = agora + age` a cada escrita ou `touch` ao fim de cada requisição que carrega a sessão (validade deslizante). `read` recusa e apaga a sessão com `expires_at` vencido. |
| Absoluto | 12 horas desde o login | O driver não oferece esse limite. Um middleware próprio compara `agora − login_at` com o limite, sendo `login_at` gravado nos dados assinados da sessão no login e **nunca atualizado** por atividade, rotação do identificador ou troca de senha. Nunca é prorrogado. Ao atingi-lo, o usuário precisa autenticar-se de novo. |

- Sessão que ultrapassa qualquer um dos limites responde `401 UNAUTHENTICATED` e a linha é removida do banco. Sessão sem `login_at` é tratada como inválida.
- A validade é decidida pelo servidor, não pelo cookie.
- Sem job de limpeza (CLAUDE.md seção 1: sem jobs sem necessidade): o pacote apaga a sessão vencida quando ela é lida e faz coleta probabilística de sessões vencidas (padrão 2% das escritas). Se o volume de linhas antigas virar problema, a limpeza será proposta em novo ADR.

### Sessão: rotação do identificador

- **No login:** sempre é gerado um identificador novo. Qualquer identificador que o navegador já tenha enviado é descartado, e nunca é promovido a sessão autenticada (evita *session fixation*).
- **Após o login**, a sessão é etiquetada com o id do usuário (*session tagging*), pois o guard regenera o identificador durante o `login()`.
- **Na troca de senha** (`PATCH /auth/password`): o identificador da sessão atual é rotacionado e **todas as outras sessões do usuário são revogadas** (`tagged` e `destroy`). O `login_at` é **preservado**: trocar a senha não reinicia o limite absoluto de 12 horas.
- A mesma revogação das outras sessões ocorre quando o `owner` ou o `platform_admin` gera nova senha temporária para um usuário (reset-password) e quando o `owner` desativa um `staff`.

### Sessão: revogação no logout

- `POST /auth/logout` apaga a linha da sessão no servidor e instrui o navegador a remover o cookie.
- Como a validade é decidida pelo servidor, um cookie copiado antes do logout deixa de funcionar: a requisição seguinte responde `401`.
- O logout atinge apenas a sessão atual. Encerrar as demais sessões do usuário só ocorre nos casos da seção anterior.

### CSRF: validação de `Origin` (mecanismo obrigatório)

Um middleware próprio, simples e explícito, é aplicado a **todo método que altera estado** (`POST`, `PUT`, `PATCH` e `DELETE`) em `/api/v1`, com a única exceção descrita adiante.

**Origem confiável**
- A única origem confiável é a configurada na variável de ambiente `APP_URL`, que contém esquema, host e porta (por exemplo `https://cardapio.exemplo.com`; em desenvolvimento, `http://localhost:3000`).
- A origem não é derivada de `Host`, `X-Forwarded-Host`, `Referer` nem de qualquer outro dado da requisição.
- Em produção, `APP_URL` deve usar `https`. Não há segunda origem nem lista de origens na v1.

**Comparação exata**
- O valor do header `Origin` é comparado, **por igualdade exata de texto**, com a origem de `APP_URL` normalizada (esquema e host em minúsculas, sem barra final, sem caminho; porta padrão omitida).
- Não há curinga, comparação por prefixo ou sufixo, subdomínios, nem `startsWith` ou `includes`. `https://cardapio.exemplo.com.atacante.com` e `http://` no lugar de `https://` são recusados.
- Qualquer valor que não coincida exatamente é recusado, inclusive `null`.

**Resultado**
- `Origin` ausente, vazio, `null` ou diferente: `403 FORBIDDEN`, e a requisição não chega ao controller. Não há alternativa por `Referer`.
- Métodos seguros (`GET`, `HEAD`, `OPTIONS`) não alteram estado e não podem ser usados para isso.
- O login (`POST /auth/login`) também passa pelo middleware, o que evita *login CSRF*.

**Exceção `/public`: restrita a rotas sem cookie de sessão**
- Somente rotas sob `/public` ficam fora do middleware, e somente enquanto **não** usam autenticação por cookie: o grupo `/public` não registra o middleware de sessão nem de autenticação e não lê o cookie de sessão. A exceção existe porque essas rotas não têm credencial ambiente que um site de terceiros possa explorar.
- Uma rota que passe a ler a sessão não pode ficar em `/public`. Deve ir para `/tenant` ou `/platform`, ou para outro grupo protegido.
- Hoje a exceção cobre `GET /public/restaurants/:slug`, `POST /public/restaurants/:slug/orders` e `GET /public/orders/:trackingToken`.

**Por que `Origin` basta, e por que não há token CSRF**
- Navegadores enviam `Origin` em `POST`, `PUT`, `PATCH` e `DELETE`, e uma página de outro site não consegue forjá-lo. `SameSite=Lax` é defesa em profundidade, não o controle principal. Token CSRF não será adotado na v1, para evitar estado extra no cliente. Se um caso real exigir, será proposto em novo ADR.

### Ordem de implementação

- **F2-T3 não é concluída sem o middleware de `Origin` registrado no grupo de rotas** que contém login, logout e troca de senha. Nenhuma rota autenticada que altere estado pode existir sem ele.
- **F2-T4** cobre o middleware com os testes abaixo e verifica que **todas** as rotas existentes que alteram estado estão protegidas.
- Toda rota nova que altere estado nas fases seguintes entra no mesmo grupo e herda o middleware.

### Testes obrigatórios

**Sessão (F2-T3)**
1. Login válido cria a sessão e o cookie com `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`; `Secure` verificado na configuração de produção.
2. O cookie contém só o identificador (nenhum dado do usuário) e a linha existe na tabela de sessões.
3. Login gera identificador novo; um identificador enviado antes do login não vira sessão autenticada (fixation).
4. Sessão sem atividade além do limite de inatividade responde `401` e a linha é removida.
5. Sessão acima do limite absoluto responde `401`, mesmo com atividade recente.
6. Atividade dentro do limite de inatividade não prorroga além do limite absoluto.
7. Logout apaga a sessão no servidor; reutilizar o cookie copiado responde `401`.
8. Troca de senha rotaciona o identificador atual, preserva `login_at` (o limite absoluto não reinicia) e revoga as demais sessões do usuário; reset-password e desativação de `staff` revogam as sessões do usuário afetado.
9. Vínculo desativado nega o acesso ao restaurante na requisição seguinte, com a sessão ainda válida.

**CSRF e origem (F2-T3 e F2-T4)**
10. Para cada método que altera estado (`POST`, `PUT`, `PATCH`, `DELETE`), em rota autenticada: `Origin` correto passa; ausente, vazio, `null` e de outro site respondem `403` sem alterar dados.
11. Comparação exata: subdomínio, domínio com sufixo extra, esquema diferente, porta diferente, `Origin` com caminho e barra final indevida são recusados; a normalização documentada (esquema e host em minúsculas) é aceita.
12. `Referer` correto sem `Origin` continua recusado.
13. O login sem `Origin` válido responde `403` (*login CSRF*).
14. Métodos seguros (`GET`) não exigem `Origin`.
15. Teste de tabela de rotas: toda rota que altera estado, fora de `/public`, tem o middleware; o teste falha se uma rota nova ficar sem ele.
16. Rotas de `/public` não leem o cookie de sessão: uma requisição com cookie de sessão válido é tratada exatamente como sem cookie.

**Rate limit**
17. Login excedendo 5 tentativas por minuto por IP e identificador responde `429`; o contador é reiniciado ao reiniciar o processo (comportamento documentado).

### Rate limit em memória

- Contadores em memória do processo, com **uma única instância da API** (PEND-15). Reiniciar o processo zera os contadores. Revisar a estratégia antes de escalar para mais de uma instância.
- Limites iniciais, configuráveis por ambiente: login 5/min por IP e identificador de usuário; criação de pedido 5/min por IP e restaurante; acompanhamento 30/min por IP.
- O Nginx aplica limites de conexão e requisição como defesa complementar, sem substituir a aplicação.
- O IP real depende do proxy confiável configurado no AdonisJS e no Nginx. Isso deve ser conferido em F6-T4, para que o limite não se aplique ao IP do proxy.

## Consequências

- A tabela `sessions` consta no modelo de dados do ROADMAP (seções 4.2 e 4.3) e é criada em F2-T1 pela migration gerada pelo próprio pacote. Ela é infraestrutura de autenticação, não guarda dados de restaurante e não tem `restaurant_id`.
- Os pacotes `@adonisjs/auth` e `@adonisjs/session` são oficiais do AdonisJS e entram na Fase 2. A verificação do esquema e do *tagging* foi feita contra `@adonisjs/session` 8.3.0 (AdonisJS 7); em F1-T2 deve-se conferir a versão gerada pelo scaffold e repetir a verificação se for outra.
- Sem CORS, o frontend chama `/api/v1/...` por caminho relativo, sem `credentials` especiais.
- Em desenvolvimento, `APP_URL` precisa coincidir exatamente com a origem do Next.js. O `.env.example` documentará isso.
- Clientes que não são navegadores (por exemplo `curl` e testes automatizados) precisam enviar `Origin` nas rotas protegidas. Os testes Japa farão isso.
- Se o pacote de sessão do AdonisJS não oferecer algum requisito acima (por exemplo, revogar todas as sessões de um usuário), a lacuna será resolvida em F2-T3 com o menor código possível e registrada em adendo a este ADR.
