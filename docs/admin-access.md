# Acesso administrativo

O aplicativo não cria administradores automaticamente e não oferece cadastro público.

## Concessão inicial

1. Obtenha autorização específica para alterar o projeto Supabase remoto.
2. Crie ou confirme a conta em Authentication > Users.
3. Copie o UUID imutável da conta.
4. Em uma sessão SQL administrativa autorizada, insira uma nova linha em
   `public.admin_users` com esse UUID em `user_id`.
5. Confirme o acesso pelo painel sem consultar ou expor a chave `service_role`.

## Revogação

Em uma sessão SQL administrativa autorizada, preencha `revoked_at = now()` e
`revoked_by` na associação ativa. Não apague nem reutilize a linha. Uma futura
reconcessão deve inserir uma nova associação para preservar o histórico.

Nenhum desses passos é executado pela aplicação ou por esta entrega local.
