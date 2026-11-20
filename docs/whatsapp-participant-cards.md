# Cartões por WhatsApp com wa.me

## Botões na tela de inscrições

`/admin/inscricoes` tem **Enviar cartão** em cada inscrição e **Enviar todos** acima da lista. O envio é o PNG com a legenda completa, pela conta do evento final 3997, em uma única aba do Chrome. Apenas inscrições com `payment_status=paid` e sem cancelamento entram na fila. Enviar todos usa todas as inscrições elegíveis, independentemente dos filtros e da paginação da tela.

Para um grupo específico, marque as caixas ao lado dos nomes e clique em **Enviar selecionados (N)**. **Selecionar elegíveis desta página** marca apenas a página atual, respeitando os filtros. A seleção permanece ao trocar de página e pode ser removida com **Limpar seleção**. Selecionar não envia mensagens. Uma seleção vazia nunca se transforma em envio para todos; o serviço valida os IDs e as condições de cada inscrição novamente antes de criar a fila.

No computador do operador, abra `scripts/iniciar-whatsapp-inscricoes.cmd` e mantenha essa janela ativa. Volte à tela de inscrições e clique em **Conectar serviço**. O Chrome pode pedir acesso à rede local; o serviço atende apenas em `127.0.0.1:4319`. Feche a janela anterior do Chrome criada pelo script de teste antes do primeiro lote, para liberar o perfil de automação.

Os botões só são habilitados quando o serviço local está acessível. Cada chamada verifica a sessão Supabase e a associação administrativa ativa. O serviço aceita apenas a origem oficial ou desenvolvimento em localhost; domínios adicionais devem ser listados explicitamente em `WHATSAPP_ADMIN_ORIGINS`, separados por vírgula. Chaves administrativas e caminhos de imagens permanecem no serviço local.

O botão **Pausar após este cartão** interrompe a fila entre envios. Há apenas uma execução por vez. Envios registrados são pulados e tentativas inconclusivas ficam como **Revisar envio**. O progresso é local a este computador e não é confirmação de entrega. O clique em **Enviar todos** realmente envia os cartões; abrir o serviço ou consultar o progresso não envia mensagens.

O gerador scripts/generate-participant-wa-me-links.mjs prepara um link wa.me por participante, com uma mensagem curta preenchida e a imagem PNG correspondente ao lado. Ele não envia mensagens e não anexa arquivos. O envio fica manual no WhatsApp.

O script inclui inscrições pagas e não canceladas, conforme a regra atual do cartão público e do credenciamento.

## Custo e limites

Gerar e abrir links wa.me não tem tarifa da WhatsApp Business Platform. O wa.me abre uma conversa com o texto preenchido; a pessoa ainda precisa revisar, anexar o PNG e tocar em Enviar. O WhatsApp informa que a mensagem pré-preenchida aparece no campo de texto, não é enviada automaticamente.

O link wa.me não consegue anexar a imagem. Na lista HTML, use a prévia e o caminho do PNG para anexar o arquivo manualmente no chat. O script Playwright abaixo anexa o PNG no Chrome e pode enviar em sequência com a opção explícita `--send`. Para envio por API, configure WhatsApp Business Cloud API e um modelo aprovado.

Envie somente para participantes que aceitaram receber mensagens do evento pelo WhatsApp.

## Gerar a lista

Execute:

    node --env-file=.env --env-file=.env.local scripts/generate-participant-wa-me-links.mjs

O comando cria dois arquivos locais na pasta output/participant-cards:

- whatsapp-envios.html — lista com prévia dos cartões, botão para abrir cada conversa e contador de marcações manuais.
- links-whatsapp.csv — exportação com os links wa.me e os caminhos locais dos PNGs.

Na página HTML, abra a conversa, anexe o arquivo cartoes/NOME-DO-ARQUIVO.png, envie no WhatsApp e depois clique em “Marcar como enviado”. O contador é manual: wa.me não fornece confirmação de envio para a página.

Esses arquivos contêm telefones e links individuais dos cartões. Mantenha-os na pasta local e não os publique.

## Preparar o PNG automaticamente com Playwright

Abra `scripts/abrir-cartoes-whatsapp.cmd` para enviar até 10 cartões em sequência. Ele instala uma versão fixa de `playwright-core` na pasta de saída ignorada pelo Git e abre o Chrome em um perfil exclusivo. Feche a janela anterior desse perfil antes de iniciar outro lote. Na primeira execução, vincule o WhatsApp da conta do evento pelo QR Code. O perfil guarda essa sessão localmente; não compartilhe a pasta de saída.

O script confere o remetente no perfil do WhatsApp e consulta pagamento, cancelamento, telefone e hospedagem no banco antes de cada anexo. Abre uma conversa por vez, escolhe explicitamente **Fotos e vídeos**, anexa o PNG e preenche a legenda completa aprovada. Inclui acomodação e colegas apenas quando o plano atual atribui hospedagem à pessoa; quando não há acomodação, a legenda diz explicitamente que a inscrição não inclui hospedagem. Todas as mensagens trazem o contato oficial do Pe. Lucas Soares (+55 85 9727-8622) para correção de informações. A leitura e a entrega devem ser conferidas no WhatsApp.

Com `--send`, clica em Enviar e segue para a próxima pessoa. O script exige uma mensagem **nova** com a imagem e a legenda — mensagens antigas com o mesmo texto não são aceitas como confirmação — e aguarda o envio assentar antes de navegar para o próximo contato. O WhatsApp mantém o ícone de relógio enquanto a mídia ainda está sendo enviada: **não feche a janela do Chrome** até todas as mensagens estarem com o check. Sem `--managed`, a janela permanece aberta ao final para essa conferência. Sem `--send`, você revisa e envia no Chrome; depois digita `ENVIADO` no terminal. Qualquer outra resposta pausa com o Chrome aberto. A execução seguinte do lote pula envios registrados e tentativas inconclusivas, evitando repetição automática após falhas. Para repetir uma pessoa, use um filtro explícito somente depois de conferir a conversa.

Para preparar apenas uma pessoa:

    node --env-file=.env --env-file=.env.local scripts/prepare-whatsapp-card.mjs --participant="Antonio Gerbson"

Também aceita `--registration=<uuid>`. O filtro de nome deve identificar uma única inscrição. A legenda acompanha a imagem e não contém o link do cartão.

A interface do WhatsApp pode mudar. Se o script não identificar a prévia e a legenda, ele para. O script não marca presença nem altera pagamentos. O WhatsApp desativa abas simultâneas: os lotes usam sempre uma conversa por vez.

## Teste realizado

O teste de 20/11/2026 enviou o cartão de Antônio Gerbson da Silva Lima como foto com a legenda completa, pela conta do evento final 3997 para o telefone cadastrado final 8007. A interface confirmou leitura. Não havia acomodação atribuída a esse participante, portanto o bloco de hospedagem foi omitido. Antes do fluxo corrigido, o teste produziu também uma figurinha e uma mensagem curta; o seletor foi corrigido para usar o menu Fotos e vídeos e o campo específico de legenda da mídia.
