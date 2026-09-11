# Inscrição em etapas

## Objetivo
Transformar a inscrição atual em um fluxo guiado, mais confortável no celular e mais chamativo, sem alterar os dados exigidos nem a integração de pagamento.

## Experiência proposta
- **Etapa 1 — Seus dados:** nome, CPF, e-mail, WhatsApp e nascimento, com campos altos e leitura fácil.
- **Etapa 2 — Sua participação:** coro/diocese, perfil musical e foto, mostrando o valor assim que o coro for escolhido.
- **Etapa 3 — Conferir e pagar:** resumo dos dados, valor, forma de pagamento disponível e opção de voltar para corrigir.
- Indicador visual de progresso com três etapas, títulos curtos e estado atual bem destacado.
- Botões grandes de “Continuar”, “Voltar” e “Ir para pagamento”.
- Uma etapa por vez, mantendo tudo o que já foi digitado ao avançar ou voltar.

## Validação e erros
- Validar somente os campos da etapa atual ao avançar.
- Levar o foco ao primeiro campo com erro e exibir a mensagem junto dele.
- Manter o tratamento existente para CPF duplicado, alteração de preço, falha de carregamento e indisponibilidade da InfinitePay.
- Em falhas de pagamento, permanecer na revisão sem perder dados ou foto.

## Dados, segurança e pagamento
- Nenhuma mudança no banco, nos dados coletados ou nas regras de preço.
- A validação completa continuará sendo feita antes de criar a inscrição.
- O servidor continuará determinando o valor confiável e criando o pagamento na InfinitePay.
- A foto manterá os formatos e limite atuais.

## Implementação técnica
- Reorganizar o formulário atual em três painéis controlados pelo estado da etapa.
- Reutilizar os componentes e tokens visuais existentes, ampliando campos e áreas de toque.
- Exibir o resumo de preço dentro das etapas de participação e revisão, evitando excesso de informação na primeira etapa.
- Preservar acessibilidade com `fieldset`, foco, estado de progresso, mensagens anunciadas e navegação por teclado.

## Testes e entrega
- Atualizar os testes do formulário para avanço, retorno, bloqueio por etapa, revisão e envio.
- Revalidar os cenários de promoção, preço normal, CPF duplicado, foto e falha de checkout.
- Conferir visualmente em desktop e celular, inclusive ausência de sobreposições.
- Rodar os testes relacionados, a verificação completa e confirmar a página no navegador.