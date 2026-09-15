# Valores do Programa de Rifas e saldo de quitação

## Objetivo

Corrigir o cálculo do Programa de Venda de Rifas para refletir a regra comercial aprovada:

- inscrição normal: R$ 300,00 pagos no checkout inicial;
- inscrição pelo programa de rifas: R$ 100,00 pagos agora e R$ 250,00 pagos até 30/10, totalizando R$ 350,00.

O aplicativo deve exibir e cobrar o saldo configurado de R$ 250,00, sem derivá-lo como diferença entre o valor normal e a entrada promocional.

## Modelo de configuração

`event_registration_settings` usará o terceiro campo já introduzido pelo fluxo atual, `promotional_remaining_price_cents`, como valor global positivo ou nulo. O valor promocional existente continuará representando a entrada (`promotional_price_cents`). A cotação e o snapshot usam o nome de domínio `remainingPriceCents`/`remaining_price_cents`. A administração exibirá os três campos e validará que os valores necessários estejam preenchidos quando houver coro promocional ativo.

Uma cotação promocional exposta ao formulário incluirá `balancePriceCents` e `totalPriceCents`, com `totalPriceCents = registrationPriceCents + balancePriceCents`. Uma cotação normal manterá `balancePriceCents = null` e total igual ao preço normal.

## Snapshots e compatibilidade

Novas inscrições salvarão `remaining_price_cents` junto dos snapshots existentes. O servidor usará o valor confiável resolvido para o coro, e não valores editáveis enviados pelo navegador.

Inscrições históricas não serão reescritas. A migração manterá o comportamento legado para snapshots promocionais sem saldo explícito; novas inscrições usarão o terceiro valor configurado. Registros sem snapshots coerentes continuarão tratados como históricos/indisponíveis.

## Fluxos afetados

- formulário público: mostrar R$ 100,00 agora e R$ 250,00 depois;
- validação e checkout inicial: persistir entrada e saldo corretos;
- confirmação pública e portal do participante: mostrar saldo pendente derivado do snapshot;
- área do regente e administração: cobrar somente o saldo atual salvo, com proteção contra excesso e cobranças duplicadas;
- funções financeiras e trigger SQL: calcular total promocional como entrada + quitação, mantendo taxas e itens adicionais fora do saldo das rifas.

## Segurança e operação

Autorização, segredo da InfinitePay e acesso às tabelas permanecem server-side. Será criada apenas uma migração versionada; sua aplicação remota, publicação Git/Lovable e cobrança real permanecem etapas separadas que exigem autorização específica.

## Verificação

O desenvolvimento seguirá TDD: testes falhando para configuração, cotação, snapshots, estados financeiros e checkout; implementação mínima; testes focados em modo serial; typecheck/lint/build; inspeção do diff e validação das migrações. Nenhuma alteração não relacionada do checkout principal será incluída.
