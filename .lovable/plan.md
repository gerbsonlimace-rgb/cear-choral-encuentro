# Resumo compacto e PDF por coro

## Tela
- Compactar a página **Resumo**, reduzindo alturas, espaços e tamanhos dos ícones dos indicadores.
- Exibir os números gerais em uma única faixa compacta, sem repetir as mesmas contagens em outra seção.
- Manter valores recebidos, taxa de inscrição pendente e rifas separados; preservar o total previsto por coro e a identificação de registros históricos.
- Exibir os coros em uma grade mais densa: três colunas quando houver espaço e uma ou duas em telas menores, sem cortar nomes ou valores.
- Incluir em cada card um botão com ícone **Exportar PDF**, identificado com o nome do coro para acessibilidade.

## Exportação
- Exportar todas as inscrições do coro correspondente ao card, incluindo pagas, pendentes, parcialmente pagas, isentas e históricas, não apenas uma página da lista.
- Usar o PDF já implementado: nome, coro, função, e-mail, WhatsApp, situação financeira, valor pago e taxa pendente, com páginas numeradas e cabeçalho repetido.
- Mostrar o coro no cabeçalho do PDF e não incluir inscritos de outros cards, mesmo quando o coro não estiver associado a um cadastro configurado.
- Após preparar o arquivo, o botão daquele card muda para **Baixar PDF**, mantendo a entrega adequada para celular.

## Arquitetura, dados e segurança
- Reutilizar o resumo e o gerador de PDF existentes; não alterar inscrições, preços, pagamentos, rifas ou tabelas.
- Acrescentar uma seleção por coro no servidor que corresponda exatamente ao agrupamento utilizado pelo resumo, sem depender de filtragem no navegador.
- Validar a seleção recebida e exigir autorização administrativa antes de consultar os inscritos ou gerar o PDF.
- Manter a auditoria existente de exportações PDF, registrando a quantidade realmente exportada e sem copiar dados pessoais para os logs.

## Erros e estados
- Mostrar geração em andamento somente no card acionado e impedir pedidos duplicados enquanto o PDF é preparado.
- Em falha de consulta, geração, auditoria ou download, apresentar mensagem curta e permitir tentar novamente; não disponibilizar arquivo parcial.
- Descartar arquivos preparados ao sair da página ou perder o acesso administrativo.

## Testes e entrega
- Testar a seleção exata do coro com inscritos de vários grupos, pagamentos de diferentes situações e mais de uma página.
- Confirmar que a auditoria conta somente os inscritos do coro escolhido e que chamadas sem autorização não acessam dados.
- Executar os testes afetados; conferir o resumo em larguras diferentes e inspecionar o PDF renderizado para nomes longos, acentos e quebras de página.
- A conferência completa com inscrições reais continua dependendo de uma sessão administrativa disponível; não solicitar credenciais.
- Entregar na prévia, sem publicação automática.