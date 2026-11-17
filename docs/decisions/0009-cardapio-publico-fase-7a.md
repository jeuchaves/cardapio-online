# ADR 0009 — Cardápio público: composição e ajustes de tokens (Fase 7A)

- Status: aprovado — Fase 7A, decisões D-02 e D-03 (autorização de execução de 2026-11-17)
- Referências: [ADR 0008](0008-direcao-visual-papel-e-tinta.md); [F7A](../F7A-melhorias-ux-pre-producao.md) T3, T4, T5 e T10; `CLAUDE.md` seções 1 e 11

## Contexto

O ADR 0008 definiu a identidade "Papel e tinta" e foi aplicado na Fase 7. A revisão da Fase 7A apontou que o cardápio ainda parece genérico: todo produto é um cartão idêntico (caixa branca arredondada), o cabeçalho é uma pilha de texto e selos sem hierarquia, e o botão de adicionar flutuava sobre o cartão.

## Decisão

O ADR 0008 **continua valendo**; este ADR o complementa sem substituí-lo.

1. **Identidade mantida:** papel, tinta e acento oliva único; Geist; sem gradiente, sombra decorativa, fonte nova ou tema por restaurante (que exigiria backend).
2. **Produtos em linhas de menu, não em cartões:** cada categoria é uma única superfície (cartão um degrau acima do papel) com linhas separadas por filete de 1 px. Cada linha: nome, descrição e preço à esquerda; foto à direita e, logo abaixo dela, a ação, **sempre na mesma borda direita**. Produto sem foto mantém a ação na mesma borda (não há quadro vazio). A linha inteira abre o detalhe por um gatilho que a cobre; a ação rápida fica acima dele (botão dentro de botão não é válido). Produto com adicionais mostra "Opções" no lugar do "+". Justificativa: filetes e preço alinhado reduzem a repetição visual, a ação fica no polegar, e a leitura de preços em coluna facilita comparar.
3. **Cabeçalho do restaurante como banner de superfície sólida** (`--accent`, oliva suave, contraste de texto 7,8:1): marca (logo em caixa de proporção fixa com `object-contain`, ou inicial do nome quando não há logo), nome em destaque, descrição recolhida em três linhas com "Ver mais", modalidades e pagamento em texto corrido e telefone como botão de 44 px. Sem imagem de capa e sem gradiente (a capa enviada é a F7A-T5b, fora do lote).
4. **Token de status "Em preparo":** o par violeta (`#eee8f8` e `#4b2e83`) é trocado por verde-azulado (`#dcefee` e `#14504b`, 7,7:1). Violeta/lilás é evitado pelas skills de design e não se confunde com o oliva do acento. Os demais pares ficam como estão (todos acima de 4,5:1, medidos).
5. **Movimento (T10):** só animação funcional no acompanhamento do pedido, sem biblioteca, desligada por `prefers-reduced-motion`, e só depois que a API confirma o status. Isso abre uma exceção ao "sem animação" do ADR 0008, restrita a essa tela.

## Consequências

- Alterações só em `apps/web`; contratos, permissões e dados não mudam; nenhuma dependência.
- Os seletores protegidos do E2E (nome acessível do produto, "Adicionar ao carrinho") são preservados.
- Pedidos já existentes continuam exibindo o token de preparo com a nova cor.
