# 📖 RUPTUR SaaS - BÍBLIA COMPLETA DE INSUMOS E SOLUÇÕES

**Proprietário**: Diego (@thearch@ruptur.cloud)  
**Data**: 2026-05-07  
**Visão**: SaaS Full WhatsApp/Omnichannel (CRM/SDR/Outbound/Inbound/IA) rodando HOJE, parametrizando 100% existente, zero custo novo, free-tier max.  
**Stack**: UAZAPI (tiatendeai) + Bubble (front vendas) + Whats Business não-oficial + KVM2 Hostinger + Oracle VPS x2 free + Supabase Cloud + Redis + GitHub + Vercel + Cloudflare + Google APIs + Grafana/Prometheus + Typebot + HF/OpenAI/OpenRouter + N8N/Orion selecionado.

---

## 📑 ÍNDICE COMPLETO

1. **Bloco 0**: Contexto Global & Identidade
2. **Bloco 1**: Stack Atual (O que Você JÁ TEM)
3. **Bloco 2**: UAZAPI Core - Bíblia Links Exaustiva
4. **Bloco 3**: Plugin Bubble + Funcionalidades 105 Endpoints
5. **Bloco 4**: Orion Top 10 Selfhosted (Sem Reinventar Roda)
6. **Bloco 5**: KVM2 Hostinger + Oracle VPS Deploy
7. **Bloco 6**: Micro-Vitórias 1-10 (Rodar Hoje)
8. **Bloco 7**: Roadmap SaaS Full (2-4 Semanas)
9. **Apêndice A**: Tabelas Técnicas (Endpoints, Workflows, etc)
10. **Apêndice B**: Checklist Pré-Produção

---

# BLOCO 0: CONTEXTO GLOBAL & IDENTIDADE

## 👤 Quem é Diego (você)

- **Email**: ruptur.cloud@gmail.com
- **Identidade**: @thearch@ruptur.cloud
- **Papel**: Proprietário Ruptur SaaS, arquiteto full-stack, foco WhatsApp/automação
- **Stack Mindset**: Parametrize o existente, conecte peças, lance hoje, escale amanhã

## 🎯 Visão Central do Projeto

**Não é**: Construir SaaS WhatsApp do zero, nem usar Bubble inteiro como backend, nem depender 100% UAZAPI free.

**É**: Usar UAZAPI (API WhatsApp premium) + Bubble (front vendas) + Selfhosted Orion (CRM/warmup/IA) para criar solução omnichannel (Whats/Insta) rodando hoje. Foco MVPs rápidas, vender antes de "perfeito", escalar infra com zero custo novo (Oracle+Hostinger+Supabase free-tier).

## 🏗️ Arquitetura Geral (Visão 30mil pés)

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA FRONT (Vendas)                    │
│  Vercel + Cloudflare + Figma (prototipo) → Landing/Bubble   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│              CAMADA BUBBLE (Lógica UI/UX)                   │
│  tiatendeai (app Bubble) + Plugin uazapiGO + Stripe pago    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│           CAMADA CORE WHATSAPP (Messaging)                  │
│  UAZAPI Server: tiatendeai.uazapi.com (105 endpoints)       │
│  + Whats Business não-oficial + Evolution/Quepasa proxy     │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│          CAMADA BACKEND (KVM2 Hostinger + Oracle x2)        │
│  N8N (workflows) + Chatwoot (inbox) + TwentyCRM (dados)     │
│  Redis (cache warmup) + MinIO (storage) + Grafana (BI)      │
│  Supabase (DB) + Typebot (bots) + Flowise (IA)              │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│         CAMADA IA/INTELIGÊNCIA (Selfhosted)                 │
│  Ollama (LLM local) + Hugging Face (models) +               │
│  OpenRouter/OpenAI API (backup/pesado) + Sentiment (NLP)    │
└─────────────────────────────────────────────────────────────┘
```

**Fluxo de Dados Exemplo**: Usuário clica "Enviar Campaign" em Bubble → N8N webhook dispara → UAZAPI envia Whats → Webhook retorna → Supabase/Redis salva status → Grafana plota métrica → Lead score atualiza.

---

# BLOCO 1: STACK ATUAL - O QUE VOCÊ JÁ TEM

## 📊 Tabela Exaustiva: Ferramentas + Status + Sinergia UAZAPI

| Categoria | Ferramenta | Status | Integração UAZAPI/MVP | Ganho Imediato | Prioridade |
|-----------|-----------|--------|----------------------|-----------------|-----------|
| **Infra VPS** | KVM2 Hostinger | ✅ Pago | Rodar N8N/Redis/Chatwoot | Escala instâncias, warmup nativo | 🔴 P1 |
| **Infra VPS** | Oracle VPS Mini free (x2) | ✅ Free | Redundância tiatendeai, Evolution proxy | Failover automático anti-ban | 🔴 P1 |
| **DB/Cache** | Supabase Cloud (free-tier) | ✅ Ativo | Webhook UAZAPI → leads/CRM DB | Lead score real-time, fluxo conversacional | 🔴 P1 |
| **DB/Cache** | Redis (em Orion) | ✅ Orion | Cache warmup status, session healthscore | Sessions instant, RTX queries | 🟡 P2 |
| **Frontend Deploy** | Vercel | ✅ Free | Deploy landing "Teste Whats R$47" | Ultra-rápido + preview branches | 🟡 P2 |
| **CDN/Proxy** | Cloudflare | ✅ Free | Proxy tiatendeai.uazapi.com (anti-detecção) | Rate limit, geo-rotation, SSL grátis | 🔴 P1 |
| **Dev/CI-CD** | GitHub + GitHub Actions | ✅ Ativo | Workflow: push → Orion redeploy Oracle1 | Versionamento, automação deploy | 🟡 P2 |
| **IDE/Código** | Antigravity IDE | ✅ Ativo | Bots código gerado > Typebot integrado | Prototipagem rápida N8N/Python | 🟡 P2 |
| **Design** | Figma | ✅ Ativo | Prototipa inbox/CRM Chatwoot > implement | Spec exato para dev | 🟡 P2 |
| **Wiki/Docs** | Notion | ✅ Ativo | Este MD + Notion como wiki (redundância) | Onboarding equipe, documentação viva | 🟡 P2 |
| **Tarefas/Roadmap** | Linear | ✅ Ativo | Tickets: "Deploy N8N", "Config Chatwoot" | Sprint tracking | 🟡 P2 |
| **IA/Models** | Hugging Face (free) | ✅ Free | Sentiment analysis webhook UAZAPI | Análise emoção leads (hot/cold) | 🟡 P2 |
| **IA/LLM Router** | OpenRouter (barato) | ✅ Free tier | Router: OpenAI fallback (3-5x mais barato) | Custo IA reduzido, failover automático | 🟡 P2 |
| **IA/LLM Pago** | OpenAI API | ✅ Free credits | Assistente IA webhook > resposta auto | Análise contexto, qualificação leads | 🟡 P2 |
| **IA/Chatbot** | Typebot (Orion 05) | ✅ Orion | Fluxos visuais Whats (UAZAPI send) | Bots sem código | 🔴 P1 |
| **Dev Tools** | Jam.dev | ✅ Free | Bug reports / debug vídeo | Teste E2E, issue trace | 🟢 P3 |
| **Monitor/Métricas** | Grafana (Orion 29) | ✅ Orion | Dashboard healthscore UAZAPI + Whats | Visualização ban-risk real-time | 🔴 P1 |
| **Monitor/Métricas** | Prometheus (Orion) | ✅ Orion | Scrape Redis/Supabase/UAZAPI metrics | Séries tempo, alertas thresholds | 🟡 P2 |
| **Google Suite** | Google Sheets/Slides/Docs/Calendar | ✅ Free | Sync métricas Supabase → Sheets, agendamento | Receita previsível (Aaron Ross export) | 🟡 P2 |
| **Workflows** | N8N (Orion 06) | ✅ Orion | Hub central: webhook UAZAPI → tudo | Automatização warmup, CRM sync | 🔴 P1 |
| **CRM/Inbox** | Chatwoot (Orion 02) | ✅ Orion | Canal UAZAPI + Insta + Web | Inbox unificada omnichannel | 🔴 P1 |
| **CRM/Dados** | TwentyCRM (Orion 46) | ✅ Orion | API sync conversas UAZAPI → leads DB | Full CRM open-source, SDR ready | 🔴 P1 |
| **IA/Fluxos** | Flowise (Orion 07) | ✅ Orion | Sentiment nodes em webhook, LLM chains | IA assistentes visually | 🟡 P2 |
| **IA/Local** | Ollama (Orion 30-31) | ✅ Orion | LLM local (Mistral/Llama 7B) | Zero custo inference, privacidade | 🟡 P2 |
| **Storage Selfhosted** | MinIO (Orion 04) | ✅ Orion | S3 compatível > upload UAZAPI mídia | Reduz custo Bubble storage | 🟡 P2 |
| **Testing** | Teste Sprite? (pendente) | ❓ Unclear | ? | ? | 🟢 P3 |
| **Context Manager** | Context7? (pendente) | ❓ Unclear | ? | ? | 🟢 P3 |

**Resumo**: Você já tem **90% da stack** montada. Faltam apenas parametrizações, integrações e deploy. Zero novo custo. Destino: SaaS omnichannel Whats/Insta competitivo com Hubspot.

---

# BLOCO 2: UAZAPI CORE - BÍBLIA LINKS EXAUSTIVA

## 📚 Tabela Completa: Links + Descrições Originais (Mantém Tudo)

| Categoria | Link | Descrição Completa (Mantida 100%) |
|-----------|------|----------------------------------|
| **Servidor Principal** | https://uazapi.dev/interno?p=conecte | Página gerenciamento servidores. Seção "Meus Servidores" lista **tiatendeai** como servidor grátis. Crie instâncias aqui. Acessar regularmente para renovar token (free TTL 1h). |
| **Servidor URL Base** | https://tiatendeai.uazapi.com | Seu servidor pessoal. Use como base para API calls: `https://tiatendeai.uazapi.com/send/text` + parametros. Free: instâncias TTL ~1h, resetam. Pago: URL permanente. |
| **Token Instance** | c81a5296-36db-4b80-8a47-96539591261b | Token autenticação UAZAPI. Usar em headers: `Authorization: Bearer c81a5296-36db-4b80-8a47-96539591261b`. NUNCA expor no frontend (client-side). |
| **Plugin Bubble** | https://bubble.io/plugin/uazapigo---whatsapp-api-1725712298105x455773695640076300 | Plugin oficial uazapiGO v2.0 Bubble. Todas chamadas 105 endpoints configuradas! Facilita WhatsApp em Bubble sem API Connector manual. Versão atual (recomendada). |
| **Plugin Legado** | https://bubble.io/plugin/uazapijs---whatsapp-api-1687876991772x211640242971607040 | uazapi.js (versão antiga). Não usar (use uazapiGO). |
| **Plugin Editor** | https://bubble.io/plugin_editor?id=1725712298105x455773695640076300&tab=tabs-1 | Abre editor interno plugin Bubble. Ver chamadas, código gerado, testes. |
| **App tiatendeai (Bubble)** | https://bubble.io/page?id=tiatendeai&tab=Styles&show_plugin=uazapiGO+-+WhatsApp+API&type=page&name=Home&ai_generated=true | Seu app Bubble com plugin uazapiGO instalado. Home page AI-generated. Parametrize aqui para landing/MVP. |
| **App tiatendeai Mobile** | https://bubble.io/page?id=tiatendeai&app_type=mobile&source=onboarding&tab=Design&name=Home&type=page&ai_generated=true | Versão mobile do app (responsive). |
| **Plugin Demo Index** | https://bubble.io/page?id=uazapigo-plugin&tab=Design&name=index | Página design index do plugin demo. Veja exemplos implementação. |
| **Plugin Teste com Debug** | https://uazapigo-plugin.bubbleapps.io/version-test?debug_mode=true | Versão teste ao vivo com `debug_mode=true`. Inspecione chamadas API, respostas, timing. Melhor lugar para entender endpoints. |
| **Demo Inbox Multiatendimento** | https://uazapigo-multiatendimento.bubbleapps.io/ | Inbox multi-atendimento Bubble pré-pronto. Exibe conversas WhatsApp, atendentes, labels. **Faltava esta parte** - use como referência inbox melhor que demo básico. |
| **Contributor Bubble** | https://bubble.io/contributor/1551375666439x869672428482681800 | Seu perfil contributor Bubble. Acesso controle plugins criados. |
| **Home UAZAPI** | https://uazapi.dev/ | Site principal UAZAPI. Login, planos, docs link. |
| **Docs UAZAPI Completa** | https://docs.uazapi.com | Documentação técnica 105 endpoints, 15 schemas JSON. **Referência autoridade**. Inclui: send/text, send/media (imagem/vídeo/áudio/doc/sticker), send/location, send/menu (botão/carousel/lista/enquete), send/contact, webhooks, instance management, group ops, contact lists, label management, status updates, reaction, delete message, edit message, download media, check if number on WhatsApp, get instance status, QR code, pair code, etc. |
| **Config Bubble Específica** | https://uazapi.dev/interno?p=configbubble | Página configuração específica Bubble dentro UAZAPI. Parâmetros plugin, credenciais, test. |
| **Config Conta UAZAPI** | https://uazapi.dev/interno?p=conta | Gerenciamento conta UAZAPI. Dados pessoais, planos, integração API keys. |
| **Plugin Link Visual** | https://35f4dab92897cf3e1238db60f83e8b64.cdn.bubble.io/cdn-cgi/image/w=1024,h=275,f=auto,dpr=2,fit=contain/f1729874579562x386596938016600300/plugin.jpg | Imagem screenshot plugin (referência visual). |

## 🔗 Resumo Estrutura UAZAPI

```
UAZAPI Ecosystem:
├── API Server: tiatendeai.uazapi.com (seu endpoint)
├── Admin Panel: uazapi.dev/interno/
├── Token Auth: c81a5296-36db-4b80-8a47-96539591261b (instance)
├── Endpoints: 105 total (docs.uazapi.com)
├── Plugin Bubble: uazapiGO (v2.0)
├── App Bubble: tiatendeai (seu projeto)
├── Demo: uazapigo-plugin.bubbleapps.io
└── Inbox Demo: uazapigo-multiatendimento.bubbleapps.io (omnichannel)
```

---

# BLOCO 3: PLUGIN BUBBLE + FUNCIONALIDADES 105 ENDPOINTS

## 🎯 Cards: Funções Core (Agrupadas por Contexto)

### CARD 1️⃣ : Envio Mensagens (Core Revenue)
**Finalidade**: Mensagens texto/mídia/menu para campanha WhatsApp.  
**Endpoints**: `send/text`, `send/media`, `send/location`, `send/menu`, `send/contact`, `send/stories`.  
**Plugin**: ▶️ Server Side (seguro, consome WU) | 🔓 Client Side (rápido, sem WU, exponha só não-sigiloso).  
**Params**: `phone`, `message`, `delay`, `quoted_message_id`, `mentions`, `link_preview`.  
**Webhook**: Retorna `message_id`, `status` (pending/sent/failed).  
**MVP Venda**: "Envie campanhas WhatsApp ilimitadas R$47/mês - Teste grátis".  
**Tech Stack**: Bubble form → N8N validate → UAZAPI endpoint → Redis queue (warmup).

---

### CARD 2️⃣ : Gerenciamento Instâncias/Contas
**Finalidade**: Criar/listar/deletar instâncias WhatsApp. Controle healthscore.  
**Endpoints**: `instance/create`, `instance/list`, `instance/details` (QRCode+PairCode), `instance/disconnect`, `instance/delete`, `instance/change_name`.  
**Plugin**: ▶️ Server Side (admintoken required).  
**Warmup/Maturação**: Monitor API calls repetidas (Prometheus scrape) → Grafana healthscore (% uptime + send rate + ban-risk).  
**Extension**: Predict ban via ML (HF model: send-rate > threshold → flag).  
**MVP Venda**: "Gerenciador Instâncias Anti-Ban (Healthscore) R$97/mês".  
**Tech Stack**: Grafana dashboard → Prometheus scrape UAZAPI `/instance/status` → alertas Redis.

---

### CARD 3️⃣ : Webhooks & Recebimento (Inbox)
**Finalidade**: Receba mensagens/events UAZAPI em tempo real. Feed inbox.  
**Endpoints**: `webhook/create`, `webhook/list`, `webhook/show`.  
**Webhook Payload**: `message_id`, `phone`, `body`, `media_type`, `timestamp`, `is_group`, `contact_name`.  
**Plugin**: ▶️ Server Side config (Bubble webhook URL).  
**Integração**: UAZAPI webhook → Bubble → N8N endpoint → Supabase save → Redis cache → Chatwoot sync.  
**Extension**: Sentiment real-time (webhook → HF model → tag "hot/cold").  
**MVP Venda**: "Inbox Omnichannel Grátis (Whats+Insta+Web) R$0 teste".  
**Tech Stack**: Chatwoot (Orion 02) + UAZAPI canal + real-time via Socket.io.

---

### CARD 4️⃣ : Grupos & Contatos
**Finalidade**: Gerenciar grupos, adicionar membros, contatos.  
**Endpoints**: `group/create`, `group/list`, `group/details`, `group/add_members`, `group/remove_members`, `group/edit_name`, `group/edit_image`, `group/change_invite_url`, `group/edit_locked`, `group/edit_announce`, `group/edit_description`, `contact/list`, `contact/search`.  
**Plugin**: ▶️ Server Side.  
**Extension**: Lead qualificação por grupo (ex: "Clientes Ativos" grupo → lead_score +10).  
**MVP Venda**: "Segmentação por Grupos (Whats Communities) R$77/mês".  
**Tech Stack**: N8N → UAZAPI group ops → Supabase segment table → TwentyCRM sync.

---

### CARD 5️⃣ : Chat Management & Labels
**Finalidade**: Pesquisar chats, adicionar labels, arquivar, mutar, bloquear, importar leads.  
**Endpoints**: `chat/search`, `chat/edit_lead`, `chat/pin`, `chat/mute`, `chat/archive`, `chat/delete`, `chat/label`, `chat/block`, `chat/import_leads`, `label/list`.  
**Plugin**: ▶️ Server Side.  
**Extension**: Auto-label via sentiment (webhook → HF → tag automatic).  
**MVP Venda**: "Qualificação Automática Leads (Labels Smart) R$127/mês".  
**Tech Stack**: Webhook sentiment → N8N label assigner → UAZAPI chat/label endpoint.

---

### CARD 6️⃣ : Status Mensagens & Reações
**Finalidade**: Verificar delivery/read status, reagir, deletar, editar, download mídia.  
**Endpoints**: `message/search`, `message/reaction`, `message/delete_for_everyone`, `message/mark_as_read`, `message/edit`, `message/download`, `send/presence` (online/offline).  
**Plugin**: ▶️ Server Side.  
**Extension**: Análise taxa entrega (Prometheus metric: mensagens_entregues / mensagens_enviadas).  
**MVP Venda**: "Análise Entrega Mensagens (Relatório de Delivery) R$47/mês".  
**Tech Stack**: Grafana + Prometheus scrape UAZAPI message metrics.

---

### CARD 7️⃣ : IA/Chatbot & Assistentes
**Finalidade**: Configurar assistentes IA, triggers, knowledge base, funções custom.  
**Endpoints**: `chatbot/instance_settings`, `chatbot/create_trigger`, `chatbot/ai_agent` (create/edit), `chatbot/ai_knowledge` (create/edit), `chatbot/ai_function` (create/edit).  
**Plugin**: ▶️ Server Side (UAZAPI tem suporte IA nativo).  
**Extension**: Local LLM (Ollama Orion 30) + Flowise (Orion 07) para sentiment chains.  
**MVP Venda**: "Assistente IA 24/7 (Respostas Auto Whats) R$197/mês".  
**Tech Stack**: Ollama (LLM Mistral 7B) → Flowise (chains) → N8N webhook → UAZAPI send.

---

### CARD 8️⃣ : SDR/Outbound/Warmup
**Finalidade**: Disparos graduais, recuperação vendas, follow-ups automáticos.  
**Endpoints**: send/text com `delay` param + N8N cron workflow.  
**Plugin**: ▶️ N8N HTTP node (não é nativo UAZAPI, mas parametrizável).  
**Extension**: Redis queue anti-ban (enfileira envios, respeita rate limit).  
**MVP Venda**: "SDR Automático (Outbound) R$297/mês".  
**Tech Stack**: N8N cron → Redis queue → UAZAPI send/text (1-100 dia com warmup).

---

### CARD 9️⃣ : CRM Full (Aaron Ross / Receita Previsível)
**Finalidade**: Lead score, fluxo conversacional, pipeline stages, previsão revenue.  
**Endpoints**: Tudo acima + custom field mapping via `instance/update_fields`.  
**Plugin**: ▶️ TwentyCRM (Orion 46) + Supabase DB.  
**Aaron Ross Framework**: Webhook → N8N pipeline (stage 1/2/3/4) → Supabase → Metabase BI → receita = (# leads stage4) × (conversion %) × (ticket médio).  
**Extension**: Lead score (Supabase: points = 5×opened + 3×replied + 10×scheduled + 20×paid).  
**MVP Venda**: "CRM WhatsApp Completo (Pipeline+Previsão) R$397/mês".  
**Tech Stack**: Webhook → N8N → Supabase → Metabase (Orion 24) + TwentyCRM UI.

---

### CARD 🔟 : Omnichannel (Whats + Insta + Web)
**Finalidade**: Unificar Whats/Insta/Form web em inbox único.  
**Endpoints**: UAZAPI Whats + Chatwoot multi-channel integration.  
**Plugin**: Chatwoot (Orion 02) como hub central.  
**Extension**: Instagram via Meta API mimic (proxy VPS com Puppeteer).  
**MVP Venda**: "Inbox Omnichannel Completo (Whats+Insta+Web) R$199/mês".  
**Tech Stack**: Chatwoot (central) + UAZAPI (Whats) + Insta API (proxy Oracle VPS) + web forms.

---

## 📊 Tabela: 105 Endpoints UAZAPI (Resumida, Categorizada)

| Categoria | Quantidade | Exemplos | Link Docs |
|-----------|-----------|----------|-----------|
| Envio Mensagens | 6 | send/text, send/media, send/menu, send/location | docs.uazapi.com |
| Chat Management | 8 | chat/search, chat/label, chat/archive, chat/block | docs.uazapi.com |
| Instâncias | 11 | instance/create, instance/list, instance/details, instance/connect | docs.uazapi.com |
| Grupos | 15 | group/create, group/add_members, group/edit_name | docs.uazapi.com |
| Contatos/Labels | 5 | contact/list, label/list | docs.uazapi.com |
| Mensagens (Status/Reaction) | 8 | message/search, message/reaction, message/delete | docs.uazapi.com |
| Webhooks | 3 | webhook/create, webhook/list, webhook/show | docs.uazapi.com |
| Atendentes | 2 | attendant/list, attendant/create | docs.uazapi.com |
| Sender Management | 7 | sender/create, sender/edit_folder, sender/list | docs.uazapi.com |
| ChatBot/IA | 10 | chatbot/instance_settings, chatbot/create_trigger | docs.uazapi.com |
| Outros (Check number, Profile, Proxy) | 14 | check_number_on_whatsapp, get_profile_info | docs.uazapi.com |
| **TOTAL** | **105** | ... | docs.uazapi.com |

---

# BLOCO 4: ORION TOP 10 SELFHOSTED (Sem Reinventar Roda)

## 🎯 Critério Seleção

Não usar Setup Orion completo (97+ ferramentas = overhead). Usar top 10 que fazem sentido direto com UAZAPI/Bubble/KVM2:
- ✅ Sinergia WhatsApp/CRM/IA
- ✅ Free-tier ou incluído repo
- ✅ Low RAM (KVM2 2-4GB roda 10 fácil)
- ✅ Docker compose pronto (Orion)

## 📋 Top 10 Orion + Parametrização Direta

### Orion #1: Traefik + Portainer (Infra)
**Orion Link**: Ordem 01 (Traefik/Portainer setup)  
**O que é**: Proxy reverso (Traefik) + gerenciador containers (Portainer). Orquestra Docker, SSL automático, roteamento.  
**Sinergia**: Route tiatendeai.uazapi.com → KVM2 backend. Escala múltiplas instâncias sem conflito porta.  
**Parametrize Hoje**:
```bash
# No KVM2 Hostinger via SSH:
git clone https://github.com/YOUR_ORION_REPO orion  # ou clone manual
cd orion && docker-compose -f traefik-portainer.yml up -d

# Acesse: https://kvm2-hostname.com/portainer
# Config: UAZAPI_SERVER=https://tiatendeai.uazapi.com
# Route webhook N8N: /api/webhooks → backend:3000
```
**Ganho**: Escalável, múltiplas instâncias UAZAPI em paralelo, SSL grátis, zero nginx manual.

---

### Orion #6: N8N (Workflows Automação)
**Orion Link**: Ordem 06  
**O que é**: Workflow visual (tipo Make/Zapier) open-source. Conecta qualquer API.  
**Sinergia**: Hub central automação. Webhook UAZAPI → N8N → Supabase/Bubble/Chatwoot. Warmup cron, lead score, sentiment.  
**Parametrize Hoje**:
```bash
# Docker compose N8N (em Orion repo):
docker-compose -f n8n.yml up -d

# Acesse: http://kvm2-ip:5678
# Setup initial: email + password
# Criar workflow:
  1. UAZAPI webhook trigger (recebe mensagem)
  2. Sentiment node (HF model via HTTP)
  3. Lead score calculator (Supabase lookup)
  4. Chatwoot HTTP POST (cria ticket)
  5. Redis HSET (cache status)

# Export JSON workflow para versionamento (GitHub Actions)
```
**Ganho**: Automação sem código, central intelligence, reutilizável, versionável.

---

### Orion #2: Chatwoot (Inbox Omnichannel)
**Orion Link**: Ordem 02  
**O que é**: Inbox omnichannel (Whats/Insta/FB/Web/Email). CRM leve, multi-agent.  
**Sinergia**: Unifica UAZAPI (Whats canal) + Instagram (proxy) + Form web. Melhor que Bubble inbox demo.  
**Parametrize Hoje**:
```bash
# Docker compose Chatwoot:
docker-compose -f chatwoot.yml up -d

# Acesse: http://kvm2-ip:3000
# Setup: email, senha, agent count
# Add canal UAZAPI:
  Integrations > Custom Channel
  Name: "UAZAPI WhatsApp"
  Webhook URL: https://kvm2.com/api/v1/webhooks/chatwoot
  Token: UAZAPI_TOKEN (salvar Chatwoot env)

# Config UAZAPI webhook → Chatwoot:
  tiatendeai.uazapi.com/webhook/create
  URL: https://chatwoot.kvm2.com/api/v1/incoming_messages
  Body mapping: phone → contact, body → message
```
**Ganho**: Inbox profissional, multi-agent, labels, respostas templates, superior Bubble demo.

---

### Orion #4: MinIO (Storage S3)
**Orion Link**: Ordem 04  
**O que é**: S3 compatível selfhosted. Armazena mídia.  
**Sinergia**: UAZAPI upload arquivos → MinIO. Reduz custo Bubble storage. Backup local.  
**Parametrize Hoje**:
```bash
# Docker compose MinIO:
docker-compose -f minio.yml up -d

# Acesse: http://kvm2-ip:9000
# Setup: access key, secret key
# Criar bucket: "uazapi-media"

# Config UAZAPI upload:
# N8N: send/media endpoint
# S3 config: endpoint=http://minio:9000, bucket=uazapi-media
# Result: URL assets via Traefik: https://kvm2.com/media/filename
```
**Ganho**: Zero custo storage, privacidade mídia, velocidade local.

---

### Orion #05: Typebot (Chatbot Visual)
**Orion Link**: Ordem 05  
**O que é**: Chatbot funis visuais (drag-drop). Integra Whats via webhook.  
**Sinergia**: Fluxos lead qualificação automática. Webhook Typebot → UAZAPI send (respostas contextuais).  
**Parametrize Hoje**:
```bash
# Docker compose Typebot:
docker-compose -f typebot.yml up -d

# Acesse: http://kvm2-ip:3001
# Criar bot: "Lead Qualification"
# Nós: Question (name) → Condition (budget?) → Fallback UAZAPI send

# Config webhook Typebot:
# N8N trigger: UAZAPI message → Typebot API (sendMessage)
# Resposta → Webhook UAZAPI send/text (loop)
```
**Ganho**: Bots sem código, fluxos complexos, automação semi-inteligente.

---

### Orion #15: Uptime Kuma (Monitor Healthscore)
**Orion Link**: Ordem 15  
**O que é**: Uptime monitor. Ping hosts, alertas Slack/Email.  
**Sinergia**: Monitor tiatendeai healthscore (status API). Prediz ban-risk via downtime pattern.  
**Parametrize Hoje**:
```bash
# Docker compose Uptime Kuma:
docker-compose -f uptime-kuma.yml up -d

# Acesse: http://kvm2-ip:3001
# Add monitor: 
  Name: "UAZAPI tiatendeai healthscore"
  Type: HTTP
  URL: https://tiatendeai.uazapi.com/instance/status
  Header: Authorization: Bearer c81a5296-36db-4b80-8a47-96539591261b
  Interval: 5 min
  Alert Slack: #alerts (se +1 falha)

# Metrics: uptime%, response time, incident log
# Dashboard Grafana: scrape Uptime Kuma API
```
**Ganho**: Visibilidade ban-risk, alertas proativas, histórico downtime.

---

### Orion #24: Metabase (BI Dashboard)
**Orion Link**: Ordem 24  
**O que é**: BI/Data viz (tipo Looker/Tableau). Query banco, gráficos.  
**Sinergia**: Query Supabase → Métricas Aaron Ross (revenue predictability). Score point, conversion funnel.  
**Parametrize Hoje**:
```bash
# Docker compose Metabase:
docker-compose -f metabase.yml up -d

# Acesse: http://kvm2-ip:3000
# Connect DB: Supabase (host/port/database/user/password)
# Criar dashboard:
  1. Query leads table (filter: stage = 'qualified')
  2. Sum revenue where status='paid'
  3. Chart: leads_by_day (time series)
  4. Funnel: leads → qualified → paid (% conversion)
  5. Metric: "Revenue Previsível (MRR)" = stage4_count × 0.8 × ticket_avg

# Share dashboard público ou Bubble embed (iframe)
```
**Ganho**: BI profissional, receita visível, decisões data-driven.

---

### Orion #07/41: Flowise (IA Workflows)
**Orion Link**: Ordem 07 (Flowise) / 30-31 (Ollama LLM local)  
**O que é**: LangChain visual (IA chains). Ollama: LLM local (Mistral 7B, Llama 2).  
**Sinergia**: Sentiment webhook UAZAPI → Flowise chain → tag lead. Assistente IA sem custo OpenAI.  
**Parametrize Hoje**:
```bash
# Docker compose Ollama + Flowise:
docker-compose -f ollama.yml up -d
docker-compose -f flowise.yml up -d

# Ollama pull: mistral (4.4GB)
# Acesse Flowise: http://kvm2-ip:3000

# Criar flow "Sentiment Analysis":
  1. Webhook input (UAZAPI message body)
  2. Ollama node: prompt="Analyze sentiment: {message}. Return: HOT/WARM/COLD"
  3. HTTP POST Supabase: update lead.sentiment_tag
  4. Chatwoot HTTP: update ticket tags

# Test: POST webhook com mensagem exemplo
```
**Ganho**: IA local (zero custo), análise contexto, assistentes custom, privacidade.

---

### Orion #46: TwentyCRM (CRM Open-Source)
**Orion Link**: Ordem 46  
**O que é**: CRM moderno open (tipo Pipedrive). Pipeline, contatos, deals.  
**Sinergia**: API sync UAZAPI conversas → leads DB. SDR dashboard, fluxo conversacional.  
**Parametrize Hoje**:
```bash
# Docker compose TwentyCRM:
docker-compose -f twentycrm.yml up -d

# Acesse: http://kvm2-ip:3001
# Setup: email, workspace name
# Import via API: N8N workflow
  1. GET /api/v1/instance/chats (UAZAPI)
  2. Transform → TwentyCRM API POST /companies (customer) + /deals (conversation)
  3. Map fields: phone → customer.phone, timestamp → deal.created_at

# Dashboard: Sales pipeline (Qualified → Won)
# Export API para Bubble embed (iframe ou API sync)
```
**Ganho**: CRM profissional open-source, escalável, API-first, customizável.

---

### Orion #38: Supabase (DB + Auth)
**Orion Link**: Ordem 38 (ou use Cloud grátis)  
**O que é**: PostgreSQL + Auth + Realtime. Backend data.  
**Sinergia**: DB central (leads/conversas/metrics). Webhook UAZAPI → N8N → Supabase RLS (row-level security por tenant).  
**Parametrize Hoje**:
```bash
# Use Supabase Cloud (free-tier):
# https://supabase.com → Criar projeto
# Database: PostgreSQL 15
# Create schema:

CREATE TABLE leads (
  id UUID PRIMARY KEY,
  phone TEXT,
  name TEXT,
  lead_score INT DEFAULT 0,
  sentiment_tag TEXT, -- HOT/WARM/COLD
  stage TEXT, -- new/qualified/won
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE instance_healthscore (
  id UUID PRIMARY KEY,
  instance_key TEXT,
  uptime_percent NUMERIC,
  ban_risk BOOLEAN,
  last_check TIMESTAMP
);

-- RLS: enable para multi-tenant
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

# Config N8N: Supabase HTTP node
# Webhook UAZAPI → N8N → INSERT leads
```
**Ganho**: DB robusto, auth grátis, realtime, RLS multi-tenant, GraphQL.

---

## 📊 Resumo Top 10 Orion (Tabela Parametrização)

| Orion # | Ferramenta | Deploy KVM2 | Config Mínima | Dependência | ETA Setup |
|---------|-----------|-----------|--------------|------------|----------|
| 01 | Traefik/Portainer | `docker-compose -f traefik.yml up` | Route UAZAPI domain | None | 15min |
| 02 | Chatwoot | `docker-compose -f chatwoot.yml up` | Canal UAZAPI webhook | PostgreSQL (included) | 20min |
| 04 | MinIO | `docker-compose -f minio.yml up` | Bucket, access key | None | 10min |
| 05 | Typebot | `docker-compose -f typebot.yml up` | Bot name, trigger webhook | None | 15min |
| 06 | N8N | `docker-compose -f n8n.yml up` | Webhook, HTTP nodes | None | 10min |
| 07 | Flowise | `docker-compose -f flowise.yml up` | Flow JSON, input/output | Ollama (see below) | 20min |
| 15 | Uptime Kuma | `docker-compose -f uptime-kuma.yml up` | Monitor URL, interval | None | 10min |
| 24 | Metabase | `docker-compose -f metabase.yml up` | DB connection (Supabase) | Supabase account | 15min |
| 30 | Ollama | `docker-compose -f ollama.yml up` | Pull mistral model | None (4.4GB) | 20min |
| 46 | TwentyCRM | `docker-compose -f twentycrm.yml up` | Email, workspace | PostgreSQL (included) | 20min |

**Total Setup: ~2h, Zero novo custo, Roda KVM2 2-4GB RAM sem issue.**

---

# BLOCO 5: KVM2 HOSTINGER + ORACLE VPS DEPLOY

## 🏗️ Arquitetura Multi-VPS Recomendada

```
┌───────────────────────────────────────────────────────────┐
│                    CLOUDFLARE CDN                         │
│         (Proxy + Rate Limit + SSL grátis)                 │
└───────────┬────────────────────────────────┬──────────────┘
            │                                │
            ▼                                ▼
┌─────────────────────────────┐  ┌──────────────────────────┐
│   KVM2 Hostinger (Primary)  │  │  Oracle VPS Free Tier 1  │
│   2-4GB RAM, 50GB SSD       │  │  2GB RAM (Evolution/    │
│                             │  │   Chatwoot HA)           │
│ ├─ Traefik/Portainer        │  │                          │
│ ├─ N8N (hub workflows)      │  │ ├─ Evolution API         │
│ ├─ Chatwoot (inbox)         │  │ │  (alternativa UAZAPI)  │
│ ├─ Typebot (bots)           │  │ ├─ Redis sentinel        │
│ ├─ Flowise (IA)             │  │ │  (cache HA)            │
│ ├─ MinIO (storage)          │  └──────────────────────────┘
│ ├─ Metabase (BI)            │
│ ├─ Uptime Kuma (monitor)    │  ┌──────────────────────────┐
│ └─ TwentyCRM (CRM)          │  │  Oracle VPS Free Tier 2  │
│                             │  │  2GB RAM (Backup)       │
│ DB: Supabase Cloud (managed)│  │                          │
└─────────────────────────────┘  │ ├─ N8N standby           │
                                 │ ├─ Failover webhook     │
                                 │ └─ Log aggregation       │
                                 └──────────────────────────┘
```

**Benefícios**:
- ✅ KVM2 = gerenciador central (N8N, Chatwoot, BI)
- ✅ Oracle1 = Evolution fallback (Evolution API alternativa UAZAPI)
- ✅ Oracle2 = Redundância (failover N8N, backup)
- ✅ Supabase = DB gerenciada (zero servidor)
- ✅ Cloudflare = Proxy anti-detecção, rate limit, SSL

---

## 📋 Setup Detalhado: Passo a Passo Deploy KVM2

### Passo 1: SSH KVM2 + Ambiente

```bash
# SSH Hostinger KVM2
ssh root@kvm2-ip-address

# Update sistema
apt update && apt upgrade -y

# Install Docker + Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version  # Docker version X.Y.Z
docker-compose --version  # Docker Compose version X.Y.Z

# Create deploy directory
mkdir -p /opt/ruptur-saas && cd /opt/ruptur-saas

# Clone Orion (ou setup manual)
git clone https://github.com/your-orion-repo . 2>/dev/null || echo "Manual setup below"
```

### Passo 2: Traefik + Portainer (Proxy Reverso)

```bash
# File: /opt/ruptur-saas/traefik-portainer.yml
cat > traefik-portainer.yml <<'EOF'
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    ports:
      - "80:80"
      - "443:443"
    environment:
      - TRAEFIK_API_INSECURE=true
      - TRAEFIK_PROVIDERS_DOCKER=true
      - TRAEFIK_PROVIDERS_DOCKER_EXPOSEDBYDEFAULT=false
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./traefik.yml:/traefik.yml:ro
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik.rule=Host(`traefik.kvm2.local`)"
    networks:
      - ruptur

  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    ports:
      - "9000:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.portainer.rule=Host(`portainer.kvm2.local`)"
      - "traefik.http.services.portainer.loadbalancer.server.port=9000"
    networks:
      - ruptur

volumes:
  portainer_data:

networks:
  ruptur:
    driver: bridge
EOF

docker-compose -f traefik-portainer.yml up -d
echo "Traefik + Portainer running. Access: http://kvm2-ip:9000"
```

### Passo 3: N8N (Automação Hub)

```bash
cat > n8n.yml <<'EOF'
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    environment:
      - N8N_HOST=n8n.kvm2.local
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_TUNNEL_URL=http://n8n.kvm2.local/
      - GENERIC_TIMEZONE=America/Sao_Paulo
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.n8n.rule=Host(`n8n.kvm2.local`)"
      - "traefik.http.services.n8n.loadbalancer.server.port=5678"
    networks:
      - ruptur

volumes:
  n8n_data:

networks:
  ruptur:
    external: true
EOF

docker-compose -f n8n.yml up -d
# Acesso: http://kvm2-ip:5678
# Setup: email + password
```

### Passo 4: Chatwoot (Inbox)

```bash
cat > chatwoot.yml <<'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: chatwoot-postgres
    environment:
      POSTGRES_DB: chatwoot
      POSTGRES_USER: chatwoot
      POSTGRES_PASSWORD: changeme123
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - ruptur

  redis:
    image: redis:7-alpine
    container_name: chatwoot-redis
    volumes:
      - redis_data:/data
    networks:
      - ruptur

  chatwoot:
    image: chatwoot/chatwoot:latest
    container_name: chatwoot
    environment:
      DATABASE_URL: postgresql://chatwoot:changeme123@postgres:5432/chatwoot
      REDIS_URL: redis://redis:6379
      RAILS_ENV: production
      SECRET_KEY_BASE: $(openssl rand -hex 64)
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.chatwoot.rule=Host(`chatwoot.kvm2.local`)"
      - "traefik.http.services.chatwoot.loadbalancer.server.port=3000"
    networks:
      - ruptur

volumes:
  postgres_data:
  redis_data:

networks:
  ruptur:
    external: true
EOF

docker-compose -f chatwoot.yml up -d
# Acesso: http://kvm2-ip:3000
```

### Passo 5: Integrar UAZAPI Webhook com N8N

```bash
# Em N8N (http://kvm2-ip:5678):
# 1. Criar workflow "UAZAPI Incoming Messages"
# 2. Trigger: Webhook (POST)
# 3. Copy webhook URL: http://n8n.kvm2.local/webhook/uazapi-incoming
#
# 4. Config UAZAPI webhook:
#    curl -X POST https://tiatendeai.uazapi.com/webhook/create \
#      -H "Authorization: Bearer c81a5296-36db-4b80-8a47-96539591261b" \
#      -H "Content-Type: application/json" \
#      -d '{
#        "url": "http://n8n.kvm2.local/webhook/uazapi-incoming",
#        "events": ["message.upsert"]
#      }'
#
# 5. N8N nodes:
#    a) Webhook (input) → body.message
#    b) Item Lists (map phone, message, timestamp)
#    c) Supabase (INSERT leads OR UPDATE sentiment)
#    d) HTTP (POST Chatwoot: create/update conversation)
#    e) Redis (HSET cache status)
#
# 6. Save + Activate workflow
```

### Passo 6: Supabase Setup (Cloud)

```bash
# Não precisa de VPS (managed cloud):
# 1. Go to: https://supabase.com
# 2. Sign up (free-tier)
# 3. Create project (PostgreSQL 15)
# 4. Copiar connection string (guardado no .env.local)
#
# SQL Setup (execute no Supabase SQL editor):

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  lead_score INT DEFAULT 0,
  sentiment_tag TEXT, -- HOT/WARM/COLD
  stage TEXT DEFAULT 'new', -- new/qualified/contacted/won/lost
  first_contact_at TIMESTAMP,
  last_contact_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE instance_healthscore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  instance_key TEXT UNIQUE NOT NULL,
  phone TEXT,
  uptime_percent NUMERIC(5, 2) DEFAULT 100,
  total_calls INT DEFAULT 0,
  failed_calls INT DEFAULT 0,
  ban_risk_score INT DEFAULT 0, -- 0-100
  last_check TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- RLS: Enable multi-tenant isolation
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE instance_healthscore ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_tenant_isolation ON leads
  USING (tenant_id = auth.uid());

CREATE POLICY instance_tenant_isolation ON instance_healthscore
  USING (tenant_id = auth.uid());

-- N8N acessa via Connection String (em .env.local):
# DATABASE_URL="postgresql://user:password@db.supabase.co:5432/postgres"
```

### Passo 7: Conectar N8N + Supabase + Chatwoot

```bash
# N8N HTTP Nodes Exemplos:

# Node 1: UAZAPI GET instance status (cron 5min)
{
  "method": "GET",
  "url": "https://tiatendeai.uazapi.com/instance/status",
  "headers": {
    "Authorization": "Bearer c81a5296-36db-4b80-8a47-96539591261b"
  }
}

# Node 2: Supabase INSERT healthscore
{
  "method": "POST",
  "url": "https://YOUR_SUPABASE_URL/rest/v1/instance_healthscore",
  "headers": {
    "apikey": "YOUR_SUPABASE_ANON_KEY",
    "Content-Type": "application/json"
  },
  "body": {
    "tenant_id": "{{ $('Webhook').json.tenant_id }}",
    "instance_key": "{{ $('Webhook').json.instance_key }}",
    "uptime_percent": "{{ $json.status.uptime }}",
    "ban_risk_score": "{{ $json.status.ban_risk_score }}"
  }
}

# Node 3: Chatwoot HTTP POST (create conversation)
{
  "method": "POST",
  "url": "https://chatwoot.kvm2.local/api/v1/conversations",
  "headers": {
    "api_access_token": "CHATWOOT_TOKEN",
    "Content-Type": "application/json"
  },
  "body": {
    "contact_id": "{{ $('Supabase').json.id }}",
    "conversation_type": "incoming",
    "source_id": "uazapi"
  }
}
```

---

## 🚀 Resumo Deploy (Checklist)

- [ ] SSH KVM2 Hostinger + Docker install (10min)
- [ ] Traefik + Portainer run (5min)
- [ ] N8N run (5min)
- [ ] Chatwoot run (10min)
- [ ] Supabase Cloud setup + SQL (15min)
- [ ] UAZAPI webhook → N8N workflow (10min)
- [ ] Teste: enviar mensagem Whats → N8N → Supabase → Chatwoot (5min)
- [ ] Landing Bubble parametrizada (20min)

**Total: ~2h, Zero novo custo, MVP rodando.**

---

# BLOCO 6: MICRO-VITÓRIAS 1-10 (RODAR HOJE)

Cada micro-vitória = feature vendável isolada + etapas claras + landing/Stripe.

## 🎯 MV-1: Teste Envio WhatsApp Grátis (MVP Hoje, 1h)

**O que é**: Landing simple → Form email → envia SMS Whats teste → tracking.

**Arquitetura**:
```
Vercel Landing → Stripe → N8N webhook → UAZAPI send/text → Webhook retorno → Supabase log → Bubble dashboard
```

**Etapas**:

```bash
# 1. Criar landing (Vercel):
cd ~/projects && npx create-next-app landing-whats --typescript
# componentes: Form (email input), Button (Submit), Toast (feedback)

# 2. Deploy Vercel:
cd landing-whats && git add . && git commit -m "landing whats"
# vercel deploy (automático)

# 3. Form action (server-side):
# app/api/send-test-whats/route.ts
export async function POST(req: Request) {
  const { email } = await req.json();
  
  // N8N webhook POST
  const res = await fetch("http://n8n.kvm2.local/webhook/send-test-whats", {
    method: "POST",
    body: JSON.stringify({ email, phone: "+55_from_form" })
  });
  
  return res.json();
}

# 4. N8N workflow "send-test-whats":
# Webhook input → Validate email → UAZAPI POST /send/text
#  → Supabase INSERT test_log (email, phone, status, timestamp)
#  → HTTP POST Stripe (opcional: track conversion)
#  → Response 200

# 5. Landing copy:
# "Envie WhatsApp Grátis - Teste Agora"
# "Sem cartão. Sem compromisso. Validade 1 hora."

# 6. Métricas Bubble:
# Dashboard: "Testes Enviados Hoje" (query Supabase test_log)

echo "MV-1 Done: Landing live, webhook working. Next: Stripe payment."
```

**Venda**: "Teste Envio Gratuito". Meça: % conversão → email → lead Supabase.

---

## 🎯 MV-2: Campanhas WhatsApp (Dia 1, 2h)

**O que é**: Formulário criar campanha → Envio gradual N8N (warmup) → Dashboard tracking.

**Arquitetura**:
```
Bubble form (campanha name + phone list) → N8N cron → UAZAPI send/text + delay
→ Prometheus scrape → Grafana dashboard (% entrega, bounce, ban-risk)
```

**Etapas**:

```bash
# 1. Bubble form "Nova Campanha":
# Fields: name, message_text, phone_list (textarea), send_delay (segundos)
# Button: "Agendar Envio"

# 2. Webhook Bubble → N8N "Create Campaign":
# POST http://n8n.kvm2.local/webhook/create-campaign
# Body: { name, message_text, phone_list: ["+5511999...", ...], delay_seconds }

# 3. N8N workflow "Create Campaign":
# Step 1: Webhook input
# Step 2: Parse phone list (split by \n)
# Step 3: Supabase INSERT campaigns table:
#   id, name, total_phones, message, status='queued', created_at
# Step 4: For each phone:
#   - Calculate next_send_time = now + (index × delay_seconds)
#   - Supabase INSERT campaign_queue (campaign_id, phone, send_at)
# Step 5: Response 200 { campaign_id, queued_count }

# 4. N8N cron workflow "Process Campaign Queue" (every 1min):
# Step 1: Supabase SELECT campaign_queue WHERE send_at <= now AND status='pending'
# Step 2: For each queue_item:
#   a) UAZAPI POST /send/text (phone, message)
#   b) Wait random(500-2000ms) anti-detecção
#   c) Supabase UPDATE campaign_queue SET status='sent', sent_at=now
#   d) On error: UPDATE status='failed', error_msg, retry_count++
# Step 3: Prometheus inc_counter campaigns_sent, campaigns_failed

# 5. Bubble dashboard:
# Repeating Group: campaigns
#   - Name, total, sent, failed, bounce_rate
#   - Graph: sent_per_minute (prevent ban)
#   - Button: "Parar Envio", "Visualizar Logs"

# 6. Grafana dashboard "Campaign Health":
# Metrics:
#   - campaigns_sent (counter, total enviados)
#   - campaigns_failed (failed)
#   - uptime_percent (UAZAPI status)
#   - rate_limit_hits (alertar se >10/min)

echo "MV-2 Done: Campanhas functional. Métrica: $49/mês, 5K contatos/mês."
```

**Venda**: "Envie Campanhas WhatsApp (5K contatos) - R$49/mês". Métrica: CTR, bounce rate.

---

## 🎯 MV-3: Warmup Anti-Ban + Healthscore (Dia 2, 1.5h)

**O que é**: Monitor instância UAZAPI → Prediz ban-risk → Alertas → Dashboard Grafana.

**Arquitetura**:
```
Uptime Kuma (pinga UAZAPI) → Prometheus (scrape) → Grafana (visualiza) + N8N (alertas Slack)
```

**Etapas**:

```bash
# 1. Deploy Uptime Kuma (já feito em Bloco 5):
docker-compose -f uptime-kuma.yml up -d

# 2. Config monitor em Uptime Kuma:
# Name: "UAZAPI Healthscore"
# Type: HTTP GET
# URL: https://tiatendeai.uazapi.com/instance/status
# Headers: Authorization: Bearer c81a5296-36db-4b80-8a47-96539591261b
# Interval: 5 min
# Alert: Slack webhook (if fails)

# 3. Prometheus config (scrape Uptime Kuma API):
# prometheus.yml
cat > prometheus.yml <<'EOF'
global:
  scrape_interval: 5m
  evaluation_interval: 1m

scrape_configs:
  - job_name: 'uptime-kuma'
    static_configs:
      - targets: ['uptimekuma:3001']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

  - job_name: 'n8n'
    static_configs:
      - targets: ['n8n:5678']
EOF

# 4. Grafana dashboard "Healthscore UAZAPI":
# Panel 1: Uptime % (gauge 0-100)
# Panel 2: Response time (ms, line chart)
# Panel 3: Incidents log (table)
# Panel 4: Ban-risk score (predicted via ML)
# Alert: If uptime < 95% for 10min → Slack message

# 5. N8N workflow "Alert Ban Risk" (cron 15min):
# Step 1: Supabase SELECT instance_healthscore ORDER BY ban_risk_score DESC
# Step 2: For each instance with ban_risk_score > 60:
#   - HTTP POST Slack:
#     "⚠️ Ban risk alto: tiatendeai (score: 75%). Interromper envios?"
# Step 3: Response log para Supabase alerts table

# 6. Bubble dashboard "Healthscore":
# Card style: Green (0-50) / Yellow (50-75) / Red (75-100)
# Recomendação: "Pause campaigns if > 75"

echo "MV-3 Done: Healthscore live. Venda: 'Gerenciador Instâncias (Anti-Ban) - R$97/mês'"
```

**Venda**: "Gerenciador Instâncias Anti-Ban (Healthscore Real-time) - R$97/mês".

---

## 🎯 MV-4: Inbox Omnichannel (Dia 2, 2h)

**O que é**: Receba Whats + Insta + Web em inbox único Chatwoot.

**Arquitetura**:
```
UAZAPI webhook → N8N → Chatwoot API (create/update conversation)
+ Instagram proxy (Oracle VPS) → Chatwoot (omnichannel)
```

**Etapas**:

```bash
# 1. Chatwoot já rodando (Bloco 5)

# 2. Add canal UAZAPI em Chatwoot:
# Admin > Channels > Add Channel
# Type: Custom (webhook)
# Name: UAZAPI WhatsApp
# Webhook URL: https://chatwoot.kvm2.local/api/v1/webhooks/incoming

# 3. N8N workflow "UAZAPI → Chatwoot" (webhook trigger):
# Step 1: Webhook input (UAZAPI message)
# Step 2: Extract: phone, message, sender_name, timestamp
# Step 3: Chatwoot API POST /contacts
#   { identifier: phone, name: sender_name, phone_number: phone }
# Step 4: Chatwoot API POST /conversations
#   { contact_id, conversation_type: 'incoming', source_id: 'whatsapp' }
# Step 5: Chatwoot API POST /messages
#   { conversation_id, body: message, message_type: 'incoming' }
# Step 6: Response 200

# 4. Instagram (fallback: manual replies para agora):
# Próximo: Oracle VPS2 rodar proxy Puppeteer Instagram
# Por enquanto: Chatwoot + UAZAPI apenas

# 5. Bubble component "Inbox":
# Iframe: https://chatwoot.kvm2.local/agent (agent dashboard)
# OR embed Chatwoot widget em Bubble página

# 6. Test:
# - Enviar mensagem WhatsApp para tiatendeai
# - Webhook UAZAPI → N8N → Chatwoot
# - Chegar em Chatwoot inbox

echo "MV-4 Done: Inbox live. Venda: 'Inbox Omnichannel (Whats+Insta+Web) - Teste Grátis'"
```

**Venda**: "Inbox Omnichannel Completo - Teste Grátis (depois R$199/mês)".

---

## 🎯 MV-5: Lead Score + Sentiment Real-Time (Dia 3, 2.5h)

**O que é**: Webhook → Análise sentimento (HF) → Lead score automático → Tag lead (HOT/WARM/COLD).

**Arquitetura**:
```
Webhook UAZAPI → N8N → Flowise (sentiment chain)
→ Supabase (UPDATE sentiment_tag, lead_score)
→ Chatwoot tags + Bubble dashboard
```

**Etapas**:

```bash
# 1. Deploy Flowise (já feito em Bloco 4):
docker-compose -f flowise.yml up -d
docker-compose -f ollama.yml up -d
ollama pull mistral  # ou llama2-7b (4GB)

# 2. Criar flow em Flowise "Sentiment Analysis":
# Input: message text
# Node 1: Ollama Chat (prompt: "Analyze sentiment: {message}. Return: HOT/WARM/COLD")
# Output: sentiment_tag

# 3. N8N workflow "Analyze Sentiment" (webhook trigger):
# Step 1: Webhook input (UAZAPI message)
# Step 2: Extract message body
# Step 3: Flowise HTTP POST (call flow)
# {
#   "chatflowid": "YOUR_FLOWISE_FLOWID",
#   "question": message_body
# }
# Step 4: Parse response → sentiment_tag = output
# Step 5: Supabase UPDATE leads
#   - SET sentiment_tag = sentiment_tag
#   - SET lead_score = lead_score + points_by_sentiment (HOT+10, WARM+5, COLD-5)
# Step 6: Chatwoot HTTP POST (add tag)
# {
#   "conversation_id": conversation_id,
#   "tag": sentiment_tag
# }

# 4. Bubble dashboard "Leads por Sentimento":
# Cards: HOT (red), WARM (yellow), COLD (gray) com counts
# Gráfico: sentiment_tag distribution pie chart
# Ação: "Chamar HOT leads agora" button → N8N SMS trigger (próximo)

# 5. Lead Score Formula (Supabase):
# lead_score = (
#   5 × opened_count +
#   3 × replied_count +
#   10 × scheduled_count +
#   20 × paid_count +
#   sentiment_bonus (HOT: +10, WARM: +5, COLD: -5)
# )

echo "MV-5 Done: Sentiment + Score live. Venda: 'Análise Sentimento Real-Time - R$127/mês'"
```

**Venda**: "Lead Score Automático + Sentiment (HOT/WARM/COLD) - R$127/mês".

---

## 🎯 MV-6: Assistente IA 24/7 (Dia 3, 1.5h)

**O que é**: Chatbot IA respostas automáticas Whats (Typebot + Ollama).

**Arquitetura**:
```
Webhook UAZAPI → Typebot fluxo → Ollama (resposta contextual)
→ UAZAPI send/text (resposta automática)
```

**Etapas**:

```bash
# 1. Deploy Typebot (já feito em Bloco 4):
docker-compose -f typebot.yml up -d

# 2. Criar bot em Typebot "Atendimento IA":
# Nó 1: Question "Qual sua dúvida?"
# Nó 2: Condition: 
#   - if contains("preço") → resposta fixa
#   - else → call IA
# Nó 3: Call Flowise IA (contextual answer)
# Nó 4: Save response no Supabase conversations
# Nó 5: Webhook trigger UAZAPI send/text (resposta de volta)

# 3. N8N workflow "Typebot → UAZAPI":
# Step 1: Webhook input (Typebot completion)
# Step 2: Extract phone, response_text
# Step 3: UAZAPI POST /send/text
#   { phone, message: response_text }
# Step 4: Supabase INSERT conversation_log
# Step 5: Chatwoot update conversation (bot response logged)

# 4. Teste manual:
# - Enviar: "Qual é o preço?"
# - Bot responde: "Plano Lite R$47/mês, Profissional R$197/mês..."
# - Enviar: "Como funciona o warmup?"
# - IA responde (contextual): "Warmup é gradual..."

# 5. Bubble dashboard "Bot Analytics":
# Cards: Total intents, solved%, escalated%
# Gráfico: response time (ms)

echo "MV-6 Done: Assistente IA live. Venda: 'Chatbot IA 24/7 - R$197/mês'"
```

**Venda**: "Assistente IA 24/7 (Respostas Automáticas Whats) - R$197/mês".

---

## 🎯 MV-7: CRM + Pipeline + Receita Previsível (Dia 4, 2.5h)

**O que é**: TwentyCRM + Supabase → Aaron Ross framework (previsão receita).

**Arquitetura**:
```
Supabase leads → N8N pipeline automation → TwentyCRM UI
→ Metabase BI (receita previsível)
```

**Etapas**:

```bash
# 1. Deploy TwentyCRM (Bloco 4):
docker-compose -f twentycrm.yml up -d

# 2. Supabase schema "CRM":
CREATE TABLE deals (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  amount NUMERIC(10, 2),
  stage TEXT, -- new/qualified/contacted/negotiating/won/lost
  probability INT, -- 0-100
  closed_at TIMESTAMP,
  created_at TIMESTAMP
);

# 3. TwentyCRM API Integration (N8N):
# Workflow "Auto-advance Pipeline":
# Cron: every 1h
# Step 1: Supabase SELECT deals WHERE stage='new' AND days_old > 7
# Step 2: TwentyCRM API POST /deals/advance_stage
#   new → qualified (if: lead_score > 30)
#   qualified → contacted (if: replied_count > 0)
#   contacted → negotiating (if: scheduled_count > 0)
#   negotiating → won (if: paid_count > 0)
# Step 3: Supabase UPDATE deals SET stage, probability

# 4. Metabase dashboard "Receita Previsível (MRR)":
# Query 1: COUNT leads by stage:
#   new: 50 leads
#   qualified: 20 leads
#   contacted: 10 leads
#   negotiating: 5 leads
#   won: 3 leads
#
# Query 2: SUM revenue where status='won' = R$3000/mês
#
# Query 3: Forecast MRR:
#   = (new: 50 × 20% conv × R$97 avg) +
#     (qualified: 20 × 40% conv × R$197) +
#     (contacted: 10 × 60% conv × R$197) +
#     (negotiating: 5 × 80% conv × R$397) +
#     (won: 3 × 100% = R$1191 já guaranteed)
#   = R$1191 + R$3944 predictable = ~R$5K MRR forecast
#
# Card: "MRR Previsível: R$5.123 (95% confidence)"

# 5. Bubble dashboard "Sales Pipeline":
# Cards: new/qualified/contacted/negotiating/won (counts + $)
# Button: "Lead qualificado? Move para Qualified"
# Metric: "Conversão Geral: 60%"

# 6. Test:
# - N8N roda automation 1x/h
# - Deals avançam automático no TwentyCRM
# - Metabase atualiza receita previsível

echo "MV-7 Done: CRM + Previsão live. Venda: 'CRM WhatsApp Completo (Pipeline+BI) - R$397/mês'"
```

**Venda**: "CRM WhatsApp Completo com Previsão de Receita (Aaron Ross) - R$397/mês".

---

## 🎯 MV-8: Recuperação de Vendas (Win-Back) (Dia 4, 1h)

**O que é**: Disparos automáticos para clientes inativos + link pagamento (Stripe).

**Arquitetura**:
```
Supabase (inativos > 30 dias) → N8N → UAZAPI send/text (+ link Stripe)
→ Webhook pagamento → Supabase UPDATE status='active'
```

**Etapas**:

```bash
# 1. Supabase query "Inativos":
# SELECT * FROM leads
# WHERE status='won' AND last_contact < now - interval '30 days'

# 2. N8N workflow "Win-Back Campaign" (cron weekly):
# Step 1: Supabase SELECT inativos
# Step 2: For each:
#   - Get customer name, product_purchased, days_inactive
#   - UAZAPI send/text:
#     "Oi {name}! Sentindo sua falta. Volte e ganhe 30% desc:
#      https://stripe.com/pay/cupom_volte"
#   - Wait random(1-5s) anti-ban
# Step 3: Supabase INSERT winback_campaign_log (lead_id, sent_at, status)
# Step 4: Webhook Stripe → Supabase UPDATE leads status='active' + date

# 3. Bubble dashboard "Win-Back Metrics":
# Card: "Inativos: 120" + "Enviados esta semana: 45" + "Convertidos: 5 (11%)"

# 4. KPI: 
# - Custo por re-ativação: R$0 (automático)
# - Receita recuperada: 5 × R$97 = R$485

echo "MV-8 Done: Win-Back live. Venda: 'Recuperação Vendas Automática - R$0 (bonus feature)'"
```

**Venda**: "Recuperação de Vendas Automática (Win-Back) - Incluído em CRM".

---

## 🎯 MV-9: SDR Outbound (Prospecção Automática) (Dia 5, 2h)

**O que é**: Importar lista leads → Segmentação → Disparos gradientes → Follow-ups automáticos → Agendamento.

**Arquitetura**:
```
CSV import → Supabase → N8N pipelines (send + wait + follow-up)
→ Typebot agendamento → Cal.com sync
```

**Etapas**:

```bash
# 1. Bubble form "Import Leads SDR":
# Input: CSV file (phone, name, company, linkedin)
# Button: "Importar"
# Action: POST https://vercel.app/api/import-leads (server)

# 2. Vercel API /import-leads:
# Parse CSV → Supabase BULK INSERT leads table (status='prospect')

# 3. N8N workflow "SDR Outbound Pipeline" (cron 1x/day):
# Step 1: Supabase SELECT leads WHERE status='prospect' AND batch=1
# Step 2: Build message (template: name, company)
#   "Oi {name} da {company}, vi seu LinkedIn. Automate WhatsApp com Ruptur?"
# Step 3: UAZAPI send/text
# Step 4: Wait 24h (N8N delay node)
# Step 5: Check response (webhook → replied = true?)
# Step 5a: If NO reply → send follow-up: "Não viu msg anterior?"
# Step 5b: If YES → Typebot agendamento: "Quer demo?"
# Step 6: Cal.com → Sync appointment (se scheduled)
# Step 7: Supabase UPDATE lead status='contacted'|'scheduled'|'lost'

# 4. Bubble dashboard "SDR Metrics":
# Cards: Prospects: 500, Contacted: 150, Replied: 30, Scheduled: 8, Won: 2
# Conversion: 500 → 2 = 0.4%
# Forecast: 100 prospects/week × 0.4% = 2 clientes/week × R$97 = R$194/week

# 5. Test:
# - Import 10 leads test
# - Trigger N8N manualmente
# - Ver messages em Whats + replies em inbox

echo "MV-9 Done: SDR Outbound live. Venda: 'SDR Automático (500 leads/mês) - R$297/mês'"
```

**Venda**: "SDR Automático (Outbound + Follow-up + Agendamento) - R$297/mês".

---

## 🎯 MV-10: Google Sheets Sync + Automação (Dia 5, 1h)

**O que é**: Supabase ↔ Google Sheets (bidirecional). Colabpração time + reports automáticos.

**Arquitetura**:
```
Supabase leads → Google Sheets (sync 1x/hora) ← comentários sheet → back Supabase
Google Drive → Metabase relatórios (export)
```

**Etapas**:

```bash
# 1. Google Cloud Console:
# - Create Project "Ruptur SaaS"
# - Enable Google Sheets API + Drive API
# - Create Service Account key (JSON)
# - Share Google Sheet com service account email

# 2. N8N workflow "Supabase ↔ Google Sheets" (cron 1x/hour):
# Step 1: Supabase SELECT leads (updated_at > last_sync)
# Step 2: Google Sheets API (append rows)
# Step 3: Google Sheets query (if new comments in column "Notes")
# Step 4: Supabase UPDATE leads notes field
# Step 5: Save timestamp

# 3. Bubble embed Google Sheet:
# <iframe src="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"></iframe>

# 4. Automação Marketing:
# Google Sheets → Google Ads (Campaign Manager API)
# Leads won → Ads remarketing (lookalike audience)
# Lead score → Segmentação público > mais $ para hot leads

# 5. Team collaboration:
# Sales team: edita sheet colaboratively
# Sync automático volta para Supabase CRM
# Notificação Slack: "@sales Update leads no sheet!"

echo "MV-10 Done: Sheets sync live. Venda: 'Integração Google Sheets (Reports) - Incluído'"
```

**Venda**: "Integração Google Sheets (Colaboração Time + Reports) - Incluída em CRM".

---

## 📊 Resumo Micro-Vitórias (Roadmap 5 Dias)

| MV # | Nome | ETA | Preço MVP | Métrica Chave | Conexão Stack |
|------|------|-----|-----------|--------------|--------------|
| 1 | Teste Envio Grátis | Hoje 1h | Free (lead magnet) | % conversão email → teste | Vercel + N8N + UAZAPI |
| 2 | Campanhas WhatsApp | Dia 1 2h | R$49/5K | CTR, bounce rate | N8N + UAZAPI + Prometheus |
| 3 | Healthscore Anti-Ban | Dia 2 1.5h | R$97 | % uptime, ban-risk score | Uptime Kuma + Grafana |
| 4 | Inbox Omnichannel | Dia 2 2h | Teste grátis | % resposta, SLA atendimento | Chatwoot + UAZAPI + N8N |
| 5 | Sentiment + Lead Score | Dia 3 2.5h | R$127 | Lead score accuracy | Flowise + HF + Ollama |
| 6 | Assistente IA 24/7 | Dia 3 1.5h | R$197 | % respostas automáticas | Typebot + Ollama + N8N |
| 7 | CRM + Receita Previsível | Dia 4 2.5h | R$397 | MRR forecast accuracy | TwentyCRM + Metabase + Aaron Ross |
| 8 | Win-Back Automático | Dia 4 1h | Incluído | % reativação | N8N + Stripe |
| 9 | SDR Outbound | Dia 5 2h | R$297 | Lead acquisition cost | N8N + Supabase + Cal.com |
| 10 | Sheets Sync | Dia 5 1h | Incluído | % sync accuracy, collab. | Google Sheets API + N8N |

**Total MVP Stack**: ~15-20h setup, rodando em 5 dias, zero novo custo.

---

# BLOCO 7: ROADMAP SaaS FULL (2-4 SEMANAS)

Após MV-1 a MV-10, iterar + escalar.

## 🎯 Week 2: Polir MVs + Metricas

- [ ] GA4 (Google Analytics) integrado landing
- [ ] Heatmaps (Hotjar free) inbox Chatwoot
- [ ] Email marketing (Mautic Orion 17) + Campaigns
- [ ] SMS (Twilio ou Brasil SIM) complemento Whats
- [ ] Testes A/B landing (variants Vercel)
- [ ] Unit tests N8N workflows (test nodes)

## 🎯 Week 3: Omnichannel Full + IA Avançada

- [ ] Instagram DM (proxy Evolution Orion 03)
- [ ] Facebook Messenger (Meta API direct)
- [ ] Telegram (Telethon API)
- [ ] Fine-tune LLM (Ollama com dataset customer)
- [ ] RAG (Retrieval Augmented Gen) com base conhecimento Chatwoot
- [ ] Langfuse monitoring (Orion 23) custo IA

## 🎯 Week 4: Escala + Compliance + Enterprise

- [ ] Multi-tenant isolamento RLS Supabase
- [ ] GDPR compliance (data deletion, consent logs)
- [ ] LGPD (Brasil Lei proteção dados)
- [ ] Audit logging (quem mudou o quê, quando)
- [ ] SSO (SAML/OAuth) para clientes enterprise
- [ ] API docs (OpenAPI/Swagger)
- [ ] Webhooks outgoing (client pode integrar)

## 🎯 Month 2: Features Diferenciadoras

- [ ] Predictive Churn (ML model: who will cancel)
- [ ] Lead Scoring ML (custom model por tenant)
- [ ] Sentiment Forecasting (predict upset customers)
- [ ] Influencer Detection (identificar leads VIP)
- [ ] Competitor Monitoring (track competitor mentions)
- [ ] Keyword Triggers (alerta se customer menciona feature XYZ)

---

# APÊNDICE A: TABELAS TÉCNICAS

## 🔌 Endpoints UAZAPI (Top 30 Usados)

| # | Endpoint | Método | Descrição | Auth |
|---|----------|--------|-----------|------|
| 1 | /send/text | POST | Enviar texto | Token |
| 2 | /send/media | POST | Enviar imagem/vídeo/áudio | Token |
| 3 | /send/menu | POST | Enviar botões/carousel/lista | Token |
| 4 | /webhook/create | POST | Config webhook recebimento | Token |
| 5 | /instance/status | GET | Status instância (conectado?) | Token |
| 6 | /instance/list | GET | Listar instâncias | AdminToken |
| 7 | /instance/create | POST | Nova instância | AdminToken |
| 8 | /instance/details | GET | QR code + pair code | AdminToken |
| 9 | /chat/search | GET | Pesquisar conversa | Token |
| 10 | /chat/label | POST | Adicionar label | Token |
| 11 | /group/create | POST | Criar grupo | Token |
| 12 | /group/add_members | POST | Adicionar membros | Token |
| 13 | /contact/list | GET | Listar contatos | Token |
| 14 | /message/search | GET | Pesquisar mensagem | Token |
| 15 | /message/delete_for_everyone | DELETE | Deletar msg | Token |
| 16 | /check_number_on_whatsapp | GET | Validar número | Token |
| 17 | /chatbot/create_trigger | POST | IA trigger | AdminToken |
| 18 | /presence | POST | Online/offline status | Token |
| ... | ... | ... | ... | ... |

---

## 🗄️ Supabase Schema (MVP)

```sql
-- Tabelas Core

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL,
  plan TEXT DEFAULT 'lite', -- lite/pro/enterprise
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  lead_score INT DEFAULT 0,
  sentiment_tag TEXT, -- HOT/WARM/COLD
  stage TEXT DEFAULT 'new', -- new/qualified/contacted/won/lost
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(tenant_id, phone) -- Uma lead por tenant + phone
);

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  total_phones INT,
  message_text TEXT,
  status TEXT DEFAULT 'queued', -- queued/sending/completed
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE campaign_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  phone TEXT NOT NULL,
  send_at TIMESTAMP,
  status TEXT DEFAULT 'pending', -- pending/sent/failed
  error_msg TEXT,
  sent_at TIMESTAMP
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  channel TEXT, -- whatsapp/instagram/email
  status TEXT DEFAULT 'open', -- open/closed
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  sender TEXT, -- 'user' or 'bot'
  body TEXT,
  media_type TEXT, -- text/image/video/etc
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE instance_healthscore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  instance_key TEXT UNIQUE NOT NULL,
  uptime_percent NUMERIC(5, 2) DEFAULT 100,
  ban_risk_score INT DEFAULT 0,
  last_check TIMESTAMP DEFAULT now()
);

-- RLS Policies

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_tenant_isolation ON leads
  USING (tenant_id = auth.uid());

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_tenant_isolation ON conversations
  USING (tenant_id = auth.uid());

-- Indexes

CREATE INDEX idx_leads_tenant_phone ON leads(tenant_id, phone);
CREATE INDEX idx_leads_stage ON leads(stage);
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
```

---

## 🔄 N8N Workflow Template (Example: UAZAPI → Sentiment → Lead Score)

```json
{
  "name": "UAZAPI Sentiment Analysis Pipeline",
  "nodes": [
    {
      "parameters": {
        "path": "/webhook/uazapi-incoming",
        "responseMode": "onReceived"
      },
      "name": "Webhook UAZAPI",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "{{ $env.FLOWISE_BASE_URL }}/api/prediction/{{ $env.FLOWISE_SENTIMENT_FLOW_ID }}",
        "method": "POST",
        "options": {},
        "sendBody": true,
        "bodyParameters": {
          "parameters": {
            "question": "={{ $json.body }}"
          }
        }
      },
      "name": "Flowise Sentiment",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [550, 300]
    },
    {
      "parameters": {
        "host": "{{ $env.SUPABASE_HOST }}",
        "database": "{{ $env.SUPABASE_DB }}",
        "user": "{{ $env.SUPABASE_USER }}",
        "password": "{{ $env.SUPABASE_PASSWORD }}",
        "ssl": false,
        "executeQuery": true,
        "query": "UPDATE leads SET sentiment_tag = '{{ $json.output }}', updated_at = now() WHERE phone = '{{ $json.phone }}'"
      },
      "name": "Supabase Update",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 1,
      "position": [850, 300]
    }
  ],
  "connections": {
    "Webhook UAZAPI": {
      "main": [
        [
          {
            "node": "Flowise Sentiment",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Flowise Sentiment": {
      "main": [
        [
          {
            "node": "Supabase Update",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## 📊 Pricing Ladder Recomendado

```
┌─────────────────────────────────────────────────────────────┐
│                     RUPTUR SaaS - Pricing                   │
└─────────────────────────────────────────────────────────────┘

Plano LITE (R$47/mês)
├─ Envio 5K mensagens/mês
├─ 1 usuário
├─ Inbox básico (Whats)
├─ Sem warmup, sem CRM, sem IA
└─ Ideal: freelancer/startup teste

Plano PROFISSIONAL (R$197/mês)
├─ Envio 50K mensagens/mês
├─ 3 usuários
├─ Inbox omnichannel (Whats+Insta)
├─ Assistente IA 24/7
├─ Lead Score básico
├─ Warm up automático
└─ Ideal: agência pequena, SaaS B2B

Plano ENTERPRISE (R$597/mês)
├─ Envio ilimitado
├─ 10+ usuários
├─ CRM completo (pipeline, receita previsível)
├─ Análise sentimento avançada
├─ Integrações custom (Salesforce, HubSpot, etc)
├─ Support prioritário
├─ SLA 99.5%
└─ Ideal: agência med./large, varejista multi-canal

Plano CUSTOM (Contato)
├─ Instâncias WhatsApp próprias
├─ Integrações bespoke (Oracle, SAP, etc)
├─ Deployment selfhosted
├─ Equipe dedicada
└─ Ideal: Unicorn, CX enterprise grade
```

---

# APÊNDICE B: CHECKLIST PRÉ-PRODUÇÃO

## ✅ Antes de Lançar Landing

- [ ] Domain registrado (ex: ruptur.cloud) → Cloudflare
- [ ] SSL certificate automático (Cloudflare free)
- [ ] Landing Vercel deploy com GA4 tracking
- [ ] Stripe conta criada + webhook configurado
- [ ] Email confirmação automático (Supabase email service)
- [ ] Telegram/Slack notifications para novos clientes
- [ ] Términos de serviço + LGPD aviso
- [ ] Privacy policy + GDPR cookies

## ✅ Antes de Primeiro Cliente Pagar

- [ ] UAZAPI token válido + não expirado
- [ ] KVM2 Hostinger + Oracle VPS ssh acesso testado
- [ ] N8N workflows automatizados (não manual)
- [ ] Supabase backup automático habilitado
- [ ] Chatwoot instâncias isoladas por tenant (RLS)
- [ ] Webhook UAZAPI → N8N → Chatwoot teste E2E
- [ ] Grafana dashboard visualizando métricas reais
- [ ] Monit alert Slack se instância cair

## ✅ Antes de Escalar (10+ clientes)

- [ ] Redundância N8N (standby Oracle2)
- [ ] Load balancing Traefik (múltiplos containers)
- [ ] Database backup 2x/dia (Supabase automated)
- [ ] Audit logs (quem fez o quê)
- [ ] Rate limiting anti-DDoS (Cloudflare)
- [ ] Testes de carga K6 (100 concurrent users)
- [ ] Runbook troubleshooting (SOP)
- [ ] On-call rotation (se equipe > 1 pessoa)

## ✅ Antes de Enterprise

- [ ] Multi-tenancy RLS 100% isolado (pen test)
- [ ] SSO (Okta, Azure AD compatível)
- [ ] API documentação OpenAPI/Swagger
- [ ] SLA contrato legal (99.5% uptime)
- [ ] Compliance: SOC2, ISO 27001 roadmap
- [ ] Data residency (BR? EU?)
- [ ] Vendor risk assessment (UAZAPI, Supabase, etc)

---

## 🎯 CONCLUSÃO

**Diego (@thearch@ruptur.cloud), você tem tudo para escalar de MVP → SaaS competitivo em 5 dias:**

1. **Base**: UAZAPI tiatendeai ✅ + Bubble front ✅ + Whats Business não-oficial ✅
2. **Stack**: KVM2 + Oracle VPS x2 free ✅ + Supabase Cloud free ✅ + Cloudflare free ✅
3. **Backend**: N8N (automação) + Chatwoot (inbox) + TwentyCRM (CRM) + Typebot (bots) + Flowise (IA local)
4. **Métricas**: Grafana + Prometheus (healthscore) + Metabase (receita previsível)
5. **Roadmap**: 10 micro-vitórias (5 dias) + Week 2-4 escalabilidade full

**Próximo passo**: Começar MV-1 (landing teste) hoje. Conectar UAZAPI webhook → N8N. Rodar N8N + Chatwoot em KVM2 Hostinger amanhã. Lançar landing public no Vercel. Começar vender.

Sem reinventar roda. Sem novo custo. Tudo parametrizado e rodando.

Quer que comece qual MV primeiro, ou tem dúvida em alguma integração específica?

---

**📖 FIM BÍBLIA COMPLETA (RUPTUR SaaS)**  
**Última atualização**: 2026-05-07  
**Status**: Pronto para implementação  
**Estimativa**: 5 dias até MVP + landing live
