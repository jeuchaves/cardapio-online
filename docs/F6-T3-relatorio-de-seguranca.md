# F6-T3: relatório de revisão de segurança

- Data: 2026-11-16
- Base revisada: commit `2838ad0` (branch `feat/fase-6-quality-deploy`)
- Pacote A implementado: commit `68c6a23`
- Referências: `CLAUDE.md` seções 5 a 9 e 12; ROADMAP seções 6 e 7; ADRs 0002 a 0004
- Método: revisão estática do código, da configuração e do histórico Git, mais execução das suítes existentes. Sem varredura dinâmica e sem infraestrutura de produção.

## 1. Resumo

Não foi encontrada falha explorável nos controles centrais (autenticação, sessão, CSRF, autorização, isolamento entre restaurantes, upload e logs). O achado mais sério, **S-01**, é de configuração e só aparece atrás de um proxy: ele bloqueia a produção até o `trustProxy` ser configurado e testado.

| ID | Severidade | Tipo | Resumo | Situação |
| --- | --- | --- | --- | --- |
| S-01 | **Alta** | C+I | `trustProxy` ausente: todos os clientes dividem um IP atrás do Nginx | **Aberto. Bloqueia a produção atrás de proxy** (F6-T4) |
| S-02 | Média | C | Nenhum header de segurança em nenhuma camada | **Parcialmente resolvido** (pacote A); o restante na F6-T4 |
| S-03 | Baixa-média | C | Custo do hash de senha (scrypt) abaixo da recomendação atual | Aberto; decisão técnica na seção 7 |
| S-04 | Baixa | C | Upload valida só a assinatura e não remove metadados; escrita temporária antes da autenticação | Parcialmente resolvido (CSP em `/uploads`); resto na F6-T4 |
| S-05 | Baixa | C | 2 vulnerabilidades transitivas (`minimatch`, `deepmerge`) | Aceito sem `override`; acompanhar upstream |
| S-06 | Info | D | `platform_admin` recebe a senha temporária do `owner` | **Risco não aceito; aberto** para solução futura |
| S-07 | Info | i | Skills de terceiros versionadas (3.482 arquivos, com scripts) | Aberto (F6-T4: `.dockerignore`) |
| S-08 | Info | I | Nada garante `NODE_ENV=production` e `APP_URL` em https | Aberto (checklist de implantação) |
| S-09 | Info | D | O `owner` descobre se um e-mail existe na plataforma | **Aceito provisoriamente** (ROADMAP 5.2) |

Legenda: **C** confirmado no código; **I** depende de infraestrutura; **D** consequência do desenho; **i** informativo.

## 2. Achados

### S-01 (Alta): `trustProxy` ausente

- **Evidência:** `apps/api/config/app.ts` não define `trustProxy`. O padrão do `@adonisjs/http-server` 9.3.1 é `proxyaddr.compile("loopback")`, ou seja, só confia em `127.0.0.1` e `::1`. `request.ip()` alimenta quatro limites: login, pedido, cotação e acompanhamento (`auth_controller.ts`, `public_orders_controller.ts`, `public_cart_controller.ts`, `public_tracking_controller.ts`).
- **Impacto:** com o Nginx em outro container (IP fora de loopback), todos os clientes compartilham um contador:
  - 20 logins por minuto no total, para todos os usuários, e qualquer pessoa trava o login de todos com 20 requisições;
  - 5 pedidos por minuto por restaurante, somando todos os clientes;
  - 30 consultas de acompanhamento por minuto no sistema inteiro, apesar de a tela recarregar sozinha.
- **Risco inverso:** confiar em qualquer origem permite forjar `X-Forwarded-For` e burlar todos os limites.
- **Correção prevista (F6-T4):** `trustProxy` restrito à rede do Nginx; Nginx sobrescrevendo `X-Forwarded-For` com `$remote_addr`; teste Japa que prove o IP real e teste na topologia de homologação. Se o Nginx rodar no host e a API ouvir só em `127.0.0.1`, o padrão já bastaria; a topologia depende da decisão D1.
- **Decisão:** bloqueio para produção atrás de proxy até a configuração e os testes de `trustProxy`.

### S-02 (Média): headers de segurança ausentes

- **Evidência:** não há `@adonisjs/shield`. O Next só define headers na rota do token (`/r/:slug/pedido/:token`). Só `/uploads` enviava `X-Content-Type-Options`. O Next anunciava `X-Powered-By`.
- **Impacto:** sem HSTS, sem proteção contra clickjacking (telas de login e painel podem ser embutidas em iframe), sem `Permissions-Policy`, sem `nosniff` nas respostas da API e sem CSP.
- **Resolvido (pacote A, `68c6a23`):** `poweredByHeader: false` no Next.
- **Pendente (F6-T4, no Nginx):** HSTS, `nosniff`, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy` padrão (a rota do token continua com `no-referrer`), `Permissions-Policy` e CSP em modo Report-Only.

### S-03 (Baixa-média): custo do hash de senha

- **Evidência:** `apps/api/config/hash.ts` usa scrypt com N=16384, r=8, p=1 e `maxMemory` de 32 MiB (cost 1024 nos testes). A recomendação atual da OWASP é N=2^17 com p=1 ou equivalentes (2^16 com p=2; 2^15 com p=3).
- **Impacto:** só importa se o banco ou os backups vazarem, quando o custo define a resistência a quebra offline. Não é explorável online, porque o login tem rate limit.
- **Decisão técnica:** ver seção 7. Nenhuma alteração foi feita nesta etapa.

### S-04 (Baixa): upload

- **Evidência:** `apps/api/app/support/images.ts` valida os primeiros 8 a 12 bytes, a extensão e o MIME informados. Não re-codifica a imagem nem remove EXIF. O bodyparser grava até 6 MB em disco nas duas rotas de imagem antes de autenticar, e o `cleanupUploads` apaga ao fim.
- **Mitigações existentes:** `Content-Type` definido pela extensão da chave, `nosniff`, sem SVG, nome gerado pelo servidor, caminho por restaurante, só chaves no formato exato.
- **Impacto:** um arquivo poliglota é aceito, mas servido como imagem e não executa. Fotos de produto e logo podem publicar metadados de GPS. Requisições não autenticadas podem escrever temporariamente em disco.
- **Resolvido (pacote A):** `Content-Security-Policy: default-src 'none'; sandbox` em `/uploads`.
- **Pendente:** `client_max_body_size` de 6 MB só nas duas rotas de imagem e `limit_req` no Nginx (F6-T4). Remover EXIF exigiria uma biblioteca de imagem e fica como decisão de dependência futura.

### S-05 (Baixa): dependências

| Pacote | Versões afetadas | Corrigida em | Severidade | Advisory | Caminho |
| --- | --- | --- | --- | --- | --- |
| `minimatch` | >=7.0.0 <11.0.1 | >=11.0.1 | Moderada | GHSA-g3hv-75wg-m249 | `apps/api > @adonisjs/auth@10.1.0 > @adonisjs/core@7.6.0 > @adonisjs/application@9.1.1 > @adonisjs/assembler@8.6.0 > …` |
| `deepmerge` | >=4.2.0 <=4.3.1 | **sem versão corrigida** | Baixa | GHSA-gcqx-w48m-w2h4 | `apps/api > @adonisjs/auth@10.1.0 > @adonisjs/lucid@22.4.2 > deepmerge@4.3.1` |

- Ambas vêm de dependências transitivas de `@adonisjs/*`. Pelo caminho, o uso parece ser de configuração e build, e não de entrada de usuário. **O uso interno nos pacotes não foi verificado.**
- **Decisão:** não utilizar `pnpm override`. Manter as versões atuais, acompanhar as atualizações de `@adonisjs/*` e reavaliar com `pnpm audit` a cada atualização e no checklist de implantação.

### S-06 (Info, risco não aceito): acesso do `platform_admin` aos dados do `owner`

- **Evidência:** `POST /platform/restaurants/:id/owner/reset-password` devolve a senha temporária ao `platform_admin` (ROADMAP 8.2). Com ela, ele entra como `owner`, vê pedidos e dados pessoais dos clientes e troca a senha no primeiro acesso, o que contorna na prática a regra APR-04. A ação gera log de auditoria e exige troca de senha, mas isso não impede o acesso.
- **Decisão:** **risco não aceito.** Manter aberto para uma solução futura que separe a operação administrativa da autenticação do `owner`.

### S-07 (Info): skills de terceiros no repositório

- **Evidência:** `.agents/` e `.claude/` somam 3.482 arquivos versionados, incluindo scripts `.mjs`. Não fazem parte da aplicação.
- **Ação (F6-T4):** o `.dockerignore` deve excluí-los das imagens.

### S-08 (Info): ambiente de produção

- **Evidência:** `secure` do cookie de sessão e do cookie HTTP depende de `app.inProduction`, e `APP_URL` aceita http em qualquer ambiente.
- **Ação (checklist de implantação):** conferir `NODE_ENV=production` e `APP_URL` em https antes de abrir ao público.

### S-09 (Info, aceito provisoriamente): enumeração de e-mail

- **Evidência:** `owner` criando `staff` com e-mail já existente recebe `409 EMAIL_TAKEN` (`staff_controller.ts`).
- **Decisão:** aceito provisoriamente, conforme o contrato atual da ROADMAP 5.2. Permanece documentado como risco conhecido.

## 3. Controles revisados sem achados

| Área | Verificação |
| --- | --- |
| Sessão | Identificador regenerado no login, `login_at` fixo, limite absoluto validado no servidor, logout destrói a linha da sessão, revogação por etiqueta (`session_control.ts`, `absolute_session_middleware.ts`, `auth.spec.ts`). |
| CSRF | `Origin` por igualdade exata, aplicado antes da sessão em todos os grupos autenticados; teste que percorre a tabela de rotas (`csrf.spec.ts`). |
| Autorização e IDOR | Vínculo ativo consultado a cada requisição; todas as rotas de `/tenant` e `/platform` exigem autenticação; perfil `owner` verificado em middleware. |
| Multi-tenancy | Cerca de 45 consultas por id nos controllers e em `support/` revisadas. Todas carregam `restaurant_id` do tenant validado; as exceções (plataforma, login, acompanhamento por token) são deliberadas. Testes em `menu_isolation`, `orders_isolation`, `tables`, `tenant`. |
| Login | Mensagem única, hash executado mesmo sem usuário, limite antes da consulta. |
| Senhas temporárias | `crypto.randomInt`, 16 caracteres de um alfabeto de 55 (cerca de 92 bits), `no-store`, nunca em log. |
| SQL | Consultas parametrizadas; só 3 usos de SQL manual, todos com parâmetros. |
| Logs | A aplicação não registra requisições. Registra só erros sanitizados, auditoria (14 ações, ver `audit_log.spec.ts`) e falha de imagem. O `redact` do Pino cobre token, telefone, nome e observações. |
| Frontend | Sem `dangerouslySetInnerHTML`, `eval`, scripts de terceiros, `target=_blank` nem `console`. O `localStorage` guarda só o carrinho e a mesa. A página do token tem `no-store`, `no-referrer` e `noindex`. |
| Segredos | O histórico só tem `.env.example` e `.env.test` (valores de teste); a senha nos arquivos versionados é o placeholder `troque-esta-senha`. `.env.*` está ignorado, inclusive `.env.production`. Nenhum segredo real encontrado no histórico. |
| Erros | 500 genérico em produção (`debug = !inProduction`); `/health` sem detalhes. |
| Banco | Compose de desenvolvimento publica o Postgres só em `127.0.0.1`; senha obrigatória. |

## 4. Itens que dependem da infraestrutura

Os resultados locais não comprovam nenhum destes controles em produção. Todos continuam abertos para a F6-T4, F6-T5 e F6-T8.

1. **`access_log` do Nginx:** o token está no caminho (`/r/:slug/pedido/:token` e `/api/v1/public/orders/:token`). A redação precisa ser implementada e comprovada.
2. **`error_log` do Nginx:** em erros de upstream ele imprime `request: "GET /…token…"`. A estratégia **não pode simplesmente suprimir erros importantes**, por exemplo baixando para `crit`, sem demonstrar como a operação continuará detectando falhas (por exemplo, 502 e 504 no `access_log`, healthchecks e alertas). A redação deve ser comprovada com **token sentinela no `access_log`, no `error_log` e nos logs dos containers**.
3. **`Secure` do cookie atrás de HTTPS e proxy:** o teste local só prova que o atributo acompanha `app.inProduction`.
4. **IP real atrás do Nginx:** S-01.
5. **Driver S3:** não instalado nem validado contra nenhum provedor (adendo do ADR 0003); o bucket precisa ter leitura pública sem listagem e sem escrita anônima (decisão D2).
6. **Rate limit em memória:** zera a cada reinício ou deploy e só vale para uma instância (ADR 0004).
7. **Chamada servidor a servidor do Next à API** com o token na URL: deve usar a URL interna; se passar pelo Nginx, o caminho precisa casar com a regra de redação.
8. **Backups:** contêm dados pessoais e hashes de senha; exigem criptografia e acesso restrito (F6-T5).
9. **Postgres de produção:** não publicar porta.

## 5. Limitações desta auditoria

- Revisão estática: sem varredura dinâmica (DAST), sem teste de intrusão e sem análise de tráfego real.
- Não foi verificado o uso interno de `minimatch` e `deepmerge` dentro dos pacotes.
- O comportamento atrás de Nginx, TLS e proxy não foi observado.
- As medições de custo do hash foram feitas em um notebook (Intel i5-6300U, 2 núcleos, 7,9 GB, Node 26), que não representa o servidor de produção.
- Dependências foram avaliadas pelo `pnpm audit` na data acima; novas vulnerabilidades podem surgir.

## 6. Pacote A (implementado e validado)

Commit `68c6a23`, `🔒 fix: hide X-Powered-By and add CSP to uploads`:

| Arquivo | Mudança |
| --- | --- |
| `apps/web/next.config.ts` | `poweredByHeader: false` |
| `apps/api/app/controllers/uploads_controller.ts` | `Content-Security-Policy: default-src 'none'; sandbox` em `/uploads` |
| `apps/api/tests/functional/images.spec.ts` | O teste de leitura pública exige o CSP exato para JPEG, PNG e WebP |
| `apps/web/e2e/order-flow.spec.mjs` | Teste E2E: `/r/:slug`, `/entrar` e rota inexistente não devolvem `X-Powered-By` |

Validação: `pnpm lint`, `pnpm typecheck` e `prettier --check` passaram; `pnpm test` com 334 de 334; E2E com 14 de 14. Prova negativa do teste E2E: com `poweredByHeader` reativado, o teste falha com `Received: "Next.js"`.

## 7. Decisões desta etapa

| Tema | Decisão |
| --- | --- |
| S-05 | Sem `pnpm override`. Acompanhar `@adonisjs/*` e reavaliar com `pnpm audit`. |
| S-06 | Risco não aceito. Manter aberto para solução futura que separe a operação administrativa da autenticação do `owner`. |
| S-09 | Aceito provisoriamente (ROADMAP 5.2). |
| S-01 | Bloqueio para produção atrás de proxy até a configuração e os testes de `trustProxy`. |
| S-02 | Pacote A resolve apenas `X-Powered-By`; os demais headers permanecem para a F6-T4. |
| Pacotes B e C | Reservados para a F6-T4. |
| `error_log` | Não suprimir erros importantes sem demonstrar a detecção de falhas; redação comprovada com token sentinela (seção 4, item 2). |

### Scrypt (S-03): decisão técnica registrada, sem implementação

Nenhum arquivo foi alterado. `config/hash.ts` permanece como está; rehash, limitador de concorrência e limite global de hashes **não** foram implementados.

- **Opção preferencial para avaliação:** N=2^17, r=8, p=1. Em Node, `p` maior que 1 roda em sequência e só aumenta o tempo, então 2^17 com p=1 oferece o nível da recomendação com latência previsível.
- **`maxMemory` de 256 MiB:** **não aprovado.** Valor apenas sugerido (o dobro dos 128 MiB necessários por hash).
- **Medição de referência** (notebook, 7 amostras por configuração, processo isolado; não representa produção):

| N, r, p | Memória por hash | Mediana | 16 hashes simultâneos | Pico RSS |
| --- | --- | --- | --- | --- |
| 2^14, 8, 1 (atual) | 16 MiB | 94 ms | 0,47 s | 105 MB |
| 2^15, 8, 1 | 32 MiB | 129 ms | 0,98 s | 168 MB |
| 2^15, 8, 3 | 32 MiB | 374 ms | 2,4 s | 169 MB |
| 2^16, 8, 2 | 64 MiB | 534 ms | 3,3 s | 296 MB |
| 2^17, 8, 1 | 128 MiB | 545 ms | 3,9 s | 552 MB |

- **Verificado com o driver real do AdonisJS:** o driver com parâmetros novos verifica hashes antigos e `needsReHash` os detecta. O inverso (driver antigo verificando hash novo) devolve `false`: reverter a configuração para um `maxMemory` menor deixa sem acesso quem já foi rehasheado. A regra é nunca baixar o `maxMemory` abaixo do maior custo já usado.
- **Condições antes da decisão final:**
  - repetir a medição com **Node.js 24, no servidor de produção ou em ambiente representativo** (D1);
  - avaliar a memória do container (a API roda no máximo 4 hashes simultâneos no pool de threads, o que dá um teto de cerca de 4 vezes a memória por hash) e a **concorrência de autenticação**;
  - **definir a estratégia de rehash antes de futuras mudanças de parâmetros** (o `withAuthFinder` não faz rehash no login; `hash.needsReHash` existe no driver).
- **Prioridade:** como ainda não há usuários reais em produção, **configurar corretamente antes da criação das primeiras contas**, o que evita a necessidade de migração dos hashes.
- **Restrição:** não reduzir o custo do hash por conveniência sem evidência técnica.

## 8. Pendências para as próximas fases

| Fase | Pendência |
| --- | --- |
| Antes da F6-T4 | D1 (servidor, sistema operacional, domínio e DNS) e D2 (provedor S3 ou volume). Decisão sobre o scrypt (seção 7). |
| F6-T4 | S-01: `trustProxy` com teste. S-02: demais headers e CSP Report-Only. Redação de `access_log` e `error_log` com teste do token sentinela, incluindo logs dos containers. Limites de corpo por rota e `limit_req`. `.dockerignore` (S-07). Checagem de ambiente (S-08). `mem_limit` da API. |
| F6-T5 | Backup criptografado com acesso restrito; restauração testada. |
| F6-T8 | Verificar em homologação: `Secure` do cookie, IP real, redação de logs, S3 ou volume. |
| Contínuo | S-05: `pnpm audit` e acompanhamento de `@adonisjs/*`. S-06: solução futura. S-09: risco conhecido. |
