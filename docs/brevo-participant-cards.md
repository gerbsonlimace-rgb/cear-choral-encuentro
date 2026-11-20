# Cartões individuais por e-mail pelo Brevo

O serviço local envia mensagens transacionais individuais pelo endpoint oficial
`POST /v3/smtp/email`. Cada e-mail tem um único destinatário e anexa somente o PNG
do próprio participante. O teste usa o cartão de Gerbson e o e-mail de teste
configurado; seu envio fica separado do lote e não marca o cartão de Gerbson como
enviado para a inscrição.

O corpo da mensagem usa a mesma função do WhatsApp, incluindo os dados atuais
da acomodação, os colegas de quarto e o contato oficial. O assunto é
“Seu cartão do participante”.

## Configuração local

Adicione estas variáveis a `.env.local` no computador que enviará as mensagens:

```dotenv
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=Encontro de Coros
BREVO_TEST_EMAIL=
```

`BREVO_SENDER_EMAIL` deve pertencer a um remetente/domínio autenticado no Brevo.
Se o painel mostrar que o domínio não está autenticado, conclua a autenticação
antes do lote. Mantenha a chave apenas em `.env.local`; ela nunca vai para o
navegador nem para o Git.

Gere os cartões recentes em `output/participant-cards/` e execute
`scripts/iniciar-brevo-cartoes.cmd`. Na administração de inscrições, envie o
teste para conferir assunto, remetente, imagem do evento e o PNG com QR. Após
conferir a caixa de entrada, use **Enviar todos os cartões** para iniciar o lote.
Ele inclui inscrições pagas e não canceladas com endereço válido e pula envios
já aceitos pelo Brevo. Tentativas sem confirmação ficam em revisão para evitar
duplicatas automáticas.

O painel usa a sessão Supabase do administrador; o serviço escuta apenas em
`127.0.0.1:4320` e revalida a associação administrativa ativa em cada chamada.

## Referência da API

O envio usa o endpoint oficial de e-mail transacional do Brevo, com uma imagem
PNG em base64 por destinatário e remetente, assunto e conteúdo HTML explícitos:
[Send a transactional email](https://developers.brevo.com/reference/send-transac-email).
