# F8-B3 — Roteiro da troca de nameservers e do DNSSEC (sequência aprovada; execução iniciada pelo responsável em 2026-11-18)

- **Tarefa:** F8-B3 do [plano da arquitetura B](ROADMAP.md) (tipo P, planejamento).
- **Estado: SEQUÊNCIA APROVADA pelo responsável em 2026-11-18 (mensagem no chat); roteiro com pendências (ver seção 6); EXECUÇÃO (F8-B5) INICIADA pelo responsável em 2026-11-18, após pedido explícito no chat.** O serviço "DNS do Registro.br" foi desativado e a troca está na espera de transição (seção 7). Este documento segue como planejamento; as ações nos painéis são do responsável e eu só faço consultas de leitura. **Correções feitas depois da tela real do Registro.br: a ordem dos passos 2 e 3 e a premissa de continuidade da resolução estavam erradas (seções 3, 4 e 7).**
- **Criado em:** 2026-11-18.
- **Depende de:** [F8-B1](F8-B1-roteiro-inventario-dns.md) (em andamento) e F8-B2 (em andamento; **2FA da Cloudflare pendente**, ver "Pré-condições"). Contexto: [ADR 0006](decisions/0006-arquitetura-de-infraestrutura-e-hospedagem.md).
- **Critério de conclusão (ROADMAP):** roteiro aprovado pelo responsável, com o procedimento de retorno e o procedimento exato para o DS, definido com a configuração disponível na hora.

## Fontes consultadas (2026-11-18)

| Marca | Fonte | Observação |
| --- | --- | --- |
| **[RB]** | Registro.br, [DNS e DNSSEC](https://registro.br/tecnologia/dnssec/dns-e-dnssec/) e [Características Técnicas](https://registro.br/tecnologia/caracteristicas-tecnicas/) | Páginas oficiais lidas no navegador. A tela atual do painel **não foi vista nesta etapa**. |
| **[CF]** | Cloudflare, [DNSSEC](https://developers.cloudflare.com/dns/dnssec/) e [full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/) | Documentação oficial. |
| **[R]** e **[P]** | Responsável e consultas públicas | Como no [roteiro da F8-B1](F8-B1-roteiro-inventario-dns.md). |

Trechos das páginas oficiais podem estar desatualizados em relação ao painel. **Conferir a tela na hora da execução.**

## 1. O que a documentação oficial estabelece

1. **DNSSEC com os servidores do Registro.br é automático e obrigatório [RB].** A pergunta "É possível desativar o DNSSEC para domínios vinculados aos servidores DNS do Registro.br?" tem a resposta "Não. A utilização do DNSSEC nos servidores DNS do Registro.br é obrigatória e vinculada de forma automática." Isso explica por que o painel não mostra opção de DNSSEC (F8-B1, B.3) e é compatível com o DS e a DNSKEY encontrados nas consultas públicas. **Não confirma o estado do DS na tela do painel.**
2. **Sair do DNS do Registro.br [RB].** O serviço pode ser desativado na tela de administração do domínio, e é preciso informar **pelo menos 2 servidores DNS com autoridade** sobre o domínio. "A publicação dos novos servidores DNS levará ao menos 2 horas, tempo necessário para a remoção completa da chave DNSSEC." A transição completa pode levar **até 3 horas** por causa de caches.
3. **Voltar ao DNS do Registro.br [RB]:** é preciso **aguardar 4 horas** depois da desativação. **O retorno imediato não existe.**
4. **Aceitação da delegação [RB]:** as delegações só são aceitas quando os servidores indicados **respondem com autoridade** pelo nome. A Cloudflare precisa estar respondendo pela zona antes da troca.
5. **Ritmo das publicações [RB]:** as publicações do `.br` ocorrem a cada 5 minutos; alterações de DNS ficam visíveis em até 1 hora (modo do Registro.br).
6. **DS com DNS de terceiros [RB]:** o formulário pede "os dados do record DS", e o sistema valida o DS na hora do cadastro; há a ferramenta DScheck para conferir.
7. **Ordem padrão da Cloudflare [CF]**, para quem sai de um provedor com DNSSEC ativo e sem multi-signer: (1) remover o DS no registrador; (2) esperar o TTL do DS expirar no pai (confirmar com `dig DS`); (3) trocar os nameservers; (4) esperar o TTL antigo do NS; (5) habilitar o DNSSEC na Cloudflare; (6) cadastrar o DS fornecido pela Cloudflare no registrador. **Aviso [CF]:** trocar os nameservers antes de o TTL do DS expirar pode causar SERVFAIL em resolvedores que validam.
8. **Multi-signer [CF]:** só serve se o provedor atual permitir inserir DNSKEY externas no apex. **Não há indicação de que o serviço do Registro.br ofereça isso**, então este roteiro **não** usa o multi-signer.

## 2. O que continua não sabido (decisão ou conferência necessária)

| # | Questão | Como resolver |
| --- | --- | --- |
| Q1 | Ao desativar o serviço, **o Registro.br remove o DS sozinho** ou a tela pede ação? A página fala em "remoção completa da chave DNSSEC", mas **não afirmo que isso remove o DS na delegação** | Ler a tela na execução; conferir com `dig DS menubora.com.br` antes e depois. **Não presumir.** Remover registros da zona **não** remove o DS por si só |
| Q2 | A ordem interna do Registro.br (DS e delegação) evita o SERVFAIL descrito pela Cloudflare? | Não se sabe; mitigar escolhendo a janela **antes do lançamento**, sem tráfego, e testando com resolvedores que validam |
| Q3 | Onde fica na tela o campo do DS para DNS de terceiros? | Ver na execução, depois de a zona estar ativa |
| Q4 | A Cloudflare responde **com autoridade** (flag `aa`) para a zona pendente? | Conferir antes da troca (passo 1.3) |
| Q5 | TTL da delegação no `.com.br` e do DS | Medir com `dig +trace` e `dig DS` antes de definir as esperas |

## 3. Pré-condições (gates) para a execução

1. **F8-B1:** concluída, ou exceção registrada pelo responsável.
2. **F8-B2: concluída com risco aceito (2026-11-18)**; critérios do ROADMAP atendidos (zona, registros e consulta direta). **2FA da conta Cloudflare: RISCO ACEITO POR ESCRITO pelo responsável em 2026-11-18** (mensagem no chat). A conta foi criada com login pelo Google e o 2FA próprio da Cloudflare **não está verificado**. A recomendação era resolver antes da F8-B5, porque a conta passa a controlar o DNS do domínio; **o responsável aceitou o risco.** O risco continua registrado e a política do ABERTO-20 **não está atendida**; reabrir a decisão antes de criar tokens de API ou o R2.
3. **2FA da conta do Registro.br** confirmado (informado como ativo [R]; método não informado).
4. **Janela sem tráfego real:** executar antes de qualquer deploy ou lançamento.
5. **Cópia de segurança do estado atual:** registros do Registro.br (hoje dois `A`), nameservers atuais, DS e DNSKEY observados, exportação da zona da Cloudflare (BIND), sem tokens.
6. **Retorno entendido:** o retorno ao DNS do Registro.br só é possível 4 horas depois da desativação [RB]. **Correção (2026-11-18):** a premissa anterior ("o site continua resolvendo durante qualquer correção") era **falsa para a janela de transição**: depois da desativação a zona do Registro.br fica vazia e a delegação externa só é liberada cerca de 2 horas depois; nesse intervalo o nome **não resolve** (observado em 2026-11-18). Só é aceitável por não haver tráfego real (gate 4).

## 4. Sequência proposta (rascunho para aprovação; nada executado)

Cada passo só começa depois de o anterior passar na sua verificação.

| # | Passo | Verificação (critério) |
| --- | --- | --- |
| 1.1 | Conferir que a zona da Cloudflare tem os mesmos dois registros A, em DNS only | Painel e consulta direta aos nameservers `danica.ns.cloudflare.com` e `jack.ns.cloudflare.com` devolvem `187.53.123.179` para o apex e para o `www` |
| 1.2 | Registrar o estado atual: `dig NS`, `dig DS`, `dig DNSKEY`, `dig +trace`, valores dos registros | Saídas guardadas no documento de evidência |
| 1.3 | Conferir a autoridade da Cloudflare (Q4) | `dig @danica.ns.cloudflare.com menubora.com.br SOA +norec` mostra `aa` |
| 1.4 | Medir TTL do DS e da delegação (Q5) | Valores anotados; esperas definidas a partir deles |
| 2 | **Corrigido pela tela real:** no Registro.br, **desativar** o serviço "DNS do Registro.br". A tela informa que os servidores estão em transição e que servidores externos só poderão ser delegados após cerca de 2 horas. **Os nameservers não são informados nesta hora** | Tela de transição com a contagem regressiva; evidência: horário da desativação e texto da tela |
| 3 | Aguardar cerca de 2 horas (contagem da tela) e acompanhar. **Depois**, informar no Registro.br `danica.ns.cloudflare.com` e `jack.ns.cloudflare.com` (a delegação só é aceita se os servidores responderem com autoridade), lendo antes as mensagens da tela (Q1, Q3). Em seguida, acompanhar a propagação | `dig DS menubora.com.br` sem DS (confirma Q1); `dig NS` mostra os nameservers da Cloudflare; registros resolvem em 8.8.8.8 e 1.1.1.1; **sem SERVFAIL** em resolvedor que valida |
| 4 | Esperar a ativação da zona na Cloudflare (e-mail de zona ativa; o painel mostra "Active") | Status "Active" |
| 5 | Esperar o TTL do NS antigo | Consultas diretas mostram só os nameservers da Cloudflare |
| 6 | Cloudflare: **Enable DNSSEC**; copiar o DS; cadastrar no Registro.br; validar com DScheck | DS aceito pelo Registro.br; `dig +dnssec` mostra o indicador `ad` em resolvedor que valida |
| 7 | Verificação final e atualização dos documentos (ADR 0006, ROADMAP, F8-B1) | Tabela de evidências preenchida |

**Retorno (se algo falhar):** a zona da Cloudflare tem os mesmos valores, mas só responde pelo domínio depois da delegação (correção na seção 3, item 6). Voltar ao DNS do Registro.br exige 4 horas de espera depois da desativação [RB]; durante esse tempo, corrigir na Cloudflare em vez de voltar. Definir antes quem decide e que limite de tempo justifica voltar.

## 5. O que este roteiro não faz

- Não altera nada; não inicia a F8-B5.
- Não liga proxy, AOP, Full (strict), WAF nem regras; isso vem depois (F8-B7 em diante).
- Não usa multi-signer DNSSEC.
- Não presume que desativar o serviço remove o DS, nem que o painel mostra a opção do DS antes da hora.

## 6. Pendências para concluir a F8-B3

- [x] **Sequência aprovada** pelo responsável em 2026-11-18 (mensagem no chat). **Não** foram definidos, e continuam pendentes, **o critério de retorno** (quem decide e que limite de tempo justifica voltar) e as esperas exatas (dependem de Q5).
- [x] Gate do 2FA da Cloudflare: **risco aceito por escrito** pelo responsável em 2026-11-18 (ver seção 3, item 2).
- [ ] Q1 a Q5 respondidas na execução ou por consulta ao Registro.br, e o procedimento exato do DS fixado.
- [ ] Janela escolhida (antes do lançamento).
- [ ] Preparação da evidência: modelo de registro dos comandos antes e depois.

Aprovação da sequência: registrada pelo responsável no chat em 2026-11-18. **Assinatura formal pendente** (a ser feita quando as pendências acima forem fechadas).

Aprovado por: ______________________  Data: ____/____/______

## 7. Registro da execução (2026-11-18)

Evidência de consultas públicas somente leitura feitas por mim; as ações nos painéis são do responsável. Horários locais da máquina do responsável.

| Hora | Fato | Fonte |
| --- | --- | --- |
| antes de ~15:29 | Estado de partida: zona da Cloudflare com os dois `A` em `187.53.123.179` (apex e `www`) nos dois nameservers; resposta com autoridade (`aa`); NS `d.sec.dns.br` e `e.sec.dns.br`; DS 56886/13/2 no `.com.br`; TTL de NS, DS e `A` de 3600 s (**Q4 e Q5 respondidas**) | [P] |
| ~15:29 | Desativação do DNS do Registro.br aceita. Tela: "os servidores DNS do domínio se encontram em transição. Servidores DNS externos poderão ser delegados em aproximadamente 1h59m45s" (liberação prevista por volta de **17:29**) | [R] |
| 15:29 | NS e DS ainda os do Registro.br. `d.sec.dns.br` e `e.sec.dns.br` respondem com autoridade (`aa`), mas **sem o registro `A`** (NOERROR/NODATA, SOA de 900 s); 1.1.1.1 e 8.8.8.8 também sem `A` | [P] |

**Conclusões:** (1) **Q1, parcial:** o DS continuava presente às 15:29; a remoção não é imediata e o desaparecimento do DS segue a verificar com `dig DS` ao longo da espera; (2) a ordem real é desativar, esperar cerca de 2 horas e só então informar os servidores externos; (3) durante a espera o nome não resolve (sem tráfego real, aceito).

**Próximos passos (à noite, de outra máquina):** repetir `dig NS`, `dig DS` e `dig A` (1.1.1.1, 8.8.8.8 e direto nos servidores); informar os nameservers da Cloudflare no Registro.br se a tela já permitir; depois, zona "Active", espera do TTL do NS (1 h), DNSSEC e DS na Cloudflare e DScheck (passos 4 a 7). **Não ativar o DNSSEC na Cloudflare enquanto `dig DS` ainda mostrar o DS antigo.** Status da F8-B5: Em andamento; F8-B3 segue com as pendências da seção 6.
