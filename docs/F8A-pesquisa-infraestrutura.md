# Fase 8-A: pesquisa de infraestrutura, custos e capacidade

- Data da consulta: **2026-11-17**
- Situação: **pesquisa para planejamento (consulta de 2026-11-17).** Depois dela, o responsável contratou a **Hostinger KVM 2** e preparou o servidor; ver a seção 10. O texto das seções 1 a 9 é histórico e **não foi reescrito**; onde ele diz "nada contratado", vale a seção 10. Os ADRs [0006](decisions/0006-arquitetura-de-infraestrutura-e-hospedagem.md) e [0007](decisions/0007-estrategia-de-backup-e-restauracao.md) são **RASCUNHO, NÃO APROVADOS**.
- Referências: ROADMAP, Fase 8 (F8-T1 a F8-T6) e ABERTO-01 a ABERTO-08; [F6-T3](F6-T3-relatorio-de-seguranca.md); [ADR 0003](decisions/0003-imagens-e-qrcode.md); [ADR 0004](decisions/0004-rate-limit.md)
- Orçamento máximo declarado pelo usuário: **R$ 100,00 por mês para toda a infraestrutura recorrente.**

Legenda: **[C]** lido em página do próprio fornecedor nesta data · **[T]** informado só por terceiro · **[M]** medido (com o ambiente) · **[E]** estimativa · **NÃO CONFIRMADA** = não consegui confirmar.

Limitação do método: as páginas foram lidas por uma ferramenta que as resume; não vi o HTML bruto. Todos os valores precisam ser reconferidos no checkout e no contrato antes de qualquer contratação.

## 1. Fornecedores de VPS

### 1.1 HypeHost

| Item | Informação | Fonte |
| --- | --- | --- |
| Plano candidato | **KVM 6GB**: R$ 89/mês, 3 vCPU, 6 GB RAM, rede de 1 Gbps, IPv4 fixo e IPv6 [C] | `/en/vps-linux` |
| Plano menor | KVM 4GB: R$ 59/mês, 2 vCPU, 4 GB, 30 GB [C] | idem |
| Disco do KVM 6GB | **CONFLITO:** 40 GB nos cartões e na lista de planos; 60 GB na seção "melhor VPS no Brasil" e no FAQ de custo da mesma página. **Não assumo nenhum dos dois**; para planejar uso **40 GB** (o menor) | idem |
| Tráfego | "flexível", sem franquia declarada. **NÃO CONFIRMADA** a política de uso; os termos citam redução para 50 Mbps em uso não autorizado de tráfego (§16) [C] | termos |
| Ciclos | Mensal, trimestral (−10%), semestral (−15%), anual (−30%). A página **não mostra totais**; cálculo meu para o KVM 6GB: R$ 240,30, R$ 453,90 e R$ 747,60. **NÃO CONFIRMADO** até o checkout | `/en/vps-linux` |
| Renovação | A página diz "sem reajuste na renovação"; os **termos (§14) permitem reajuste anual pelo IPCA positivo e repasse imediato** de variação cambial, energia e licenças. **CONFLITO** | página e termos |
| Impostos | **NÃO CONFIRMADA** a inclusão nos preços; a página de preços diz que impostos seguem o perfil fiscal da conta | `/en/pricing` |
| Pagamento | Cartão, Pix, boleto e transferência; PayPal aparece na seção de pagamento mas **não no FAQ** (conflito menor) | `/en/vps-linux` |
| Datacenter | Página do plano: **São Paulo**. Página LGPD: infraestrutura no Brasil, em **Ascenty SP03, SP04, SP05 e FTZ1 (Fortaleza), "conforme a localização contratada"**. Os termos não nomeiam o datacenter. Confirmar o local no pedido | `/en/vps-linux`, `/en/legal/lgpd` |
| Backup | **CONFLITO entre quatro textos:** (1) plano: "backup automático" sem detalhes; (2) página de preços: "em VPS o cliente cuida do backup"; (3) termos §10: rotina diária com **um ponto de restauração semanal, "melhor esforço", sem garantia**; (4) LGPD: backups e snapshots do provedor são apagados no cancelamento | páginas e termos |
| Anti-DDoS | "AntiDDoS PRO" incluso, sem custo no filtro padrão [C]; ataques tratados como força maior nos termos (§11) | idem |
| Upgrade e downgrade | Upgrade a qualquer momento com diferença proporcional; **downgrade que reduz disco exige reinstalação e apaga os dados** (§10) | termos |
| Reembolso | **7 dias corridos, só na primeira compra e sem violação dos termos**; não vale para renovação, upgrade nem downgrade (§06). Reembolso volta à origem do pagamento; exige cancelamento imediato no painel **e** um chamado ao financeiro | termos e ajuda |
| **Inadimplência** | Serviço pré-pago; **vencimento sem pagamento causa suspensão automática; 3 dias corridos depois, o contrato é considerado rescindido e os dados são excluídos definitivamente, sem recuperação** (§06) | termos |
| Cancelamento voluntário | Os termos **não dizem** quando os dados são apagados; a página LGPD diz que a instância e os backups são excluídos ao cancelar | termos, LGPD |
| SLA | Meta de 99,7%; crédito de 5× o tempo parado (mínimo de 24 h), com chamado em até 30 dias; crédito é a "única e exclusiva compensação" | termos §08 |
| Responsabilidade | Limitada ao dano direto comprovado; em uso empresarial, limitada ao valor mensal do contrato (§03) | termos |
| Aviso de mudanças | Termos: 15 dias; manutenção programada: 24 horas | termos |
| Razão social | Ver "informações não confirmadas" (denominações divergentes) | |
| Reputação | Sem página no Reclame Aqui encontrada; domínio com cerca de 7 anos [T]; fundada em Osasco (SP) em 2019 [C] | |

**Consequências operacionais registradas:** (a) o risco de perda total em 3 dias após a suspensão por atraso torna **o backup externo e o pagamento em dia** requisitos, não opcionais; (b) o backup do provedor **não pode ser considerado** parte da estratégia; (c) downgrade apaga dados.

### 1.2 Solução Host

| Item | Informação |
| --- | --- |
| **CONFLITO entre páginas do mesmo site (lidas hoje)** | A página inicial listou **Cloud Starter R$ 39,90** (2 vCPU, 4 GB, 60 GB), **Cloud Pro R$ 79,90** (4 vCPU, 8 GB, 120 GB RAID 10) e Cloud Elite R$ 149,90. A página `vps.php` lista **BR Starter R$ 89,90** (2 vCPU, 4 GB, 60 GB), BR Pro R$ 169,90 (4 vCPU, 8 GB, 80 GB), BR Max R$ 219,90 e BR Ultra R$ 299,90, todos em **São Paulo** com Anti-DDoS e rede de 1 a 2 Gbps (outro conflito) |
| Termos de serviço, privacidade e sobre | **Links do rodapé apontam para "#": não publicados.** **NÃO CONFIRMADOS** suspensão, retenção, reembolso, backup, razão social e CNPJ |
| Preço de renovação, ciclos, impostos, pagamento | **NÃO CONFIRMADOS** |
| Datacenter | A página `vps.php` diz São Paulo; a página inicial diz só "Brasil"; o provedor do datacenter não é nomeado |
| Reputação | sem página no Reclame Aqui encontrada |

**Conclusão:** não é possível avaliar nem recomendar sem termos publicados e sem resolver o conflito de preços entre páginas.

### 1.3 StartCloud

| Item | Informação |
| --- | --- |
| Planos (lidos hoje) | CloudVPS 1: R$ 69,90, 2 vCPU, 4 GB, 50 GB NVMe · CloudVPS 2: R$ 89,90, 2 vCPU, 6 GB, 100 GB · CloudVPS 3: R$ 139,90, 4 vCPU, 8 GB, 150 GB · CloudVPS 4: R$ 299,90 [C]. IPv4 dedicado e tráfego ilimitado informados |
| **Conflitos** | O FAQ cita planos "a partir de R$ 44,90 com 30 GB NVMe", que não existem na lista; o banner "Black November, até 50% em todos os planos" não indica quais cartões já incluem o desconto; os botões de contratar do CloudVPS 3 e 4 apontam para "#" |
| Termos de uso e privacidade | **Links do rodapé apontam para "#": não publicados.** **NÃO CONFIRMADOS** suspensão, reembolso, backup (só "snapshots e backups sob demanda"), razão social e CNPJ |
| Datacenter | "Datacenter Tier III no Brasil"; **cidade NÃO CONFIRMADA** |
| SLA | "99,9%" citado sem documento de apoio |
| Renovação, ciclos, impostos, pagamento | **NÃO CONFIRMADOS** |

**Conclusão:** não é possível avaliar sem termos publicados e sem localização.

### 1.4 Hostinger (KVM)

| Item | Informação |
| --- | --- |
| Planos [C] | **KVM 2:** 2 vCPU, 8 GB, 100 GB NVMe, 8 TB. Promoção R$ 42,99/mês **só no ciclo de 24 meses pago à vista (R$ 1.031,76)**; renovação anunciada **R$ 77,99/mês pelo mesmo período de 24 meses (R$ 1.871,76 de uma vez)**. KVM 1: 1 vCPU, 4 GB, R$ 29,99 promo e R$ 59,99 renovação. KVM 4: 4 vCPU, 16 GB, R$ 59,99 promo e R$ 149,99 renovação |
| Ciclos | A página mostra só o de 24 meses; **mensal e 12 meses NÃO CONFIRMADOS**. Parcelamento em até 12 vezes citado. Oferta com validade até 2027-11-17 nos dados estruturados |
| Renovação | Os **termos permitem alterar as taxas, inclusive de renovação, a qualquer momento e sem aviso**; renovação automática é o padrão, com cobrança de 30 a 0 dias antes do fim, e sem obrigação de aviso (§16) |
| Impostos | **NÃO CONFIRMADA** a inclusão nos preços |
| Datacenter | "Brasil" está entre as localizações do FAQ; **cidade NÃO CONFIRMADA em fonte da Hostinger**. "São Paulo" aparece só em benchmark de terceiro [T] |
| Backup | Semanal gratuito, restauração pelo painel; retenção **NÃO CONFIRMADA** (a documentação de suporte tem números divergentes entre idiomas para snapshots). Os termos dizem que **o usuário é o único responsável pelo backup (§6)** e permitem remover dados e cópias quando há restrições (§10) |
| Reembolso | 30 dias; renovação conta como nova transação; VPS KVM com upgrades fora do reembolso; limite de 180 dias entre reembolsos de VPS; pagamento em criptomoeda não reembolsável |
| Suspensão | Falha de pagamento permite suspensão ou cancelamento imediato, sem aviso; **sem período de carência fixo** (§16) |
| IPv4 | "IP dedicado" por cliente; versão de IP **NÃO CONFIRMADA** |
| Anti-DDoS, CPU dedicada ou compartilhada | **NÃO CONFIRMADOS** |

### 1.5 Resumo comparativo

| | HypeHost KVM 6GB | Solução Host | StartCloud | Hostinger KVM 2 |
| --- | --- | --- | --- | --- |
| Preço recorrente mensal conhecido | R$ 89 (sujeito a IPCA e repasse) | conflito (R$ 39,90 ou R$ 89,90 para 4 GB) | R$ 89,90 (6 GB) | só 24 meses: R$ 77,99/mês equivalente |
| Termos publicados e lidos | **sim** | **não** | **não** | **sim** |
| Cidade do datacenter | São Paulo, com FTZ1 possível (confirmar) | São Paulo na página `vps.php` | não | não |
| Pagamento por Pix | sim | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO |
| Risco por inadimplência | **dados excluídos 3 dias após a suspensão** | NÃO CONFIRMADO | NÃO CONFIRMADO | sem carência fixa |
| Backup do provedor | "melhor esforço", conflito entre textos | NÃO CONFIRMADO | sob demanda, sem detalhes | semanal, retenção NÃO CONFIRMADA |

## 2. Armazenamento

Consulta em 2026-11-17.

### 2.1 Cloudflare R2 [C]
- Armazenamento Standard: **US$ 0,015/GB-mês**. Faixa gratuita: **10 GB-mês**, 1 milhão de operações Classe A e 10 milhões de Classe B por mês. Classe A: US$ 4,50 por milhão; Classe B: US$ 0,36 por milhão. **Saída para a internet gratuita.**
- Localização: padrão "automática" (perto de quem cria o bucket); dicas de localização só para América do Norte, Europa, Ásia-Pacífico e Oceania; **sem dica para a América do Sul**; "jurisdições" só UE, EUA e FedRAMP.
- Acesso: buckets privados por padrão; para acesso público em produção, domínio próprio (com cache); `r2.dev` é só para desenvolvimento e tem limite de taxa; o domínio precisa ser uma zona na mesma conta Cloudflare.
- Compatibilidade com o Adonis Drive: serviço `s3` com `region: 'auto'` e `endpoint` da conta [C].

### 2.2 Backblaze B2 [C]
- A partir de **US$ 6,95/TB-mês**; primeiros **10 GB gratuitos**; saída gratuita até 3× a média armazenada, depois US$ 0,01/GB; chamadas das classes A, B e C gratuitas; classe D US$ 0,004 por 10 mil (2.500 por dia gratuitas); compatível com S3.
- Regiões (página de regiões de dados): **US East (Reston), US West (Sacramento e Phoenix), EU Central (Amsterdã) e CA East (Toronto). Nenhuma no Brasil nem na América do Sul.**
- Retenção mínima de objeto e travas de imutabilidade: **NÃO CONFIRMADAS** nesta pesquisa.

### 2.3 Implicações
- **Imagens** (fotos de produto e logo) são dados públicos de negócio, sem dados pessoais; a localização fora do Brasil pesa pouco para elas.
- **Backups** contêm dados pessoais (nome e telefone de clientes, hashes de senha). **Nem R2 nem B2 garantem armazenamento no Brasil**; isso exige análise jurídica (ADR 0007). Cifrar antes do envio reduz o risco, mas **não elimina** a questão de transferência internacional.
- Alternativa com armazenamento no Brasil (por exemplo, o object storage da Magalu Cloud): **NÃO AVALIADA com preço** (a página de preços carrega por calculadora e não deu valores).

## 3. Matriz de custo total mensal

**Regras desta matriz:** só preços recorrentes de lista; promoções e pagamentos antecipados ficam em coluna separada; nada é omitido. Câmbio para itens em dólar: **hipótese de R$ 5,30 por US$ 1 (NÃO CONFIRMADA; não obtive cotação confiável)**, mais IOF de cartão internacional (cerca de 3,5%, NÃO CONFIRMADO). Domínio: **R$ 40/ano** (informado por fontes de terceiros, **NÃO CONFIRMADO no Registro.br**) = R$ 3,33/mês.

| Item | Mínimo viável | Recomendado (dentro do teto) | Acima do teto |
| --- | --- | --- | --- |
| VPS | HypeHost **KVM 4GB**: R$ 59,00 | HypeHost **KVM 6GB**: R$ 89,00 | HypeHost **KVM 12GB** (5 vCPU, 80 GB): R$ 159,00 |
| Domínio (rateado) | R$ 3,33 | R$ 3,33 | R$ 3,33 |
| Imagens (R2) | R$ 0,00 (dentro de 10 GB) | R$ 0,00 (dentro de 10 GB) | R$ 0,00 a variável |
| Backup (B2, dentro de 10 GB) | R$ 0,00 | R$ 0,00 | R$ 0,00 |
| Monitoramento (Healthchecks, plano gratuito de 20 verificações [C]) | R$ 0,00 | R$ 0,00 | R$ 0,00 |
| Monitoramento de disponibilidade externo | **NÃO CONFIRMADO** (não pesquisei preço) | idem | idem |
| Cloudflare (DNS e, se aprovado, proxy), plano gratuito | R$ 0,00, **NÃO reconfirmado hoje** | idem | idem |
| **Total recorrente conhecido** | **R$ 62,33** | **R$ 92,33** | **R$ 162,33** |
| Folga até R$ 100 | R$ 37,67 | **R$ 7,67** | **−R$ 62,33** |

**Custos variáveis e franquias:**
- R2 acima de 10 GB: US$ 0,015/GB-mês (≈ R$ 0,08/GB, hipótese cambial). 50 GB seriam cerca de R$ 3,2 por mês.
- B2 acima de 10 GB: ≈ US$ 0,007/GB-mês.
- IPCA anual ou repasses cambiais da HypeHost (termos §14) podem elevar o valor do VPS.
- Multa de R$ 250 por notificação de SPAM na HypeHost (termos §07), risco operacional.
- Reajustes e valores de reposição de domínio: variáveis.

**Custos iniciais e pagamento antecipado (separados):**

| Opção | Desembolso | Equivalente mensal | Observação |
| --- | --- | --- | --- |
| HypeHost KVM 6GB, mensal | R$ 89 por mês | R$ 89 | Primeiro mês com reembolso de 7 dias só na primeira compra |
| HypeHost KVM 6GB, anual | **R$ 747,60 (cálculo meu, NÃO CONFIRMADO)** | R$ 62,30 | Reembolso de 7 dias; renovação sem reembolso; ver risco de reajuste |
| Hostinger KVM 2, 24 meses | R$ 1.031,76 no primeiro ciclo; **R$ 1.871,76 na renovação** | R$ 42,99 no 1º ciclo e **R$ 77,99 depois** | Promoção **não** vale como custo recorrente |
| Domínio | R$ 40 por ano (NÃO CONFIRMADO) | R$ 3,33 | |

### Parecer sobre o orçamento de R$ 100,00 por mês
- **Para o primeiro projeto**, a **HypeHost KVM 6GB com ciclo mensal fecha em R$ 92,33 por mês, com folga de R$ 7,67 para custos variáveis.** Isso respeita o teto, mas a folga é pequena.
- **O limite de R$ 100 NÃO comprova viabilidade para 4 a 6 projetos.** Pela matriz de capacidade (seção 4), seis projetos exigiriam mais RAM do que a KVM 6GB oferece na faixa alta. Os planos maiores ou uma segunda VPS custam entre R$ 159 e R$ 178 só de servidor, **acima do teto**. Não existe, nas fontes confirmadas, cenário seguro e adequado para seis projetos dentro de R$ 100.
- O cenário "mínimo viável" (KVM 4GB, R$ 62,33) cabe no orçamento, mas tem 30 GB de disco e 4 GB de RAM e só foi avaliado, por estimativa, para o primeiro projeto.
- Nenhum requisito de segurança, backup, isolamento ou privacidade foi reduzido para caber no orçamento.

## 4. Matriz de capacidade (1, 3 e 6 projetos)

### 4.1 O que é medido e o que não é
| Dado | Tipo | Origem |
| --- | --- | --- |
| Scrypt N=2^17, r=8, p=1: 128 MiB por hash; mediana de 545 ms; 16 hashes simultâneos em 3,9 s; pico de RSS de 552 MB | **[M]** em notebook (i5-6300U, 2 núcleos, 7,9 GB, **Node 26**), **não** na VPS nem no Node 24 | F6-T3, seção 7 |
| Parâmetros atuais do hash (N=16384, r=8, p=1, `maxMemory` de 32 MiB) | **[C] no código** | `apps/api/config/hash.ts` |
| Pool de threads do Node: 4 hashes simultâneos no padrão | hipótese baseada na documentação do Node; **não testado aqui** | F6-T3 |
| Todos os demais consumos (memória, CPU, disco, logs, banco) | **[E]** | esta pesquisa |
| Nenhum teste de carga, de limites de memória ou de restauração foi executado | | |

### 4.2 Estimativas
Hipóteses: cada projeto é Node (web mais API), leve a médio; **os seis projetos não têm a mesma carga e a tecnologia dos outros cinco é desconhecida**, então as faixas de 4 a 6 projetos são só ordem de grandeza.

| Indicador (planejando em 40 GB de disco e 6 GB de RAM) | 1 projeto | 3 projetos | 6 projetos |
| --- | --- | --- | --- |
| RAM em regime [E] | 1,4 a 2,0 GB | 2,0 a 3,4 GB | 3,2 a 5,9 GB |
| Pico de login com hash [M para o custo por hash; E para a simultaneidade] | +0,5 GB por API | +0,5 GB por API que esteja autenticando | idem; **cada API tem o seu pool de threads**, o teto teórico simultâneo soma |
| Pico de build | **zero na VPS (build fora)**; no deploy, o contêiner novo sobe antes do antigo cair, então some um segundo contêiner por alguns segundos | idem | idem |
| CPU [E] | folgada fora de picos | picos por login e por renderização | disputa em picos; risco de lentidão simultânea |
| Disco: sistema e Docker | 5 a 6 GB | 5 a 6 GB | 5 a 6 GB |
| Disco: imagens (cerca de 0,15 a 0,6 GB por imagem, duas por projeto, com versões anteriores guardadas) | 1 a 2 GB | 3 a 6 GB | 6 a 12 GB |
| Disco: logs com rotação | 0,1 a 0,3 GB | 0,3 a 0,9 GB | 0,6 a 1,8 GB |
| Disco: dumps temporários (antes do envio) | 0,05 a 0,3 GB | 0,15 a 0,9 GB | 0,3 a 1,8 GB |
| Disco: crescimento do banco | 0,1 a 1 GB por ano por projeto (hipótese **sem dados reais**) | | |
| **Disco total estimado** | 7 a 11 GB | 10 a 18 GB | 15 a 28 GB |
| Margem de RAM em 6 GB (política: manter ao menos 25% livres, 1,5 GB) | **sim** | **talvez; só com medição** | **não demonstrada; provável falta na faixa alta** |
| Margem de disco (política: manter ao menos 30% livres, 12 GB em 40 GB) | sim | talvez | **não** na faixa alta |

**Concorrência e falhas:** limites de memória por contêiner evitam que um projeto derrube os demais, mas **o PostgreSQL compartilhado é um domínio de falha comum** (um superusuário comprometido ou um banco que consome I/O afeta todos).

**Parecer:** a KVM 6GB é **adequada em estimativa para o primeiro projeto**; para três projetos **depende de medição**; **não há evidência de que suporte seis**. Não afirmo capacidade validada.

### 4.3 Testes ainda necessários (nenhum executado)
1. Scrypt N=2^15 e N=2^17 em **Node 24 na VPS escolhida**, com 1 e com 4 logins simultâneos.
2. Pilha completa em Compose com carga realista, `docker stats` por pelo menos 30 minutos.
3. PostgreSQL com 50 a 100 conexões simuladas e vários bancos.
4. Uso de disco depois de vários deploys (`docker system df`) e política de limpeza.
5. Limites de memória ligados, para ver se há morte por falta de memória (OOM).
6. Para cada novo projeto, perfil próprio antes de entrar na VPS.
7. Restauração de backup em VPS limpa, com cronômetro.

## 5. Informações NÃO CONFIRMADAS

- Razão social e CNPJ de HypeHost, Solução Host e StartCloud. Para a HypeHost aparecem nomes diferentes: "JSK Cloud e Infraestrutura Ltda" (terceiro), domínio de contato `jeskesolutions.net` (política de privacidade) e uma denominação diferente numa leitura automática do termo de serviço; **verificar no contrato**.
- Disco real do KVM 6GB da HypeHost (40 GB ou 60 GB).
- Inclusão de impostos nos preços de todos os fornecedores.
- Totais dos ciclos de desconto da HypeHost e se o ciclo anual existe no checkout.
- Termos de serviço de Solução Host e StartCloud (não publicados nas páginas lidas).
- Cidade do datacenter de StartCloud e Hostinger.
- Retenção e conteúdo do backup incluído de todos os provedores.
- Disponibilidade de Pix em Solução Host, StartCloud e Hostinger.
- Sistemas operacionais oferecidos (Ubuntu ou Debian) em cada VPS.
- Preço de domínio no Registro.br (só terceiros).
- Retenção mínima e travas de imutabilidade do B2 e do R2.
- Preço de monitoramento de disponibilidade externo.
- Cotação do dólar e IOF.
- Plano gratuito do Cloudflare (não reconsultado hoje).

## 6. Pendências, dependências e decisões

| ID | Pendência | Depende de | Bloqueia |
| --- | --- | --- | --- |
| P-01 | Confirmação comercial por escrito da HypeHost: disco, impostos, backup, razão social, datacenter | usuário e HypeHost | contratação |
| P-02 | Confirmação do disco e do upgrade (upgrade proporcional confirmado nos termos; downgrade apaga dados) | P-01 | dimensionamento |
| P-03 | Leitura integral dos termos e do contrato antes de pagar | usuário | contratação |
| P-04 | Decisão do domínio | usuário | DNS, TLS, QR Codes (`NEXT_PUBLIC_SITE_URL` é lida no build) |
| P-05 | Decisão de DNS e Cloudflare (P1, P2 ou P3, ADR 0006) | usuário e P-06 | IP real, `trustProxy`, cache |
| P-06 | Análise jurídica e de privacidade (LGPD) sobre o proxy do Cloudflare e sobre transferência de dados | jurídico | P-05, P-08 |
| P-07 | Decisão sobre storage de imagens | usuário | F8-T2 |
| P-08 | Decisão sobre destino de backup (nenhum candidato pesquisado garante o Brasil) | jurídico e usuário | ADR 0007 |
| P-09 | Definição dos alertas externos (ferramenta e conta) | usuário | ADR 0007 |
| P-10 | Medição do scrypt com Node 24 na VPS escolhida | VPS de teste | parâmetros do hash |
| P-11 | Teste de carga e de limites de memória | VPS de teste | capacidade |
| P-12 | Teste de restauração em VPS limpa | ADR 0007 aprovado | RTO |
| P-13 | Validação de logs sem token (token sentinela em Nginx, API e contêineres) | Nginx implantado | F8-T6 |
| P-14 | Validação de `trustProxy` e do IP real (S-01) | P-05 | F8-T6 |
| P-15 | Validação dos limites de upload (6 MB só nas rotas de imagem) | Nginx implantado | F8-T6 |
| P-16 | Procedimento de gestão de segredos (APP_KEY, banco, credenciais de storage, chave de backup) | usuário | ADR 0006 e 0007 |
| P-17 | Autorização da dependência do driver S3 | usuário | implementação do storage |
| P-18 | Validação jurídica da retenção (ABERTO-01) | jurídico | retenção definitiva dos backups |

## 7. Riscos

- **Perda total de dados 3 dias após atraso de pagamento na HypeHost** (termos §06). Mitigação proposta: backup externo, pagamento por Pix com antecedência, ciclo mais longo (avaliar), alerta de vencimento. **Não é garantia.**
- Reajuste de preço pelo IPCA e repasses imediatos (§14) podem consumir os R$ 7,67 de folga.
- Backup do provedor em "melhor esforço" não deve ser considerado.
- PostgreSQL compartilhado entre projetos é domínio de falha comum.
- Provedor pequeno e sem reputação medida; razão social a confirmar.
- Servidor único: um RTO de 4 horas pressupõe pessoa disponível.
- Backups podem ir para fora do Brasil (B2 e R2).
- Perda da chave privada de backup torna os backups ilegíveis.
- Capacidade para 4 a 6 projetos não demonstrada.

## 8. Fontes e datas (todas consultadas em 2026-11-17)

**Fornecedores de VPS**
- HypeHost: [vps-linux](https://hypehost.com.br/en/vps-linux), [preços](https://hypehost.com.br/en/pricing), [termos de serviço](https://hypehost.com.br/en/legal/tos), [LGPD e DPA](https://hypehost.com.br/en/legal/lgpd), [privacidade](https://hypehost.com.br/en/legal/privacy), [ajuda: cancelamento e reembolso](https://ajuda.hypehost.com.br/pt-BR/articles/14660928-como-solicito-cancelamento-e-reembolso), [sobre](https://hypehost.com.br/en/sobre)
- Solução Host: [página inicial](https://solucaohost.com.br), [VPS](https://solucaohost.com.br/vps.php)
- StartCloud: [página inicial](https://startcloud.com.br), [Cloud VPS](https://startcloud.com.br/servidor-vps)
- Hostinger: [VPS](https://www.hostinger.com/br/servidor-vps), [termos de serviço universais](https://www.hostinger.com/br/legal/termos-de-servico-universal), [política de reembolso](https://www.hostinger.com/br/legal/refund-policy)

**Armazenamento e serviços**
- [Cloudflare R2: preços](https://developers.cloudflare.com/r2/pricing/), [R2: localização dos dados](https://developers.cloudflare.com/r2/buckets/data-location/), [R2: buckets públicos](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Backblaze B2: preços](https://www.backblaze.com/cloud-storage/pricing), [B2: regiões](https://www.backblaze.com/docs/cloud-storage-data-regions)
- [AdonisJS Drive](https://docs.adonisjs.com/guides/digging-deeper/drive)
- [Cloudflare: DPA](https://www.cloudflare.com/cloudflare-customer-dpa/), [cabeçalhos HTTP](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/), [cache padrão](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/), [Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)
- [Healthchecks: preços](https://healthchecks.io/pricing/)

**Terceiros (só como indício)**
- Preço de domínio: [Teletime](https://teletime.com.br/14/10/2026/br-6-milhoes/), [Homehost](https://www.homehost.com.br/blog/registro-de-dominios/quanto-custa-um-dominio) (a página oficial do Registro.br não pôde ser lida)
- [Site Confiável: hypehost.com.br](https://www.siteconfiavel.com.br/site/hypehost-com-br)

## 9. Sequência recomendada para a próxima etapa da Fase 8

1. Você revisa os dois ADRs em rascunho e este relatório; nada é aprovado automaticamente.
2. Pedir à HypeHost, por escrito, a confirmação dos itens da P-01, e ler o contrato final (P-03).
3. Levar ao responsável jurídico as questões P-06, P-08 e P-18.
4. Decidir domínio, DNS e Cloudflare (P-04, P-05) e destino de backup (P-08).
5. Só então, com autorização explícita, contratar o plano mensal da VPS (reembolso de 7 dias apenas na primeira compra), executar os testes P-10 a P-12 e redigir a versão final dos ADRs.
6. Depois disso, a implementação da F8-T2 (Dockerfiles, Compose, Nginx, `trustProxy`) e da F8-T3.

## 10. Atualização: contratação e preparação do servidor (2026-11-17 a 2026-11-18)

O responsável escolheu a **Hostinger KVM 2** em vez da HypeHost KVM 6GB. Os detalhes, o estado do servidor e as pendências estão no adendo de execução do [ADR 0006](decisions/0006-arquitetura-de-infraestrutura-e-hospedagem.md). Aqui ficam os dados novos, lidos no carrinho e no assistente da Hostinger em 2026-11-17 [C], e o que mudou nas pendências.

**Planos da Hostinger na página de VPS (preço promocional por 24 meses e renovação anunciada)**

| Plano | vCPU | RAM | Disco NVMe | Banda | Promoção/mês | Renovação/mês |
| --- | --- | --- | --- | --- | --- | --- |
| KVM 1 | 1 | 4 GB | 50 GB | 4 TB | R$ 29,99 | R$ 59,99 |
| **KVM 2 (contratado)** | 2 | 8 GB | 100 GB | 8 TB | R$ 42,99 (R$ 1.031,76 pelos 24 meses) | R$ 77,99 |
| KVM 4 | 4 | 16 GB | 200 GB | 16 TB | R$ 59,99 | R$ 149,99 |
| KVM 8 | 8 | 32 GB | 400 GB | 32 TB | R$ 119,99 | R$ 259,99 |

**Itens da seção 1.4 que mudaram**

| Item | Antes | Agora |
| --- | --- | --- |
| Localização do servidor | "Brasil" no FAQ; cidade NÃO CONFIRMADA | Região **Brasil** selecionável no assistente [C]; cidade continua NÃO CONFIRMADA |
| Sistemas operacionais | NÃO CONFIRMADOS | Ubuntu, Debian, AlmaLinux, Rocky Linux e outros [C]; instalado o Ubuntu 26.04.1 LTS |
| Ciclos | só o de 24 meses visível | continua só o de 24 meses no carrinho; mensal e 12 meses **NÃO CONFIRMADOS** |
| Pagamento por Pix | NÃO CONFIRMADO | continua NÃO CONFIRMADO (o checkout mostrou cartão, Google Pay e NuPay entre as opções) |
| Backup | semanal gratuito, retenção NÃO CONFIRMADA | backup diário **pago** (R$ 32,99/mês) oferecido e não contratado; o gratuito semanal e a retenção continuam sem confirmação |
| Impostos | NÃO CONFIRMADA a inclusão | R$ 0 no carrinho; cálculo final depois do faturamento NÃO CONFIRMADO |
| Painéis e aplicativos pré-instalados | não pesquisado | 19 painéis de controle e mais de mil aplicativos; **nenhum é necessário** para a topologia (Compose por projeto atrás do Nginx); os que trazem proxy próprio, como Traefik, Dokploy e Coolify, conflitam com o Nginx do ADR |

**Orçamento com a Hostinger KVM 2 (cálculo do assistente, [E])**

| Fase | VPS | Domínio rateado (NÃO CONFIRMADO) | Total mensal | Folga até R$ 100 |
| --- | --- | --- | --- | --- |
| Primeiros 24 meses | R$ 42,99 | R$ 3,33 | R$ 46,32 | R$ 53,68 |
| Depois da renovação | R$ 77,99 | R$ 3,33 | R$ 81,32 | R$ 18,68 |

O desembolso inicial é de R$ 1.031,76 à vista, e a renovação de R$ 1.871,76 também é de uma vez; ambos ficam fora da coluna mensal.

**Pendências da seção 6 afetadas**

- **P-01 e P-02** (confirmação por escrito da HypeHost): **sem objeto** enquanto a HypeHost não for usada. Para a Hostinger, ficam por confirmar no painel e no comprovante: impostos, cidade do datacenter, retenção do backup gratuito e se o Pix existe.
- **P-03** (leitura integral do contrato): passa a valer para os termos da Hostinger (§6, §10 e §16 já lidos na pesquisa; leitura integral pendente).
- **Prazo novo:** as medições de capacidade (P-10 a P-12) devem ocorrer dentro do reembolso de 30 dias, até **2026-12-17** (conferir a data exata no comprovante).
- **P-04 (domínio): decidida em 2026-11-17.** Domínio **menubora.com.br** no Registro.br, **R$ 40,00 por ano** (valor pago, agora confirmado pelo responsável; antes só havia fonte de terceiros), DNS no próprio Registro.br, apontado para a VPS. Detalhes e verificação no adendo do ADR 0006. A renovação anual e o canônico com ou sem `www` seguem sem confirmação.
- **Continuam abertas:** Cloudflare (P-05), destino do backup (P-08), questões jurídicas (P-06, P-18), storage de imagens e a autorização do driver S3 (P-17).

**Matriz de capacidade (seção 4):** as estimativas partiam de 6 GB de RAM e 40 GB de disco. O KVM 2 tem 8 GB e 100 GB, então a margem estimada melhora, mas **nada foi medido**: as faixas continuam sendo estimativas [E] até os testes da seção 4.3.
