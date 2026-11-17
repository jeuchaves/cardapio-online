# Roteiro em celular físico (PEND-37, itens da Fase 7A)

- Situação: **pendente**. Não há aparelho físico neste ambiente; nenhum item abaixo foi executado nem foi simulado como aprovado.
- Quem executa: o usuário (ou pessoa de confiança), em Android e iPhone, na rede móvel e no Wi-Fi.
- Preparação: ambiente de homologação ou `pnpm dev` acessível ao celular, com um restaurante de teste que tenha logo, fotos em alguns produtos (e em outros não), um produto com adicionais, uma mesa com QR Code impresso e um `owner` e um `staff`.
- Preencha a coluna "Resultado" com Aprovado, Reprovado ou Observação.

Os 10 itens originais estão em [F7-T8, seção 6](F7-T8-validacao-final.md). Os itens abaixo são os **novos da Fase 7A**.

| # | Cenário | Resultado esperado | Resultado |
| --- | --- | --- | --- |
| 1 | Abrir o cardápio pelo QR Code da mesa | Banner com logo e nome legíveis; "Você está na Mesa N"; sem rolagem lateral; descrição longa recolhida com "Ver mais" que expande e recolhe | |
| 2 | Rolar o cardápio com muitas categorias | Chips de categoria rolam na horizontal sem cortar o texto; o chip ativo acompanha a rolagem | |
| 3 | Produto com foto, sem foto e com nome muito longo | Em todos, nome, descrição, preço e ação sem sobreposição; "+" ou "Opções" na mesma borda direita; nenhum texto sobre a foto | |
| 4 | Tocar em "+" num produto sem adicionais | Toast "adicionado ao carrinho" e contador do carrinho sobe; o alvo é confortável para o polegar | |
| 5 | Tocar na linha de um produto com adicionais | Abre o detalhe; escolher adicionais, quantidade, adicionar; o total do carrinho vem da cotação | |
| 6 | Abrir o carrinho com o teclado aberto | Miniaturas visíveis; produto sem foto mostra a inicial; a barra do carrinho e o botão de enviar não ficam cobertos | |
| 7 | Checkout: enviar vazio, depois preencher | Erros em português junto de Nome (e Telefone em retirada), foco no primeiro campo com erro; telefone formata ao digitar; colar "+55 (11) 98888-7777" e editar no meio funcionam | |
| 8 | Checkout com a rede desligada (modo avião) ao enviar | Mensagem "Falha de comunicação" com o que foi digitado mantido; religar a rede e enviar de novo cria um só pedido | |
| 9 | Acompanhamento do pedido com o painel avançando o status | A etapa nova aparece destacada com uma transição curta; com "reduzir movimento" ligado no sistema, sem animação e com a mesma informação | |
| 10 | Painel: menu "Área" em 320 a 390 px | Abre e fecha por toque; todos os itens do `owner` (7) e do `staff` (5) alcançáveis; sem rolagem lateral | |
| 11 | Painel: formulários de categoria, produto, adicional, mesa e equipe enviados vazios | Erro junto de cada campo, foco no primeiro, alvo de toque de 44 px nos botões Salvar e Cancelar, que têm o mesmo tamanho | |
| 12 | Painel: salvar telefone em Configurações | Máscara aplicada; ao reabrir, o telefone aparece formatado | |
| 13 | Leitor de tela (TalkBack e VoiceOver) no checkout e no login | Cada campo anuncia rótulo e erro; o menu "Área" anuncia expandido ou recolhido; a etapa atual do pedido é anunciada | |

Ao concluir, registrar o resultado no ROADMAP (PEND-37) e anotar as observações. Qualquer item reprovado vira pendência com severidade.
