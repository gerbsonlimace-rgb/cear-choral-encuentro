# App do Coralista

## Contexto

O site do II Encontro de Coros Diocesanos e Litúrgicos já possui autenticação unificada e uma área protegida do participante. Essa área mostra a identificação e a inscrição, mas as seções destinadas à playlist e às partituras ainda não carregam conteúdo real.

O CoroApp já permite criar eventos, ordenar cantos e trabalhar com letras, cifras, áudios por naipe e partituras. O App do Coralista reutilizará esse fluxo administrativo como origem do conteúdo, sem incorporar a interface do CoroApp por `iframe` e sem exigir uma segunda autenticação do coralista.

O projeto é dividido entre dois repositórios:

- `C:\Users\gerbs\Documents\GitHub\coroapp`: criação do evento oficial, publicação do repertório e upload privado dos materiais;
- `C:\Users\gerbs\Documents\GitHub\encontrocorosce`: autenticação do participante e experiência mobile **Home, Cantos, Partituras, Meu Perfil**.

## Decisões aprovadas

- o aplicativo exige login e vínculo ativo de participante;
- os materiais permanecem privados inclusive na API e no armazenamento de origem;
- o CoroApp continua sendo a fonte oficial do repertório;
- somente administradores do CoroApp enviam, organizam, publicam e removem arquivos;
- o coralista possui acesso somente para leitura, reprodução, visualização e download;
- a primeira versão possui exatamente um evento oficial configurado;
- a integração é servidor-a-servidor e nenhuma credencial do CoroApp chega ao navegador;
- o visual segue o protótipo aprovado em preto, dourado e branco, adaptado à identidade do Encontro;
- o restante do CoroApp e seus buckets públicos existentes não será alterado para privado.

## Objetivos

- transformar a área autenticada do participante em um aplicativo mobile-first;
- exibir os cantos do evento oficial na ordem definida no CoroApp;
- reproduzir áudios privados por naipe dentro do App do Coralista;
- exibir partituras e documentos privados dentro do portal;
- manter os dados da inscrição, comprovante, troca de senha e saída em **Meu Perfil**;
- permitir que administradores publiquem e atualizem o conteúdo pelo CoroApp;
- impedir que uma pessoa sem acesso ativo descubra ou recupere o conteúdo do evento pela API pública.

## Fora do escopo

- permitir uploads, comentários ou edição pelo coralista;
- criar vários eventos selecionáveis no portal;
- copiar contas ou sessões entre os dois projetos Supabase;
- disponibilizar o painel administrativo do CoroApp dentro do site do Encontro;
- sincronizar os dados do participante com usuários do CoroApp;
- suporte offline, download em lote, certificados e notificações push nesta primeira versão;
- tornar privados os buckets legados `audio-files` e `sheet-music` usados pelo restante do CoroApp;
- publicar Git, Lovable, Edge Functions ou migrações sem uma autorização posterior e específica.

## Arquitetura

O navegador mantém uma única sessão: a sessão Supabase do Encontro. Ao abrir o App do Coralista, uma função de servidor do `encontrocorosce` valida essa sessão e exige o mesmo vínculo participante ativo e pago já usado pela área atual.

Depois da autorização, o servidor do Encontro chama uma Edge Function privada do CoroApp. A chamada usa assinatura HMAC com timestamp e um segredo compartilhado armazenado somente nos ambientes de servidor. A Edge Function não aceita um `event_id` fornecido pelo navegador ou pelo portal: ela lê o identificador do único evento oficial de uma variável de ambiente privada.

A Edge Function do CoroApp consulta o evento, as músicas associadas e somente os materiais marcados como publicados no App do Coralista. Ela devolve um contrato reduzido, com URLs assinadas de curta duração para arquivos de um bucket privado. O servidor do Encontro valida integralmente essa resposta antes de entregá-la ao React.

```text
Coralista autenticado
        |
        v
Servidor do Encontro
  - valida sessão
  - valida participante ativo e pago
        |
        | HMAC + timestamp
        v
Edge Function privada do CoroApp
  - fixa o evento oficial
  - consulta conteúdo publicado
  - cria URLs assinadas temporárias
        |
        v
App mobile Home / Cantos / Partituras / Meu Perfil
```

## Modelo privado no CoroApp

### Evento oficial

O evento continua em `events` e o repertório continua em `event_songs` e `songs`. O identificador oficial é configurado no ambiente da Edge Function como `CHORISTER_PORTAL_EVENT_ID`. O cliente não envia e não escolhe esse valor.

Uma tabela `chorister_portal_publications` registra o estado de publicação:

- `id uuid primary key`;
- `event_id uuid not null unique references events(id) on delete restrict`;
- `status text not null check (status in ('draft', 'published'))`;
- `published_at timestamptz null`;
- `published_by uuid null references auth.users(id) on delete set null`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

Somente `service_role` acessa a tabela diretamente. RLS permanece habilitada e `anon` e `authenticated` não recebem privilégios diretos. A função administrativa autoriza o JWT do CoroApp antes de usar o cliente privilegiado.

### Materiais privados

Uma tabela `chorister_portal_assets` registra todos os arquivos exclusivos do portal:

- `id uuid primary key`;
- `publication_id uuid not null references chorister_portal_publications(id) on delete cascade`;
- `event_song_id uuid null references event_songs(id) on delete cascade`;
- `kind text not null check (kind in ('audio', 'sheet_music', 'manual', 'document'))`;
- `title text not null`;
- `voice_part text null check (voice_part in ('principal', 'soprano', 'contralto', 'tenor', 'baixo', 'todos'))`;
- `storage_path text not null unique`;
- `mime_type text not null`;
- `size_bytes bigint not null check (size_bytes > 0)`;
- `sort_order integer not null default 0`;
- `is_published boolean not null default false`;
- `created_by uuid null references auth.users(id) on delete set null`;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`.

As regras do domínio são:

- `audio` e `sheet_music` exigem `event_song_id`;
- `audio` exige `voice_part`;
- `manual` e `document` não pertencem a uma música e exigem `event_song_id null`;
- a Edge Function de leitura ignora qualquer ativo com `is_published = false`;
- um canto pode existir no evento sem áudio ou partitura publicados e continua aparecendo com estado vazio neutro;
- remover uma associação de `event_songs` remove somente os ativos privados vinculados a essa associação, nunca a música da biblioteca.

### Bucket

O bucket `chorister-portal-assets` é privado e aceita:

- áudio: `audio/mpeg`, `audio/mp4` e `audio/wav`, até 100 MiB;
- documento: `application/pdf`, até 25 MiB.

O caminho segue `events/<event-id>/<kind>/<asset-id>/<safe-filename>`. O nome original é normalizado antes do upload e não é usado como autorização. A aplicação persiste o caminho do objeto, nunca uma URL pública permanente.

## Administração no CoroApp

A página do evento ganha uma seção **App do coralista**, visível apenas a administradores autorizados do tenant do evento. A seção não duplica a tela completa do evento; ela usa o repertório já associado como base e oferece as ações específicas de publicação privada.

### Cabeçalho da seção

- identifica o evento oficial configurado;
- mostra `Rascunho` ou `Publicado`;
- mostra a última publicação;
- oferece **Publicar no app** ou **Retirar do app** com confirmação explícita;
- bloqueia a publicação quando o evento configurado não corresponde ao evento aberto.

### Cantos

Cada canto associado ao evento mostra:

- ordem, tipo litúrgico e nome vindos de `event_songs` e `songs`;
- áudios privados publicados por naipe;
- partitura privada publicada;
- ações de enviar, substituir, renomear, reordenar e remover o ativo privado;
- estados de envio, falha e confirmação sem perder o formulário em andamento.

O envio utiliza uma URL de upload assinada emitida pela função administrativa. A criação do registro é finalizada somente após a confirmação do objeto no Storage. Uma falha não cria um material publicado sem arquivo.

### Documentos do encontro

A mesma seção permite enviar PDFs sem vínculo com canto, classificados como **Manual** ou **Documento**. O administrador informa título, ordenação e estado de publicação. Não existe upload no App do Coralista.

## Contrato privado do CoroApp

### Função administrativa

A Edge Function `chorister-portal-admin` recebe o JWT normal do administrador do CoroApp. Ela valida o usuário e reaproveita a autorização de escrita do tenant antes de qualquer operação privilegiada.

Operações permitidas:

- consultar publicação e ativos do evento oficial;
- iniciar upload e devolver uma URL assinada de envio;
- finalizar o upload depois de validar caminho, MIME e tamanho;
- atualizar título, ordem, naipe e `is_published`;
- remover o registro e o objeto privado correspondente;
- publicar ou retirar o evento do portal.

Todas as operações rejeitam eventos diferentes de `CHORISTER_PORTAL_EVENT_ID`. A função nunca aceita `user_metadata` como autorização e não expõe `service_role` ao cliente.

### Função de leitura

A Edge Function `chorister-portal-feed` aceita somente `POST`. Ela exige:

- `x-portal-timestamp` dentro de uma janela máxima de 60 segundos;
- `x-portal-signature` calculada com HMAC-SHA-256 sobre versão, timestamp, método e caminho;
- comparação da assinatura em tempo constante;
- segredo `CHORISTER_PORTAL_SHARED_SECRET` presente nos dois ambientes de servidor;
- ausência de seleção arbitrária de evento no corpo ou na URL.

A resposta possui três estados fechados:

- `{ status: 'published', event: ... }`;
- `{ status: 'not_published' }`;
- erro HTTP genérico sem detalhes internos.

O evento publicado contém somente:

```ts
type ChoristerPortalFeed = {
  status: "published";
  event: {
    id: string;
    name: string;
    date: string;
    location: string | null;
    coverImageUrl: string | null;
    songs: Array<{
      id: string;
      order: number;
      name: string;
      liturgicalType: string;
      lyrics: string | null;
      chords: string | null;
      audios: Array<{
        id: string;
        title: string;
        voicePart: "principal" | "soprano" | "contralto" | "tenor" | "baixo" | "todos";
        signedUrl: string;
        expiresAt: string;
      }>;
      sheetMusic: {
        id: string;
        title: string;
        signedUrl: string;
        expiresAt: string;
      } | null;
    }>;
    documents: Array<{
      id: string;
      kind: "manual" | "document";
      title: string;
      signedUrl: string;
      expiresAt: string;
      sortOrder: number;
    }>;
  };
};
```

As URLs assinadas expiram em dez minutos. O servidor do Encontro pode manter o contrato validado em cache por no máximo 60 segundos, mas não persiste URLs assinadas no banco ou no navegador.

## Integração no Encontro

Uma função de servidor `getChoristerPortalFeed` usa o middleware de participante existente. O fluxo é:

1. validar o Bearer token da sessão do Encontro;
2. exigir `participant_accounts.access_status = 'active'`;
3. exigir a inscrição associada com `payment_status = 'paid'`;
4. assinar a chamada ao CoroApp com HMAC no servidor;
5. chamar `chorister-portal-feed` com timeout;
6. validar status, UUIDs, datas, tipos, listas e URLs com Zod;
7. devolver somente o contrato validado ao React.

Falha de autorização encerra o acesso como ocorre hoje. Falha técnica do CoroApp não remove a sessão do participante; ela produz um estado temporário de conteúdo indisponível com tentativa manual.

O cliente do Encontro não importa um segundo `supabase-js`, não recebe URL de projeto, chave anônima ou segredo do CoroApp e não chama a Edge Function diretamente.

## Experiência do App do Coralista

O portal usa um shell mobile-first com cabeçalho compacto e navegação inferior fixa à área do aplicativo. Em telas maiores, o conteúdo permanece centralizado na largura de um aplicativo, evitando transformar a experiência em um painel administrativo.

As abas usam exatamente esta ordem e estes rótulos:

1. **Home**;
2. **Cantos**;
3. **Partituras**;
4. **Meu Perfil**.

Os alvos interativos têm pelo menos 44 por 44 pixels, respeitam `safe-area-inset-bottom`, suportam teclado e possuem rótulos acessíveis. A aba atual é representada por estado de rota ou busca validado, permitindo recarregar a página sem voltar obrigatoriamente para a Home.

### Home

- saudação usando o primeiro nome do participante;
- cartão do evento oficial com nome, data, local e identidade preto/dourado/branco;
- atalho **Ensaiar cantos** com quantidade publicada;
- atalho **Abrir partituras** com quantidade publicada;
- orientação curta para escolher o áudio do próprio naipe;
- ausência de métricas administrativas, banners genéricos ou conteúdo de outros eventos.

### Cantos

- lista ordenada como o evento no CoroApp;
- busca local por nome e tipo litúrgico;
- nome, tipo e disponibilidade de vozes em cada item;
- seleção de áudio por `principal`, `soprano`, `contralto`, `tenor`, `baixo` ou `todos`;
- player persistente dentro do shell, com reproduzir, pausar, posição, duração e troca de áudio;
- detalhe do canto com letra e cifra quando publicadas;
- acesso à partitura do mesmo canto sem sair do aplicativo;
- mensagens específicas para canto sem áudio, partitura, letra ou cifra, sem tratar ausência editorial como erro técnico.

O player interrompe e libera o áudio anterior ao selecionar outra faixa. Uma URL expirada dispara uma única atualização do feed e retoma a faixa na posição possível; repetidas falhas exibem a ação **Tentar novamente** sem loop automático.

### Partituras

- grupo **Partituras do repertório**, ordenado como os cantos;
- grupo **Documentos do encontro**, ordenado pelo administrador;
- título, tipo e indicação de PDF;
- visualização interna em um leitor responsivo;
- ação de download do PDF;
- fallback para abrir o arquivo em nova aba quando o navegador não conseguir renderizá-lo;
- nenhuma ação de upload, edição ou remoção.

Uma URL expirada é renovada antes de abrir ou baixar. O aplicativo não armazena o PDF em cache permanente nesta primeira versão.

### Meu Perfil

- fotografia ou iniciais neutras;
- nome, coral, diocese, cidade, parte vocal e situação da inscrição;
- CPF mascarado e demais dados seguros já disponíveis no portal atual;
- **Baixar comprovante em PDF** quando o snapshot de pagamento estiver completo;
- **Alterar senha** usando reautenticação existente;
- **Sair da conta** limpando imediatamente o conteúdo protegido antes da navegação.

Detalhes financeiros extensos deixam de ocupar a entrada do aplicativo, mas permanecem disponíveis em uma seção recolhível de inscrição e pagamento dentro de **Meu Perfil**.

## Estados e tratamento de erros

- **verificando acesso:** não renderizar nome, evento ou materiais;
- **participante não autorizado:** limpar conteúdo e redirecionar para `/acessar`;
- **conteúdo ainda não publicado:** Home autenticada com mensagem “O repertório oficial será disponibilizado em breve”;
- **CoroApp indisponível ou timeout:** mensagem neutra e botão **Tentar novamente**;
- **resposta inválida:** rejeitar todo o feed, registrar somente código técnico e mostrar falha genérica;
- **ativo ausente:** omitir a ação correspondente e manter o canto visível;
- **URL assinada expirada:** renovar uma vez e repetir a ação;
- **arquivo removido durante a sessão:** atualizar o feed e informar que o material não está mais disponível;
- **upload administrativo interrompido:** não publicar o registro e permitir novo envio;
- **remoção administrativa:** confirmar título e impacto antes de apagar o registro e seu objeto;
- **logout:** remover imediatamente feed, URLs e dados pessoais mantidos em memória.

Os logs não incluem senha, JWT, segredo compartilhado, assinatura HMAC, URL assinada completa, CPF, e-mail ou conteúdo de documentos.

## Segurança

- autorização do participante ocorre no servidor do Encontro antes de qualquer chamada ao CoroApp;
- autorização administrativa ocorre na Edge Function do CoroApp antes do uso de `service_role`;
- `user_metadata` nunca participa de autorização;
- as tabelas privadas possuem RLS, privilégios revogados de `public`, `anon` e `authenticated`, e acesso direto concedido somente a `service_role`;
- o bucket é privado e não recebe política pública de leitura;
- a função de leitura aceita somente o evento configurado e não recebe um identificador arbitrário;
- segredo e chaves administrativas ficam apenas em secrets de servidor;
- assinaturas HMAC expiradas ou inválidas são rejeitadas sem revelar a causa;
- URLs assinadas têm validade de dez minutos e não são persistidas;
- a resposta é validada no limite entre os projetos;
- endpoints administrativos validam tenant, evento, tipo, tamanho e caminho do arquivo;
- a publicação não depende de decisões do navegador;
- alterações de banco e Storage passam por advisors e testes de políticas antes da aplicação remota.

## Componentes e responsabilidades

### CoroApp

- domínio `chorister-portal`: tipos, estados de publicação, validação de ativos e transformação do feed;
- repositório administrativo: publicação, ativos e confirmação de objetos;
- `chorister-portal-admin`: fronteira autenticada das mutações administrativas;
- `chorister-portal-feed`: fronteira HMAC de leitura servidor-a-servidor;
- seção **App do coralista** na página do evento;
- componentes separados para status de publicação, ativos por canto e documentos gerais;
- migração das tabelas, índices, grants, RLS e bucket privado.

### Encontro

- domínio `chorister-app`: esquema Zod e helpers de contagem, busca, agrupamento e URL expirada;
- cliente servidor-a-servidor do CoroApp;
- função de servidor protegida pelo participante;
- `ChoristerAppShell` e navegação das quatro abas;
- `ChoristerHomeTab`;
- `ChoristerSongsTab` e player;
- `ChoristerScoresTab` e leitor de PDF;
- `ChoristerProfileTab`, reutilizando os dados e ações existentes;
- página atual do participante reduzida a gate de acesso, carregamento e composição do shell.

## Testes e critérios de aceite

### CoroApp: domínio e banco

- migração cria tabelas com RLS e sem acesso direto de `anon` ou `authenticated`;
- bucket privado rejeita leitura pública;
- regras impedem áudio sem naipe, documento ligado a canto e ativo de outro evento;
- publicação só aceita o evento oficial;
- remover um ativo não remove a música da biblioteca;
- remover a associação do evento remove apenas ativos privados dependentes;
- MIME e tamanho inválidos são rejeitados no servidor.

### CoroApp: funções

- administrador autorizado consulta e altera publicação;
- usuário comum, administrador de outro tenant e requisição sem JWT recebem negação genérica;
- HMAC válida e recente entrega somente o evento oficial publicado;
- assinatura inválida, timestamp expirado e tentativa de escolher outro evento são rejeitados;
- feed omite rascunhos e ativos não publicados;
- feed cria URLs assinadas com expiração de dez minutos;
- erros não vazam segredo, chave, caminho interno ou detalhes de autorização.

### CoroApp: interface

- seção aparece somente no evento oficial para administrador autorizado;
- uploads exibem progresso, falha recuperável e confirmação;
- publicar e retirar exigem confirmação;
- ordem, título, naipe e visibilidade refletem no feed;
- layout continua utilizável em celular e desktop sem alterar a experiência pública existente.

### Encontro: servidor

- sessão ausente ou participante inativo não chama o CoroApp;
- participante ativo e pago recebe o contrato validado;
- timeout, estado não publicado e resposta inválida são diferenciados sem vazar detalhes;
- chamada HMAC usa timestamp atual e o caminho fechado;
- cache nunca ultrapassa 60 segundos;
- segredo não aparece no bundle do navegador.

### Encontro: interface

- navegação mostra exatamente **Home, Cantos, Partituras, Meu Perfil**;
- Home mostra evento e atalhos com contagens corretas;
- Cantos preserva ordem, busca e seleção por naipe;
- player reproduz, pausa, troca e libera a faixa anterior;
- partitura abre internamente e possui fallback e download;
- Meu Perfil preserva comprovante, troca de senha, CPF mascarado e logout seguro;
- conteúdo protegido não aparece antes da autorização;
- logout limpa dados e URLs antes de redirecionar;
- estados vazio, não publicado, falha e expiração possuem recuperação acessível;
- protótipo aprovado é respeitado em 320, 390, 768 e 1024 pixels.

### Verificação final local

Em cada repositório:

- testes focados em modo serial;
- suíte Vitest excluindo `**/.worktrees/**` quando aplicável;
- TypeScript sem emissão;
- lint dos arquivos alterados;
- build de produção;
- smoke test das rotas e funções;
- inspeção visual das quatro abas em larguras mobile e desktop;
- inspeção do bundle para ausência de segredos e configuração privada.

Para Supabase:

- validar a migração em ambiente local;
- executar testes SQL de grants, RLS e Storage;
- executar advisors de segurança e desempenho;
- confirmar que uma URL pública não recupera um ativo privado;
- confirmar que uma URL assinada válida recupera o ativo e deixa de funcionar após expirar.

## Ordem de entrega

1. criar e validar o modelo privado e o bucket no CoroApp;
2. implementar a função administrativa e a seção **App do coralista**;
3. implementar e validar o feed HMAC do evento oficial;
4. implementar o cliente protegido no servidor do Encontro;
5. substituir os placeholders do portal pelas quatro abas aprovadas;
6. executar verificações locais integradas nos dois projetos;
7. preparar, mas não executar, as etapas independentes de aplicação de migrações, secrets, deploy de Edge Functions, push Git e publicação Lovable;
8. solicitar autorização específica antes de cada mutação de produção e verificar banco, função, Git e frontend servido separadamente.

## Critério de conclusão

O trabalho estará concluído quando um participante ativo e pago entrar pelo portal do Encontro, visualizar somente o evento oficial e usar cantos, áudios por naipe, partituras, documentos e perfil dentro do shell aprovado; uma pessoa sem esse acesso não conseguirá obter o feed ou os objetos privados; e administradores autorizados conseguirem manter todo o conteúdo pela seção do evento no CoroApp.
