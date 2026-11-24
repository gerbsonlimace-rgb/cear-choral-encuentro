# Surpresa após a avaliação

Preparada a pedido do usuário para receber a versão final do vídeo do chat `01a204fe-f3c4-7740-b590-2cc74bce242a`. O usuário escolheu aguardar a versão final, em vez de usar os MP4s antigos. Nenhum deles foi publicado na avaliação.

## Ativação quando o MP4 estiver concluído

1. Publicar o MP4 final como arquivo público no projeto original `e6f04773-e2dc-44c3-a483-34df39d64822`, usando uma URL versionada e com MIME `video/mp4`. Preferir arquivo otimizado para celular, H.264/AAC e faststart. Não guardar um arquivo grande no histórico Git. Se o arquivo estiver em outro domínio, permitir CORS para o site, pois a preparação faz fetch.
2. Preencher `url` em `src/features/event-feedback/feedback-surprise.json` com a URL pública. `posterUrl` é opcional. A URL não pode ser uma página de player, endereço local ou link que exija login.
3. Testar no celular e publicar a atualização no Lovable original. Até definir essa URL, o formulário continua normal e não oferece um botão que abriria um vídeo inexistente.

## Comportamento

- O vídeo é baixado por completo em segundo plano desde a primeira pergunta, sem áudio ou reprodução. A implementação não depende apenas da sugestão `preload` do navegador.
- Depois que o servidor confirma o envio da avaliação, aparece “Finalizar e ver surpresa”. O clique abre um player de tela inteira, com controles nativos, e tenta reproduzir o arquivo já preparado. Se a transferência ainda não terminou, mostra “Preparando sua surpresa…”; quando concluir, a pessoa usa o play nativo.
- Fechar o player pausa a reprodução e retorna à confirmação da avaliação. Diálogo nativo mantém o foco, oferece Escape e permite os controles do celular.
- Falha no vídeo não interfere no envio das opiniões. O player informa que a avaliação já foi salva e oferece nova tentativa.
- A transferência é cancelada ao sair da página, e a URL temporária do arquivo é liberada. Esse cache é da página atual, não um download para a galeria nem uma garantia de funcionamento offline após recarregar.
- O tempo para preparar depende da conexão e do tamanho do MP4 final. Não é possível prometer carregamento completo antes do fim de uma avaliação muito rápida.

Implementação: `FeedbackSurprise.tsx`; ponto de ligação: `EventFeedbackPage.tsx`. Testes cobrem preparação antecipada, ativação somente após salvar, ausência de autoplay durante o questionário, falha, retry e liberação do arquivo.

Verificação: 18 testes passaram, além de TypeScript e build. Na prévia técnica em Chrome de 390×844, o vídeo já estava completamente preparado (`readyState=4`) e pausado antes do clique; o clique iniciou a reprodução, e Escape pausou e devolveu o foco ao botão. O botão mede 52px de altura. O arquivo provisório foi usado somente nessa prévia local, sem gravar avaliações nem publicar o vídeo antigo.
