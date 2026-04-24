# 📚 ÍNDICE — Documentação de Migração SaaS

**Projeto**: Ruptur SaaS Legacy → Ruptur Cloud  
**Status Geral**: Phase 0-2 Completo | Phase 3-4 Planejadas  
**Data**: 2026-04-19

---

## 📖 Documentos Disponíveis

### 1. 🎯 [DISCOVERY-REPORT.md](./DISCOVERY-REPORT.md) ← **COMECE AQUI**

Relatório consolidado com:
- Resumo executivo (4 fases)
- Descobertas críticas (warmup system)
- Dados técnicos completos
- Classificação de 11 itens legados
- Endpoints HTTP expostos
- Mapa de funções críticas
- Regras críticas (o que não mexer)
- Status de todas as migrações

**Ideal para**: Entender o contexto geral, integrar no state/Obsidian

---

### 2. 🔍 [WARMUP-DOSSIER.md](./WARMUP-DOSSIER.md)

Forense completa do Sistema de Aquecimento com:
- 10 seções detalhadas
- Mapa de 40+ funções críticas
- 6 endpoints HTTP locais
- 3 integrações externas (UAZAPI, Supabase, local filesystem)
- 4 regras críticas de cadência
- Schema completo de estado JSON
- Timer e scheduler detalhados
- Comportamento observado em produção (KVM2)
- Próximos passos (não fazer AGORA)
- Riscos críticos (proibido vs cuidado vs seguro)

**Ideal para**: Deep dive técnico, entender cada função e regra

---

### 3. 📋 [LEGACY-INVENTORY.md](./LEGACY-INVENTORY.md)

Inventário classificado de 11 itens do legado com:
- Estrutura do repo legado
- Descrição de cada item
- Ações recomendadas (🔒 congelar, 🔄 adaptar, ✅ mover, ❄️ archive)
- Destinos no novo repo
- Classificação de risco
- Tabela resumida com prioridade

**Ideal para**: Entender o mapa de migração, rastrear o que foi movido

---

### 4. 🚀 [MIGRATION-PLAN.md](./MIGRATION-PLAN.md)

Plano faseado completo (0-4) com:
- Status de cada phase
- O que foi feito (checkmarks)
- O que falta (fase 2-4)
- Estrutura criada em novo repo
- Próximas ações por phase
- Regra mestra: "Preserve behavior > architecture"

**Ideal para**: Rastrear progresso, planejar próximas fases

---

### 5. ⚡ [../PHASE-2-STATUS.md](../PHASE-2-STATUS.md)

Status atualizado da Phase 2 com:
- Arquivos movidos
- ⚠️ Aviso sobre credenciais não copiadas
- Próximas ações
- Estrutura final (árvore de diretórios)

**Ideal para**: Entender o que foi feito em Phase 2 especificamente

---

## 🗂️ Estrutura de Diretórios

```
/Users/diego/dev/ruptur-cloud/ruptur-main/saas/
│
├── 📄 package.json (adaptado)
├── 📄 .env.example (copiado)
├── 📄 Dockerfile (adaptado)
├── 📄 docker-compose.yml (copiado)
├── 📄 PHASE-2-STATUS.md (status detalhado)
│
├── 📁 web/
│   ├── dist/ (7.1KB — Front Lindona)
│   ├── manager-dist/ (1.8MB — Warmup Manager)
│   └── dashboard-dist/ (2.4MB — Legacy SafeFlow)
│
├── 📁 modules/
│   ├── warmup-core/ (PROTEGIDO — aguardando server.mjs)
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
├── 📁 integrations/
│   ├── uazapi/ (planejado)
│   ├── supabase/ (planejado)
│   ├── stripe/ (planejado)
│   └── bubble/ (planejado)
│
├── 📁 shared/
│   ├── config/ecosystem-branding.json
│   ├── types/
│   ├── constants/
│   └── utils/
│
├── 📁 runtime-data/
│   ├── warmup-state.json (4.3KB — copiado)
│   └── instance-dna/ (preservado)
│
├── 📁 scripts/
│   └── jarvis/resolve-activation.mjs
│
└── 📁 docs/
    ├── extraction/ ← VOCÊ ESTÁ AQUI
    │   ├── INDEX.md (este arquivo)
    │   ├── DISCOVERY-REPORT.md
    │   ├── WARMUP-DOSSIER.md
    │   ├── LEGACY-INVENTORY.md
    │   └── MIGRATION-PLAN.md
    ├── architecture/ (vazio)
    └── integrations/ (vazio)
```

---

## 🔄 Fluxo de Leitura Recomendado

### Para Entender o Projeto
1. Comece aqui (INDEX.md)
2. Leia [DISCOVERY-REPORT.md](./DISCOVERY-REPORT.md) (10 min)
3. Skim [WARMUP-DOSSIER.md](./WARMUP-DOSSIER.md) para referência (5 min)

### Para Integrar ao State/Obsidian
1. Copie conteúdo de **DISCOVERY-REPORT.md**
2. Use estrutura de **LEGACY-INVENTORY.md** para rastrear items
3. Referencie **WARMUP-DOSSIER.md** quando precisar de detalhes técnicos

### Para Próximas Fases (3-4)
1. Consulte [MIGRATION-PLAN.md](./MIGRATION-PLAN.md) seção "Phase 3" e "Phase 4"
2. Use [WARMUP-DOSSIER.md](./WARMUP-DOSSIER.md) para entender dependências
3. Siga "Próximos Passos" em ordem

---

## 🎯 Key Findings (TL;DR)

| Aspecto | Descoberta | Importância |
|---------|-----------|------------|
| **Ouro Estratégico** | Sistema de Aquecimento (Warmup) | 🔴 Crítico |
| **Ciclo** | 60 segundos, 6 instâncias/ciclo | 🔴 Crítico |
| **Cadência** | 4 dias mínimo entre mensagens | 🔴 Crítico |
| **Status Prod** | 44 instâncias, 29 conectadas, zero erros | 🟢 Saudável |
| **Proteção** | Rotina `warmup-default-24x7` imutável | 🔴 Crítico |
| **God-File** | 2611 linhas em `server.mjs` | 🟡 Risco técnico |
| **State** | JSON sem transações/locks | 🟡 Risco concorrência |
| **Credenciais** | Expostas em `.env` e JS | 🔴 Segurança |

---

## ⚡ Ações Imediatas

### ✅ Completadas (Phase 0-2)
- [x] Auditoria técnica completa
- [x] Forense do warmup system
- [x] Estrutura nova criada
- [x] Arquivos não-críticos movidos
- [x] Documentação gerada

### ⏳ Próximas (Phase 3)
- [ ] Copiar `.env` manualmente (credenciais)
- [ ] Criar wrappers de integração (UAZAPI, Supabase, Stripe, Bubble)
- [ ] Documentar API contracts

### 🔮 Futuro (Phase 4)
- [ ] Extrair warmup constants
- [ ] Mapear dependências scheduler
- [ ] Criar health checks
- [ ] Adicionar testes read-only

---

## 🔗 Ligações Importantes

| Recurso | Localização |
|---------|------------|
| Novo Repo | `/Users/diego/dev/ruptur-cloud/ruptur-main/saas/` |
| Legado Original | `/Users/diego/dev/tiatendeai/ruptur/saas/` |
| State Integration | Adicione descobertas a `state/knowledge/` |
| Obsidian Maps | Use `DISCOVERY-REPORT.md` como base |

---

## 📞 Suporte à Leitura

**Se você quer entender...**

- **"O que é o warmup?"** → DISCOVERY-REPORT.md + WARMUP-DOSSIER.md seção 1-4
- **"O que foi movido?"** → LEGACY-INVENTORY.md + PHASE-2-STATUS.md
- **"Qual é o plano?"** → MIGRATION-PLAN.md
- **"Quais são os riscos?"** → WARMUP-DOSSIER.md seção 10
- **"Como integrar ao state?"** → DISCOVERY-REPORT.md (copy full content)
- **"Qual é o próximo passo?"** → MIGRATION-PLAN.md seção Phase 3-4

---

## 📊 Estatísticas

| Métrica | Valor |
|---------|-------|
| Items Legados Inventariados | 11 |
| Fases Planejadas | 4 |
| Fases Completas | 2 |
| Diretórios Criados | 34 |
| Arquivos Movidos | 9+ |
| Documentos Gerados | 5 |
| Linhas Código Warmup | 2.611 |
| Linhas Documentação | 1.200+ |
| Frontend Assets Copiados | 4.2 MB |

---

**Última atualização**: 2026-04-19  
**Próxima revisão**: Após conclusão Phase 3  
**Referência**: Migration System v2.0
