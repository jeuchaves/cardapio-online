# F8-B1 — Inventário DNS e DNSSEC

- **Tarefa:** F8-B1 do [plano da arquitetura B](ROADMAP.md) (tipo P, só leitura).
- **Estado: EM ANDAMENTO (não concluída).** O inventário dos registros está **confirmado pelo responsável**. O estado do DNSSEC tem **evidência pública, sem confirmação administrativa**. Há campos pendentes (ver "Pendências").
- **Criado em:** 2026-11-18. **Atualizado em:** 2026-11-18 (duas vezes), com as informações do responsável sobre o Registro.br, a Hostinger, o 2FA (B.8) e a orientação de adiar a investigação operacional do DNSSEC para a F8-B3.
- **Critério de conclusão (ROADMAP):** documento com todos os registros e o estado do DNSSEC, **conferido pelo responsável**.
- **Alimenta:** F8-B2 (zona na Cloudflare) e F8-B3 (roteiro da troca de nameservers e do DS). Contexto: [ADR 0006](decisions/0006-arquitetura-de-infraestrutura-e-hospedagem.md).

## Convenção de fontes

| Marca | Significado |
| --- | --- |
| **[R]** | Informado e conferido pelo **responsável** (painel do Registro.br, hPanel ou SSH). |
| **[P]** | **Observação de consulta pública** (DNS), feita em 2026-11-18. Não é confirmação administrativa. |
| **Pendente** | Sem informação. Nada foi presumido. |

## Regras desta etapa

- **Somente leitura.** Não alterar, criar nem remover registros, servidores DNS, DS, chaves ou contatos. Não clicar em "salvar", "confirmar" ou "desativar" em nenhuma tela.
- **Não remover o DS e não desativar o DNSSEC agora.** Isso é decisão do F8-B3 e, feito fora de ordem, derruba a resolução do domínio (ver parte E).
- Não colar senha, código de 2FA, token ou código de recuperação neste documento.
- Capturas de tela: guardar fora do repositório se mostrarem e-mail ou dados pessoais.

## Parte A — Consultas públicas [P] (2026-11-18)

Consultadas pelo resolvedor público 8.8.8.8 e diretamente nos servidores autoritativos. Valem como retrato do momento; o resolvedor pode guardar respostas pelo TTL.

| Consulta | Resultado observado [P] |
| --- | --- |
| NS de `menubora.com.br` | `d.sec.dns.br` e `e.sec.dns.br` (TTL 3600 no resolvedor) |
| SOA | Primário `d.sec.dns.br`, série `2026322021` |
| A de `menubora.com.br` | `187.53.123.179` (TTL 3600 no resolvedor) |
| A de `www.menubora.com.br` | `187.53.123.179` (TTL 3600 no resolvedor) |
| AAAA, MX e TXT do apex | Nenhum registro (resposta sem dados, com o SOA) |
| `api`, `img`, `mail`, `ftp`, `painel` | Não existem (NXDOMAIN) |
| CAA | Consulta pública **não realizada** (o `nslookup` e o `Resolve-DnsName` do Windows não consultam esse tipo). A lista da zona no painel [R] não tem CAA |
| DS no `.com.br` | **Presente:** KeyTag `56886`, algoritmo `13` (ECDSAP256SHA256), tipo de digest `2` (SHA-256), assinado pelo `com.br`. O valor do digest não está registrado aqui |
| DNSKEY na zona | **Presente:** chave com flag `257` e algoritmo `13` |
| Autoritativos (`d.sec.dns.br` e `e.sec.dns.br`) | Responderam o mesmo IP para o apex e para o `www` |

**O TTL observado é o do resolvedor público.** O painel do Registro.br não informa TTL, então **o TTL da zona não está confirmado**.

### A.1 Divergências em relação à documentação

1. **Servidores de nomes.** O ADR 0006 registrava `a.auto.dns.br` e `b.auto.dns.br`. O responsável confirmou no painel **[R]** `d.sec.dns.br` e `e.sec.dns.br`, e a consulta pública **[P]** coincide. **O ADR 0006 foi corrigido.** O motivo da diferença não é conhecido (a hipótese de que o sufixo `sec` indique DNSSEC no Registro.br **não está confirmada**).
2. **DNSSEC.** O plano dizia "verificar DNSSEC e DS". Há **evidência pública [P]** de DS no `.com.br` e DNSKEY na zona. O painel do Registro.br **não apresenta opção nem indicação de DNSSEC** e o responsável **não conseguiu confirmar a configuração administrativa [R]**. Portanto: **não se afirma que o DNSSEC está desativado nem que o DS foi cadastrado manualmente.** Quem o ativou, como e quando são desconhecidos.
3. **Registros extras.** O responsável confirmou **[R]** que a zona só tem os dois registros `A`. Não há MX, TXT, AAAA, CNAME nem CAA.

### A.2 Comandos para repetir as consultas (somente leitura)

Linux, macOS ou WSL, com `dig`:

```sh
D=menubora.com.br
dig +short NS $D
dig +noall +answer SOA $D
dig +short A $D;    dig +short A www.$D
dig +short AAAA $D; dig +short MX $D; dig +short TXT $D; dig +short CAA $D
dig +short DS $D @8.8.8.8
dig +dnssec +noall +answer +comments DNSKEY $D @8.8.8.8
dig +trace $D          # mostra a delegação a partir da raiz e o DS no pai
dig +short A $D @d.sec.dns.br; dig +short A $D @e.sec.dns.br
```

Windows (PowerShell), sem CAA:

```powershell
$d='menubora.com.br'
foreach($t in 'NS','SOA','A','AAAA','MX','TXT','DS','DNSKEY'){ Resolve-DnsName $d -Type $t -Server 8.8.8.8 -DnssecOk -DnsOnly }
Resolve-DnsName "www.$d" -Type A -Server 8.8.8.8 -DnsOnly
```

Validação do DNSSEC: em `dig +dnssec`, o indicador `ad` na resposta do 8.8.8.8 indica que o resolvedor validou a cadeia. **Ainda não foi conferido.**

## Parte B — Painel do Registro.br

Informações do responsável **[R]**, de 2026-11-18. O responsável também informou, de forma geral, que os **dados de segurança e de administração foram conferidos e estão corretos**. Os itens sem informação específica (B.6, B.9 e B.10) ficam como **Pendente**; nada foi presumido.

| # | Item | Registrado | Situação |
| --- | --- | --- | --- |
| B.1 | Datas do domínio | Criado em 17/11/2026; expira em 17/11/2027; domínio novo **[R]** | **Confirmado** |
| B.2 | Servidores DNS | O domínio usa o DNS do próprio Registro.br: `d.sec.dns.br` e `e.sec.dns.br` **[R]**. Coincide com a consulta pública **[P]** | **Confirmado** |
| B.3 | DNSSEC: ligado ou desligado; DS gerenciado pelo Registro.br ou informado manualmente | O painel **não apresenta opção nem indicação de DNSSEC [R]**. Evidência pública **[P]**: DS no `.com.br` e DNSKEY na zona. O responsável **não conseguiu confirmar a configuração administrativa [R]** | **Pendente.** Evidência pública sem confirmação administrativa |
| B.4 | Dados do DS cadastrado | O painel não mostra. Valores só por consulta pública **[P]**: KeyTag `56886`, algoritmo `13`, digest tipo `2`; DNSKEY flag `257`, algoritmo `13` | **Pendente.** Sem confirmação administrativa |
| B.5 | Lista completa de registros da zona | Dois registros `A` **[R]** (ver parte D). **Nenhum outro registro**. O painel **não informa TTL** nem outros dados desses registros **[R]** | **Confirmado** (registros). TTL: **não informado pelo painel** |
| B.6 | Quem ligou o DNSSEC e quando | Não informado. O painel não apresenta DNSSEC | **Pendente** |
| B.7 | Contatos e dados cadastrais | Contatos e dados cadastrais **corretos [R]** (conferidos pelo responsável) | **Confirmado** |
| B.8 | 2FA da conta do Registro.br e método | **Autenticação de dois fatores ativada [R]**; o responsável informa que há **método de autenticação disponível [R]**. **O método específico não foi informado e não foi presumido.** A força do método (por exemplo, chave de segurança ou aplicativo) não está registrada | **Confirmado** (2FA ativado). Método específico: **não informado**; relevante para o ABERTO-20 |
| B.9 | Bloqueio ou trava de transferência e de alteração | Não informado | **Pendente** |
| B.10 | Renovação: valor e se é automática | Não informado. O valor pago foi R$ 40,00 por ano (ADR 0006); **o valor de renovação continua NÃO CONFIRMADO** | **Pendente** |

## Parte C — hPanel da Hostinger

Informações do responsável **[R]**, de 2026-11-18.

| # | Item | Registrado | Situação |
| --- | --- | --- | --- |
| C.1 | IP público da VPS | `187.53.123.179` **[R]**. É o IP dos dois registros `A` | **Confirmado** |
| C.2 | Domínio e zona DNS na Hostinger | **Não existe domínio cadastrado no hPanel nem zona DNS na Hostinger [R].** A Hostinger **não administra** a zona atual. (O domínio gratuito de 1 ano segue não resgatado, como no ADR 0006) | **Confirmado** |
| C.3 | Aplicativos e recursos adicionais | **Nenhum aplicativo adicional está disponível no painel [R].** O Docker foi instalado por SSH em 17/11/2026 **[R]**, o que coincide com o ADR 0006. A pendência do ADR 0006 sobre quais recursos do assistente foram marcados (Monarx, Gerenciador Docker) **não é dada por encerrada por esta informação** | **Informado** |

## Parte D — Inventário consolidado

"Obrigatório na Cloudflare" indica se o registro precisa existir na zona antes da troca (F8-B2).

| Nome | Tipo | Valor | TTL (painel) | Fonte | Obrigatório na Cloudflare | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| `menubora.com.br` | A | `187.53.123.179` | **Não informado pelo painel** | [R]; [P] confirma o valor | Sim | Em "somente DNS" até o F8-B7. Consulta pública mostrou TTL 3600 no resolvedor, **não confirmado** como TTL da zona |
| `www.menubora.com.br` | A | `187.53.123.179` | **Não informado pelo painel** | [R]; [P] confirma o valor | Sim | Redirecionamento 301 só depois (M15). Mesma observação de TTL |

**Não existem outros registros na zona [R].** Consequência para a F8-B2: só dois registros precisam ser copiados, e não há MX nem TXT de e-mail a preservar.

## Parte E — Consequências para o F8-B3 (para planejar, não para executar)

**Orientação do responsável (2026-11-18):** não investigar agora como o Registro.br administra o DNSSEC nem como o DS é removido. A investigação operacional será feita **na F8-B3**, durante a preparação da migração, quando a conta Cloudflare estiver criada e a nova zona estiver sendo preparada. O procedimento exato será definido ali, com base na configuração disponível naquele momento.

**Condição técnica registrada (vale para a F8-B3 e a F8-B5):**

1. **Antes da troca dos nameservers, será necessário tratar o DS antigo** publicado no `.com.br` (evidência pública: KeyTag 56886).
2. **A troca não pode ocorrer enquanto houver incompatibilidade** entre o DS publicado e a assinatura DNSSEC da nova zona. Nessa situação, resolvedores que validam podem falhar na resolução (SERVFAIL).
3. **O procedimento exato é definido na F8-B3**, com a configuração disponível na hora. As fontes públicas descrevem ordens diferentes; seguir a documentação vigente do Registro.br e da Cloudflare no momento da execução.
4. **Não presumir que remover os registros da zona DNS remove o DS automaticamente.** O DS fica na delegação do `.com.br`, não na zona.

Outras observações para o planejamento:

- **Janela de risco.** Como não há deploy, a troca hoje não afeta serviço real. Depois do lançamento, o custo dessa janela é maior.
- **TTL.** O TTL da delegação no `.com.br` e o TTL da zona não estão confirmados; medir a delegação com `dig +trace` antes de planejar a espera.
- **Rota de retorno.** Guardar os dados de B.2, B.4 e da parte D para recompor a zona e o DS se for preciso voltar.

## Pendências para concluir a F8-B1

1. **B.3, B.4 e B.6:** confirmação administrativa do DNSSEC (como está configurado, quem o gerencia, desde quando). **Continuam não verificadas.** Por orientação do responsável, a investigação operacional fica para a F8-B3; enquanto isso, o "estado do DNSSEC" só tem evidência pública.
2. **B.9:** bloqueios ou travas do domínio.
3. **B.10:** valor de renovação e renovação automática.
4. **TTL da zona:** o painel não informa; decidir se basta registrar como "não informado" (a consulta direta ao autoritativo mostra o valor servido, mas é observação pública).
5. **Validação `ad` do DNSSEC** em `dig +dnssec` (opcional; reforça a evidência pública).
6. **B.8, método específico do 2FA:** não informado; opcional para a F8-B1, relevante para o ABERTO-20.
7. **Conferência e assinatura do responsável** neste documento.

Resolvidas nesta atualização: **B.7** (contatos e dados cadastrais corretos) e **B.8** (2FA ativado).

## Fechamento da tarefa

- [ ] Partes B e C preenchidas pelo responsável, sem lacunas. **Parcial:** pendentes B.3, B.4, B.6, B.9 e B.10.
- [x] Todos os registros do painel (B.5) estão na parte D (dois registros `A`, confirmados pelo responsável).
- [ ] O estado do DNSSEC (B.3 e B.4) coincide com a parte A **ou** a divergência está explicada. **Pendente:** há evidência pública, sem confirmação administrativa.
- [ ] O responsável conferiu e assinou o documento (nome e data).
- [x] O ADR 0006 foi corrigido conforme a parte A.1 (servidores de nomes) e o ROADMAP registra o estado real da tarefa.

Conferido por: ______________________  Data: ____/____/______
