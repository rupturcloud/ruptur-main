# 🚀 Deployment Instructions — Phase 1 + Phase 2 Início

**Data**: 2026-05-08  
**Status**: ✅ Build + Push Completo  
**Commit**: e9c26cd (feat: implementar Phase 1 + iniciar Phase 2)  
**Image**: us.gcr.io/ruptur-jarvis-v1-68358/ruptur-saas:latest  
**Digest**: sha256:a2fa00c768183ca64f1b87b429ac749920a32b2b60a3b54978f2a41eb125a739  

---

## 📋 Pré-requisitos

- SSH access to VPS: `ssh root@ruptur.cloud`
- Docker + Docker Compose instalados
- GCP credentials configuradas (para pull da imagem privada)

---

## 🔧 Deployment na VPS (Manual Steps)

```bash
# 1. SSH na VPS
ssh root@ruptur.cloud

# 2. Navegar para diretório de deploy
cd /opt/ruptur/saas

# 3. Fazer pull da nova imagem
docker-compose pull

# 4. Fazer deploy (restart dos containers)
docker-compose up -d

# 5. Verificar logs
docker-compose logs -f saas-web

# Esperado após ~10 segundos:
# [saas-web] API Gateway listening on http://0.0.0.0:3001
```

---

## ✅ Health Check (Imediato após deploy)

```bash
# Via SSH na VPS
curl -s http://localhost:3001/api/health | jq .

# Esperado:
# {
#   "ok": true,
#   "service": "ruptur-saas-gateway",
#   "supabase": true,
#   "billing": false,
#   "rateLimitClients": 0
# }
```

---

## 🧪 Smoke Tests (Validar Instâncias)

### 1. Setup: Obter JWT Token

```bash
# Via navegador ou API
# Login em https://saas.ruptur.cloud
# Abrir DevTools → Application → Cookies
# Copiar o valor do cookie "sb-access-token"

export JWT_TOKEN="seu-token-aqui"
export API_URL="https://saas.ruptur.cloud/api"
# ou localmente:
# export API_URL="http://localhost:3001/api"
```

### 2. GET /api/instances (Listar)

```bash
curl -X GET "$API_URL/instances" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"

# Esperado: 200 OK
# { "instances": [], "total": 0 }
# ou
# { "instances": [{...}, {...}], "total": 2 }
```

### 3. POST /api/instances (Criar)

```bash
curl -X POST "$API_URL/instances" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste Phase 1",
    "systemName": "ruptur-dashboard"
  }'

# Esperado: 201 Created
# {
#   "instance": {
#     "id": "uuid",
#     "name": "Teste Phase 1",
#     "status": "connecting",
#     "token": "instance-token-xyz"
#   },
#   ...
# }
```

### 4. POST /api/instances/{key}/connect (Obter QR Code)

```bash
# Substituir {instance_key} pelo "token" retornado no passo 3
export INSTANCE_KEY="instance-token-xyz"

curl -X POST "$API_URL/instances/$INSTANCE_KEY/connect" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Esperado: 200 OK
# {
#   "qrcode": "data:image/png;base64,iVBORw0KGgo...",
#   "status": "connecting",
#   "instance": {
#     "name": "Teste Phase 1",
#     "id": "uuid"
#   }
# }
```

### 5. GET /api/instances/{key}/status (Verificar Status)

```bash
curl -X GET "$API_URL/instances/$INSTANCE_KEY/status" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"

# Esperado: 200 OK
# {
#   "status": "connecting",  # ou "connected" se já pareado
#   "connected": false,
#   "phone": "+55 11 9999-9999",
#   "profileName": "Suporte",
#   "qrcode": "data:image/png;base64,..."
# }
```

---

## 🌐 UI Validation (Navegador)

1. **Navegar para Instâncias**:
   - Acesse https://saas.ruptur.cloud
   - Faça login
   - Clique em "Dashboard" → "Instâncias"

2. **Criar Instância via UI**:
   - Clique em "Criar e conectar"
   - Preencha: Nome = "Teste UI Phase 1"
   - Clique em "Criar instância"
   - **Esperado**: QR code aparece em modal (Phase 2)

3. **QR Scanner (Phase 2)**:
   - Se câmera está disponível: scanner aparece
   - Se câmera não disponível: input manual de código
   - **Esperado**: Botão "Conectar" funciona

4. **Status Real-time**:
   - Escanear QR code no WhatsApp
   - Verificar status em tempo real (se Supabase Realtime está ativo)

---

## 📊 O Que Mudou

### Backend (Phase 1)
✅ 6 endpoints de instâncias implementados  
✅ Tenant isolation em todas as queries  
✅ Integração com UazAPI  
✅ Audit logging  

### Frontend (Phase 2 início)
✅ QRScanner.jsx component criado  
✅ html5-qrcode instalado  
✅ Instances.jsx atualizado para usar nova UI  

### Segurança
✅ JWT authentication obrigatório  
✅ CORS whitelist ativo  
✅ Rate limiting (120 req/min por IP)  
✅ Tenant isolation validado  

---

## 🔍 Troubleshooting

### Erro: 404 Not Found em /api/instances

**Causa**: Imagem antiga ainda rodando

**Solução**:
```bash
docker-compose down
docker-compose pull
docker-compose up -d
docker-compose logs saas-web
```

### Erro: 401 Unauthorized

**Causa**: JWT token inválido ou expirado

**Solução**: Fazer login novamente para obter novo token

### Erro: 403 Forbidden

**Causa**: Usuário não tem permissão no tenant

**Solução**: Verificar que usuário está logado e membro do tenant

### QR Code não aparece

**Causa**: UazAPI não está respondendo

**Solução**: Verificar se provider account está ativo em Supabase

---

## 📈 Métricas Esperadas Pós-Deploy

- **Build size**: 1.5GB (JS bundle 427KB gzipped)
- **Container startup**: ~5-10 segundos
- **API response time**: <100ms para GET, <500ms para POST
- **Memory**: ~200-300MB durante operação normal

---

## ✨ Next Steps (Após Validação)

### Phase 2 Completo (1 dia):
- [ ] Testar QR Scanner com câmera real
- [ ] Validar múltiplas câmeras em dispositivo
- [ ] Testar fallback para input manual

### Phase 3 (1-2 dias):
- [ ] Implementar Supabase Realtime listeners
- [ ] Auto-retry com exponential backoff
- [ ] Toast notifications

### Phase 4 (2-3 dias, opcional):
- [ ] Exportar instância para JSON/QR
- [ ] Histórico de tentativas
- [ ] Webhooks de status

---

## 📞 Support

Se houver dúvidas ou problemas:
1. Verificar logs: `docker-compose logs saas-web`
2. Testar health check: `curl http://localhost:3001/api/health`
3. Validar JWT token: Verificar se está expirado ou inválido
4. Verificar GCP credentials: `gcloud auth list`

---

**Deploy Status**: 🟡 Aguardando SSH e docker-compose up  
**Validação**: 🔴 Não iniciada  
**Production Ready**: 🟡 Após validação de smoke tests  
