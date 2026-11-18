# ADR 0006 — Arquitetura de infraestrutura e hospedagem

- **Status: RASCUNHO — NÃO APROVADO** como documento completo. **Atualização de 2026-11-18:** a **arquitetura B** (proxy total da Cloudflare) está aprovada como referência, e a VPS e o domínio estão definidos (ver "Adendo — Arquitetura B" e "Adendo de execução"). **Aprovar a arquitetura não autoriza executar nenhuma mudança de infraestrutura.** Seguem em aberto, entre outros, a matriz de responsabilidade (ABERTO-21), a escolha técnica sobre o `tracking_token` (ABERTO-19), a validação jurídica e a gestão de segredos. Texto das seções antigas sobre P1/P2/P3, HypeHost e PostgreSQL compartilhado é histórico quando contradiz os adendos.
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
- DNS nos servidores do Registro.br: **`d.sec.dns.br` e `e.sec.dns.br`**, conferidos no painel pelo responsável em 2026-11-18 (este ADR registrava antes `a.auto.dns.br` e `b.auto.dns.br`, valor que não se confirmou; ver [F8-B1](../F8-B1-roteiro-inventario-dns.md)). **DNSSEC:** consulta pública de 2026-11-18 encontrou DS no `.com.br` (KeyTag 56886, algoritmo 13, digest tipo 2) e DNSKEY na zona; o painel do Registro.br não apresenta opção nem indicação de DNSSEC e a configuração administrativa **não foi confirmada**. Sem Cloudflare na data deste registro (2026-11-17); **a autoridade DNS passa à Cloudflare pela arquitetura B (2026-11-18), ainda não executada**. Zona com dois registros `A` (`menubora.com.br` e `www.menubora.com.br`) para o IP da VPS; sem `AAAA`, porque o Docker está só em IPv4.
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

## Adendo de decisões do F8-T1 (2026-11-18)

Decididas pelo responsável em 2026-11-18 (duas rodadas). O status geral do ADR continua RASCUNHO: restam a análise jurídica (ABERTO-01, P-08), a entrega de imagens Docker, a gestão de segredos, a custódia da chave `age` e as medições de capacidade.

| Decisão | Resultado | Consequência |
| --- | --- | --- |
| Cloudflare | **SUPERADO em 2026-11-18 pela arquitetura B (adendo seguinte).** Texto original: P2, sem proxy. O DNS fica no Registro.br; token de acompanhamento, senha e cookies não passam por terceiros. | Cache de imagens no Nginx (`proxy_cache`); sem DDoS/WAF do Cloudflare (proteção do provedor a confirmar); `trustProxy` e IP real sem `CF-Connecting-IP`; não se aplicam os controles obrigatórios de P1 e P3; a análise P-06 deixa de ser necessária enquanto não houver proxy. |
| Imagens em produção (D2, ABERTO-02) | **R2 mantido; a entrega foi REVISADA pela arquitetura B: `img.menubora.com.br` direto do R2, em vez da API servindo `/uploads/*`.** Texto original: Cloudflare R2, com a API servindo `/uploads/*` (opção 1). Conta e bucket só para imagens. | **Driver S3 do Adonis Drive autorizado** (P-17), a ser instalado só na F8-T2 e validado contra o R2, o que o adendo do ADR 0003 ainda exige; o controller não deve mudar, a confirmar em `images.ts`; o desenvolvimento segue em disco local. |
| Destino do backup | **Backblaze B2, cifrado com `age`** (ver ADR 0007). | Fornecedor e conta diferentes do R2 das imagens; sujeito à análise jurídica P-08. |
| PostgreSQL | **Isolado para o Cardápio Digital: container, banco, usuário e volume próprios, dentro do Compose do projeto.** Substitui a proposta de PostgreSQL compartilhado da "borda". | Sem domínio de falha comum com outros projetos; a stack compartilhada "borda" fica só com o Nginx. Custo de RAM estimado em 0,15 a 0,3 GB por projeto [E], viável nos 8 GB (ver a revisão abaixo). Cada projeto tem seu `pg_dump` e sua restauração. |
| Domínio | `menubora.com.br` (registrado). `NEXT_PUBLIC_SITE_URL=https://menubora.com.br`. | **Proposta, a confirmar:** o nome sem `www` é o canônico e o `www` redireciona (301), pois a URL dos QR Codes usa o nome sem `www`. Não confirmado pelo responsável. |
| Usuário de deploy | **Admin separado do deploy.** Um usuário administrativo com `sudo` e login interativo; `deploy` sem `sudo`, só para `docker load`, `docker compose` e migrations. | O grupo `docker` equivale a root, então a chave do `deploy` deve ser exclusiva dele e revogável. O `deploy` perde o `sudo` só depois de o admin estar criado e testado. Execução e verificação pelo responsável no servidor. |

Efeito no adendo de execução: "Próximos passos (1) e (2)" estão decididos; o item (3), F8-T2, continua só por pedido explícito.

## Adendo — Arquitetura B (proxy total da Cloudflare), aprovada em 2026-11-18

**Status:** decisão de arquitetura **aprovada pelo responsável**. **Não autoriza nenhuma execução** (DNS, nameservers, firewall, VPS, certificados, proxy, buckets). O status geral do ADR continua RASCUNHO. Substitui a P2 e a opção 1 de entrega de imagens; mantém R2, PostgreSQL isolado, B2 com `age` e a separação admin/deploy. Motivos declarados: DDoS, WAF, centralização de DNS, proxy e controles, menor exposição do IP, AOP e menos controles de rede a administrar na VPS.

### Arquitetura de referência

```
Navegador ──HTTPS──► Cloudflare (DNS autoritativo, proxy, DDoS, WAF, rate limit; TLS Full strict)
                          │ HTTPS + AOP (mTLS)
                          ▼
VPS: firewall só aceita 80/443 das faixas da Cloudflare (depois de validado) + SSH restrito
  └─ nginx (borda): valida o certificado de cliente do AOP, real_ip, headers, limites, redação de logs
       ├─ web : Next.js standalone        [edge]
       └─ api : AdonisJS, 1 instância     [edge + internal]  ──► postgres 17 (isolado) [internal]
img.menubora.com.br ──► Cloudflare (proxy, cache) ──► bucket R2 de imagens (público, só imagens)
api ──S3──► R2 (grava e apaga)        backup ──age──► Backblaze B2 (outra conta e outro fornecedor)
```

| Item | Decisão |
| --- | --- |
| Registro do domínio | Registro.br (mantido) |
| DNS autoritativo | Cloudflare Free (troca de nameservers; ver a ordem em "Implantação") |
| Proxy | Ligado para a aplicação, a API (conforme ABERTO-17) e as imagens |
| TLS | Full (strict); certificado de origem a decidir (ABERTO-21) |
| AOP | Habilitado e validado; **por zona, com certificado próprio** (prova que a conexão vem da sua conta; o AOP global não prova) |
| WAF e rate limit | Conforme o plano Free; **limites do plano não conferidos** (os números citados antes são [E]) |
| Origem | Nginx na entrada; PostgreSQL sem exposição; SSH restrito; nenhum serviço administrativo público |

### Domínios

| Nome | Uso | Situação |
| --- | --- | --- |
| `menubora.com.br` | Aplicação web e domínio canônico | **Canônico confirmado pelos documentos e pelo código:** `NEXT_PUBLIC_SITE_URL` e as URLs dos QR Codes usam este nome, e `APP_URL` precisa coincidir **exatamente** com o `Origin` (ADR 0002). Nenhum QR Code impresso é afetado. |
| `www.menubora.com.br` | Redirecionamento 301 para o canônico | Proxiado, com o redirecionamento feito em **um só lugar**: a Cloudflare, na proposta da matriz (M15, aguarda aprovação). |
| `api.menubora.com.br` | API ("API/BFF") | **NÃO CRIADO (decidido em 2026-11-18, ABERTO-17):** a API continua em `/api`, na mesma origem. Não há BFF. |
| `img.menubora.com.br` | Distribuição das imagens pelo R2 | Compatível, **somente com a zona na Cloudflare** (domínio personalizado do R2 exige a zona na mesma conta [C]). |

### Imagens e upload

- Bucket de imagens **separado** de qualquer backup; contém só imagens públicas de produto e logo. O domínio público torna **todo objeto do bucket legível por quem souber a chave**; as chaves têm UUID e não há listagem. Nenhum dado pessoal de pedido vai ao bucket.
- A API continua gravando e apagando no R2 pelo driver S3. `UPLOADS_PUBLIC_BASE` passa a ser `https://img.menubora.com.br`, o que **não exige migration**, pois o banco guarda só a chave (ADR 0003).
- **Upload direto do frontend por URL pré-assinada: não adotado (decidido, ABERTO-18).** A arquitetura atual não permite sem redesenho: o ADR 0003 exige validação do conteúdo pelos bytes, 5 MB, nome e caminho gerados pelo servidor e remoção do arquivo anterior, tudo hoje na API. Um PUT direto ao R2 não passa por essa validação, exigiria CORS no bucket e uma verificação posterior. O upload continua passando pela API.
- Cabeçalhos da resposta de imagem (`nosniff`, CSP restritiva, `Cache-Control`): hoje vêm do controller de `/uploads`, que deixa de estar no caminho. Precisam ser reproduzidos no objeto (metadados no upload) ou por Transform Rules; **a validação do driver S3 contra o R2 deve verificar `Content-Type` e `Cache-Control` gravados.**
- Imagem removida continua entregue pelo cache de borda até a expiração ou a purga da URL (imagens públicas, sem dados pessoais).

### Privacidade e LGPD (pendências; nenhuma conformidade é declarada)

O responsável tem ciência de que a Cloudflare termina o TLS e processa o conteúdo das requisições, e de que a adoção da arquitetura B **não dispensa** as obrigações da LGPD. Pendências, todas **abertas** e que exigem **avaliação profissional especializada** onde indicado:

1. Termos de tratamento de dados da Cloudflare (DPA como operador; a página do DPA não cita a LGPD [C]). **Avaliação jurídica necessária** (P-06).
2. Mecanismo aplicável à transferência internacional de dados (Cloudflare e Backblaze). **Avaliação jurídica necessária** (P-08).
3. Documentar os fornecedores envolvidos: Hostinger, Cloudflare (DNS, proxy, R2) e Backblaze.
4. Revisar a política de privacidade e registrar a Cloudflare como operador.
5. Retenção e exclusão (ABERTO-01, F8-T4).
6. Evitar dados pessoais em logs, URLs e identificadores.

**Inconsistência a corrigir na orientação recebida:** a orientação diz que o fluxo coleta apenas nome e telefone. O ROADMAP (seção 7) registra também **observações livres** (até 500 caracteres, que podem conter dados pessoais), nome e e-mail dos usuários administrativos, hash de senha, e o **endereço de entrega** quando a entrega for implementada (PEND-47). Além disso, **a Cloudflare passa a ver o `tracking_token` (na URL), o cookie de sessão, a senha no login e o IP do visitante**. A lista de pendências deve partir do ROADMAP, não só de nome e telefone.

### Conflitos com decisões anteriores

| Decisão anterior | Conflito | Situação |
| --- | --- | --- |
| P2 (este ADR, adendo anterior) e PEND-51 | Substituídas pela arquitetura B | Revisadas; a PEND-52 registra a mudança |
| "Opção 2 descartada" e Nginx como cache de `/uploads` | A opção 2 é a adotada; o cache do Nginx para imagens deixa de existir | Revisadas |
| P-06 "análise jurídica antes de aprovar o proxy" | Proxy aprovado sem a análise | **Mantida como pendência que bloqueia dados reais de clientes e a publicação (F8-T6)**, não a configuração técnica; confirmar com o responsável (ABERTO-19) |
| Requisito 8 deste ADR e ROADMAP 7.3: "nem Nginx nem logs registram o `tracking_token`" | A Cloudflare vê a URL completa (painel de eventos de segurança e análises); **a redação não é controlável do nosso lado** | **Inconsistência sem solução técnica comprovada.** Decisão necessária (ABERTO-19): aceitar e documentar, ou mudar o token para fora da URL (alteração de contrato da API; não proposta aqui) |
| ADR 0002: mesma origem, sem CORS, cookie sem `Domain`, `APP_URL` único | `api.menubora.com.br` é outra origem | **Resolvido (ABERTO-17):** `/api` na mesma origem; o ADR 0002 não muda |
| CLAUDE.md seção 3: "sem BFF"; ADR 0006 requisito 3 | O texto "API/BFF" | Não há BFF; a API continua no AdonisJS. Confirmar o texto |
| ADR 0003: upload validado pela API | Upload pré-assinado | **Resolvido (ABERTO-18):** upload continua pela API |
| ADR 0004 e S-01: `request.ip()` e `trustProxy` | Há dois saltos (Cloudflare e Nginx) | Revisar na F8-T2 (`real_ip` condicionado ao AOP) |
| ADR 0006, topologia anterior (VPS exposta, `docker-user-firewall.service` aceitando 80/443 de qualquer origem) | O firewall deve passar a aceitar só as faixas da Cloudflare | Mudança só depois da validação (regra obrigatória abaixo) |

### Duplicação de tratamentos (primeira versão; **substituída pela matriz de responsabilidade** da seção "Decisões de 2026-11-18")

Cada controle precisa de **um responsável principal**; a coluna "Proposta" era só uma sugestão. A matriz abaixo no ADR é a referência.

| Tratamento | Onde pode existir | Proposta |
| --- | --- | --- |
| Rate limit | Cloudflare (Free permite poucas regras [E]), `limit_req` do Nginx, limiter da aplicação (ADR 0004) | Aplicação e Nginx continuam como controle fino; Cloudflare só contra inundação. Os três dependem do IP real |
| Cabeçalhos de segurança (HSTS, `nosniff`, `Referrer-Policy`, CSP) | Cloudflare, Nginx, Next.js | Um único dono (Nginx); no `img`, Transform Rules ou metadados |
| HTTP para HTTPS e `www` para canônico | Cloudflare e Nginx | Um só lugar; sem laço de redirecionamento |
| Certificado de origem | Let's Encrypt (exige porta 80 e renovação) ou Cloudflare Origin CA (sem renovação frequente, só confiável para a Cloudflare) | A decidir; o Origin CA dispensa a porta 80 |
| IP real | `CF-Connecting-IP`, `X-Forwarded-For`, `trustProxy` | Nginx restaura o IP só de conexão com AOP válido e sobrescreve `X-Forwarded-For`; a API confia só na rede do Nginx |
| Restrição da origem | Firewall com faixas da Cloudflare **e** AOP | Os dois (camadas diferentes); lista de faixas com fonte e atualização únicas |
| Cache | Cloudflare, Nginx, cabeçalhos da aplicação (`no-store`) | Sem cache de `/api/*`, painel e `/r/*/pedido/*` em nenhuma camada; remover o cache do Nginx para imagens |
| Limite de corpo | Cloudflare (Free permite corpos grandes [E]), Nginx (6 MB só nas rotas de imagem), bodyparser (6 MB) | Nginx e aplicação com o mesmo valor |
| Entrega de imagem | Rota `/uploads/*` e o rewrite do Next, mais `img.menubora.com.br` | Em produção só o `img`; a rota continua em desenvolvimento |
| Proteção DDoS e de bots | Cloudflare e rede da Hostinger (não confirmada); modos de bot da Cloudflare podem desafiar chamadas `fetch` do app | Testar o modo escolhido contra o fluxo de pedido |
| WAF e validação | Regras da Cloudflare e VineJS | O WAF **não substitui** a validação do backend |
| Redação do token | Nginx e aplicação redigem; a Cloudflare não é redigível | Ver o conflito acima |

### Decisões de 2026-11-18 sobre ABERTO-17 a ABERTO-21

| ABERTO | Decisão do responsável | Situação |
| --- | --- | --- |
| 17 | A API permanece na **mesma origem**, em `/api`. **Não** criar `api.menubora.com.br` agora. Preservar autenticação, cookies e a ausência de CORS. | **Decidido.** O ADR 0002 não muda (`APP_URL` único, cookie sem `Domain`, `Origin` exato). Não há BFF. Reabrir exige novo ADR. |
| 18 | O upload de imagens **continua pela API**. Sem upload direto ao R2 enquanto isso exigir remover ou contornar validações. | **Decidido.** Reabrir só com ADR que preserve a validação por bytes, o limite de 5 MB, o nome gerado pelo servidor e a remoção do arquivo anterior. |
| 19 | A análise jurídica continua **pendência obrigatória antes de dados reais de clientes em produção**. Investigar alternativas para reduzir a exposição do `tracking_token`; desligar log não elimina o processamento pela Cloudflare. | **Parcial.** Pendência jurídica mantida. Investigação feita (abaixo); **a escolha técnica sobre o token continua aberta.** |
| 20 | 2FA forte, tokens de privilégio mínimo, controle de acesso, procedimento documentado de recuperação da conta e de exportação da zona. | **Política adotada** (abaixo). **O procedimento escrito e testado ainda não existe** (F8-B15). |
| 21 | Matriz de responsabilidade entre Cloudflare, Nginx e aplicação, sem replicar configuração nas três camadas. | **Matriz elaborada como proposta; aguarda aprovação.** Nenhum valor numérico foi definido. |

### Exposição do `tracking_token` (ABERTO-19): investigação

**Onde o token aparece hoje** (lido no código, sem alterá-lo):

| # | Ponto | Observação |
| --- | --- | --- |
| 1 | Corpo da resposta de `POST /public/restaurants/:slug/orders` (`tracking_token`) | Necessário; passa em claro pela Cloudflare, mas não está em URL. |
| 2 | URL da página `/r/:slug/pedido/:token` (`router.push` no checkout) | O servidor Next recebe o token em `params`. Fica no histórico do navegador. |
| 3 | `GET /api/v1/public/orders/:trackingToken`, repetido pela atualização periódica da tela | É o ponto de maior volume: cada consulta é uma linha de URL em qualquer log. |
| 4 | Cabeçalho `Referer` | Já bloqueado (`no-referrer` na página, no HTML e na API). |
| 5 | Armazenamento do navegador | Não é gravado (comentário e código do componente de acompanhamento). |
| 6 | Logs: Nginx (a redigir), contêineres (a validar), Cloudflare, monitoramento | Sentry é opcional e **não existe no código hoje**. A Cloudflare mostra caminhos em análises e eventos de segurança [E, a conferir no painel]. |

**Fatos que limitam o dano:** o token tem 256 bits aleatórios; a resposta de acompanhamento **não traz telefone, observações nem nome do cliente** (só restaurante, número, status, tipo, datas, itens e total); **o token não expira** (ROADMAP 5.7 não define validade), então um token que vaze em log continua válido.

**Alternativas** (nenhuma implementada; as que mudam contrato exigem ADR e aprovação):

| | Alternativa | O que resolve | O que não resolve | Custo |
| --- | --- | --- | --- | --- |
| A | Manter no caminho e aplicar controles: redação no Nginx e na aplicação, bypass de cache, sem script injetado, sem regras de WAF que registrem esses caminhos, filtro de URL em qualquer monitoramento futuro | Logs sob nosso controle | A Cloudflare continua vendo o caminho | Nenhuma mudança de contrato |
| B | Token no **fragmento** da URL da página (`/r/:slug/pedido#<token>`); o navegador nunca envia o fragmento | Sai das requisições da página: Next, Nginx e Cloudflare | Histórico do navegador; a chamada da API (ponto 3) | Muda a rota da página, o E2E e o ROADMAP 9.1; sem produção ainda, não há link antigo |
| C | Token fora do caminho da API: cabeçalho em `GET` (por exemplo `X-Tracking-Token`) ou `POST` com corpo | Sai da URL da API (ponto 3) | A Cloudflare ainda processa cabeçalho e corpo em trânsito; se algum registro da Cloudflare guarda cabeçalhos é **NÃO CONFIRMADO** | Muda o ROADMAP 8.4 e a lista de exceções `/public` do ADR 0002; testes de rate limit e de token |
| D | Validade limitada (por exemplo, expirar depois de um período após o estado final) | Reduz a janela de uso de um token vazado | Não evita processamento nem registro | Decisão de negócio e mudança no backend |

**B mais C** tiram o token de **toda URL**. **Nenhuma alternativa elimina o processamento pela Cloudflare**, que termina o TLS e vê cabeçalhos e corpos; isso continua sujeito à avaliação jurídica (P-06). A recomendação, sem ser decisão: A é necessária em qualquer caso; B, C e D formam um pacote a decidir depois do parecer jurídico, e custam menos **antes** da publicação.

### Conta Cloudflare (ABERTO-20): política adotada e esboço do procedimento

**Política adotada pelo responsável:** 2FA forte, tokens com privilégio mínimo, controle de acesso, procedimento documentado de recuperação da conta e de exportação da zona. O esboço abaixo é **proposta a validar no painel**; o procedimento escrito e testado é a tarefa F8-B15 e **não existe ainda**.

- **2FA:** chaves de segurança (WebAuthn) em ao menos duas unidades para cada usuário; TOTP só como reserva; sem SMS. Disponibilidade no plano e no painel a conferir.
- **Recuperação:** códigos de recuperação guardados offline, separados do cofre de senhas, com ao menos dois responsáveis ou locais; e-mail dedicado da conta, com 2FA próprio.
- **Tokens de API:** nunca a Global API Key; um token por finalidade e por escopo (edição de DNS só da zona; R2 só do bucket de imagens; exportação só leitura); validade definida; guardados na gestão de segredos (P-16, aberta); rotação documentada.
- **Acesso:** o menor número possível de membros, com função mínima; sem login compartilhado; revisão periódica do registro de auditoria da conta.
- **Exportação:** arquivo da zona (formato BIND) e exportação das regras de WAF, rate limit, cache, redirecionamento e cabeçalhos por token somente leitura; a cada mudança e em periodicidade a definir; guardada **cifrada e fora da Cloudflare**, sem tokens; teste de recriação em zona de teste.
- **Rota de retorno:** o Registro.br continua dono do domínio. Se a conta Cloudflare for perdida, os nameservers podem ser repontados no Registro.br (propagação lenta). Por isso a conta do Registro.br também exige 2FA (suporte a conferir) e seus dados de recuperação entram no mesmo procedimento.
- **Contingência com a origem fechada:** desligar o proxy só funciona se o firewall permitir acesso direto. O procedimento de emergência (quem abre o firewall, como, por quanto tempo, como volta) deve existir e ser testado **antes** do F8-B10.

### Matriz de responsabilidade (ABERTO-21): **proposta, aguarda aprovação**

Princípio: **um dono por controle**; as outras camadas só repassam, não repetem. Camada mais externa mais folgada, camada mais interna mais estrita. Os valores numéricos (limites, tamanhos de cache) **não foram definidos aqui** e saem da F8-B4 e da F8-B11. Itens marcados "[E]" dependem de conferir o plano Free no painel.

| # | Controle | Camada responsável | Justificativa técnica | Configuração necessária | Possíveis conflitos | Validação |
| --- | --- | --- | --- | --- | --- | --- |
| M01 | DNS e DNSSEC | Cloudflare (autoritativo); Registro.br guarda o DS | Uma só autoridade de zona; o DS precisa coincidir com a chave de assinatura | Zona completa antes da troca; DS conforme o roteiro F8-B3 | DS antigo publicado derruba a resolução em resolvedores que validam | `dig +trace`, `dig DS`, `dig +dnssec` |
| M02 | TLS com o visitante | Cloudflare | Termina o TLS do visitante; é o ponto exposto | Full (strict), TLS mínimo 1.2, TLS 1.3 ligado; nunca Flexible | Modo diferente de strict permite origem sem certificado válido | Origem com certificado inválido deve dar 526 |
| M03 | HTTP para HTTPS | Cloudflare ("Always Use HTTPS") | Decide na borda, antes de chegar à origem | Regra ligada; origem sem redirecionamento próprio | Redirecionamento duplicado no Nginx pode gerar laço; Let's Encrypt HTTP-01 precisa da porta 80 | `curl -I http://...` devolve 301 uma única vez |
| M04 | Autenticar a Cloudflare perante a origem | Nginx (AOP por zona) e firewall (M05) | Só o Nginx vê o certificado de cliente; comprova que a conexão é da nossa conta | `ssl_verify_client optional`, depois `on`; certificado de cliente da zona carregado na Cloudflare; TLS 1.2 ou superior; certificado de origem **Origin CA (proposta, ABERTO-21)** ou Let's Encrypt | Modo `on` antes de validar derruba o site; Let's Encrypt exige porta 80 e renovação | Acesso direto sem certificado de cliente é recusado; log com `$ssl_client_verify` |
| M05 | Rede da origem | Firewall da VPS (`ufw` e `DOCKER-USER`) | Camada diferente do AOP; reduz exposição e ruído | Apenas faixas da Cloudflare em 80 e 443 (80 só se M04 exigir), lista com fonte e atualização versionadas, **só depois de F8-B9** | Lista desatualizada derruba o site (522); bloqueia monitores externos e o ACME direto | Varredura externa; acesso via Cloudflare 200; reinício mantém regras |
| M06 | DDoS volumétrico e de aplicação | Cloudflare | Absorve antes da VPS; a VPS não consegue absorver sozinha | Proteção gerenciada padrão; sem ajuste inicial | Nenhum direto; **não fazer teste de carga contra a produção sem conferir os termos da Cloudflare e do provedor** | Painel de eventos; teste de carga só em homologação autorizada |
| M07 | WAF | Cloudflare (regras gerenciadas do plano e poucas regras personalizadas por caminho [E]) | Filtro de padrões conhecidos, por caminho (`/api`) na mesma origem | Começar em modo de registro, depois ativar; sem regras que registrem o caminho do token | Falsos positivos em observações livres e JSON do pedido; **não substitui a validação do backend** | E2E do fluxo de pedido com WAF ativo; observações com texto atípico |
| M08 | Desafios e bots | Cloudflare, no modo mais brando que atenda | Desafio de JavaScript quebra chamadas `fetch` do app | Sem desafio em `/api/*` e `/r/*/pedido/*` | Cliente em celular fica preso em desafio; cookies adicionais | E2E e teste em celular real |
| M09 | Limite de requisições | **Três níveis com funções distintas:** Cloudflare (inundação, folgado [E]); Nginx (`limit_req` por zona, médio); aplicação (regras de negócio do ADR 0004, estritas) | A aplicação conhece usuário, restaurante e janela de negócio e responde o JSON esperado | Valores a definir na F8-B4 e F8-B11, com cada nível mais folgado que o seguinte | 429 da Cloudflare ou do Nginx não vem em JSON: o frontend precisa tratá-lo; clientes atrás do mesmo NAT; IP real errado | Exceder cada nível e conferir quem responde e a mensagem na tela |
| M10 | IP real do cliente | Nginx | Único que vê origem da conexão e cabeçalhos juntos; a API só confia nele | `set_real_ip_from` das faixas da Cloudflare, `real_ip_header CF-Connecting-IP`; `X-Forwarded-For` sobrescrito com o IP resultante; `trustProxy` da API só na rede do Nginx; com AOP obrigatório, só a nossa zona chega | Cabeçalho forjado por acesso direto é ignorado só porque o IP de origem não está nas faixas; com AOP opcional a garantia é só por IP | Forjar `X-Forwarded-For` e `CF-Connecting-IP` por acesso direto; dois clientes, dois contadores (F8-B8 e F8-B9) |
| M11 | Cabeçalhos de segurança globais (HSTS, `nosniff`, `frame-ancestors`, `Permissions-Policy`, `Referrer-Policy` padrão, CSP Report-Only) | Nginx | Um único ponto na origem, igual para todas as respostas | `add_header ... always`; HSTS **desligado** na Cloudflare; o Next define só cabeçalhos de rota (token) | Cabeçalho duplicado quando Nginx e Next definem o mesmo; CSP Report-Only sem destino dos relatórios não gera sinal | `curl -I` contando ocorrências, inclusive em 404 e 5xx; destino dos relatórios definido antes de apertar a política |
| M12 | Cabeçalhos das imagens (`nosniff`, CSP, `Cache-Control`) | Metadados gravados no objeto (driver) ou Transform Rules da Cloudflare no `img` | Nginx e API não estão no caminho das imagens | Definir na validação do driver S3 (F8-B12) | Duas fontes (metadados e regra) para o mesmo cabeçalho | `curl -I` em `img.menubora.com.br` |
| M13 | Cache | Cloudflare só para estáticos (`/_next/static/*` e `img`), guiado por `Cache-Control` da origem; **Nginx sem cache**; aplicação define `Cache-Control` por resposta | Evita guardar resposta autenticada ou com dado pessoal; menos camadas de invalidação | Regra de bypass explícita para `/api/*`, `/painel/*` e `/r/*/pedido/*`; nunca "Cache Everything" | O padrão da Cloudflare cacheia por extensão; resposta com `Set-Cookie`; **respostas autenticadas da API ainda sem `Cache-Control` conferido** | `cf-cache-status` sem HIT nesses caminhos; token sentinela |
| M14 | Recursos que injetam script ou reescrevem HTML | Cloudflare: desligar | A página do token não pode carregar script de terceiros (ROADMAP 7.3); atrapalham a hidratação do Next | Rocket Loader, ofuscação de e-mail, Web Analytics, Zaraz e semelhantes desligados | Ligados por padrão em alguns planos [E] | HTML recebido pelo navegador sem script extra |
| M15 | `www` para o canônico | Cloudflare (Redirect Rule 301, preservando caminho e consulta) | Decidido na borda; origem recebe só o canônico | Registro `www` proxiado; regra 301 | Perder `?mesa=`; laço com outra regra | `curl -I https://www...` |
| M16 | Host aceito | Nginx (`default_server` recusa nomes desconhecidos) | Evita Host forjado e acesso por IP | Só `menubora.com.br` atendido | Verificações de saúde e monitores usam o Host correto | `curl -H "Host: x"` recusado |
| M17 | Limite de corpo | Nginx (6 MB só nas duas rotas de imagem; baixo no resto); aplicação (bodyparser) | O Nginx rejeita cedo; a aplicação conhece o formato | Não configurar na Cloudflare (o limite do plano é maior [E]); valores do Nginx e do bodyparser iguais nas rotas de imagem | Valores diferentes dão erros diferentes | 7 MB responde 413; imagem de 5 MB passa; JSON grande responde 413 |
| M18 | Validação de entrada, upload, autorização e isolamento por restaurante | Aplicação (única) | Só a aplicação sabe a regra; WAF e Nginx não substituem | Nenhuma nova | Tentação de "reforçar" no WAF e divergir | Suítes Japa existentes |
| M19 | Sessão, cookie e CSRF por `Origin` | Aplicação | ADR 0002 | Cloudflare e Nginx repassam `Origin`, `Host`, `Cookie`, `Set-Cookie` e `X-Forwarded-Proto: https`, sem alterá-los | Cookies de bot da Cloudflare; Nginx alterar o `Origin` | Login via Cloudflare; `Secure` e `HttpOnly`; `Origin` errado responde 403 |
| M20 | Redação do `tracking_token` em log | Nginx e aplicação; **Cloudflare não controlável** | Só controlamos o que está na nossa pilha | `log_format` sem o caminho do token; logger da aplicação sem o caminho | Desligar log não elimina o processamento (ABERTO-19) | Token sentinela no `access_log`, no `error_log` e nos contêineres |
| M21 | Logs de acesso e erro | Nginx (dono); rotação | Estratégia do `error_log` ainda aberta (ABERTO-04) | Rotação; sem corpo, cookie ou token | Logs da Cloudflare ficam fora do nosso controle | Revisão dos campos do formato |
| M22 | Entrega de imagens | Cloudflare (proxy e cache) e R2; a API só grava e apaga | Sai o caminho API para imagens | `UPLOADS_PUBLIC_BASE` com o domínio de imagens; CSP com o domínio | Objeto removido continua em cache até a purga | Upload, leitura, remoção e purga |
| M23 | Contas e tokens da Cloudflare | Responsável pelo projeto (política da seção anterior) | A conta concentra DNS, proxy e R2 | Política do ABERTO-20 | Token amplo demais | Revisão do registro de auditoria |

**Regras da matriz:** (1) nenhuma camada repete configuração de outra; (2) onde duas camadas agem (M04 e M05, M09), as funções são diferentes, não iguais; (3) mudar o dono de um controle exige atualizar esta matriz e o ADR.

### Limites e estado do plano Free (conferidos no painel em 2026-11-18)

Leitura do painel da zona `menubora.com.br`, feita em 2026-11-18 só para consulta, sem alterar configuração. **Resolve os itens marcados "[E]" da matriz** para os limites abaixo. Os limites podem mudar; reconferir antes da F8-B11.

| Item | Observado no painel |
| --- | --- |
| Regras personalizadas de segurança (WAF) | **0 de 5** |
| Regras de rate limiting | **0 de 1** (só uma regra: a camada Cloudflare do M09 é uma regra única) |
| Regras gerenciadas | "Cloudflare managed ruleset": **sempre ativo**. Implantar outros conjuntos: "Upgrade plan" (indisponível no Free) |
| Regras de redirecionamento | **0 de 10**; existe modelo "Redirect from WWW to root" (M15) |
| Transform Rules (incluindo cabeçalhos de resposta) | **0 de 10** |
| Cache Rules | 0 ativas; **o painel não exibe o limite do plano** (não presumido) |
| Registros DNS | 2 de 200 |
| Authenticated Origin Pulls | **Disponível no Free**, nos três níveis (Global, por zona e por hostname), todos desligados e sem certificado enviado |
| Certificado de origem (Origin CA) | Criação disponível, nenhum certificado criado |
| Modo SSL/TLS | **"Full"** (padrão, sem validar o certificado de origem); passa a "Full (strict)" no F8-B7 |
| DNSSEC na Cloudflare | **Não habilitado**; Multi-signer DNSSEC desligado |

**Padrões da Cloudflare a rever na F8-B11 (relacionados à M14):** "Replace insecure JavaScript libraries" está **ligado** e reescreve JavaScript servido, o que contraria a regra de não reescrever conteúdo; "Bot Preference Sync" (escreve na frente do `robots.txt`) foi tratado no onboarding, mas **seu estado não é verificável antes da ativação da zona** (a seção AI Crawl Control pede a troca de nameservers). Confirmar os dois depois da ativação e antes de ligar o proxy.

### Implantação gradual

A ordem aprovada está no ROADMAP (Fase 8, plano da arquitetura B). **Regra obrigatória:** nunca restringir o firewall às faixas da Cloudflare antes de confirmar que o proxy e o AOP funcionam; a ordem errada causa indisponibilidade (erro 522 [C]). O AOP deve ser validado primeiro em modo opcional (`ssl_verify_client optional`, registrando o resultado) e só depois obrigatório.

### Riscos novos

- **Dependência única da Cloudflare** para DNS, proxy e imagens. Os nameservers do `.br` têm TTL longo, então **trocar de volta para outro DNS não é um plano de contingência rápido**. A contingência real é o proxy desligado (nuvem cinza) dentro da Cloudflare, o que exige o firewall aberto: é preciso um procedimento de emergência escrito e testado (ABERTO-20).
- **Concentração em uma conta Cloudflare:** DNS, proxy e R2. Exige 2FA forte, tokens de API com escopo mínimo e exportação periódica da configuração da zona (ABERTO-20).
- **Erro de configuração do firewall ou da lista de faixas** derruba o site (522).
- **DNSSEC:** trocar nameservers com DS antigo publicado causa falha de resolução em resolvedores que validam; verificar antes.
- **O IP da origem já é público** (registro `A` existente); o AOP e o firewall são obrigatórios, não opcionais.
- **Free sem SLA nem suporte** [E].

### Revisão de compatibilidade das decisões (2026-11-18) — **superada nos itens 3 a 8 pela arquitetura B**

Análise documental, a partir do adendo de execução (VPS: 2 vCPU, 8 GB, 100 GB NVMe, Ubuntu 26.04, Docker 29, só IPv4, `DOCKER-USER` restrito às portas 80 e 443) e do código (`uploads_controller.ts`, `images.ts`, `config/drive.ts`). **Nada foi executado nem medido na VPS.**

| # | Combinação | Resultado | Observação |
| --- | --- | --- | --- |
| 1 | DNS no Registro.br + Cloudflare sem proxy + R2 | **Compatível.** | A API acessa o R2 pelo endpoint S3 (`<conta>.r2.cloudflarestorage.com`), que não depende da zona DNS nem do proxy. A conta Cloudflare é necessária só para o R2; a exigência de meio de pagamento para ativar o R2 é **NÃO CONFIRMADA**. |
| 2 | R2 + API servindo `/uploads/*` (opção 1) | **Compatível.** | `uploads_controller.ts` usa `drive.use()`, `exists()` e `getStream()`, e `config/drive.ts` já prevê "outro serviço"; a mudança esperada é de configuração e do driver. O controller só serve chaves no formato `IMAGE_KEY`. A validação contra o R2 continua exigida pelo adendo do ADR 0003. |
| 3 | Opção 2 (domínio público do bucket) | **Incompatível** com DNS no Registro.br. | Domínio personalizado do R2 exige a zona no Cloudflare; `r2.dev` não é adequado a produção. Descartada enquanto o DNS estiver no Registro.br; reabrir só com novo ADR. |
| 4 | Nginx como cache + API servindo `/uploads/*` | **Compatível, com condições.** | A chave tem UUID e o controller responde `Cache-Control: public, max-age=31536000, immutable`, então o conteúdo nunca muda sob a mesma URL. Condições: (a) `proxy_cache` só em `/uploads/`, nunca em `/api/*` nem em `/r/*/pedido/*`; (b) chave de cache sem cookie; (c) 404 e 5xx com validade curta ou sem cache; (d) `max_size` e `inactive` definidos para limitar o disco; (e) imagem removida continua no cache até expirar (aceitável: imagens são públicas e sem dados pessoais); (f) testar que resposta com `Set-Cookie` não é cacheada. |
| 5 | Sem proxy + `trustProxy` (S-01) | **Compatível e mais simples.** | O Nginx vê o IP real e sobrescreve `X-Forwarded-For`; sem `real_ip` do Cloudflare. O teste de forjar o cabeçalho continua obrigatório. |
| 6 | Sem proxy + Let's Encrypt | **Compatível.** | Desafio HTTP-01 na porta 80, já liberada; sem `AAAA`. |
| 7 | Sem proxy: proteção contra DDoS/WAF | **Lacuna a aceitar por escrito.** | Ficam só o `limit_req` do Nginx e o que a Hostinger oferecer na rede (**NÃO CONFIRMADO**). |
| 8 | Latência VPS (Brasil) ↔ R2 | **Risco de desempenho, não de incompatibilidade.** | O R2 não tem região no Brasil [C]; só a primeira leitura de cada imagem paga a latência, depois o cache do Nginx atende. A medir na VPS. |
| 9 | PostgreSQL isolado + `DOCKER-USER` + Nginx | **Compatível.** | O Postgres não publica porta e fica numa rede interna do projeto, sem o Nginx. O Nginx entra só na rede de `web` e `api`. |
| 10 | PostgreSQL isolado + RAM | **Compatível.** | Soma dos limites sugeridos: API 1 GB, web 512 MB, PostgreSQL 768 MB, Nginx 64 MB, sistema 0,4 a 0,6 GB, cerca de 2,9 GB dos 8 GB [E]. A confirmar nas medições. |
| 11 | Backup B2 + R2 + VPS | **Compatível** quanto à independência (três contas: Hostinger, Cloudflare e Backblaze). | A transferência internacional do B2 depende da validação jurídica (P-08). |
| 12 | `deploy` sem `sudo` + Docker | **Compatível, com ressalva.** | O grupo `docker` equivale a root; o ganho é separar a identidade administrativa da de deploy, não eliminar o risco. |

**Incompatibilidades e lacunas identificadas:** a opção 2 de imagens (item 3), a proposta anterior de PostgreSQL compartilhado na "borda" (substituída) e a ausência de DDoS/WAF de terceiros (item 7). Nenhuma impede a F8-T2.

### Critérios para liberar a F8-T2

> **Reinterpretação pelo plano F8-B (2026-11-18):** a F8-T2 foi dividida. A **escrita dos arquivos** (F8-B4, sem deploy) exige o pedido explícito e o F8-B0 fechado. Os critérios abaixo valem para a **execução na VPS** (F8-B6 em diante); o bucket do R2 (item 3) só é criado no F8-B12.

A F8-T2 só começa por **pedido explícito** e quando:

1. ~~Nome canônico do domínio~~ **definido: `menubora.com.br`, sem `www`** (apurado nos documentos e no código em 2026-11-18).
2. O usuário administrativo estiver criado e testado no servidor e o `deploy` sem `sudo` (execução do responsável; ainda não feita).
3. Conta e bucket do R2 estiverem criados pelo responsável, com credencial restrita ao bucket e meio de pagamento confirmado.
4. As medições de capacidade (scrypt em Node 24, carga de 30 minutos, memória sem OOM, disco) estiverem feitas **antes de 2026-12-17**, para fixar os `mem_limit` e o ABERTO-05.
5. ~~Aceite do risco sem DDoS/WAF~~ **Superado pela arquitetura B.** No lugar: a matriz de responsabilidade e o certificado de origem (ABERTO-21) aprovados, e a escolha técnica sobre o `tracking_token` (ABERTO-19) registrada. O ABERTO-17 já está decidido. Esses itens bloqueiam a escrita do Nginx e do Compose, não a execução.
6. A entrega das imagens Docker estiver decidida, ou a F8-T2 for limitada aos arquivos (Dockerfiles, Compose, Nginx), sem deploy.
7. A gestão de segredos (P-16) estiver decidida, ao menos para `APP_KEY`, senhas do PostgreSQL e credenciais do R2. Sem isso, nenhum segredo é criado na VPS.

Custódia da chave `age`, validação jurídica do B2 (P-08) e ABERTO-01 não bloqueiam a **escrita** da F8-T2, mas bloqueiam backup em produção, anonimização e publicação.

## Topologia de referência (proposta)

```
Navegador ──HTTPS──► [Cloudflare: DNS e, se aprovado, proxy]  (P1, P2 ou P3: ver abaixo)
                           │
                           ▼
VPS Linux (Brasil) ── firewall: só 80, 443 e SSH restrito
  └─ Stack compartilhada "borda"
       └─ nginx : único serviço publicado (80/443), TLS, limites, headers, cache de /uploads, redação de logs
  └─ Stack do projeto (um Compose por projeto; redes edge e internal)
       ├─ web : Next.js standalone (Node 24), usuário não root, mem_limit           [edge]
       ├─ api : AdonisJS (Node 24), uma instância, mem_limit                       [edge + internal]
       └─ postgres : PostgreSQL 17, volume e usuário próprios, SEM porta publicada [internal]
Fora da VPS
  ├─ Imagens públicas: object storage compatível com S3 (ver "Armazenamento de imagens")
  └─ Backups cifrados: destino externo (ADR 0007)
```

### Isolamento entre projetos
> **Revisado em 2026-11-18:** o PostgreSQL deixa de ser compartilhado e passa a ser um container por projeto (adendo de decisões). Os itens abaixo sobre PostgreSQL compartilhado ficam como histórico e só valem se um novo ADR reabrir a questão.

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
- Domínio `.com.br` a registrar (valor de R$ 40/ano segundo fontes de terceiros; **NÃO CONFIRMADO**). **Superado: domínio `menubora.com.br` registrado em 2026-11-17 (ver o adendo de execução).**
- `NEXT_PUBLIC_SITE_URL` é lida no build e fixa a URL dos QR Codes (`apps/web/src/lib/public-url.ts`): o domínio precisa estar definido antes do build de produção, e trocar o slug ou o domínio invalida QR Codes impressos.

### TLS e Nginx
- TLS 1.2 ou superior; certificados Let's Encrypt (ou certificado de origem, se houver proxy); HSTS.
- Nginx: encaminha `/api/*` e `/uploads/*` à API e o resto ao Next; `client_max_body_size` de 6 MB **somente** nas duas rotas de imagem e valor baixo no restante; `limit_req`; headers de segurança e CSP Report-Only; **redação do token** no `access_log` e estratégia do `error_log` (ABERTO-04), comprovada com token sentinela.
- Entre o Nginx e a API, a conexão é interna; a API não é publicada.

### Cloudflare: proxy, só DNS ou híbrido (**DECIDIDO em 2026-11-18: P1, arquitetura B; ver o adendo**)

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

**Atualização (2026-11-18): o responsável escolheu P1 (arquitetura B). Os controles obrigatórios acima continuam valendo e entram nos critérios de validação do ROADMAP.**

### IP real e `trustProxy` (S-01)
- Confirmado no repositório: **`trustProxy` não está configurado** e `request.ip()` alimenta os limites de login, pedido, cotação e acompanhamento. Sem ajuste, atrás de proxy todos os clientes dividem um contador.
- Proposta: o Nginx **sobrescreve** `X-Forwarded-For` com o IP que ele vê (`$remote_addr`); a API confia **somente** na rede Docker do Nginx. Com Cloudflare, o Nginx restaura o IP de `CF-Connecting-IP` (`real_ip`) apenas para conexões vindas das faixas do Cloudflare ou autenticadas por mTLS.
- **Requer teste:** forjar `X-Forwarded-For` de fora e provar que o IP usado pelo limitador não muda; dois clientes distintos devem ter contadores distintos.

### Armazenamento de imagens
- O ADR 0003 já prevê S3 genérico. O controller `uploads_controller.ts` **já** responde `Cache-Control: public, max-age=31536000, immutable`, `nosniff` e CSP, e usa `drive.use()`, `exists()` e `getStream()`: **parece independente do disco** (a confirmar em `images.ts`, que não li). Portanto a mudança provável é de configuração do disco e variáveis, **não** do controller.
- **Candidatos:** Cloudflare R2 (US$ 0,015/GB-mês acima de 10 GB gratuitos, saída gratuita, local automático sem dica para a América do Sul [C]) ou volume local da VPS (contraria o CLAUDE.md "S3 em produção" e prende as imagens ao servidor).
- Imagens de produto e logo são dados públicos de negócio, sem dados pessoais; a localização fora do Brasil pesa pouco **para as imagens**.
- **Opção 1:** a API continua servindo `/uploads/*` lendo do storage, com cache na borda (Cloudflare em P1 ou Nginx em P2). **Opção 2:** domínio público do bucket (exige o domínio na zona Cloudflare e recriar `nosniff` e CSP por regra de transformação). **Decidido em 2026-11-18: opção 2, `img.menubora.com.br` (arquitetura B).** O upload continua pela API (ABERTO-18).
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
2. ~~Domínio e registrador~~ **decidido: `menubora.com.br` (Registro.br), canônico sem `www`.**
3. ~~Cloudflare~~ **decidido em 2026-11-18: arquitetura B (proxy total); a P2 foi superada.**
4. ~~Storage de imagens~~ **decidido em 2026-11-18: R2, entrega por `img.menubora.com.br` (opção 2).** Upload continua pela API (ABERTO-18).
5. ~~PostgreSQL compartilhado ou um por projeto~~ **decidido em 2026-11-18: um por projeto, isolado.**
6. **ABERTA:** entrega das imagens Docker por `docker save` ou por registro.
7. **ABERTA:** procedimento de gestão de segredos (P-16).
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
