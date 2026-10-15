# Editar dados de um inscrito (somente admin)

## Objetivo
Permitir que o administrador corrija os dados cadastrais de uma inscrição diretamente na tela de inscrições, sem tocar em valores, pagamento ou acesso.

## Tela
- No menu de três pontos de cada inscrição, novo item **"Editar dados"** (ícone de lápis), disponível para qualquer situação de pagamento.
- Abre um diálogo com formulário pré-preenchido com os dados atuais:
  - Nome completo, Nome no crachá, CPF, E-mail, WhatsApp, Data de nascimento
  - Diocese, Coro (lista de coros + "outro coro"), Cidade, Instituição, Função
  - Parte vocal, Perfil musical, Observações
- Botões **Salvar alterações** e **Cancelar**; enquanto salva, o botão fica desabilitado com "Salvando…".
- Ao salvar com sucesso, o diálogo fecha, a lista é recarregada e aparece um aviso de sucesso; em erro, mensagem amigável dentro do diálogo sem perder o que foi digitado.
- Não editáveis nesta tela: valores, situação de pagamento, foto e comprovantes (seguem os fluxos já existentes).

## Dados e segurança
- Nova função de servidor `updateAdminRegistration` protegida por `requireAdmin` (somente admin ativo), com validação zod no servidor (mesmos formatos do formulário de inscrição: CPF, telefone, data, diocese, parte vocal).
- Atualiza somente colunas cadastrais da tabela `registrations`; campos financeiros e de acesso nunca são aceitos.
- Se o **e-mail** mudar e a inscrição já tiver conta de participante ativa, o e-mail de login da conta também é atualizado (via cliente administrativo no servidor); se houver outra conta com o novo e-mail, a operação falha com mensagem clara.
- Se o coro mudar, `choir_id`/`choir_name`/`other_choir_name` são atualizados de forma consistente.
- Nenhuma migração de banco necessária; nenhuma regra de RLS muda.

## Erros
- E-mail já usado por outra conta → "Já existe uma conta com esse e-mail."
- Falha de validação → mensagem por campo, como no formulário público.
- Falha inesperada → "Não foi possível salvar. Tente novamente." sem expor detalhes internos.

## Validação e entrega
- Testes do servidor: admin edita com sucesso; não-admin é rejeitado; campos financeiros ignorados; e-mail duplicado falha.
- Testes da tela: item "Editar dados" no menu, formulário pré-preenchido, salvar recarrega a lista, erro mantém o diálogo aberto.
- Typecheck, testes e build verificados antes de concluir.
