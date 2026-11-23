# Controles de custo e limites

Os valores são limites operacionais a configurar por ambiente; não representam preço contratual nem garantia de custo. Defina alertas no Cloudflare, MongoDB Atlas, e-mail e artefatos de backup antes de ampliar o piloto.

| Serviço | Sinal | Ação de alerta |
|---|---|---|
| Worker | requests, erros 5xx, duração | aviso ao atingir 70%; investigação em 90% |
| Durable Object | duração, requests, websockets | revisar fan-out e conexões; nunca aumentar carga sem medir |
| MongoDB Atlas | conexões, throughput, armazenamento | alertar antes do limite do plano; revisar índices/pool |
| E-mail | falhas e retries | alertar quando falha terminal exceder o limite do piloto |
| Backups | tamanho, duração e artefato | falhar o job se vazio ou ausente |

Os limites devem ser definidos por `APP_ENV` e documentados no ambiente. Nenhum segredo ou URI deve aparecer no alerta.
