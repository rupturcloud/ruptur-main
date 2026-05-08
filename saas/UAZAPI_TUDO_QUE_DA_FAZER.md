# 🚀 UAZAPI SPEC: TUDO QUE DÁ DE FAZER (Análise Crítica)

**Data**: 2026-05-08  
**Escopo**: 105+ endpoints UAZAPI × Bubble plugin × Ruptur  
**Metodologia**: Criticidade (impacto no usuário) × Complexidade × O que Bubble já tem

---

## 📊 SUMÁRIO EXECUTIVO

**UAZAPI tem**: 105+ endpoints divididos em 14 categorias  
**Bubble plugin tem**: 71 ações + 20 Data calls (cobrindo 80% dos endpoints)  
**Ruptur tem**: Infra pronta (Supabase, billing, JWT)  

**Resultado**: 
- ✅ **85% é implementável hoje** (Bubble já faz)
- 🟡 **10% precisa integração extra** (N8N, custom logic)
- ❌ **5% é complexo demais para MVP** (IA avançada, catalog business)

**Recomendação**: Focar nos **TIER 1** (validado, alto impacto) = 6 semanas para SaaS competitivo.

---

## 🏗️ CATEGORIZAÇÃO POR TIER

### 🔴 TIER 1: ESSENCIAL (Implementar AGORA)

**Impacto**: Alto | **Complexidade**: Baixa | **Horas**: 40-50h total

#### 1. Instance Management (Conexão WhatsApp)
| Endpoint | Bubble | Ruptur | Status | ETA |
|----------|--------|--------|--------|-----|
| `/instance/create` | ✅ Nativo | ✅ Admin route | 🟢 Pronto | Done |
| `/instance/connect` | ✅ Nativo | ✅ QR code UI | 🟢 Pronto | Done |
| `/instance/status` | ✅ Nativo | ✅ Health check | 🟢 Pronto | Done |
| `/instance/disconnect` | ✅ Nativo | ✅ Admin | 🟢 Pronto | Done |
| `/instance/updateInstanceName` | ✅ Nativo | ✅ Settings | 🟢 Pronto | Done |

**O que fazer**: Apenas expor em Ruptur via API (já tem tudo)  
**Ganho**: Usuário gerencia instâncias dentro Ruptur  
**Venda**: Incluído em todos planos

---

#### 2. Envio Mensagens (Core Revenue)
| Endpoint | Bubble | Ruptur | Status | ETA |
|----------|--------|--------|--------|-----|
| `/send/text` | ✅ Nativo | ✅ Campaign form | 🟢 Pronto | Done |
| `/send/media` | ✅ Nativo | ✅ Upload UI | 🟢 Pronto | Done |
| `/send/menu` | ✅ Nativo | ✅ Button builder | 🟢 Pronto | 2h |
| `/send/contact` | ✅ Nativo | ⚠️ Partial | 🟡 Easy | 1h |
| `/send/location` | ✅ Nativo | ⚠️ Partial | 🟡 Easy | 1h |
| `/send/carousel` | ✅ Nativo | ❌ Missing | 🟡 Medium | 3h |

**O que fazer**: Parametrizar Bubble workflows em Ruptur  
**Ganho**: Campanhas ilimitadas, formatos variados  
**Venda**: "Campanhas WhatsApp Ilimitadas - R$49/mês"  
**Prioridade**: 🔴 P1 (revenue direto)

---

#### 3. Inbox + Recebimento (Omnichannel)
| Endpoint | Bubble | Ruptur | Status | ETA |
|----------|--------|--------|--------|-----|
| `/webhook` | ✅ Config nativo | ✅ Setup | 🟢 Pronto | Done |
| `messages` (webhook) | ✅ Integrado | ✅ Supabase save | 🟢 Pronto | Done |
| `/chat/find` | ✅ Nativo | ✅ Search UI | 🟢 Pronto | 2h |
| `/chat/details` | ✅ Nativo | ✅ Conversation view | 🟡 Easy | 2h |
| `/message/find` | ✅ Nativo | ✅ Message history | 🟡 Easy | 2h |
| `/message/markread` | ✅ Nativo | ✅ Automation | 🟡 Easy | 1h |
| `/message/react` | ✅ Nativo | ⚠️ Partial | 🟡 Easy | 1h |

**O que fazer**: Inbox component Ruptur + Bubble backend  
**Ganho**: Conversas em tempo real, multi-agente  
**Venda**: "Inbox Omnichannel - R$199/mês"  
**Prioridade**: 🔴 P1 (conversão leads)

---

#### 4. Chat Management + Labels
| Endpoint | Bubble | Ruptur | Status | ETA |
|----------|--------|--------|--------|-----|
| `/chat/labels` | ✅ Nativo | ✅ Tag UI | 🟢 Pronto | 2h |
| `/chat/archive` | ✅ Nativo | ✅ Bulk action | 🟡 Easy | 1h |
| `/chat/delete` | ✅ Nativo | ✅ Confirmation | 🟡 Easy | 1h |
| `/chat/block` | ✅ Nativo | ✅ Safety | 🟡 Easy | 1h |
| `/chat/pin` | ✅ Nativo | ✅ Priority | 🟡 Easy | 1h |
| `/chat/mute` | ✅ Nativo | ✅ Noise control | 🟡 Easy | 1h |

**O que fazer**: Implementar UI em Ruptur (Bubble já tem tudo)  
**Ganho**: Lead qualificação automática, organização  
**Venda**: "Lead Score + Smart Labels - R$127/mês"  
**Prioridade**: 🔴 P1 (diferencial)

---

#### 5. Grupos WhatsApp
| Endpoint | Bubble | Ruptur | Status | ETA |
|----------|--------|--------|--------|-----|
| `/group/create` | ✅ Nativo | ⚠️ Partial | 🟡 Medium | 4h |
| `/group/list` | ✅ Nativo | ✅ Dashboard | 🟢 Pronto | 1h |
| `/group/addMembers` | ✅ Nativo | ✅ Bulk upload | 🟡 Easy | 3h |
| `/group/updateName` | ✅ Nativo | ✅ Edit form | 🟡 Easy | 1h |
| `/group/resetInviteCode` | ✅ Nativo | ✅ Security | 🟡 Easy | 1h |

**O que fazer**: Grupo management dashboard  
**Ganho**: Segmentação por grupo, comunidades  
**Venda**: "Grupos WhatsApp (Comunidades) - R$77/mês"  
**Prioridade**: 🟡 P2 (nice-to-have)

---

#### 6. Atendentes + Escalação
| Endpoint | Bubble | Ruptur | Status | ETA |
|----------|--------|--------|--------|-----|
| Lead `lead_assignedAttendant_id` | ✅ Schema | ⚠️ UI minimal | 🟡 Medium | 4h |
| Presence `current_presence` | ✅ Nativo | ⚠️ Partial | 🟡 Easy | 2h |
| Labels routing | ✅ Schema | ❌ Missing | 🟡 Medium | 6h |

**O que fazer**: Dashboard atendentes + assignment rules  
**Ganho**: Multi-agent, SLA, escalação automática  
**Venda**: "Atendimento Multi-Agent - R$197/mês"  
**Prioridade**: 🟡 P2 (enterprise)

---

### 🟡 TIER 2: VALOR AGREGADO (Próximas 2-3 semanas)

**Impacto**: Médio-Alto | **Complexidade**: Média | **Horas**: 40-60h

#### 7. Disparos Automáticos (SDR/Outbound)
| Endpoint | Status | Como |
|----------|--------|------|
| `/send/text` + delay | 🟡 N8N workflow | Cron disparos graduais (warmup) |
| `/message/history-sync` | 🟡 Supabase sync | Validar delivery |
| `/sender/simple` + `/sender/advanced` | 🟡 Queue system | Gerenciar fila envios |

**Implementação**:
```
1. N8N cron: busca leads segment → disparos com delay
2. Redis queue: controla rate limit (1-100/dia)
3. Supabase: rastreia status envio (sent/failed/bounce)
4. Callback: atualiza lead status
```

**Ganho**: 
- Outbound automático
- Warmup anti-ban (gradient envios)
- Recovery vendas (win-back)

**Venda**: "SDR Automático (Outbound) - R$297/mês"  
**Prioridade**: 🟡 P2

---

#### 8. Relatórios + Analytics
| Endpoint | Status | Como |
|----------|--------|------|
| `/chat/find` + filters | ✅ Bubble | Supabase queries |
| `/message/find` + history | ✅ Bubble | Grafana/Metabase BI |
| `wa_lastMsgTimestamp` | ✅ Stored | Trend analysis |

**Implementação**:
```
1. Supabase: queries por período (diário/semanal/mensal)
2. Metabase: dashboards
   - Mensagens enviadas (trend)
   - Taxa entrega (%)
   - Tempo resposta (avg)
   - Leads por stage
3. Export: CSV/PDF para Google Sheets
```

**Ganho**:
- KPIs visíveis
- Decisões data-driven
- ROI claro

**Venda**: "Relatórios & Analytics - R$127/mês"  
**Prioridade**: 🟡 P2

---

#### 9. Contatos + CRM Integrado
| Endpoint | Status | Como |
|----------|--------|------|
| `/contacts/list` | ✅ Bubble | Import/export |
| `/contact/add` | ✅ Bubble | Form + bulk |
| `lead_*` fields (20 custom) | ✅ Schema | Editáveis em Ruptur |

**Implementação**:
```
1. Bubble + Ruptur form: adicionar/editar lead_field01..20
2. Sync bidirecional (Bubble ↔ Supabase)
3. Tags automáticas (sentimento, stage, score)
4. Exportar contatos para Google Contacts
```

**Ganho**:
- Base contatos unificada
- Fields customizáveis por tenant
- Integração Google

**Venda**: Incluído em CRM Plan  
**Prioridade**: 🟡 P2

---

#### 10. Presence + Status Online
| Endpoint | Status | Como |
|----------|--------|------|
| `/instance/presence` | ✅ Nativo | Real-time estado |
| `current_presence` | ✅ Webhook | Socket.io Supabase |

**Implementação**:
```
1. Webhook: monitora presence (available/unavailable)
2. Supabase Realtime: atualiza em tempo real
3. UI Ruptur: status orbe (verde/vermelho)
4. Alert: se ficou inativo > 1h
```

**Ganho**:
- Saber quem está "online"
- Alertas desconexão
- Healthscore em tempo real

**Venda**: "Instance Monitoring (Health Score) - R$97/mês"  
**Prioridade**: 🟡 P2

---

### 🟢 TIER 3: PREMIUM + AVANÇADO (4-6 semanas)

**Impacto**: Médio | **Complexidade**: Alta | **Horas**: 60-80h

#### 11. Newsletter (WhatsApp Channels)
| Endpoint | Status | Esforço |
|----------|--------|--------|
| `/newsletter/*` (15 endpoints) | 🟡 Bubble native | Médio |

**Implementação**:
```
1. Newsletter dashboard (create, list, settings)
2. Subscribers management (add/remove/list)
3. Broadcast messages (publish, edit, delete)
4. Analytics: views, reactions, follows
```

**Ganho**:
- Broadcast para públicos
- Newsletter marketing
- Community management

**Venda**: "WhatsApp Channels (Newsletter) - R$147/mês"  
**Prioridade**: 🟢 P3 (nice-to-have)

---

#### 12. Business Catalog (E-commerce)
| Endpoint | Status | Esforço |
|----------|--------|--------|
| `/business/catalog/*` (9 endpoints) | 🟡 Bubble | Alto |

**Implementação**:
```
1. Catalog CRUD (list, add, delete products)
2. Product sync (nome, descrição, preço, foto)
3. Catálogo visível em WhatsApp (Whats API oficial)
4. Order integration (se tiver Shopify, WooCommerce)
```

**Ganho**:
- Venda via WhatsApp
- Integração e-commerce
- Transações WhatsApp

**Venda**: "WhatsApp Shop (E-commerce) - R$297/mês"  
**Prioridade**: 🟢 P3 (enterprise)

---

#### 13. Chatbot + IA
| Endpoint | Status | Esforço |
|----------|--------|--------|
| `chatbot_*` fields | 🟡 Bubble nativo | Médio |
| Integração LLM | ⚠️ Via OpenAI | Médio |

**Implementação**:
```
1. Bubble: habilitar chatbot (webhook trigger)
2. N8N: integrar LLM (Ollama local ou OpenAI)
3. Memory: Supabase para histórico conversação
4. Commands: palavras-chave para pausar/resetar
```

**Ganho**:
- Respostas automáticas 24/7
- Qualificação leads
- Redução carga atendimento

**Venda**: "Chatbot IA 24/7 - R$247/mês"  
**Prioridade**: 🟢 P3 (diferencial)

---

#### 14. Proxy + Fingerprinting
| Endpoint | Status | Esforço |
|----------|--------|--------|
| `/instance/proxy` | 🟡 Nativo UAZAPI | Alto (VPS) |
| Fingerprint headers | ⚠️ Custom | Alto |

**Implementação**:
```
1. Proxy VPS (rotaciona IP, headers, user-agent)
2. Fingerprint: device rotation (iOS/Android/Web)
3. Bypass detection: timing, pattern mimicking
4. Anti-ban automático: monitora ban-risk score
```

**Ganho**:
- Warmup seguro (anti-detecção)
- Múltiplas instâncias sem ban
- Escalabilidade WhatsApp

**Venda**: "Warmup Avançado (Anti-Ban Proxy) - R$397/mês"  
**Prioridade**: 🟢 P3 (premium)

---

#### 15. Quick Reply + Macros
| Endpoint | Status | Esforço |
|----------|--------|--------|
| `/quickreply/edit` | ✅ Bubble | Baixo |
| `/quickreply/showall` | ✅ Bubble | Baixo |

**Implementação**:
```
1. Template library (CRUD respostas padrão)
2. Variáveis dinâmicas ({nome}, {empresa}, {link})
3. Atalhos teclado (CTRL+1, CTRL+2, etc)
4. Smart suggestion (baseado contexto)
```

**Ganho**:
- Velocidade resposta
- Consistência mensagens
- Produtividade atendente

**Venda**: Incluído em Inbox Plan  
**Prioridade**: 🟢 P3

---

#### 16. Chatwoot Config
| Endpoint | Status | Esforço |
|----------|--------|--------|
| `/chatwoot/config` | 🟡 Middleware | Médio |

**Implementação**:
```
1. Webhook bidirecional (UAZAPI ↔ Chatwoot)
2. Sincronizar conversas, labels, atendentes
3. Single inbox para múltiplos channels
```

**Ganho**:
- Omnichannel (Whats + Insta + Web + Email)
- Multi-agent robusto
- Reporting unificado

**Venda**: "Chatwoot Integration (Premium Inbox) - R$297/mês"  
**Prioridade**: 🟢 P3

---

### ❌ TIER 4: NÃO FAZER NO MVP (Complexo demais)

| Endpoint | Por quê | Alternativa |
|----------|--------|------------|
| `/message/async` | Precisa background jobs robustos | N8N já faz |
| `/message/history-sync` | Supabase RLS + webhook sync | Cron 6h |
| `/call/make` + `/call/reject` | Voip complexo | User manual (simples link) |
| `/business/*` avançado | Integração Shopify/WooCommerce | Webhook webhook custom |

---

## 📈 ROADMAP RECOMENDADO (Faseado)

### MVP (Semana 1-2): TIER 1 Core
```
[ ] Instance management (já pronto)
[ ] Send messages (campanhas)
[ ] Inbox (webhook + UI)
[ ] Chat management (labels, archive, delete)
[ ] Atendentes básico (assignment)
[ ] Relatórios básicos (mensagens/dia)
[ ] Grupos WhatsApp

Estimado: 50h
Resultado: SaaS funcional, vendável
Preço: Lite R$49 + Pro R$197 + Enterprise R$397
```

### Phase 2 (Semana 3-4): TIER 2 Value-Add
```
[ ] Disparos automáticos (SDR + warmup)
[ ] Analytics completo (Metabase)
[ ] CRM completo (lead fields customizáveis)
[ ] Presence monitoring (health score)
[ ] Quick reply + templates

Estimado: 50h
Resultado: Competitivo vs HubSpot/Chatwoot
Preço: Add-ons R$127-297/mês
```

### Phase 3 (Semana 5-6): TIER 3 Premium
```
[ ] Newsletter (canais WhatsApp)
[ ] Business Catalog (e-commerce)
[ ] Chatbot IA (24/7)
[ ] Proxy + Fingerprinting (warmup avançado)
[ ] Chatwoot integration (omnichannel)

Estimado: 80h
Resultado: Full-featured, enterprise-ready
Preço: Premium R$247-397/mês + add-ons
```

---

## 🎯 PRIORIZAÇÃO FINAL

### 🔴 COMECE AQUI (P1 - 40h)
1. ✅ **Instance management** (já pronto)
2. ✅ **Send messages** (campanhas, menus, carousel)
3. ✅ **Inbox** (recebimento, conversas)
4. ✅ **Chat management** (labels, archive, block)
5. ✅ **Grupos** (create, members, settings)
6. ✅ **Relatórios básicos** (mensagens, taxa entrega)

**ETA**: 2 semanas  
**Resultado**: MVP vendável (3 planos)

---

### 🟡 DEPOIS (P2 - 50h)
7. 🟡 **Disparos automáticos** (SDR, warmup)
8. 🟡 **Analytics completo** (Metabase BI)
9. 🟡 **CRM avançado** (lead fields, scoring)
10. 🟡 **Presence + Health Score** (monitoramento)
11. 🟡 **Quick replies** (templates)

**ETA**: +2 semanas  
**Resultado**: Competitivo

---

### 🟢 PREMIUM (P3 - 80h)
12. 🟢 **Newsletter** (canais WhatsApp)
13. 🟢 **Catálogo** (e-commerce)
14. 🟢 **Chatbot IA** (24/7 automático)
15. 🟢 **Proxy avançado** (anti-ban)
16. 🟢 **Chatwoot** (omnichannel)

**ETA**: +2-3 semanas  
**Resultado**: Full-featured, premium

---

## 💰 REVENUE POTENCIAL

| Tier | Features | Preço | Clientes Alvo | Revenue/mês (30 clientes) |
|------|----------|-------|--------------|--------------------------|
| **Lite** | P1 core | R$49 | Freelancer, pequena empresa | R$1.470 |
| **Pro** | P1 + P2 | R$197 | Agência pequena, SaaS B2B | R$5.910 |
| **Enterprise** | Tudo + custom | R$397 | Agência grande, enterprise | R$11.910 |
| **Add-ons** | Analytics, IA, etc | R$127-297 | Todos | R$3.810-8.910 |
| **TOTAL** | - | - | - | **R$23-28K/mês** |

---

## ✅ CHECKLIST IMPLEMENTAÇÃO

### MVP (P1)
- [ ] Bubble: verificar plugin UAZAPI está ok
- [ ] Ruptur: expor `/api/instances` CRUD
- [ ] Ruptur: expor `/api/campaigns` + envio
- [ ] Ruptur: Inbox component (webhook + messages)
- [ ] Ruptur: Chat management UI
- [ ] Ruptur: Grupos dashboard
- [ ] Supabase: queries relatórios
- [ ] Testes E2E: each feature
- [ ] Landing: 3 planos (Lite/Pro/Enterprise)
- [ ] Deploy GCP

### P2 (Next)
- [ ] N8N workflows (disparos automáticos)
- [ ] Metabase dashboards
- [ ] CRM fields UI
- [ ] Health score monitoring
- [ ] Templates + quick reply

### P3 (Premium)
- [ ] Newsletter endpoints
- [ ] Catálogo e-commerce
- [ ] LLM chatbot integration
- [ ] Proxy + fingerprint VPS
- [ ] Chatwoot API sync

---

## 🎯 CONCLUSÃO

**UAZAPI spec é MASSIVO, mas 80% está pronto no Bubble.**

**Estratégia**:
1. ✅ MVP (Tier 1) = 2 semanas, vendável
2. ✅ Competitivo (+ Tier 2) = +2 semanas
3. ✅ Premium (+ Tier 3) = +2-3 semanas

**Total**: 6 semanas para SaaS full-featured.

**Próximo passo**: Começar pelo P1 (Instance + Send + Inbox).

---

**Quer que eu detalle a implementação de algum Tier específico?**
