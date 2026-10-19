# Contadores e exportação PDF das inscrições

## Resultado

Na tela **Inscrições**, destacar dois contadores acima da lista:
- **Total de inscrições**: todas as inscrições cadastradas.
- **Inscrições aguardando pagamento**: inscrições com a taxa inicial ainda pendente, seguindo o cálculo financeiro já utilizado pelo painel.

Os contadores serão gerais, sem mudar com os filtros; a quantidade de resultados encontrados continuará indicando o total filtrado. Complementos de inscrições parcialmente pagas e pendências administrativas em rifas não entrarão no contador de taxa inicial pendente. Os valores financeiros existentes serão preservados.

## Lista em PDF

- Adicionar **Exportar PDF** ao lado de **Exportar CSV**.
- Incluir todas as inscrições correspondentes à pesquisa e aos filtros ativos: pagamento, coro, função e acesso ao app — não apenas a página visível.
- Produzir um PDF A4 em orientação paisagem, com nome do evento, data de emissão, filtros aplicados, quantidade de inscritos, cabeçalho repetido e páginas numeradas.
- Colunas: nome, coro, função, e-mail, WhatsApp, situação financeira, valor pago e taxa pendente. Não incluir CPF, nascimento, fotos ou comprovantes.
- Quebrar textos longos dentro das colunas e mudar de página entre linhas, sem cortar um inscrito ao meio; preservar acentos em português.
- Gerar o arquivo primeiro e então oferecer **Baixar PDF**, permitindo um clique imediato para download. Em celulares compatíveis, oferecer o compartilhamento com a opção de salvar o arquivo.
- Manter a exportação CSV existente.

## Arquitetura e dados

- Reutilizar o resumo geral existente para os contadores, sem novas tabelas ou alterações financeiras.
- Criar uma exportação PDF protegida pela autorização administrativa existente, reutilizando a seleção completa e os mesmos filtros da exportação atual.
- Gerar o documento com `pdf-lib` e fonte que suporte português; devolver apenas o arquivo pronto, não expor consultas administrativas diretamente ao navegador.
- Registrar a exportação como PDF na auditoria. Se necessário, aplicar uma migração mínima para permitir esse tipo de evento, sem modificar inscrições nem ampliar acesso público.
- Entregar o arquivo pelo aplicativo, nunca por um caminho temporário do ambiente de trabalho.

## Segurança e erros

- Verificar a identidade e a autorização administrativa antes de consultar qualquer inscrição ou gerar o arquivo.
- Manter filtros e dados pessoais fora da URL e dos registros de erro; a auditoria não armazenará o texto pesquisado nem os inscritos exportados.
- Indicar a geração em andamento e impedir cliques duplicados. Em falha de consulta, geração ou auditoria, não oferecer arquivo incompleto e permitir tentar novamente.
- Descartar arquivos preparados ao mudar filtros ou encerrar a sessão, evitando baixar um resultado desatualizado.
- Preservar a separação entre rifas administrativas e pagamentos da inscrição.

## Testes e entrega

- Testar contagens concretas para inscrições pendentes, pagas, parcialmente pagas e isentas, sem contar rifas como taxa pendente.
- Testar exportação com todos os filtros combinados e mais de uma página de resultados, autorização e falhas sem arquivo parcial.
- Verificar um PDF com nomes longos, acentos e múltiplas páginas, renderizando e inspecionando visualmente o arquivo.
- Executar os testes afetados e conferir a página e o download. A verificação com dados administrativos reais depende de uma sessão disponível; não solicitar credenciais.
- Entregar na prévia, sem publicar automaticamente.