# II Encontro de Coros Diocesados do Ceará

Crie uma landing page para oevento "II Encontro de Mùsica Sacra do Estado do Ceará" de 20 a 22 de Novembro.
Deve ter inormalções sobre o evneto programação e inscrição online.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://encontrocorosce.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e6f04773-e2dc-44c3-a483-34df39d64822).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Para usar as operações administrativas no localhost, configure a chave de servidor do
mesmo projeto Supabase em `.env.local` e reinicie `npm run dev`:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=<chave de servidor do projeto>
```

O arquivo `.env` deste repositório é versionado e contém configurações públicas.
Use `.env.local` (ignorado pelo Git) para segredos e nunca prefixe a chave de
servidor com `VITE_`. Um token pessoal `sbp_` da API de gerenciamento não substitui
a chave de servidor do projeto.

## InfinitePay checkout

- InfiniteTag padrão: `lucas-soares-xwv`
- Webhook: `https://encontrocorosce.lovable.app/api/infinitepay-webhook`
- Retorno: `https://encontrocorosce.lovable.app/pagamento`
- Variáveis opcionais de servidor: `INFINITEPAY_HANDLE` e `PUBLIC_SITE_URL`

Antes da publicação, habilite Checkout Integrado na conta InfinitePay e configure o cartão para repassar as taxas ao participante. Pix permanece com taxa zero conforme as condições vigentes da InfinitePay.

A migração Supabase deve ser aplicada antes do novo código servido. Não publique apenas uma dessas partes.
