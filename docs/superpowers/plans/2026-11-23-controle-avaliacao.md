# Controle de respostas da avaliação

**Objetivo:** solicitar CPF ou e-mail na primeira etapa, explicar finalidade e destinatários e impedir repetições do mesmo identificador sem vinculá-lo às opiniões.

**Arquitetura:** manter as três etapas e os botões fixos. Validar e normalizar o identificador no cliente e servidor. Uma função transacional grava um código com segredo permanente em tabela privada separada, sem UUID da resposta, data ou identificador em texto. As respostas continuam em `event_feedback`, sem identificação. O segredo permanece no banco, sem dependência da rotação de chaves da API.

**Decisões:** aceitar qualquer CPF válido ou e-mail válido, sem login e sem consulta às inscrições. O controle limita repetições do mesmo identificador; não comprova identidade nem unifica automaticamente CPF e e-mail. Nenhum envio automático de email será criado: o texto informa a destinação das opiniões à equipe organizadora, conforme pedido.

- [ ] Testar validação, normalização, duplicidade, retries e ausência de identificação no sessionStorage.
- [ ] Implementar campo inicial e texto, preservando o layout mobile e os critérios existentes.
- [ ] Criar RPC privada para gravação atômica e migrar o servidor para usá-la.
- [ ] Verificar testes, tipos, build, banco descartável e interface mobile; aplicar migração e publicar no projeto original autorizado.

**Limites de privacidade:** a equipe destinatária recebe somente opiniões sem CPF/e-mail. Não se promete anonimato contra o proprietário do banco: registros da mesma transação podem ser correlacionados por metadados internos (`xmin`), e o proprietário pode acessar o segredo. As opiniões livres também podem identificar quem as escreveu se incluir dados pessoais; a interface orienta a não fazer isso. O controle é pseudonimizado, sem identificador em texto, UUID ou data na tabela de controle.

**Compartilhamento adicional solicitado:** título explícito de avaliação, descrição do propósito e nova URL da arte oficial para invalidar o cache de imagem. Oferecer link com parâmetro de convite novo, mantendo `/avaliacao` canônico. A prévia exata dentro do WhatsApp depende da coleta/cache do aplicativo.
