# ADR 0006 — Arquitetura de infraestrutura e hospedagem

- **Status: RASCUNHO — NÃO APROVADO.** A topologia, o proxy, o storage e o domínio continuam sem decisão. **Atualização de 2026-11-17:** o responsável contratou a VPS Hostinger KVM 2 (ver "Adendo de execução"); isso não aprova o restante deste documento.
- Data do rascunho: 2026-11-17 (adendo de execução: 2026-11-17 a 2026-11-18)
- Referências: `CLAUDE.md` seções 1, 3, 5, 6, 9 e 12; ROADMAP, Fase 8 (F8-T1, F8-T2, F8-T6) e ABERTO-01 a ABERTO-08; [F6-T3](../F6-T3-relatorio-de-seguranca.md) (S-01 a S-09); [ADR 0002](0002-sessao-cors-csrf.md); [ADR 0003](0003-imagens-e-qrcode.md); [ADR 0004](0004-rate-limit.md); [pesquisa da Fase 8-A](../F8A-pesquisa-infraestrutura.md), com fontes, datas e itens não confirmados
- Numeração: o 0006 estava reservado à topologia de produção (PEND-28).
- Legenda: **[C]** confirmado em fonte do fornecedor · **[M]** medido · **[E]** estimativa · **NÃO CONFIRMADO** = sem fonte.

## Contexto

O projeto precisa ir a produção (Fase 8) com **custo recorrente total de até R$ 100,00 por mês**, incluindo VPS, armazenamento, backup, domínio rateado e monitoramento. Este é o primeiro de **4 a 6 projetos** previstos para a mesma infraestrutura. Hoje existe só um Compose de desenvolvimento com PostgreSQL; não há Dockerfile, Nginx nem Compose de produção (confirmado no repositório).

Decisões já aprovadas (PEND-28): Compose de produção separado, Next.js `standalone`, `trustProxy` restrito, headers básicos com CSP Report-Only, Node.js 24 LTS, backup por scripts e cron do host com criptografia externa, uma instância da API e rate limit em memória (ADR 0004).

## Requisitos e restrições

1. **Segurança, backup, isolamento multi-tenant e privacidade não podem ser reduzidos para caber no orçamento.**
2. Nenhuma porta pública para PostgreSQL ou API; só o Nginx em HTTP e HTTPS, mais SSH restrito.
3. O Next.js continua só com rewrites de `/api/*` e `/uploads/*` (em produção, o Nginx faz esse encaminhamento); **sem BFF**.
4. Um Compose por projeto, com contêineres e redes isolados por projeto; PostgreSQL compartilhado **somente como serviço**, com banco, usuário e credenciais independentes por projeto.
5. Builds fora da VPS; imagens imutáveis; deploy controlado.
6. Backups externos à VPS (ADR 0007).
7. Sem Kubernetes nem arquitetura distribuída sem necessidade comprovada.
8. O `tracking_token` (no caminho da URL) é tratado como segredo (ROADMAP 7.3): nem Nginx nem logs o registram; a página do token não carrega script de terceiros.

## Opções consideradas

### A. VPS única com Docker Compose atrás de Nginx (**proposta**)
- Segue o CLAUDE.md e o ROADMAP. Custo mais baixo. Operação é nossa (atualizações, backup, monitoramento). Servidor único é ponto único de falha.

### B. PaaS de contêineres
- Simplifica TLS e deploy, mas **contradiz a topologia aprovada**, muda a estratégia de IP real e `trustProxy` e **não foi pesquisada com preço**. Descartada por ora, sem evidência de que caiba em R$ 100.

### C. Cloud de grande porte (instâncias e banco gerenciados)
- Reduz operação de backup e banco, mas **não pesquisei preços** (as páginas bloqueiam leitura ou carregam por calculadora) e a expectativa é de custo acima do teto. **NÃO AVALIADA.**

## Comparação de VPS (resumo; detalhes na pesquisa)

| | HypeHost KVM 6GB | Solução Host | StartCloud | Hostinger KVM 2 |
| --- | --- | --- | --- | --- |
| Preço recorrente | R$ 89/mês [C], sujeito a IPCA e repasses (termos §14) | conflito entre páginas; termos não publicados | R$ 89,90 (6 GB) [C]; termos não publicados | R$ 77,99/mês equivalente, pago em ciclos de 24 meses (R$ 1.871,76) [C] |
| Recursos | 3 vCPU, 6 GB, disco **40 GB ou 60 GB (conflito)** | 4 GB e 60 GB (conflito de preço) | 2 vCPU, 6 GB, 100 GB | 2 vCPU, 8 GB, 100 GB |
| Datacenter | São Paulo (página do plano); Ascenty SP03 a SP05 e FTZ1 "conforme a localização contratada" (página LGPD) | São Paulo só em uma das páginas | "Brasil", cidade NÃO CONFIRMADA | "Brasil", cidade NÃO CONFIRMADA |
| Termos lidos | **sim** | **não** (links vazios) | **não** (links vazios) | **sim** |
| Risco principal | dados excluídos 3 dias após suspensão por atraso; backup do provedor em "melhor esforço" | informação ausente | informação ausente | reajuste de renovação a qualquer momento; pagamento de 24 meses de uma vez |

**Orçamento mensal total conhecido (pesquisa, seção 3):** mínimo viável R$ 62,33 (HypeHost KVM 4GB), proposta R$ 92,33 (HypeHost KVM 6GB, ciclo mensal; folga de R$ 7,67), acima do teto R$ 162,33 (HypeHost 12GB). Domínio de R$ 40/ano **NÃO CONFIRMADO no Registro.br**. Câmbio e IOF **NÃO CONFIRMADOS**.

## Proposta recomendada (NÃO APROVADA)

**Proposta de trabalho:** opção A, com a **HypeHost KVM 6GB (ciclo mensal) para o primeiro projeto**, condicionada a:
1. confirmação por escrito do disco, impostos, datacenter, backup e razão social (P-01);
2. leitura integral do contrato (P-03);
3. medições de capacidade na própria VPS dentro do período de reembolso de 7 dias, **que vale só na primeira compra** [C].

**Superada em 2026-11-17:** o responsável escolheu a Hostinger KVM 2 (ver o adendo abaixo). A proposta da HypeHost e a comparação acima ficam como histórico.

## Adendo de execução: VPS contratada (2026-11-17)

Por decisão do responsável, foi contratada a **Hostinger KVM 2** (2 vCPU, 8 GB, 100 GB NVMe, 8 TB de banda), região **Brasil**, ciclo de **24 meses**, para o primeiro projeto. As decisões abaixo continuam abertas: domínio e DNS, proxy do Cloudflare, storage de imagens, destino do backup, PostgreSQL compartilhado, gestão de segredos.

**Contratação** (fonte: carrinho e assistente de configuração da Hostinger, 2026-11-17)

| Item | Valor |
| --- | --- |
| Preço | R$ 1.031,76 pelos 24 meses (equivalente a R$ 42,99/mês, oferta Black Friday) [C] |
| Renovação anunciada | R$ 77,99/mês em ciclos de 24 meses (R$ 1.871,76 de uma vez) [C]; os termos permitem alterar taxas a qualquer momento [C] |
| Impostos | R$ 0 no carrinho; cálculo final depois do faturamento **NÃO CONFIRMADO** |
| Reembolso | 30 dias [C]; prazo para as medições de capacidade (critério 3): até **2026-12-17** (conferir a data exata no comprovante) |
| Datacenter | "Brasil"; cidade **NÃO CONFIRMADA** (o assistente indicou 38 ms contra 149 ms dos Estados Unidos, a partir da rede do responsável) |
| Backup do provedor | Backup diário pago (R$ 32,99/mês) **não contratado**, conforme o carrinho (confirmar no painel); o backup é nosso (ADR 0007) |
| Domínio grátis de 1 ano | oferecido e **não resgatado**; depende da decisão de domínio |

**Orçamento (cálculo do assistente, [E]):** R$ 42,99 mais R$ 3,33 de domínio rateado (NÃO CONFIRMADO) dá R$ 46,32 por mês nos primeiros 24 meses; na renovação, R$ 77,99 mais R$ 3,33 dá R$ 81,32, com folga de R$ 18,68 antes dos custos variáveis (R2, B2). O desembolso de R$ 1.031,76 é à vista e fica fora desse cálculo mensal.

**Estado do servidor** (executado e verificado pelo responsável em 2026-11-17 e 2026-11-18)

- Ubuntu **26.04.1 LTS** (`resolute`).
- SSH só por chave ed25519; `PermitRootLogin no` e `PasswordAuthentication no` confirmados com `sshd -T`; usuário `deploy` com `sudo` (provisório, ver pendências).
- `ufw` ativo com OpenSSH, 80 e 443 (IPv4 e IPv6); `fail2ban` (prisão `sshd`) e `unattended-upgrades` ativos.
- Docker Engine **29.10.0** e Compose **v5.8.0** do repositório oficial da Docker (o repositório publica para `resolute` [C]); backend de firewall `iptables`.
- **Proteção do bypass do `ufw` pelo Docker:** a unidade `docker-user-firewall.service` (em `/etc/systemd/system`) recria a cadeia `DOCKER-USER` depois do Docker, liberando só respostas de conexões existentes e conexões novas cuja porta publicada seja 80 ou 443 vindas de `eth0`, e descartando o resto. Verificado: uma porta 8080 publicada por contêiner de teste ficou inacessível de fora, a 80 ficou acessível, e as regras e o `ufw` permaneceram depois do reinício. As regras valem para IPv4 e para a interface `eth0`; o IPv6 do Docker permanece no padrão (desligado).

**Domínio (decidido e registrado em 2026-11-17)**

- **menubora.com.br**, registrado no Registro.br por **R$ 40,00 por ano** (valor pago, informado pelo responsável); criado em 2026-11-17 e com expiração em **2027-11-17**. Renovação anual: valor de renovação **NÃO CONFIRMADO**.
- DNS nos servidores do Registro.br (`a.auto.dns.br` e `b.auto.dns.br`), sem Cloudflare por ora (P1, P2 e P3 seguem em aberto). Zona com dois registros `A` (`menubora.com.br` e `www.menubora.com.br`) para o IP da VPS; sem `AAAA`, porque o Docker está só em IPv4.
- Verificado em 2026-11-17: ambos os nomes resolvem para o IP da VPS no resolvedor público 8.8.8.8.
- `NEXT_PUBLIC_SITE_URL` será `https://menubora.com.br` (a variável é lida no build e entra nos QR Codes; trocar o domínio depois invalida os QR Codes impressos).
- Ainda não decidido: qual dos dois nomes (com ou sem `www`) é o canônico, com redirecionamento do outro.

**Onde paramos (2026-11-17)**

- Feito: VPS contratada, endurecida e verificada; Docker e proteção `DOCKER-USER` ativos; domínio registrado e apontado.
- Acesso: SSH com usuário `deploy` e chave ed25519 protegida por passphrase. A chave privada existe só no computador do responsável; para outro dispositivo, copiar a chave por meio seguro ou gerar uma chave por máquina e acrescentá-la a `~/.ssh/authorized_keys`. Plano B: console do navegador no hPanel.
- Próximos passos, em ordem sugerida: (1) decidir storage de imagens, destino do backup e Cloudflare; (2) modelo do usuário de deploy; (3) F8-T2 (Dockerfiles, Compose de produção, Nginx e HTTPS), só por pedido explícito; (4) medições de capacidade antes de 2026-12-17.

**Pendências desta execução**

- A unidade `docker-user-firewall.service` e as configurações do SSH **não estão versionadas** no repositório; registrar na F8-T5 (documentação de implantação).
- O usuário `deploy` ainda tem `sudo`. O ADR pede um usuário de deploy sem privilégios, e o grupo `docker` equivale a acesso de root: decidir o modelo antes do primeiro deploy.
- Conferir no painel quais recursos adicionais do assistente foram marcados (Monarx, Gerenciador Docker); a recomendação é não usar o Gerenciador Docker (camada extra sobre o Compose).
- O critério de validação 4 (varredura externa) está só **parcialmente** atendido: foram testadas as portas 80 e 8080, não houve varredura completa.
- Medições de capacidade (critério 3) dentro do prazo de reembolso.

## Topologia de referência (proposta)

```
Navegador ──HTTPS──► [Cloudflare: DNS e, se aprovado, proxy]  (P1, P2 ou P3: ver abaixo)
                           │
                           ▼
VPS Linux (Brasil) ── firewall: só 80, 443 e SSH restrito
  └─ Stack compartilhada "borda"
       ├─ nginx : único serviço publicado (80/443), TLS, limites, headers, redação de logs
       └─ postgres : PostgreSQL 15+ (versão atual do projeto: 17), SEM porta publicada
  └─ Stack por projeto (um Compose por projeto, rede própria)
       ├─ web : Next.js standalone (Node 24), usuário não root, mem_limit
       └─ api : AdonisJS (Node 24), uma instância, mem_limit
Fora da VPS
  ├─ Imagens públicas: object storage compatível com S3 (ver "Armazenamento de imagens")
  └─ Backups cifrados: destino externo (ADR 0007)
```

### Isolamento entre projetos
- **Rede:** cada projeto tem sua rede Docker. O Nginx entra nas redes dos projetos que atende; web e API de um projeto **não enxergam** os de outro.
- **PostgreSQL compartilhado:** um **banco e um usuário por projeto**, sem superusuário; `REVOKE CONNECT` do papel `PUBLIC`; `pg_hba` por banco e por usuário; senhas distintas em variáveis de ambiente; o servidor ouve só na rede interna.
- **Risco aceito só se aprovado:** o PostgreSQL compartilhado é **domínio de falha comum** (I/O, memória, credencial administrativa). Alternativa: um PostgreSQL por projeto (mais isolamento, **mais RAM, estimada em 0,15 a 0,3 GB por instância [E]**).
- **Multi-tenancy do projeto** (isolamento por `restaurant_id`) **não muda** e continua coberta pelos testes de isolamento.

### Sistema operacional e acesso
- **Instalado:** Ubuntu 26.04.1 LTS (ver o adendo de execução). Ubuntu e Debian estavam disponíveis na Hostinger [C].
- Acesso por chave SSH, sem senha e sem login de root; usuário de deploy sem privilégios; `fail2ban` ou equivalente; atualizações de segurança automáticas; Docker Engine do repositório oficial; **o socket do Docker não é exposto**.
- **Cuidado conhecido:** portas publicadas pelo Docker **contornam** o firewall comum do sistema; só o Nginx publica porta, e a cadeia `DOCKER-USER` deve bloquear o resto.

### Deploy
- Build fora da VPS; imagem com tag imutável por commit; envio sem registro externo (`docker save` e `docker load` por SSH) **ou** registro privado (**exigiria conta**; decisão pendente).
- Migrations como passo explícito do deploy; `migration:rollback --force` roda em produção no Adonis e apaga tabelas, então a configuração `disableRollbacksInProduction` deve ser avaliada (não existe hoje em `config/database.ts`).
- Backup antes de cada migration.

### DNS e domínio
- Domínio `.com.br` a registrar (valor de R$ 40/ano segundo fontes de terceiros; **NÃO CONFIRMADO**). **Domínio ainda não decidido.**
- `NEXT_PUBLIC_SITE_URL` é lida no build e fixa a URL dos QR Codes (`apps/web/src/lib/public-url.ts`): o domínio precisa estar definido antes do build de produção, e trocar o slug ou o domínio invalida QR Codes impressos.

### TLS e Nginx
- TLS 1.2 ou superior; certificados Let's Encrypt (ou certificado de origem, se houver proxy); HSTS.
- Nginx: encaminha `/api/*` e `/uploads/*` à API e o resto ao Next; `client_max_body_size` de 6 MB **somente** nas duas rotas de imagem e valor baixo no restante; `limit_req`; headers de segurança e CSP Report-Only; **redação do token** no `access_log` e estratégia do `error_log` (ABERTO-04), comprovada com token sentinela.
- Entre o Nginx e a API, a conexão é interna; a API não é publicada.

### Cloudflare: proxy, só DNS ou híbrido (**NÃO DECIDIDO; P1, P2 e P3 abaixo**)

**Exposição com o proxy ligado.** O Cloudflare termina o TLS e processa, em claro: a **URL completa, incluindo o `tracking_token`** (`/r/:slug/pedido/:token` e `/api/v1/public/orders/:token`); os **cookies, incluindo a sessão do painel**; os **corpos de requisição, incluindo senha no login e nome, telefone e observações do pedido**; as **respostas** (lista de pedidos, dados do cliente); e o **IP do visitante** [C, DPA e documentação de cabeçalhos]. O DPA do Cloudflare o define como **operador**, proíbe uso para publicidade, prevê subprocessadores com aviso de 30 dias e transferências sob cláusulas contratuais da UE, do Reino Unido e da Suíça; **a página do DPA não menciona a LGPD** [C]. **É preciso análise jurídica e de privacidade antes de aprovar o proxy (P-06).**

| | P1: proxy no domínio todo | P2: Cloudflare só para DNS | P3: híbrido |
| --- | --- | --- | --- |
| Token, senha e cookie passam pelo Cloudflare | **sim** | não | não no host do app |
| Proteção DDoS e WAF do Cloudflare | sim | não (fica a proteção do provedor, a confirmar) | só no host das imagens |
| Cache de imagens | Cloudflare | cache do Nginx (`proxy_cache`) | Cloudflare, em outro subdomínio |
| IP real do cliente | `CF-Connecting-IP` mais Nginx: duas camadas | direto; mais simples | misto |
| Controles de privacidade adicionais | obrigatórios (ver abaixo) | não aplicáveis | só no subdomínio de imagens |
| Origem | exigir Authenticated Origin Pulls (mTLS, disponível no plano gratuito [C]) e restringir faixas de IP | não aplicável | idem no host proxiado |

**Controles obrigatórios se P1 ou P3 forem aprovados (cada um precisa de teste):** desligar recursos que injetam script ou reescrevem HTML (analytics, Rocket Loader, ofuscação de e-mail); regras de cache que **nunca** guardem `/api/*`, `/r/*/pedido/*` e o painel (por padrão o Cloudflare não cacheia HTML nem JSON nem respostas com `Set-Cookie` ou `no-store` [C], mas não usar "Cache Everything" no domínio todo); revisar desafios de bot que exibam script ao cliente; registrar o Cloudflare como operador na política de privacidade.

**Esta proposta não escolhe P1, P2 ou P3.**

### IP real e `trustProxy` (S-01)
- Confirmado no repositório: **`trustProxy` não está configurado** e `request.ip()` alimenta os limites de login, pedido, cotação e acompanhamento. Sem ajuste, atrás de proxy todos os clientes dividem um contador.
- Proposta: o Nginx **sobrescreve** `X-Forwarded-For` com o IP que ele vê (`$remote_addr`); a API confia **somente** na rede Docker do Nginx. Com Cloudflare, o Nginx restaura o IP de `CF-Connecting-IP` (`real_ip`) apenas para conexões vindas das faixas do Cloudflare ou autenticadas por mTLS.
- **Requer teste:** forjar `X-Forwarded-For` de fora e provar que o IP usado pelo limitador não muda; dois clientes distintos devem ter contadores distintos.

### Armazenamento de imagens
- O ADR 0003 já prevê S3 genérico. O controller `uploads_controller.ts` **já** responde `Cache-Control: public, max-age=31536000, immutable`, `nosniff` e CSP, e usa `drive.use()`, `exists()` e `getStream()`: **parece independente do disco** (a confirmar em `images.ts`, que não li). Portanto a mudança provável é de configuração do disco e variáveis, **não** do controller.
- **Candidatos:** Cloudflare R2 (US$ 0,015/GB-mês acima de 10 GB gratuitos, saída gratuita, local automático sem dica para a América do Sul [C]) ou volume local da VPS (contraria o CLAUDE.md "S3 em produção" e prende as imagens ao servidor).
- Imagens de produto e logo são dados públicos de negócio, sem dados pessoais; a localização fora do Brasil pesa pouco **para as imagens**.
- **Opção 1:** a API continua servindo `/uploads/*` lendo do storage, com cache na borda (Cloudflare em P1 ou Nginx em P2). **Opção 2:** domínio público do bucket (exige o domínio na zona Cloudflare e recriar `nosniff` e CSP por regra de transformação). **Não decidido.**
- **Dependência nova:** o driver S3 do Adonis Drive. **Exige autorização do usuário** (CLAUDE.md seção 1).

### Segurança de rede
- Firewall: só 80, 443 e SSH; SSH só por chave e restrito por origem se possível; Docker publica apenas o Nginx.
- Nenhuma porta de PostgreSQL ou API aberta; verificável por varredura externa.
- Headers: HSTS, `nosniff`, `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` e CSP Report-Only (S-02); a página do token mantém `no-store` e `no-referrer`.
- Atualizações do sistema e das imagens base com janela definida.
- Gestão de segredos (APP_KEY, senhas de banco, credenciais de storage, chave de backup): **procedimento NÃO DEFINIDO (P-16)**; nenhum segredo vai ao repositório.

### Limites de recursos (proposta; valores [E], a medir)
| Contêiner | Limite inicial sugerido | Observação |
| --- | --- | --- |
| API | 1 GB | Heap mais até 4 hashes de 128 MiB, caso N=2^17 seja adotado (ABERTO-05) |
| web (Next standalone) | 512 MB | `--max-old-space-size` ajustado |
| PostgreSQL | 768 MB | `shared_buffers` e `max_connections` pequenos |
| Nginx | 64 MB | |
| Sistema e Docker | 0,4 a 0,6 GB | |
Rotação de logs do Docker e do Nginx; swap pequeno apenas como rede de segurança.

### VPS e dimensionamento
Estimativas (todas **[E]**; só o custo de memória do scrypt é **[M]**, em notebook e Node 26, **não na VPS**): 1 projeto de 1,4 a 2,0 GB de RAM em regime; 3 projetos de 2,0 a 3,4 GB; 6 projetos de 3,2 a 5,9 GB; disco de 7 a 11 GB, de 10 a 18 GB e de 15 a 28 GB, respectivamente. **A KVM 6GB é adequada, em estimativa, para o primeiro projeto; três dependem de medição; não há evidência de que suporte seis.** Matriz completa na pesquisa, seção 4.

## Custos

Ver a matriz da pesquisa (seção 3): R$ 62,33 (KVM 4GB), **R$ 92,33 (KVM 6GB, mensal)** e R$ 162,33 (KVM 12GB) por mês, mais custos variáveis (R2 e B2 acima de 10 GB, câmbio, IPCA do provedor). **O limite de R$ 100 mostra viabilidade para o primeiro projeto e não comprova viabilidade para 4 a 6 projetos.**

## Riscos

- Hostinger: renovação de R$ 1.871,76 de uma vez a cada 24 meses; os termos permitem alterar taxas a qualquer momento e suspender ou cancelar por falha de pagamento **sem carência fixa** (§16). Exige backup externo, alerta de vencimento e caixa para a renovação.
- Histórico, HypeHost (não contratada): exclusão dos dados 3 dias após suspensão (§06) e reajuste por IPCA (§14).
- Backup do provedor em melhor esforço e com textos conflitantes.
- PostgreSQL compartilhado como domínio de falha comum.
- Servidor único; indisponibilidade enquanto se restaura.
- Exposição de dados em claro ao Cloudflare, se o proxy for aprovado.
- Capacidade não demonstrada para 3 a 6 projetos.
- Termos de Solução Host e StartCloud não publicados.
- Fornecedor de porte pequeno, com razão social a confirmar.

## Dependências

F8-T1 (esta decisão), pesquisa da Fase 8-A, ADR 0007, validação jurídica (ABERTO-01 e P-06), autorização do driver S3 (P-17), decisão de domínio (P-04), medição do scrypt (ABERTO-05), ABERTO-02 e ABERTO-03 do ROADMAP.

## Decisões pendentes (do responsável pelo projeto)

1. ~~Fornecedor e plano da VPS, ciclo de pagamento~~ **decidido em 2026-11-17: Hostinger KVM 2, 24 meses** (ver o adendo). Continua aberta a aceitação do risco de renovação (taxas alteráveis a qualquer momento e cobrança de 24 meses de uma vez).
2. Domínio e registrador.
3. Cloudflare: P1, P2 ou P3.
4. Storage de imagens: R2 ou volume; opção 1 ou 2 de entrega.
5. PostgreSQL compartilhado ou um por projeto.
6. Entrega de imagens por `docker save` ou por registro.
7. Procedimento de gestão de segredos.
8. Quais projetos entram na VPS, em que ordem, e o que fazer ao ultrapassar a capacidade (segunda VPS ou plano maior, ambos acima de R$ 100).
9. Autorização da dependência do driver S3.

## Critérios de validação antes da implementação

1. Confirmações comerciais por escrito e contrato lido.
2. Análise jurídica sobre proxy e transferência de dados concluída.
3. Em VPS de teste: scrypt em Node 24 medido; carga de 30 minutos; limites de memória sem OOM; uso de disco após vários deploys.
4. Varredura externa mostra só 80, 443 e SSH.
5. Teste de IP real e de `trustProxy` (S-01) passa.
6. Token sentinela ausente no `access_log`, no `error_log` e nos logs dos contêineres.
7. Limite de upload de 6 MB só nas rotas de imagem comprovado.
8. Restauração do backup em VPS limpa concluída (ADR 0007).
9. Este ADR revisado e aprovado pelo usuário; só então o status muda.

## Consequências (se aprovado)

- A F8-T1 fica concluída; a F8-T2 passa a ter topologia de referência.
- O ROADMAP e o `README.md` devem ser atualizados com a topologia final.
- Qualquer mudança de fornecedor, de proxy ou de PostgreSQL compartilhado exige novo ADR ou adendo.
