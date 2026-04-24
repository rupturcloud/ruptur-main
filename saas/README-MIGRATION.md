# 🚀 RUPTUR SaaS — Migration Quick Start

**Status**: Phase 0-2 ✅ | Phase 3-4 🔲  
**Data**: 2026-04-19  
**Repo**: `/Users/diego/dev/ruptur-cloud/ruptur-main/saas/`

---

## ⚡ 30-Second Overview

**O que é isto?**
Nova estrutura do Ruptur SaaS com separação clara de responsabilidades, protegendo o sistema crítico de aquecimento (Warmup) enquanto se prepara para crescimento.

**O que mudou?**
- 11 items do legado foram classificados e repositionados
- 4.2 MB de assets movidos para nova estrutura
- 5 documentos gerados com descobertas técnicas
- Estrutura pronta para isolamento de integrações

**Por que agora?**
Reduzir risco técnico: o warmup system está em produção com comportamento crítico. Documentar antes de refatorar.

---

## 📚 Documentation Quick Links

| Documento | O quê | Quando Ler |
|-----------|-------|-----------|
| **[INDEX.md](./docs/extraction/INDEX.md)** | 📖 Guia de navegação | Sempre comece aqui |
| **[DISCOVERY-REPORT.md](./docs/extraction/DISCOVERY-REPORT.md)** | 🎯 Relatório consolidado | Entender contexto geral |
| **[WARMUP-DOSSIER.md](./docs/extraction/WARMUP-DOSSIER.md)** | 🔍 Forense técnica completa | Deep dive no warmup |
| **[LEGACY-INVENTORY.md](./docs/extraction/LEGACY-INVENTORY.md)** | 📋 O que foi movido | Rastrear migração |
| **[MIGRATION-PLAN.md](./docs/extraction/MIGRATION-PLAN.md)** | 🚀 Plano 4 fases | Entender roadmap |
| **[STATE-EXPORT.md](./docs/extraction/STATE-EXPORT.md)** | 💾 Pronto para estado | Copiar/colar para Obsidian |

---

## 🎯 Key Findings (TL;DR)

### Ouro Estratégico Identificado: Sistema de Aquecimento
```
- Automatiza aquecimento WhatsApp via UAZAPI
- 44 instâncias total, 29 conectadas
- Ciclo: 60 segundos, 6 instâncias/ciclo
- Cadência: 4 dias mínimo entre mensagens
- Status: Saudável, zero erros em produção
- CRÍTICO: Proteger antes de refatorar
```

### Arquitetura Legado
```
- God-file: 2.611 linhas em server.mjs
- Responsabilidades acopladas: router, scheduler, state, integrations
- State: JSON sem transações/locks (risco)
- Integrações: UAZAPI, Supabase, Stripe, Bubble
```

### O Que Foi Feito (Phase 0-2)
```
✅ Inventariados 11 items legados
✅ Criada estrutura nova (34 diretórios)
✅ Movidos 9+ arquivos não-críticos
✅ Copiados 4.2 MB assets (frontend)
✅ Gerada documentação técnica completa
🔲 Warmup ainda no legado (protegido para Phase 4)
```

---

## 🏗️ Estrutura Nova

```
saas/
├── 📁 web/                       (Frontend assets — copiados)
│   ├── dist/                     (Front Lindona 7.1KB)
│   ├── manager-dist/             (Warmup Manager 1.8MB)
│   └── dashboard-dist/           (Legacy SafeFlow 2.4MB)
│
├── 📁 modules/                   (Core domains — vazios, prontos)
│   ├── warmup-core/              (🔒 PROTEGIDO — await server.mjs)
│   ├── tenants/
│   ├── users/
│   ├── onboarding/
│   ├── billing/
│   ├── whatsapp/
│   ├── inbox/
│   ├── crm/
│   ├── campaigns/
│   └── health/
│
├── 📁 integrations/              (Third-party wrappers — planejado Phase 3)
│   ├── uazapi/
│   ├── supabase/
│   ├── stripe/
│   └── bubble/
│
├── 📁 shared/                    (Utilities)
│   ├── config/ecosystem-branding.json
│   ├── types/
│   ├── constants/
│   └── utils/
│
├── 📁 runtime-data/              (Persistent state)
│   ├── warmup-state.json         (4.3KB — copiado)
│   └── instance-dna/
│
├── 📁 scripts/
│   └── jarvis/resolve-activation.mjs
│
├── 📁 docs/
│   ├── extraction/               (📚 Documentação migração)
│   ├── architecture/
│   └── integrations/
│
├── package.json                  (Adaptado)
├── Dockerfile                    (Adaptado)
├── docker-compose.yml            (Copiado)
├── .env.example                  (Copiado)
└── README-MIGRATION.md           (Este arquivo)
```

---

## ⚠️ Ações Imediatas Necessárias

### 1. Copiar Credenciais (Manual)
```bash
# NÃO foi copiado automaticamente por segurança
cp /Users/diego/dev/tiatendeai/ruptur/saas/.env \
   /Users/diego/dev/ruptur-cloud/ruptur-main/saas/.env
```

**Conteúdo necessário**:
- `WARMUP_ADMIN_TOKEN` (UAZAPI)
- `WARMUP_SERVER_URL` (UAZAPI endpoint)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### 2. Integrar ao State/Obsidian
1. Abra [STATE-EXPORT.md](./docs/extraction/STATE-EXPORT.md)
2. Copie conteúdo
3. Crie nova página em `Obsidian/ruptur-saas-migration/`
4. Integre ao seu state system

### 3. Rotacionar Credenciais (Soon)
- [ ] Rotacionar OPENAI_API_KEY
- [ ] Rotacionar SUPABASE_KEY
- [ ] Rotacionar UAZAPI_ADMIN_TOKEN
- [ ] Remover hardcoded keys de JS

---

## 🔄 Próximas Fases

### Phase 3: Integration Isolation (Próximas 1-2 semanas)
```
Objetivo: Criar wrappers sem alterar comportamento

1. UAZAPI wrapper
   - client.js (HTTP)
   - polling.js (fetch instances)
   - webhook-handlers.js (process results)

2. Supabase wrapper
   - client.js (auth + connect)
   - operations.js (CRUD)

3. Stripe wrapper
   - checkout.js
   - subscriptions.js
   - webhooks.js

4. Bubble wrapper
   - inbox.js
   - auth.js
```

### Phase 4: Deep Warmup Analysis (Semana 3-4)
```
Objetivo: Preparar warmup para refatoração segura

1. Extrair constants → shared/constants/warmup.js
2. Copiar scheduler logic → modules/warmup-core/scheduler.js
3. Copiar pool management → modules/warmup-core/pool.js
4. Documentar todas as regras
5. Criar health checks
6. Criar testes read-only
```

---

## 🔐 Security Checklist

- [ ] `.env` copiado com credenciais
- [ ] `.env` não commitado ao git
- [ ] Supabase key removida de JS (use env injection)
- [ ] Endpoints `/warmup/api/local/*` com auth
- [ ] Tokens rotacionados (OPENAI, SUPABASE, UAZAPI)
- [ ] Audit trail mantido intacto
- [ ] Warmup-default-24x7 protegido

---

## 🧪 Testando a Estrutura

### Verificar build
```bash
cd /Users/diego/dev/ruptur-cloud/ruptur-main/saas
npm install
```

### Verificar paths
```bash
# Deve existir
ls -la ./web/dist/
ls -la ./web/manager-dist/
ls -la ./modules/warmup-core/  # ainda vazio
```

### Verificar documentação
```bash
# Ler em ordem
cat ./docs/extraction/INDEX.md
cat ./docs/extraction/DISCOVERY-REPORT.md
```

---

## 📞 Suporte Rápido

**"Onde está o warmup?"**
→ Ainda no legado. Phase 4 o trará para a nova estrutura.
→ Veja WARMUP-DOSSIER.md para forense completa.

**"O que foi movido?"**
→ Frontend assets (dist/, manager-dist/, dashboard-dist/), configs, scripts.
→ Veja LEGACY-INVENTORY.md para checklist.

**"Como integro ao estado?"**
→ Copie STATE-EXPORT.md para seu Obsidian.
→ Veja INDEX.md para navegação.

**"Quando é Phase 3?"**
→ Quando credenciais forem seguras e state estiver integrado.
→ Veja MIGRATION-PLAN.md para roadmap.

**"Por que warmup está protegido?"**
→ Está em produção com comportamento crítico.
→ Documentar primeiro, refatorar depois (safe).
→ Veja WARMUP-DOSSIER.md seção "Regras Críticas".

---

## 📊 Métricas

| Métrica | Valor |
|---------|-------|
| Items Inventariados | 11 |
| Fases Completas | 2 |
| Diretórios Criados | 34 |
| Documentos Gerados | 6 |
| Linhas Warmup Code | 2.611 |
| Assets Copiados | 4.2 MB |
| Status Produção | ✅ Saudável |

---

## 🎯 Próximas Ações (In Order)

1. **Hoje**: Ler [INDEX.md](./docs/extraction/INDEX.md) + [DISCOVERY-REPORT.md](./docs/extraction/DISCOVERY-REPORT.md)
2. **Amanhã**: Copiar `.env` manualmente
3. **Dia 3**: Integrar [STATE-EXPORT.md](./docs/extraction/STATE-EXPORT.md) ao Obsidian
4. **Semana 2**: Iniciar Phase 3 (integrations)
5. **Semana 4**: Iniciar Phase 4 (warmup analysis)

---

## 📚 Documentos Referência

```
📁 /Users/diego/dev/ruptur-cloud/ruptur-main/saas/docs/extraction/

├── 📖 INDEX.md                  ← Comece aqui
├── 🎯 DISCOVERY-REPORT.md       ← Consolidado (para state)
├── 🔍 WARMUP-DOSSIER.md         ← Técnico completo
├── 📋 LEGACY-INVENTORY.md       ← O que foi movido
├── 🚀 MIGRATION-PLAN.md         ← Plano 4 fases
└── 💾 STATE-EXPORT.md           ← Copiar/colar Obsidian
```

---

**Criado**: 2026-04-19  
**Status**: Phase 0-2 ✅ Completo  
**Próximo**: Phase 3 (1-2 semanas)

🎯 **Comece por**: [INDEX.md](./docs/extraction/INDEX.md)
