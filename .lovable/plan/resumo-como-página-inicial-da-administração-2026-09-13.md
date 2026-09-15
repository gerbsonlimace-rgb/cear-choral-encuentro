# Resumo como página inicial da administração

## Objetivo
Fazer o acesso principal da administração abrir diretamente o Resumo e eliminar a quebra visual causada pelo conteúdo não respeitar a barra superior e o menu lateral.

## Implementação
- Criar a entrada `/admin` com redirecionamento para `/admin/resumo`, preservando os endereços administrativos existentes.
- Ajustar a página de Resumo para usar a mesma moldura responsiva da navegação administrativa: conteúdo abaixo da barra superior, ao lado do menu no computador e acima da barra inferior no celular.
- Remover espaçamentos e estruturas duplicadas que hoje fazem navegação e conteúdo se sobreporem.
- Manter indicadores, dados, permissões e carregamento atuais sem alterar regras financeiras.
- Completar os metadados próprios das rotas administrativas tocadas, mantendo-as fora da indexação.

## Estados e segurança
- Preservar a checagem de sessão e autorização administrativa.
- Sem sessão válida, encaminhar para a tela de acesso em vez de exibir erro ou tela vazia.
- Manter os estados de carregamento e falha dentro da página ajustada.

## Validação
- Verificar `/admin` e `/admin/resumo` em computador e celular.
- Confirmar que menu, barra superior, cards e conteúdo não se sobrepõem nem causam rolagem horizontal.
- Executar os testes focados da navegação e do resumo e confirmar a compilação da prévia.
