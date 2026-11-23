# Avaliação pública do encontro

O usuário aprovou uma página pública em `/avaliacao`, sem login, com a logo oficial, cinco perguntas e respostas anônimas persistidas. Prioridade: celular, visual rico na identidade preta, branca e dourada existente e conclusão em aproximadamente dois minutos.

## Abordagem

Usar um formulário em quatro etapas, em vez de uma tabela horizontal ou uma página longa: avaliação geral; sete aspectos do evento com a contribuição para o coro na mesma tela; intenção de voltar; sugestão opcional. Transporte foi removido a pedido do usuário. A segunda etapa usa grupos de opções que se ajustam a 320px, incluindo “Não utilizei” somente para Alimentação e Hospedagem. A contribuição usa opções em uma coluna. Manter respostas ao voltar. Progresso, seleção por texto e ícone, foco acessível, alvos de pelo menos 44px e confirmação somente após o servidor salvar. A compactação visual foi desfeita a pedido do usuário, restaurando o espaçamento original.

Logo oficial discreta e nome “Sua voz faz a diferença” no topo, sem foto ou banner. Tipografia Manrope nos controles; enquadramento preto, superfícies claras e dourado em seleção/foco. Documento ajustado à altura visível; somente perguntas podem rolar, com botões sempre visíveis e opções exibidas diretamente, sem combobox. Totais reais de inscrições não canceladas e avaliações no topo, consultados no servidor apenas como contagem; ausência de acesso é representada por “—”. Sem convite ou botão de compartilhar, removidos pelo usuário, mas com imagem oficial de 1200×630 nos metadados Open Graph para WhatsApp. Nenhuma mudança na página inicial ou em fluxos financeiros. Nova tabela independente, RLS e acesso somente pelo servidor; nenhum nome, CPF, email ou conta. UUID de envio persistido no navegador evita duplicação em tentativas de rede. Validação no servidor e no banco. Erros preservam respostas e permitem tentar novamente.

Publicação usa o projeto Lovable existente; não criar um Site separado. Preparar e verificar a implementação antes de qualquer publicação.

Notas visuais usam cinco estrelas estilo Uber, preenchidas até a nota escolhida, com resposta textual e descrição acessível. Cada critério tem ícone Lucide próprio. “Não utilizei” é permitido somente em Alimentação e Hospedagem; os demais critérios exigem nota no servidor e no banco. Não mostrar escala numérica na tela.
