# Link público “Eu Vou”

## O que será entregue
- Criar o endereço público `https://encontrocorosce.lovable.app/euvou` para o editor de arte “Eu Vou”.
- Remover a exigência de login nessa página, mantendo o editor completo para escolher arte, inserir foto, ajustar, baixar e compartilhar.
- Manter o endereço antigo `/participante/minha-foto` funcionando por redirecionamento para `/euvou`, evitando links quebrados.
- Atualizar o atalho existente na área do participante para abrir o novo endereço.

## Compartilhamento no WhatsApp
- Definir título, descrição, endereço canônico e imagem social específicos para `/euvou`.
- Usar uma imagem pública em formato adequado para a prévia do WhatsApp e apontar `og:image` e `twitter:image` para o mesmo arquivo.
- Permitir indexação da nova página pública; o endereço antigo será apenas um redirecionamento.

## Segurança e erros
- A página não acessará dados pessoais nem funções protegidas do participante.
- Falhas ao carregar uma arte continuarão exibindo a mensagem existente, sem tela em branco.

## Validação e entrega
- Atualizar os testes de navegação e do atalho da área do participante.
- Conferir a página pública no computador e no celular, incluindo os metadados do WhatsApp.
- Validar testes e compilação. A mudança chegará ao endereço público após uma nova publicação.
