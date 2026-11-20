# Chamada pública com QR individual

## Objetivo e decisões do usuário

Entregar um link e um QR individual para cada inscrito e uma chamada pública,
sem autenticação, para a equipe registrar rapidamente a presença em cada atividade.
A fila deve avançar sem reabrir a câmera, sem confirmar manualmente cada leitura
e sem pausas artificiais entre participantes diferentes.

O usuário definiu que o total esperado inclui somente inscrições confirmadas
financeiramente e que o endereço da chamada deve ser público, sem chave da equipe.
Compartilhar ou abrir o cartão individual, por si só, nunca registra presença.

## Alternativas consideradas

- Chamada autenticada: usa o acesso administrativo atual, mas contraria o pedido.
- Link exclusivo e revogável da equipe: sugerido e inicialmente escolhido;
  substituído pelo usuário por um endereço público.
- Chamada pública: escolha final. Qualquer visitante pode abrir o leitor; para
  registrar alguém, é necessário apresentar um QR individual válido.

## Páginas e comportamento

### Cartão individual — `/cartao?token=…`

- Cada inscrição recebe um token aleatório, estável e imprevisível, emitido no
  servidor. Não usar CPF, e-mail, telefone ou ID sequencial como credencial.
- A página abre sem login e apresenta nome/crachá, coro e QR grande em preto e
  branco. O QR contém o próprio link do cartão e pode ser impresso ou salvo.
- A resposta pública contém somente os campos necessários ao cartão. Não expor
  contato, documento, valores, recibos ou acesso ao portal.
- Inscrições pendentes podem ter cartão, mas seu QR não pode registrar presença.
- Os links de todos os inscritos não cancelados ficam disponíveis para exportação
  CSV administrativa, com nome, coro e link, pronta para posterior envio.
- Uma ação administrativa prepara os cartões existentes em lote; novos cartões
  são preparados de forma idempotente. Não recriar tokens a cada exportação.

### Lista de atividades — `/chamada`

- Pública, sem login, senha ou chave compartilhada.
- Listar somente atividades ativas com `requires_qr = true`, ordenadas por data
  e ordem da programação existente, sem inventar uma nova atividade.
- Cada item apresenta título, data/horário, presentes confirmados, total esperado
  e progresso. Exemplo ilustrativo: `Credenciamento · 42 de 150`.
- Selecionar uma atividade abre a tela de leitura. A câmera inicia após a ação
  do operador e a permissão do navegador, quando necessária.
- Não publicar uma lista geral com os dados pessoais dos inscritos.

### Leitor contínuo

- Câmera traseira preferencial, mantida aberta até pausar, sair ou trocar a
  atividade. Usar `BarcodeDetector` quando disponível e ZXing contínuo no fallback.
- Capturar o próximo participante enquanto o servidor confirma os anteriores,
  com fila limitada de requisições, sem um atraso global entre QR diferentes.
- Não encerrar o vídeo, remontar a câmera, mostrar modal ou exigir novo clique
  depois de uma leitura.
- Feedback de sucesso com nome do participante, indicador visual e som curto,
  quando suportado e habilitado. Erros e duplicados têm texto e visual próprios.
- Suprimir o mesmo código que permanece na câmera e não emitir requisições
  repetidas. A unicidade no banco continua protegendo contra leitores simultâneos.
- Mostrar presentes, total esperado, faltantes, percentual e leituras pendentes.
  O número de presentes só muda após confirmação do servidor, nunca por captura.
- Uma falha de rede não conta como presença; conservar a leitura para tentar
  novamente sem travar as próximas, mostrar claramente a pendência e evitar
  repetição automática ilimitada. Ao sair com pendências, avisar o operador.
- Internet é necessária para confirmar. Não prometer latência zero de câmera,
  rede ou servidor; eliminar pausas artificiais e viagens redundantes ao banco.
- Total e progresso vêm do servidor; respostas concorrentes não podem fazer o
  contador retroceder. Atualizar também ao retomar foco e periodicamente para
  refletir outros leitores.

## Regras de presença e contagem

- Proposta de implementação: seguir a confirmação já usada pelo portal:
  `payment_status = 'paid' AND cancelled_at IS NULL`, incluindo isenções já
  aprovadas. Não exigir quitação de rifas ou pendências administrativas.
  Uma entrada promocional já confirmada mantém a mesma elegibilidade do portal.
- Todos os inscritos podem receber link; apenas os elegíveis entram no denominador
  e podem gerar novas presenças. Revalidar o estado no servidor a cada gravação.
- Presença única por `(activity_id, registration_id)`. Uma releitura, inclusive
  de outro aparelho, retorna `already_recorded` e não incrementa nada.
- Reutilizar `event_activity_attendances` para que as presenças apareçam nos
  relatórios e no painel do participante. Aceitar inscrição sem conta Auth.
- Tornar a ligação à conta de participante opcional nesse fluxo e ajustar a
  gravação antiga para a mesma unicidade por inscrição, preservando o histórico.
- A leitura presencial pela equipe dispensa a geolocalização individual do
  participante. O fluxo antigo de autoatendimento conserva suas validações.
- Horários continuam informativos, conforme a migração já existente que permite
  presença fora da janela. Não reintroduzir restrição de horário.
- Caso uma inscrição com presença seja cancelada depois, conservar o histórico;
  excluir essa inscrição dos totais de elegíveis e presentes no progresso atual.

## Servidor, dados e desempenho

- Funções de servidor públicas estreitas: listar atividades e totais, carregar
  um cartão válido e registrar uma leitura válida para uma atividade elegível.
- Validação explícita do tamanho/formato dos tokens e IDs. Nenhum segredo ou
  cliente `service_role` pode ir para o navegador.
- Tabela dos cartões e funções de banco acessíveis somente por `service_role`,
  RLS habilitada, sem concessão direta a `anon` ou `authenticated`.
- A gravação e os totais resultantes devem vir de uma única chamada de banco,
  com inserção idempotente e índices adequados. Não provisionar conta Auth nem
  carregar o snapshot administrativo inteiro por QR lido.
- A chamada pública mostra somente o nome do cartão efetivamente apresentado
  e contadores agregados. Não oferecer busca pública de inscritos.
- Cartão e chamada usam `noindex` e política de referência restritiva.
- A geração em lote e o CSV exigem a autorização administrativa existente.
- Não alterar campos financeiros, regras de checkout, rifas ou a rota `/euvou`.

## Interface

Modo operacional, seguindo `DESIGN.md`: Manrope, superfícies claras, controles
pretos e dourado discreto. Página curta, celular primeiro, contadores grandes
e câmera visível. Reutilizar componentes existentes. Sem navegação administrativa
na chamada pública, sem banners promocionais, sem animações que atrasem a fila.

## Verificação e entrega

- Testar token inválido, inscrição pendente/cancelada e cartão sem conta Auth.
- Testar duplicidade entre leitura pública e antiga, e dois leitores simultâneos.
- Testar contagem de pagos/isenções, exclusão de cancelados e ausência de efeitos
  financeiros administrativos na elegibilidade.
- Testar QR diferentes em sequência, duplicado ainda visível, falha de rede,
  recuperação e câmera mantida aberta enquanto gravações estão pendentes.
- Testar exportação completa e autorização administrativa.
- Executar testes focados, TypeScript e build, e conferir layout móvel/desktop.
- Verificar câmera real e velocidade no aparelho do evento como etapa distinta;
  testes simulados não comprovam throughput físico.
- Preservar as alterações locais preexistentes e o histórico publicado do Lovable.
  Código local, migração aplicada, publicação e geração real dos cartões são
  evidências separadas e devem ser relatadas com precisão.

## Fora desta entrega

Disparo de e-mail/SMS, compra de créditos Brevo, reconhecimento facial,
geolocalização dos participantes neste novo leitor e operação offline completa.
Os links exportados servem de base para o envio posterior solicitado na conversa.
