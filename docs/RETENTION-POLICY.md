# Política operacional de retenção e exclusão

Prazos abaixo são uma configuração inicial do piloto e exigem **validação jurídica** e contratual antes de uso amplo. O prazo é contado a partir do último evento operacional relevante, salvo obrigação legal documentada.

| Tipo de dado | Retenção operacional inicial | Acesso |
|---|---:|---|
| Conta, vínculo e consentimento | vigência da conta + 90 dias | titular, instituição vinculada e operação autorizada, conforme papel |
| Solicitações, agenda e status | vigência do piloto + 180 dias | participantes e instituição em formato operacional |
| Mensagens de conversa | até 90 dias após encerramento | somente participantes autorizados |
| Feedback agregado | 180 dias | instituição, sem conteúdo clínico |
| Certificado público | enquanto válido/revogado + obrigação aplicável | consulta pública minimizada |
| Eventos de auditoria e governança | 180 dias, ou prazo legal aplicável | operação autorizada |
| Eventos técnicos de e-mail | 180 dias | operação autorizada |
| Analytics diário agregado | 366 dias | administração, sem identificadores |
| Backups | 14 dias no artefato automatizado, salvo ciclo aprovado | operação autorizada |

Exclusões do titular usam a transação única do gateway. Se falhar, nenhuma etapa parcial é apresentada como concluída. Cópias de backup expiram pelo ciclo próprio. Não há eliminação automática de registros sujeitos a obrigação legal sem orientação jurídica.
