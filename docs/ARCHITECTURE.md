# Arquitetura oficial do Acolhe

Status: caminho de produção definido em 16/11/2026.

## Decisão

O caminho oficial é **Cloudflare Worker + Durable Object + MongoDB Atlas**. O Worker serve os assets do frontend e as rotas `/api`; o Durable Object mantém o gateway de acesso ao MongoDB e os canais realtime.

`backend/` é a implementação FastAPI histórica/local usada em testes e comparação. Não deve ser publicada como segundo backend ativo. Mudanças de negócio devem ser refletidas primeiro em `cloudflare-worker/src/`.

## Fronteiras

- O navegador nunca recebe credenciais do MongoDB.
- Dados pessoais e operacionais passam pela API autenticada.
- A instituição recebe apenas dados administrativos e indicadores agregados previstos no contrato.
- Conteúdo de chat permanece entre estudante e profissional.
- O Worker é a fonte de verdade para regras de horário, papel, vínculo e estado do fluxo.

Qualquer novo serviço de produção deve registrar motivo, dados tratados, segredos, plano de rollback e impacto de custo.
