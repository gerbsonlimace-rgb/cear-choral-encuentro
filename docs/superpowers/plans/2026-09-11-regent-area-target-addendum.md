# Adendo de implementação no projeto alvo

Este plano será implementado em `gerbsonlimace-rgb/cear-choral-encuentro`, na branch
`codex/area-regente`. O projeto Supabase deste alvo é `mtkjsrbywymwixwscosf`.

## Compatibilidade obrigatória

- Preservar o fluxo existente em `/participante`.
- Preservar a fotografia privada e obrigatória do participante.
- Preservar `voicePart` e todos os seus valores já aceitos pelo domínio.
- Manter como URL pública atual `https://encontrocorosdiocesanosce.lovable.app`.
- Manter o handle InfinitePay de Lucas, `lucas-soares-xwv`.
- Nunca copiar para este alvo o `supabase/config.toml` de outro projeto.

## Ajustes em relação ao plano original

A unicidade de CPF será adicionada por uma nova migration posterior às migrations já
existentes. Ela fará um preflight e abortará se encontrar CPFs não nulos duplicados;
não apagará, atualizará nem reconciliará inscrições automaticamente.

As Tasks 2 e 9 exigem merge manual para preservar, respectivamente, o fluxo atual de
participante com foto/classificação vocal e o comportamento atual da integração
InfinitePay. Não devem ser portadas por aplicação cega de patches de outro repositório.
