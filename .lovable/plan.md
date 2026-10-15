# Promover inscrito a administrador (e remover)

## O que o admin vai ver
- Na lista de inscrições (/admin/inscricoes), no menu "Mais" de cada inscrito, um novo item:
  - "Tornar administrador" (ícone de escudo) quando a pessoa ainda não é admin.
  - "Remover administrador" quando ela já é admin.
- Uma etiqueta discreta "Admin" ao lado do nome de quem já é administrador.
- Antes de confirmar, um diálogo explica o efeito:
  - Tornar: "Fulano poderá acessar a administração com o mesmo login da área do participante."
  - Remover: "Fulano perderá o acesso à administração. A inscrição e a área do participante continuam iguais."
- Mensagem de sucesso e lista atualizada após confirmar.

## Regras
- Só aparece para inscritos que já têm acesso à área do participante liberado (conta criada após o pagamento/isenção). Para os demais, o item fica desabilitado com a dica "Libere o acesso do participante primeiro."
- Um admin não pode remover a si mesmo.
- Não é possível remover o último administrador ativo.
- A pessoa promovida continua inscrita e passa a ver o botão de alternância "Ir para Admin" / "Ir para Participante" que já existe.
- Nenhuma senha muda e nenhum e-mail é enviado.

## Histórico
- Promoção cria um novo vínculo de administrador registrando quem concedeu e quando.
- Remoção marca o vínculo como encerrado (quem removeu e quando) — sem apagar, preservando o histórico, como já descrito em docs/admin-access.md (que será atualizado).

## Erros
- Sem conta de participante → "Libere o acesso do participante primeiro."
- Tentativa de remover a si mesmo → "Você não pode remover seu próprio acesso."
- Último admin → "É preciso manter pelo menos um administrador."
- Falha inesperada → "Não foi possível concluir. Tente novamente."

## Detalhes técnicos
- Sem migração: usa a tabela `admin_users` existente (`granted_by`, `revoked_at`, `revoked_by`).
- `admin-registration.server.ts`: listagem passa a trazer `isAdmin` por inscrição (join participant_accounts.user_id → admin_users ativo); novos métodos `grantAdmin(registrationId, actorId)` e `revokeAdmin(registrationId, actorId)` via cliente administrativo no servidor, com as regras acima (conta vinculada, auto-remoção, último admin, idempotência se já admin/já removido).
- `admin.functions.ts`: `grantAdminFromRegistration` e `revokeAdminFromRegistration` (POST, middleware `requireAdmin`, validação zod de uuid).
- `AdminRegistrationsPage.tsx`: item no menu "Mais", etiqueta "Admin", AlertDialog de confirmação, recarga da lista.
- Testes: servidor (regras e erros), tela (item, confirmação, recarga). Typecheck e build verificados.
