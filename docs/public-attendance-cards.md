# Cartões individuais e chamada pública

Os cartões usam o modelo aprovado no chat de WhatsApp: canvas 1080 × 1920,
avatar circular à esquerda, nome de crachá à direita, coro e nome completo,
quarto/colegas quando houver hospedagem e QR grande na metade inferior.

O QR contém `/cartao?token=…`, usando o token aleatório persistido para a
inscrição. Abrir o cartão nunca registra presença. A página `/chamada` lista
as atividades ativas com presença e abre um leitor contínuo sem login.

## Geração dos arquivos

Na raiz do projeto, com as variáveis de servidor em `.env.local`:

```powershell
node --env-file=.env --env-file=.env.local scripts/export-participant-cards.mjs
python scripts/render-participant-cards.py
```

O exportador lê o snapshot administrativo completo e os tokens existentes;
nunca recria tokens ou registra presença. A montagem usa Pillow e OpenCV,
com Node/qrcode para máscaras alternativas quando necessário. As fontes são
as fontes Segoe UI e Georgia presentes no Windows.

As imagens e a planilha ficam em `output/participant-cards/`, ignorado pelo
Git. Não publicar esse diretório como uma galeria pública: inclui fotos,
hospedagem e links individuais. O ZIP inclui os PNGs e a planilha, sem fotos
originais ou manifesto interno. Compartilhar com cada participante somente
o cartão correspondente.

O renderizador adapta a tipografia de nomes longos e confirma que cada QR
decodifica para o link esperado no cartão completo e na redução 540 × 960.
Essa verificação não mede velocidade de câmera física nem comprova entrega
de mensagens do WhatsApp.

## Banco e publicação

A migração `20261120051219_public_attendance_cards.sql` foi aplicada em
20/11/2026 no projeto `mtkjsrbywymwixwscosf`, com registro no histórico.
Foram confirmados 157 cartões únicos para 157 inscrições não canceladas com
`payment_status = 'paid'`. As cinco atividades habilitadas retornaram esse
mesmo total. As tabelas e RPCs seguem restritas a `service_role` com RLS.

A gravação real, releitura idempotente e rejeição de token inválido foram
verificadas em uma transação revertida, sem deixar presenças de teste.

Banco ativo, código local, merge Git e publicação Lovable são etapas distintas.
Antes de distribuir os links, publicar a versão com `/cartao` e `/chamada` e
verificar esses endereços. Não apresentar a geração de arquivos como prova
de que a versão pública já foi publicada.
