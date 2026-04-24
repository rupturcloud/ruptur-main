# MIGRATION PLAN — Legacy SaaS → Ruptur Cloud

## STATUS: PHASE 1 COMPLETE (STRUCTURE CREATED)

### Phase 0: ✅ COMPLETE
- [x] Inventário completo do legado
- [x] Dossiê forense do warmup
- [x] Mapa de riscos
- [x] Classificação por item

### Phase 1: ✅ COMPLETE
- [x] Estrutura nova criada em `/Users/diego/dev/ruptur-cloud/ruptur-main/saas/`
- [x] Diretórios para todos os módulos
- [x] Diretórios para integrations isoladas
- [x] Shared config/types/constants
- [x] Runtime-data preservado

### Phase 2: 🔲 PENDING
- [ ] Mover files sem toucar warmup
- [ ] Adaptar package.json + scripts
- [ ] Adaptar .env + Dockerfile
- [ ] Mover front assets (dist/, manager-dist/)

### Phase 3: 🔲 PENDING
- [ ] Mapear Bubble inbox integration
- [ ] Mapear UAZAPI endpoints
- [ ] Mapear Stripe webhooks
- [ ] Criar integration facades

### Phase 4: 🔲 PENDING
- [ ] Análise completa de warmup
- [ ] Mapa de dependências
- [ ] Runtime origin mapping
- [ ] Rules documentation

---

## ESTRUTURA CRIADA

```
saas/
├── web/                       (Frontend assets)
├── api/                       (API layer)
├── modules/                   (Core domains)
│   ├── tenants/              (Tenant management)
│   ├── users/                (User accounts)
│   ├── onboarding/           (Setup flow)
│   ├── billing/              (Subscriptions)
│   ├── whatsapp/             (WhatsApp integration)
│   ├── inbox/                (Message inbox)
│   ├── crm/                  (CRM features)
│   ├── campaigns/            (Campaign management)
│   ├── warmup-core/          (🔒 PROTECTED: Warmup system)
│   └── health/               (Health checks)
│
├── integrations/             (Third-party integrations)
│   ├── bubble/               (Bubble integration)
│   │   ├── inbox/            (Inbox via Bubble)
│   │   ├── auth/             (Auth via Bubble)
│   │   └── embeds/           (Embedded forms)
│   ├── uazapi/               (WhatsApp via UAZAPI)
│   │   ├── instances/        (Instance management)
│   │   ├── messaging/        (Message sending)
│   │   ├── campaigns/        (Campaign delivery)
│   │   ├── webhooks/         (Webhook handling)
│   │   └── warmup-support/   (Warmup integration)
│   └── stripe/               (Payments via Stripe)
│       ├── checkout/         (Checkout flows)
│       ├── subscriptions/    (Subscription management)
│       └── webhooks/         (Webhook handling)
│
├── shared/                   (Shared utilities)
│   ├── config/               (Configuration)
│   ├── types/                (TypeScript types)
│   ├── constants/            (Constants)
│   └── utils/                (Helper functions)
│
├── docs/                     (Documentation)
│   ├── extraction/           (Migration documentation)
│   ├── architecture/         (Architecture decisions)
│   └── integrations/         (Integration guides)
│
├── runtime-data/             (Persistent state)
│   └── instance-dna/         (Instance history)
│
└── scripts/                  (Utility scripts)
    └── jarvis/               (Jarvis integration)
```

---

## PRÓXIMAS AÇÕES (PHASE 2)

1. **Mover arquivos não-críticos**
   - package.json
   - .env.example
   - Dockerfile
   - docker-compose.yml
   - shared/ecosystem-branding.json
   - scripts/jarvis/

2. **Adaptar paths**
   - Todas referências internas
   - Import paths
   - Config references

3. **Mover frontend assets**
   - dist/ → web/dist/
   - manager-dist/ → web/manager-dist/
   - dashboard-dist/ → web/dashboard-dist/

4. **Congelar runtime**
   - runtime/server.mjs → modules/warmup-core/server.mjs (SEM MUDANÇAS)
   - runtime-data/ → runtime-data/ (SEM MUDANÇAS)

---

## PRÓXIMAS AÇÕES (PHASE 3)

1. **Criar mapas de integração**
   - Bubble inbox flow
   - UAZAPI endpoints
   - Stripe webhooks

2. **Criar facades**
   - UAZAPI client wrapper
   - Supabase operations wrapper
   - Bubble inbox bridge

3. **Documentar**
   - Integrations guide
   - API contracts
   - Webhook handlers

---

## PRÓXIMAS AÇÕES (PHASE 4)

1. **Análise forense warmup**
   - Extrair constants
   - Mapear dependências
   - Documentar regras
   - Criar health checks

2. **Proteções**
   - Adicionar testes read-only
   - Adicionar validation
   - Adicionar safeguards

---

## REGRA MESTRA

**Preserve behavior > architecture**

Nada será reescrito, refatorado ou limpo até que a estrutura nova esteja operacional.

