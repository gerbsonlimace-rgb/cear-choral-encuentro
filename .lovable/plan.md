# Menus internos em preto e dourado

## Objetivo
Aplicar a identidade preta, branca e dourada do evento aos menus dos módulos internos, preservando o conteúdo claro e toda a navegação existente.

## Interface
- **Computador:** manter a barra superior preta e transformar a barra lateral branca em preta.
- **Celular:** transformar a barra inferior em preta.
- **Estados:** itens normais em branco suave; item ativo, ícone, marcador e foco em dourado; passagem do mouse com contraste discreto.
- **Menu “Mais”:** manter o painel claro para leitura, usando preto e dourado nos itens e no estado ativo.
- Aplicar o mesmo padrão à Administração e à estrutura compartilhada de Participante e Regente.

## Comportamento e segurança
- Não alterar destinos, permissões, dados, login, logout nem regras de negócio.
- Manter `aria-current`, foco visível, alvos de toque e suporte a movimento reduzido.
- Usar os tokens semânticos já existentes, sem cores soltas nos componentes.

## Validação e entrega
- Atualizar os testes visuais/estruturais dos menus.
- Conferir computador e celular, incluindo menu recolhido, item ativo e “Mais”.
- Confirmar compilação sem erros e registrar a nova regra no guia visual.
