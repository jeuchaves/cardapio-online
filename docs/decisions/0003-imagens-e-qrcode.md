# ADR 0003 — Imagens e QR Code

- Status: aprovado — tarefa F0-T7
- Data: 2026-11-15
- Referências: `CLAUDE.md` seções 3, 8 e 9; ROADMAP seções 3, 4.5, 6 e 8.3, PEND-11, PEND-12 e ABERTO-02

## Contexto

Produtos e o restaurante têm imagem (produto e logo). Cada restaurante imprime QR Codes que levam ao cardápio ou a uma mesa. O provedor de object storage de produção ainda não foi escolhido (ABERTO-02), então esta decisão não pode depender de nenhum provedor específico.

## Decisão

### Imagens

1. **Sem integração antes da Fase 3.** Nada de storage é criado na Fase 1 ou 2. A implementação começa em F3-T5.
2. **Dois destinos, escolhidos por variável de ambiente:** disco local em desenvolvimento e testes; object storage compatível com a API S3 em produção. O código usa o protocolo S3 genérico (endpoint, região, bucket e credenciais por variável de ambiente), **sem recurso exclusivo de um provedor**.
3. **O banco guarda só a chave relativa**, por exemplo `restaurants/<restaurant_id>/products/<uuid>.webp`. A URL pública é montada em tempo de resposta a partir de uma base configurável, o que permite trocar de provedor sem migration de dados.
4. **Nome e caminho gerados pelo servidor:** UUID aleatório mais extensão derivada do tipo detectado. O nome enviado pelo cliente nunca é usado. O caminho é isolado por restaurante, e o `restaurant_id` vem do contexto autorizado, nunca do payload.
5. **Validação:** apenas JPEG, PNG e WebP; tipo detectado pelo **conteúdo** (assinatura do arquivo), extensão coerente com o tipo detectado, máximo de 5 MB. Qualquer outro caso responde `422 INVALID_IMAGE`. Não há SVG.
6. **Substituição e remoção:** ao trocar ou remover a imagem, a API grava a nova chave e remove o arquivo anterior. Se a remoção do arquivo falhar, o erro é registrado em log e não derruba a operação. Não há rotina de limpeza agendada.
7. **Leitura:** as imagens do cardápio são públicas por natureza e servidas por URL sem autenticação. O storage de produção não permite listagem pública nem escrita anônima. As imagens nunca são servidas como código executável.
8. **Biblioteca de storage:** a escolha do pacote (preferindo o recurso oficial do AdonisJS, se atender ao requisito) é feita em F3-T5, aplicando a regra de dependências do `CLAUDE.md`, e fica registrada em adendo a este ADR. **Nenhuma dependência é adicionada agora.**

### QR Code

1. Gerado **no frontend** com a biblioteca `qrcode` (dependência aprovada no ROADMAP, instalada apenas em F4-T4). Não há endpoint de QR Code nem armazenamento do QR.
2. O conteúdo é **somente a URL pública**: `<base pública>/r/:slug` para o restaurante e `<base pública>/r/:slug?mesa=:identifier` para a mesa. A base pública vem de variável de ambiente.
3. O QR Code **não é credencial.** O identificador da mesa é um código curto aleatório e não sequencial, que dá apenas contexto ao pedido e não concede acesso (`CLAUDE.md` seção 8).
4. O QR nunca contém o `tracking_token`, e-mail, telefone ou qualquer dado pessoal.
5. Alterar o slug invalida QR Codes já impressos, e a API exige `confirm_slug_change` (ROADMAP 8.2). Alterar ou excluir uma mesa invalida o QR dela.

## Consequências

- Duas dependências novas, já aprovadas no ROADMAP: `qrcode` no web (F4-T4) e um driver S3 na API (F3-T5, pacote definido ali). Nenhuma delas entra antes da fase correspondente.
- Os testes de upload (F3-T5) rodam contra o disco local. O contrato S3 precisa de verificação em homologação, após a escolha do provedor (ABERTO-02, que bloqueia só a produção).
- Backup (F6-T5) cobre o banco **e** as imagens.
- Trocar de provedor exige copiar os objetos e ajustar as variáveis de ambiente, sem alterar o banco.

## Adendo (2026-11-18) — entrega de imagens em produção

Revisão motivada pela arquitetura B do [ADR 0006](0006-arquitetura-de-infraestrutura-e-hospedagem.md): em produção, as imagens são entregues por `img.menubora.com.br` (domínio personalizado do bucket R2, com a zona na Cloudflare), e não mais pela rota `/uploads/*` da API. Efeitos:

- `UPLOADS_PUBLIC_BASE` passa a ser a URL do domínio de imagens; o banco guarda só a chave, então não há migration (decisão 3 deste ADR).
- O bucket de imagens é público e só contém imagens; nunca recebe backups nem dados de pedidos.
- Os cabeçalhos que o controller de `/uploads` define (`nosniff`, CSP restritiva, `Cache-Control`) precisam existir também nas respostas do R2 (metadados do objeto ou Transform Rules); verificar na validação do driver S3.
- A rota `/uploads/*` e o rewrite do Next permanecem para desenvolvimento e testes com disco local.
- O CSP do frontend (Report-Only, F8-T2) deve permitir o domínio de imagens em `img-src`.
- **O upload continua passando pela API** (validação por bytes, 5 MB, nome gerado pelo servidor). Upload pré-assinado direto ao R2 **não foi adotado** e exigiria novo ADR (ABERTO-18).
- O driver S3 continua **não instalado e não validado contra o R2**.

## Adendo — F3-T5 (upload de imagens)

- **Biblioteca:** `@adonisjs/drive` 4 (recurso oficial; flydrive 2). Só o serviço `fs` está configurado (`apps/api/config/drive.ts`), em `UPLOADS_ROOT` (padrão `storage/`, ignorado pelo git). O SDK do S3 é peer opcional e **não foi instalado**: o serviço S3 será acrescentado à mesma configuração quando o provedor for escolhido (ABERTO-02). **O caminho S3 não foi validado contra nenhum provedor.**
- **Leitura:** rota própria `GET /uploads/*` (o `serveFiles` do drive fica desligado). Só serve chaves no formato exato `restaurants/<uuid>/(products|logo)/<uuid>.(jpg|png|webp)`; o `Content-Type` vem da extensão da chave, com `X-Content-Type-Options: nosniff`. Sem listagem e sem sessão. O Next repassa `/uploads/*` para a API.
- **URL:** o banco guarda a chave; a API devolve `image_url` / `logo_url` a partir de `UPLOADS_PUBLIC_BASE` (padrão `/uploads`).
- **Validação:** um único arquivo no campo `file`; tipo detectado pelos bytes (JPEG `FF D8 FF`, PNG, WebP `RIFF` + `WEBP` nos bytes 0–3 e 8–11); extensão e MIME informados pelo cliente precisam ser coerentes com o tipo detectado; máximo de 5 MB conferido no tamanho efetivo do arquivo temporário.
- **Multipart:** só as duas rotas de imagem processam multipart (`autoProcess` por rota). O limite do corpo é 6 MB (os 5 MB da imagem mais o envelope do multipart; acima disso, `413`). O arquivo temporário vai para `apps/api/tmp/uploads` e o middleware `cleanupUploads` o apaga ao fim de qualquer resposta.
- **Ordem:** validar, gravar o arquivo novo, atualizar o banco (linha travada com `FOR UPDATE`) e só então apagar o antigo. Falha no banco remove o arquivo novo; falha ao remover o antigo é registrada em log (só a chave) e não derruba a operação. Excluir o produto também remove a imagem.
