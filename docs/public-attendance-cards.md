# Cartões individuais e chamada pública

Os cartões usam o modelo aprovado no chat de WhatsApp: canvas 1080 × 1920,
avatar circular à esquerda, nome de crachá à direita, coro e nome completo,
QR central logo abaixo da identificação e quarto/colegas quando houver hospedagem
abaixo dele. A acomodação tem ícone de cama e número destacado. O QR ocupa um
quadro de 724 × 724, com módulos escalados em pixels inteiros para manter nitidez.
O bloco de hospedagem tem área própria, separado do QR e do rodapé.

O QR contém `/cartao?token=…`, usando o token aleatório persistido para a
inscrição. Abrir o cartão nunca registra presença. A página `/chamada` contém
o Gerenciamento do evento, bloqueado por CPF liberado no servidor.

## Gerenciamento do evento

No celular, a navegação fica na parte inferior: Leitor QR e Relatórios. O leitor
cabe no viewport sem rolagem da página. Listas longas têm rolagem interna; as
respostas de van e alimentação abrem em uma janela própria com a câmera pausada.
A câmera continua aberta entre leituras e somente confirmações do servidor contam.
Buscar nome permite localizar os confirmados por partes do nome, sem exigir acentos,
e marcar presença com a mesma fila idempotente do QR. A lista é pré-carregada ao
abrir a atividade; a filtragem ocorre em memória a cada tecla, sem debounce nem
consultas ao servidor durante a digitação. Pessoas já presentes ficam
identificadas; a câmera pausa durante a busca e retoma ao fechá-la. A paleta dos
botões e janelas permanece clara e com texto contrastante, inclusive com tema escuro
salvo no aparelho.

O bloqueio usa o CPF de uma inscrição não cancelada com conta ativa. Após a
validação, o servidor emite um cookie assinado HttpOnly, SameSite Strict e de oito
horas; o CPF não fica no cookie nem no armazenamento do navegador. As permissões
são verificadas novamente em cada operação, portanto a revogação também vale para
um aparelho já desbloqueado. CPF é um bloqueio fraco, e não substitui uma senha secreta.

Administradores têm o leitor QR. Relatórios dependem de uma permissão separada,
mesmo para administradores. Em Inscrições > Mais, Habilitar/Remover Gerenciamento
do evento configura somente relatórios; não concede acesso financeiro ou ao leitor.
O campo é mantido em Auth app_metadata.event_report_registration_id, que somente
o servidor administrativo altera; user_metadata nunca é usado na autorização.
Nesta entrega, a permissão foi ativada somente para Gerbson Lima e Pe. Lucas Soares.
Os dois registros permanecem configuráveis pela administração.

Cada relatório usa o snapshot completo dos confirmados não cancelados e as
presenças da atividade escolhida, sem limitar os dados à página visível. Inclui
totais e totais por coro, presentes, ausentes, uso da van e restrições alimentares.
Respostas não informadas ficam separadas de Não. Van e alimentação consideram
todos os confirmados, presentes ou ausentes.

O PDF é preparado no servidor junto com o relatório, antes de habilitar o botão
Compartilhar PDF. Em aparelhos compatíveis abre a seleção de aplicativos para
escolher WhatsApp, compartilhando o arquivo PDF. Sem suporte, baixa o PDF para
anexar manualmente. A geração não depende de imagens externas.

O banco ativo ainda precisa da migração existente
20261120120000_expand_dietary_restriction_answers.sql para salvar tipos detalhados
de restrição. Enquanto isso, o relatório continua mostrando o booleano já salvo
e Tipo não informado, sem inventar tipos ou transformar ausência em Não. O leitor
também mantém foto/coro/hospedagem disponíveis com o esquema anterior.

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
