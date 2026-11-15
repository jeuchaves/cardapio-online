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
