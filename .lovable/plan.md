# Filtros por coro e por função na lista de inscrições (admin)

## Objetivo
Em **Inscrições** (/admin/inscricoes), além da pesquisa e da situação, o administrador poderá filtrar por **Coro** e por **Função** (perfil musical: Coralista, Regente, Instrumentista).

## Desenho consolidado

### Telas (AdminRegistrationsPage.tsx)
- A barra de filtros ganha dois novos controles ao lado de "Situação":
  - **Coro**: Select com "Todos os coros", os coros cadastrados (mesma lista já usada na edição de inscrito, `getPublicConfiguration` → `choirs`) e a opção "Outro coro (fora da lista)" para inscrições com `choir_id` nulo.
  - **Função**: Select com "Todas as funções", Coralista, Regente, Instrumentista (mesmos rótulos já exibidos na coluna e no detalhe).
- Mudar qualquer filtro volta para a página 1 e recarrega a lista (mesmo comportamento do filtro de situação).
- Layout: os filtros continuam em uma linha no desktop (`sm:flex-row`); no mobile empilham.

### Dados e validação
- `adminRegistrationQuerySchema` (admin.domain.ts) ganha:
  - `choirId`: união entre `"all"` e uuid, padrão `"all"`.
  - `musicalProfile`: união entre `"all"` e `musicalProfileSchema` (regente | instrumentista | coralista), padrão `"all"`.
- `adminRegistrationExportSchema` passa a incluir os dois campos, então o **CSV exportado respeita os filtros** de coro e função (além de pesquisa e situação, como hoje).
- Filtro por "Outro coro (fora da lista)" = `choir_id IS NULL` no banco; filtro por coro específico = `choir_id = <id>`.

### Servidor (admin-registration.server.ts)
- `repository.list`: aplica `.eq("choir_id", …)` / `.is("choir_id", null)` e `.eq("musical_profile", …)` na consulta.
- Caminho enriquecido (`listEnriched` com `listCandidates`): aplica os mesmos filtros em memória junto ao filtro de situação, antes da paginação.
- O resumo financeiro continua global (todas as inscrições), sem mudança.
- Sem migração de banco; nenhuma permissão nova.

### Segurança
- Sem mudanças: mesmas server functions autenticadas (`requireAdmin`); filtros são parâmetros validados por Zod no servidor.

### Erros
- Coro inválido (uuid malformado) é rejeitado pelo schema e o painel mostra a mensagem padrão de erro de lista, com "Tentar novamente".
- Nenhum resultado: mensagem existente "Nenhuma inscrição encontrada."

### Testes
- `admin.domain.test.ts`: schema aceita coro + função, padrão "all".
- `admin-registration.server.test.ts`: lista aplica filtro de coro (eq e is null) e de perfil musical; export repassa os filtros.
- `AdminRegistrationsPage.test.tsx`: seletores renderizam; mudar coro/função recarrega com os novos parâmetros e volta à página 1.

### Entrega
- Sem publicação automática; publico só quando você pedir.
