# Frontend do Acolhe

Aplicação React construída com Vite. O frontend é compilado para os assets servidos pelo Cloudflare Worker.

## Comandos

```bash
npm install
npm run dev      # desenvolvimento local
npm test         # suíte de regressão
npm run build    # build de produção em build/
```

O fluxo oficial de produção é publicado pelo Worker em `../cloudflare-worker`.

## Configuração

O frontend usa as rotas do Worker configuradas no ambiente de execução. Não coloque credenciais, tokens ou arquivos `.env` neste diretório.
