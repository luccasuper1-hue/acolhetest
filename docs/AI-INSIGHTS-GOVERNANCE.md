# Acolhe Insights — governança da primeira versão

O Acolhe Insights interpreta somente indicadores operacionais agregados da instituição. O modelo recebe um conjunto mínimo de números já filtrados pelo backend; ele não consulta MongoDB, conversas, mensagens, notas, diagnósticos, nomes, e-mails ou identificadores individuais.

Sua voz é calma, lúcida, próxima, discreta e prática: um orientador institucional cuidadoso que separa observação, interpretação, limites e próximo passo. Não é terapeuta, mascote ou autoridade clínica, e nunca transforma incerteza em autoridade.

## Proteções implementadas

- acesso exclusivo ao papel institucional e à instituição autenticada;
- perguntas individuais, clínicas, diagnósticas, de conteúdo privado e de prompt injection bloqueadas;
- amostras menores que o mínimo operacional ficam ocultas;
- limites por usuário, instituição e dia, pergunta com até 600 caracteres e saída limitada;
- limite por minuto, fingerprint de perguntas repetidas, comparação máxima de 12 meses e cache curto por instituição/intenção/período;
- timeout curto, validação de JSON e fallback determinístico;
- validação dos números e fontes contra o conjunto autorizado antes de exibir a resposta;
- fontes, período e limitações exibidos na resposta;
- logs apenas com escopo anonimizado, intenção, duração, status, fallback e contagem de métricas;
- binding exclusivo `env.AI` do Cloudflare Workers AI; não há provedor alternativo;
- nenhuma chamada automática na abertura do painel, processamento em background ou WebSocket.
- gráficos e comparações só podem usar séries fornecidas pelo backend; a primeira versão não executa ações.
- respostas estruturadas distinguem `observation`, `interpretation`, `next_step` e `limitations`;
- a interface evita culpa, falsa intimidade, promessas emocionais e linguagem clínica.

## Pendências jurídicas e operacionais

Antes de uso amplo, a instituição e o Acolhe ainda precisam revisar controlador e operador, eventual suboperador de IA, transferência internacional, retenção, tratamento de dados de adolescentes e contrato/termos do provedor. A implementação técnica não constitui aprovação jurídica.

## Validação local

Use mocks locais para o binding `AI` e fixtures agregadas para testar políticas, isolamento, fallback e contratos. Não fazer deploy, staging ou carga enquanto a cota gratuita do Cloudflare estiver sob restrição.
