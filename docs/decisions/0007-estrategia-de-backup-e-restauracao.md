# ADR 0007 — Estratégia de backup e restauração

- **Status: RASCUNHO — NÃO APROVADO.** Nada deste documento é decisão. **Nenhum backup existe nem está operacional.** Nenhum serviço foi contratado e nenhuma conta foi criada.
- Data do rascunho: 2026-11-17
- Referências: `CLAUDE.md` seções 9 e 12; ROADMAP 7.3 e 7.4, F8-T3 e F8-T4, ABERTO-01; [ADR 0003](0003-imagens-e-qrcode.md); [ADR 0006](0006-arquitetura-de-infraestrutura-e-hospedagem.md) (rascunho); [pesquisa da Fase 8-A](../F8A-pesquisa-infraestrutura.md)
- Legenda: **[C]** confirmado em fonte do fornecedor · **[E]** estimativa · **NÃO CONFIRMADO** = sem fonte. Todos os valores de RPO, RTO, frequência e retenção abaixo são **provisórios e não são garantias**.

## Contexto

O backup contém **dados pessoais** (nome e telefone de clientes, observações de pedidos, nome e e-mail de usuários) e **hashes de senha** (ROADMAP 7.3). A F8-T3 exige backup do PostgreSQL em formato custom e das imagens, scripts no repositório, cron do host, criptografia externa e **restauração testada em ambiente limpo**.

Fatos sobre o provedor de VPS em consideração (HypeHost, termos lidos em 2026-11-17):
- Os termos dizem que **o backup é responsabilidade exclusiva do cliente** (§04) e que a rotina do provedor (diária, com um ponto de restauração semanal) é de **"melhor esforço", sem garantia** (§10). A página de preços diz que "em VPS o cliente cuida do backup", enquanto a página do plano anuncia "backup automático" sem detalhes. **Conflito registrado.**
- **Suspensão automática por atraso, e exclusão definitiva dos dados 3 dias corridos depois** (§06).
- Backups e snapshots do provedor são **apagados no cancelamento** (página LGPD).

Portanto: **o backup do provedor não faz parte desta estratégia**; ele é, no máximo, um bônus.

## Adendo de decisões (2026-11-18)

O responsável decidiu, no F8-T1, que o destino dos backups cifrados é o **Backblaze B2**, com cifragem por **`age`** no servidor antes do envio, em conta e fornecedor diferentes do R2 das imagens ([ADR 0006](0006-arquitetura-de-infraestrutura-e-hospedagem.md), adendo de 2026-11-18). **Continuam abertos e bloqueiam a implementação:** a análise jurídica da transferência internacional (P-08; o B2 não tem região no Brasil), a retenção definitiva (ABERTO-01, P-18), o custodiante da chave privada, a ferramenta e o canal de alerta (P-09) e os RPO/RTO provisórios. Nenhuma conta foi criada. O status do ADR continua RASCUNHO. **Efeito do PostgreSQL isolado (2026-11-18):** o dump passa a ser feito no container do próprio projeto, sem os papéis de outros projetos; o item "papéis do servidor" do escopo vale só para o usuário do Cardápio Digital. Seguem **abertas**, e não concluídas: custódia da chave privada `age` e validação jurídica do B2.

## Adendo (2026-11-18) — efeitos da arquitetura B no backup

A orientação da arquitetura B pediu atualização do "ADR 0007"; a arquitetura está registrada no **ADR 0006**, e este ADR recebe só os efeitos sobre o backup. Nenhuma decisão de backup foi alterada.

- O bucket público de imagens (R2) **não pode** guardar backups. O destino do backup continua sendo o B2, em conta e fornecedor diferentes.
- **A conta Cloudflare concentra DNS, proxy e R2.** A configuração da zona (registros, regras de WAF, rate limit, redirecionamentos, regras de cache e de cabeçalho) passa a ser dado a proteger: exportá-la periodicamente e guardá-la fora da Cloudflare, sem tokens. Sem isso, a recriação da zona depende da memória de quem a configurou.
- Segredos novos entram no escopo da gestão de segredos (P-16, ainda aberta): credenciais do R2, token de API da Cloudflare, chave privada do certificado de origem e do AOP.
- A cópia das imagens (R2 para outro fornecedor) continua necessária: o R2 passa a ser também o ponto único de entrega.
- Na restauração em VPS limpa, o DNS não precisa mudar (a Cloudflare aponta para o IP da origem); é preciso atualizar o IP no registro proxiado e reemitir o certificado de origem e o AOP. Incluir esses passos no procedimento.
- Seguem abertas e **não concluídas**: custódia da chave `age`, validação jurídica do B2, gestão de segredos.

## Objetivos de recuperação (provisórios)

| Objetivo | Valor provisório | Observação |
| --- | --- | --- |
| **RPO do banco** | até 1 hora | depende da frequência real e de a verificação passar |
| **RPO das imagens** | até 24 horas | o original fica no storage; a cópia protege contra apagamento ou perda da conta |
| **RTO** | 4 horas **[E]** | só vira número real depois do primeiro teste de restauração medido em VPS limpa |

**Esses valores não são aprovados nem garantidos e dependem da aprovação do responsável pelo projeto.** Um RPO menor que 1 hora exigiria arquivamento contínuo (WAL), componente a mais que contraria o princípio de "só o necessário" (CLAUDE.md seção 1) e só se justifica com necessidade comprovada.

## Escopo dos dados

- **PostgreSQL:** um dump por banco de projeto, mais os papéis do servidor (apenas definições, sem expor senhas em claro fora do arquivo cifrado).
- **Imagens:** objetos do storage de imagens (produtos e logos); chaves e conteúdo.
- **Configuração:** variáveis de ambiente e arquivos de Compose e Nginx **ficam no repositório (sem segredos) e no cofre de segredos**; **procedimento de gestão de segredos NÃO DEFINIDO (P-16)**.
- **Fora do escopo:** logs, cache, imagens Docker (reconstruíveis), sessões (podem ser descartadas; os usuários fazem login de novo).

## Backup do PostgreSQL (proposta)

- Formato custom (`pg_dump -Fc`), por banco, agendado no cron do host (decisão aprovada em PEND-28), com execuções escalonadas entre os projetos.
- Frequência provisória: **horária**, mais um dump completo diário. Ajustar quando houver dados reais: **a duração e o tamanho do dump não foram medidos**.
- O dump é feito por um papel de leitura próprio, **sem poder de escrita**.

## Backup de imagens (proposta)

- As imagens já residem no storage do ADR 0006 (candidato: Cloudflare R2). A **cópia diária** vai para **fornecedor e conta diferentes** do storage principal, para sobreviver à perda ou suspensão dessa conta.
- Cópia só de objetos novos; verificação por contagem e tamanho.

## Destino externo

Nenhum destino está aprovado. Candidatos pesquisados, **nenhum com região no Brasil confirmada**:

| | Backblaze B2 | Cloudflare R2 |
| --- | --- | --- |
| Custo | US$ 6,95/TB-mês, 10 GB gratuitos, saída gratuita até 3× o armazenado [C] | US$ 0,015/GB-mês, 10 GB gratuitos, saída gratuita [C] |
| Região | US East, US West, EU Central, CA East; **nenhuma no Brasil** [C] | automática; **sem dica para a América do Sul** [C] |
| Independência do VPS | sim | sim; **mas o R2 também guarda as imagens**: backups e imagens na mesma conta compartilhariam o risco |

- **Recomendação preliminar (não decisão):** destino de backup em fornecedor **diferente** do storage de imagens.
- **Backups com dados pessoais fora do Brasil são transferência internacional de dados (LGPD).** A cifragem antes do envio reduz o risco, **não elimina** a questão. **Exige análise jurídica (P-08).** Alternativa com armazenamento no Brasil: **NÃO AVALIADA com preço**.
- Retenção mínima de objeto e travas de imutabilidade (proteção contra apagamento por credencial comprometida): **NÃO CONFIRMADAS**.

## Criptografia e custódia das chaves

- Cifrar **no servidor, antes do envio**, com **chave pública** (por exemplo, `age` ou `gpg`, ferramentas do sistema, **fora das dependências do projeto**; escolha pendente).
- A **chave privada de descriptografia não pode ficar apenas na VPS**: guardar em cofre de senhas **e** em cópia offline separada, com ao menos **duas pessoas ou locais** capazes de recuperá-la. **O responsável pela custódia ainda não foi definido.**
- A VPS só deve conseguir **cifrar e gravar** no destino (credenciais de escrita, sem permissão de listar, ler ou apagar). Assim, quem invadir a VPS não lê nem apaga os backups antigos.
- A perda da chave privada torna os backups ilegíveis: testar a descriptografia a cada teste de restauração.

## Integridade

1. Hash SHA-256 de cada arquivo cifrado, gravado em manifesto e conferido após o envio.
2. Verificação do conteúdo do dump (`pg_restore --list`) antes de cifrar.
3. **Teste de restauração periódico e automatizado** em contêiner descartável, com contagem de linhas de tabelas-chave.
4. Alerta de tamanho anômalo (backup muito menor que o anterior).

## Frequência e retenção provisória (NÃO APROVADA)

- **Provisório:** 48 horários e 14 diários. **Não é decisão aprovada.**
- **A retenção definitiva está bloqueada pela validação jurídica (ABERTO-01 e P-18).** A proposta de 180 dias para pedidos e a anonimização valem **também para os backups**: um backup antigo pode conter dados que o procedimento de anonimização já removeu da base viva. Por isso **não há retenção semanal, mensal ou anual proposta** nesta etapa.
- Quando o jurídico decidir, este ADR deve ser revisado, e a retenção dos backups deve ser **menor ou igual** ao que ficar decidido.
- Solicitações de titulares (exclusão e correção) afetam a retenção dos backups: procedimento a definir com o jurídico.

## Alertas

- **Batimento (heartbeat):** cada backup avisa um serviço externo que rodou; a falta de aviso gera alerta. Candidato: Healthchecks, com **plano gratuito de 20 verificações e 100 registros por verificação**; canais de SMS e WhatsApp só nos planos pagos [C].
- **Ferramenta, conta e canal de alerta NÃO DEFINIDOS (P-09)**; usar serviço externo exige decisão de conta e de privacidade (o alerta não deve conter dados pessoais).
- Alertas mínimos: backup não executado; backup falhou na verificação; destino inacessível; disco local cheio; **vencimento do pagamento da VPS próximo** (risco de exclusão em 3 dias).

## Testes de restauração

- **Semanal e automatizado:** restaurar o dump mais recente em contêiner descartável e conferir `migration:status`, contagens e uma consulta de integridade.
- **Completo, manual, a cada mudança relevante de infraestrutura:** em **VPS limpa**, conferir login, cardápio público, imagem e acompanhamento de pedido (critério da F8-T3), medindo o tempo para calibrar o RTO.
- Um backup que nunca foi restaurado **não é considerado backup**.

## Procedimento de recuperação em VPS limpa (esboço, a detalhar e testar)

1. Provisionar a VPS (fornecedor e plano conforme o ADR 0006) e aplicar a base de segurança.
2. Instalar Docker; obter o repositório e as imagens por tag imutável.
3. Recuperar os segredos do cofre; recuperar a **chave privada** do custodiante.
4. Baixar o último dump cifrado e o manifesto; conferir o SHA-256; descriptografar.
5. Criar bancos e papéis; restaurar com `pg_restore`; conferir `migration:status`.
6. Restaurar o acesso às imagens (storage principal ou cópia).
7. Subir Nginx e as stacks; ajustar DNS; verificar saúde, login, cardápio, imagem e acompanhamento.
8. Registrar tempos e problemas; atualizar este ADR.

## Custos

Todos dentro das franquias gratuitas no volume inicial **[E]** (centenas de MB), em R$ 0,00 por mês no mínimo; **custo variável** acima de 10 GB (US$ 0,007 a 0,015 por GB-mês), com câmbio **NÃO CONFIRMADO**. Detalhes na matriz de custos da pesquisa. Armazenar dumps horários em volume local temporário usa disco da VPS (estimado em 0,05 a 0,3 GB por projeto).

## Riscos

- **Perda da chave privada:** backups irrecuperáveis.
- **Backup comprometido pela mesma conta ou credencial que o dado vivo.**
- **Exclusão do VPS em 3 dias por inadimplência**, antes de alguém notar.
- **Transferência internacional** de dados pessoais (B2 e R2 sem região no Brasil confirmada).
- **Retenção de backup maior que a política de privacidade** (ABERTO-01).
- Dump horário em banco crescente: tempo e I/O não medidos.
- Restauração nunca testada: RTO desconhecido.
- Dependência de serviço externo de alerta (nova conta).

## Dependências

ADR 0006 (destino e topologia); F8-T2 (VPS e ambiente); validação jurídica (ABERTO-01, P-06, P-08, P-18); decisão da ferramenta de criptografia e de alertas; procedimento de segredos (P-16); autorização para qualquer dependência ou conta nova.

## Decisões pendentes (do responsável pelo projeto)

1. Aprovar ou ajustar RPO (1 hora e 24 horas) e RTO (4 horas) provisórios.
2. Destino do backup (B2, R2 ou alternativa no Brasil), sujeito à análise jurídica.
3. Custodiante e local da chave privada de backup.
4. Ferramenta de criptografia e de alertas (e a conta de alerta).
5. Retenção definitiva (**bloqueada** até a validação jurídica).
6. Quem executa e acompanha os testes de restauração.

## Critérios de validação antes da implementação

1. Destino e retenção aprovados após análise jurídica.
2. Chave privada gerada, guardada fora da VPS e **testada** na descriptografia.
3. Um backup completo gerado, verificado e restaurado em VPS limpa, com tempo medido.
4. Alerta de falha de backup disparado em teste proposital.
5. Teste de que a credencial da VPS **não** consegue ler nem apagar backups já enviados.
6. Este ADR revisado e aprovado pelo usuário; só então o status muda.
