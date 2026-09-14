# Programacao, presenca por QR e geocerca

## Objetivo

Transformar a programacao do encontro em uma fonte de dados administravel e reutilizada pela pagina publica e pelo portal do participante. O administrador podera manter atividades, escolher quais contabilizam presenca por QR Code, exigir geolocalizacao por atividade, imprimir todos os codigos e consultar as presencas registradas. O participante podera escanear o QR, confirmar presenca e acompanhar seu percentual.

## Regras aprovadas

- O menu administrativo ganha a aba **Programacao**, posicionada depois de **Coros**.
- O percentual e calculado como `presencas unicas / atividades ativas marcadas com QR * 100`, arredondado para o inteiro mais proximo.
- Atividades sem QR nao entram no numerador nem no denominador.
- O QR e fixo para permitir impressao, assinado pelo servidor e revogavel por versao.
- A verificacao de localizacao e configurada separadamente em cada atividade com QR.
- Com **Verificar localizacao** desligado, o navegador nao solicita localizacao e a presenca guarda campos geograficos nulos.
- Com **Verificar localizacao** ligado, a permissao e uma pre-condicao. A presenca e bloqueada se a posicao nao puder ser validada ou estiver fora do raio.
- As coordenadas aceitas ficam disponiveis somente no administrativo, acompanhadas de precisao, distancia calculada, horario e link para o mapa.
- As 24 atividades exibidas atualmente na pagina principal formam a carga inicial. Todas iniciam ativas e sem QR.

## Modelo de dados

### Atividades

A tabela `event_activities` armazena:

- `id`, titulo e descricao;
- data, horario inicial e horario final;
- local textual;
- categoria visual: acolhimento, celebracao, refeicao, conferencia, musica ou visita;
- ordem dentro da programacao;
- `is_active`;
- `requires_qr`;
- `verify_location`;
- latitude, longitude e raio permitido em metros;
- `qr_version`, iniciado em 1;
- datas de criacao e atualizacao.

As restricoes do banco e do dominio exigem:

- horario final posterior ao inicial;
- inicio e fim quando `requires_qr` estiver ativo;
- `verify_location` somente quando `requires_qr` estiver ativo;
- latitude, longitude e raio quando `verify_location` estiver ativo;
- coordenadas e raio nulos quando `verify_location` estiver inativo;
- latitude entre -90 e 90, longitude entre -180 e 180 e raio entre 10 e 5.000 metros.

### Presencas

A tabela `event_activity_attendances` armazena uma linha por atividade e conta de participante. Ela contem a inscricao vinculada, horario da confirmacao, versao do QR utilizada e, quando exigidos, latitude, longitude, precisao, horario da coleta e distancia calculada em metros.

A unicidade `(activity_id, participant_account_id)` torna o registro idempotente. Uma segunda leitura informa que a presenca ja existe e preserva os dados da primeira confirmacao.

Atividades com presencas nao podem ser excluidas por causa da chave estrangeira. O administrador deve inativa-las. Inativar ou retirar o QR de uma atividade remove-a do denominador futuro, conforme a regra de percentual aprovada.

## Carga inicial e programacao publica

A migracao cadastra exatamente as 24 atividades hoje publicadas entre 20 e 22 de novembro de 2026, mantendo nomes, datas, horarios conhecidos, ordem e categorias. Nenhuma atividade recebe horario final inventado; quando o administrador ativar QR em uma delas, o formulario exigira que o horario final seja definido.

A secao Programacao da pagina principal deixa de conter a lista fixa. Um server function publico e somente leitura devolve apenas atividades ativas e apenas campos publicos: titulo, descricao, data, horarios, local, categoria e ordem. Coordenadas, raio, configuracoes internas de QR e dados de presenca nunca fazem parte dessa resposta.

O portal do participante usa a mesma origem para o guia do evento. A migracao deve ser aplicada antes da versao do aplicativo que remove a lista fixa, evitando uma janela sem programacao.

## QR Code fixo e revogavel

O QR impresso aponta para `/participante/presenca?token=...`. O token contem a versao do formato, o identificador da atividade e `qr_version`. O servidor assina o conteudo com HMAC-SHA-256 e `ATTENDANCE_QR_SECRET`, mantido somente no ambiente do servidor. O token impresso nao expira por tempo; sua validade depende da assinatura, da versao vigente, do status da atividade e da janela de presenca.

O segredo e carregado somente nas operacoes de emitir ou validar QR. Listar, criar ou editar atividades sem gerar QR continua funcionando quando o segredo ainda nao estiver configurado.

O comando **Regenerar QR** incrementa `qr_version`. Isso invalida imediatamente codigos impressos anteriormente. A interface deve explicar essa consequencia antes da regeneracao.

## Confirmacao de presenca

O servidor exige conta de participante ativa, usuario autenticado, inscricao correspondente e pagamento confirmado. Em seguida:

1. valida formato e assinatura do token;
2. carrega a atividade ativa e marcada com QR;
3. compara a versao do token com `qr_version`;
4. verifica a janela entre 30 minutos antes do inicio e 30 minutos depois do fim;
5. aplica a geocerca quando configurada;
6. grava a presenca de forma idempotente.

Antes de solicitar permissao, a pagina chama uma verificacao preliminar no servidor. Essa operacao valida assinatura, versao e disponibilidade da atividade e retorna somente se a localizacao e exigida. Ela nao revela coordenadas nem raio ao participante. Quando a geocerca estiver desligada, o cliente nao chama a API de geolocalizacao e confirma a presenca somente com o token.

Quando estiver ligada, a pagina solicita uma posicao de alta precisao no momento do scan. Ela envia latitude, longitude, precisao e o timestamp fornecido pelo navegador. O servidor valida limites numericos, recusa posicoes com mais de dois minutos e precisao pior que 100 metros, calcula a distancia pela formula de Haversine e aceita apenas `distancia <= raio configurado`.

Mensagens especificas cobrem QR invalido, QR revogado, atividade inativa, janela fechada, localizacao negada, posicao indisponivel, posicao antiga, baixa precisao, area externa e presenca ja registrada.

Geolocalizacao de navegador oferece controle operacional, mas nao e prova antifraude absoluta em aparelhos modificados. Essa limitacao sera tratada como risco conhecido, sem criar coleta adicional de dados.

## Experiencia administrativa

A pagina `/admin/atividades` passa a usar a navegacao administrativa comum com a aba **Programacao** ativa. Como o menu passa a ter sete itens, a versao movel deve permitir acesso confortavel a todos sem cortar rotulos ou reduzir excessivamente os alvos de toque.

A pagina lista atividades por dia e oferece:

- cadastro, edicao, inativacao e exclusao;
- campos de categoria, data, horarios, local, descricao e ordem;
- flags de QR e verificacao de localizacao;
- coordenadas e raio exibidos condicionalmente;
- captura opcional da localizacao atual do administrador para preencher o ponto da atividade;
- visualizacao e regeneracao do QR individual;
- download do PDF coletivo;
- total de presencas por atividade;
- abertura da lista de participantes presentes.

A lista de presencas mostra participante, horario, precisao, distancia e, quando houver coordenadas, um link HTTPS para abrir o ponto no mapa. Os campos geograficos nao aparecem para registros feitos sem verificacao de localizacao.

## Experiencia do participante

O portal oferece uma acao para abrir o leitor. Depois da leitura, o aplicativo identifica se a atividade exige localizacao. Somente nesse caso exibe uma explicacao curta e aciona a permissao do navegador.

O resultado apresenta confirmacao ou erro e atualiza o painel com:

- percentual de participacao;
- quantidade presente e total exigido;
- lista das atividades ativas com QR;
- estado presente ou pendente em cada atividade.

## PDF para impressao

O botao **Baixar PDF dos QR Codes** inclui todas as atividades ativas marcadas com QR, na ordem da programacao. Se nenhuma estiver elegivel, o botao fica desabilitado com uma explicacao.

O arquivo e gerado no servidor para o administrador autenticado. Cada atividade ocupa uma pagina A4 com titulo, data, horario, local, QR grande, identificacao do encontro e instrucao para o participante. O nome do arquivo inclui o evento e a data de geracao. O PDF usa os mesmos tokens fixos exibidos individualmente e continua valido ate que um QR seja regenerado.

## Seguranca e privacidade

- Todas as tabelas ficam com RLS ativada e sem acesso direto de `anon` ou `authenticated`.
- Operacoes administrativas passam por `requireAdmin` e pelo cliente de servidor.
- Presenca e painel do participante passam por `requireParticipantAccess` e nunca confiam em `user_metadata`.
- O endpoint publico da programacao e somente leitura, seleciona campos explicitamente permitidos e nunca aceita filtros que ampliem acesso.
- O cliente nao recebe o segredo de assinatura.
- Coordenadas de participantes nao sao retornadas em endpoints publicos nem no painel de outros participantes.
- Latitude e longitude sao dados pessoais operacionais e seguem o mesmo ciclo de vida do registro de presenca e da inscricao vinculada.

## Erros e operacao

Falhas ao carregar a programacao publica devem mostrar uma mensagem localizada na secao, sem derrubar a pagina inteira. O administrativo mantem os dados digitados quando uma gravacao falha. Downloads e geracoes de QR exibem erro acionavel sem fechar a tela atual.

Excluir uma atividade com presenca retorna orientacao para inativa-la. Regenerar QR exige uma confirmacao que informe que PDFs e folhas ja impressas deixarao de funcionar.

## Validacao

A implementacao deve conter testes significativos para:

- validacao das combinacoes de QR, geocerca, horarios e coordenadas;
- percentual com atividades ativas, inativas, marcadas e nao marcadas;
- assinatura, adulteracao, versao e revogacao do token;
- distancia Haversine, idade e precisao da posicao;
- autorizacao de administrador e participante;
- unicidade e idempotencia de presenca;
- CRUD e estados condicionais do formulario;
- ausencia de pedido de localizacao quando a flag estiver desligada;
- bloqueios e mensagens quando a flag estiver ligada;
- exibicao de coordenadas e link do mapa somente para administradores;
- estrutura, quantidade de paginas e conteudo basico do PDF;
- carga das 24 atividades e correspondencia com a programacao atual;
- renderizacao dinamica da programacao publica;
- navegacao administrativa com a nova aba.

Ao final, executar os testes focados em serie, a verificacao TypeScript e o build de producao. Falhas pre-existentes da suite global devem ser separadas das evidencias desta entrega.

## Entrega e implantacao

Codigo, publicacao Git, implantacao e mutacao do banco sao provas separadas. A implementacao local cria a migracao e o codigo, mas nao aplica SQL remoto nem publica alteracoes sem autorizacao explicita para esses passos.

Para producao, a ordem segura e:

1. configurar `ATTENDANCE_QR_SECRET` com pelo menos 32 bytes no ambiente de servidor;
2. aplicar e verificar a migracao no projeto Supabase correto;
3. publicar o codigo;
4. validar a carga de 24 atividades, o CRUD, o PDF, um scan sem localizacao e um scan de teste com geocerca;
5. confirmar separadamente o SHA publicado, o ledger de migracoes e o comportamento no navegador.

## Fora de escopo

- impedir falsificacao de GPS em dispositivos modificados;
- rastrear o participante continuamente;
- solicitar localizacao em atividades com a flag desligada;
- exportar relatorios gerais de presenca em planilha;
- registrar presenca manual pela equipe;
- criar mapas internos ou historico de deslocamento.
