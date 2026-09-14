# Avisos do encontro

O administrador acessa `/admin/avisos`, seleciona um evento configurado e publica
um título e uma mensagem. Pode editar, retirar da home e republicar. A retirada
preserva o conteúdo no admin. O texto é simples, com quebras de linha, sem HTML.

Na Home de `/participante`, a seção Avisos aparece depois do status do acesso.
Mostra primeiro os três avisos mais recentes, com evento, mensagem e data; “Ver
todos os avisos” expande a lista. “Atualizar” consulta novamente o servidor.
Retornar à Home também recarrega os avisos. Falhas de carregamento não são
apresentadas como uma lista vazia.

## Acesso e persistência

- As funções administrativas usam `requireAdmin`, com identidade de auditoria
  obtida do middleware. A leitura usa `requireParticipantAccess`.
- Só entram na home avisos publicados de eventos atualmente configurados e cuja
  publicação no CoroApp foi confirmada pelo servidor.
- Uma fonte indisponível não bloqueia as fontes saudáveis. Se nenhuma fonte pode
  ser confirmada e houve falha, a interface permite tentar novamente.
- Avisos de fontes removidas podem ser retirados. Republicação ou mudança de
  evento exige um evento configurado.
- `event_notices` tem RLS e não concede acesso direto a `anon`/`authenticated`.
  O servidor possui apenas SELECT, INSERT e UPDATE; não há exclusão física na UI.

## Ativação

Migração: `supabase/migrations/20260914013721_create_event_notices.sql`.

Esta implementação foi validada localmente. A publicação do código no Git não
aplica a migração: a ativação no banco remoto deve ser verificada separadamente.

Antes da ativação, confirmar o projeto Supabase de destino e aplicar somente a
migração acima, com autorização de produção. Ela cria uma tabela e três índices;
não altera inscrições, pagamentos ou documentos. Depois, publicar o código e
verificar um aviso no admin e na Home de um participante ativo, incluindo edição
e retirada. Conferir separadamente a versão de código e o registro da migração.

Para rollback, reverter o código do módulo e preservar a tabela com os avisos.
Não é necessário excluir dados para desativar a interface.

## Validação realizada

- Testes de publicação, validação de campos, edição, retirada, fontes removidas e
  indisponíveis, limites administrativos e integração da Home.
- Testes existentes da navegação, do shell do participante e da autorização.
- Migração executada em PostgreSQL local isolado (PGlite), verificando restrições,
  bloqueio de leitura/escrita por usuários comuns e gravação pelo servidor.
- Prévia dos componentes reais em largura de 390 px, com dados fictícios e
  persistência em memória, incluindo o formulário de publicação.
