# 🎯 PRÓXIMOS PASSOS — Ruptur Bubble Integration

**Data**: 2026-05-08  
**Status**: ✅ Backend + Frontend prontos | 🟡 Workflows pending

---

## 📋 O QUE FOI ENTREGUE HOJE

### ✅ Phase 1: Instance Management (COMPLETO)
- `modules/instances/instances.service.js` — Service layer com 6 métodos
- `api/routes-instances.mjs` — 6 endpoints (GET/POST/PATCH/DELETE)
- Integração no gateway + Tenant isolation verificado
- **Resultado**: `/api/instances` operacional com QR code + status

### ✅ Phase 2: Bubble Integration — Passo 1-2 (COMPLETO)
- `api/routes-bubble.mjs` — Token generation (POST /api/bubble/token)
- `web/client-area/src/pages/Inbox.jsx` — Reescrito como iframe
- Gateway integrado + Build passing
- **Resultado**: Inbox carrega Bubble transparentemente

### ✅ Documentação para Agente
- `BUBBLE_AGENTE_IMPLEMENTACAO_UNICA.md` — 604 lines com 13 workflows + 31 instâncias
- `UAZAPI_TUDO_QUE_DA_FAZER.md` — Análise crítica TIER 1-3

**Commit**: feat: implementar integração Bubble como backend invisível para Inbox

---

## 🚀 3 OPÇÕES DE PRÓXIMO PASSO

### 🔵 OPÇÃO A: Começar Implementação de Workflows (Recomendado para MVP)

**O que**: Agent implementa 13 workflows Bubble conforme BUBBLE_AGENTE_IMPLEMENTACAO_UNICA.md

**Workflows** (ordem proposta):
1. **Phase 1** (Data Layer): Criar 5 data types (Chat, Message, Contact, Label, Group) — 4h
2. **Phase 2** (Webhooks): Implementar `on_message_received` + `on_connect` — 8h
3. **Phase 3** (API Endpoints): Expor 5 endpoints que Ruptur vai chamar — 6h
4. **Phase 4** (Ações): Implementar 6 ações auxiliares (labels, search, etc) — 8h
5. **Phase 5** (Testes): E2E validation — 4h

**Total**: ~30h distribuído ao longo de 1 semana

**Ganho**:
- ✅ Inbox omnichannel funcional
- ✅ Conversas sincronizadas
- ✅ Labels + Lead scoring
- ✅ Multi-agente suportado

**Bloqueador**: Nenhum — tudo pronto

---

### 🔴 OPÇÃO B: Resolver "Problema no Pagamento" UAZAPI (Crítico se bloqueando)

**O que**: Investigar e resolver issue mencionada no dashboard UAZAPI

**Passos**:
1. SSH na VPS: `ssh root@ruptur.cloud`
2. Verificar logs Bubble: `docker-compose logs bubble-runtime`
3. Verificar Supabase webhook logs (Realtime)
4. Confirmar que:
   - ✅ Conta UAZAPI está ativa (não suspensa)
   - ✅ Conta Bubble não está pausada
   - ✅ Webhook Global está configurado

**Estimado**: 1-2h se é config, 4-8h se é bug

**Ganho**: Desbloqueador para testar workflows em produção

---

### 🟢 OPÇÃO C: Teste Rápido Local (Validação 30min)

**O que**: Confirmar que token generation + validation estão funcionando

**Passos**:
```bash
# 1. Confirmar build
npm run build  # ✅ Já passei

# 2. SSH na VPS
ssh root@ruptur.cloud

# 3. Deploy (se diferente da última versão)
cd /opt/ruptur/saas
docker-compose pull
docker-compose up -d

# 4. Teste token generation
curl -X POST https://app.ruptur.cloud/api/bubble/token \
  -H "Authorization: Bearer <seu-jwt-token>" \
  -H "Content-Type: application/json"

# 5. Verificar resposta
# Esperado: { "bubble_url": "...", "token": "...", "expires_in": 3600 }
```

**Ganho**: Confirma que infra está OK antes de workflows

---

## 📊 RECOMENDAÇÃO

### Caminho Proposto (Prioridade)

1. **Agora (OPÇÃO C - 30min)**
   - Validate token generation localmente
   - Confirma que POST /api/bubble/token retorna bubble_url válida
   - Deploy atualizado na VPS se necessário

2. **Se houver problema financeiro (OPÇÃO B - em paralelo)**
   - Resolver UAZAPI/Bubble issue
   - Liberar capacidade para workflows

3. **Depois (OPÇÃO A - 1 semana)**
   - Agent implementa 13 workflows
   - Testa E2E (user → /inbox → Bubble carrega)
   - Sincroniza histórico das 31 instâncias

### Timeline Estimado

| Fase | Tempo | Resultado |
|------|-------|-----------|
| Validação local (C) | 30min | ✅ Token OK |
| Resolver financeiro (B) | 1-2h | ✅ Capacity OK |
| Workflows Phase 1-2 (A) | 12h | ✅ Inbox funcional |
| Workflows Phase 3-5 (A) | 18h | ✅ MVP completo |
| Deploy produção | 1h | 🚀 Live |
| **TOTAL** | **~1.5 semanas** | **Inbox omnichannel live** |

---

## 📌 CHECKLIST POR OPÇÃO

### OPÇÃO A: Workflows
- [ ] Ler `BUBBLE_AGENTE_IMPLEMENTACAO_UNICA.md` completamente
- [ ] Delegar para agente com prompt claro (fiz isso, arquivo pronto)
- [ ] Agent executa Phase 1: Data types em Bubble
- [ ] Agent executa Phase 2: Webhooks + API endpoints
- [ ] Manual test: Enviar mensagem de teste, ver em Ruptur
- [ ] Validar tenant isolation (user A não vê user B)
- [ ] Deploy em produção

### OPÇÃO B: Financeiro
- [ ] Acessar dashboard UAZAPI (tiatendeai.uazapi.com)
- [ ] Verificar status de pagamento
- [ ] Verificar status de conta Bubble
- [ ] Confirmar que 31 instâncias estão no limite (31/100)
- [ ] Se algo está bloqueado, resolver antes de continuar

### OPÇÃO C: Validação Local
- [ ] `npm run build` — já passou ✅
- [ ] SSH na VPS
- [ ] `docker-compose pull && docker-compose up -d`
- [ ] POST `/api/bubble/token` com token válido
- [ ] Verificar resposta: `{ bubble_url, token, expires_in }`
- [ ] POST `/api/bubble/validate` com token
- [ ] Verificar resposta: `{ valid, user_id, email, tenant_id }`

---

## 🎯 DECISÃO NECESSÁRIA DE DIEGO

**Qual caminho seguir?**

- [ ] **Opção A**: Começar workflows agora (recomendado para MVP)
- [ ] **Opção B**: Resolver financeiro primeiro
- [ ] **Opção C**: Validar localmente primeiro (prudente)
- [ ] **Combo**: C + B em paralelo, depois A

**Status**: Bloqueado em sua decisão. Tudo técnico está pronto.

---

## 📞 DEPENDÊNCIAS

Se você disser "vamos com A":
- Vou preparar prompt para agente com todos os detalhes
- Agent implementa 13 workflows em ~30h
- Você testa em sandbox Bubble, depois deploy

Se você disser "vamos com B":
- Você verifica financeiro UAZAPI/Bubble
- Resolve qualquer issue
- Depois seguimos com A ou C

Se você disser "vamos com C":
- Você faz SSH na VPS
- Roda curl test
- Confirma token generation está OK
- Depois A ou B conforme necessário

**Recomendação Pessoal**: C → B → A (validar → liberar → implementar)

---

**Criado por**: Claude Code  
**Pronto para**: Sua decisão sobre próximo passo
