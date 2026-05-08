# 🚀 Deployment via GCP Cloud Console SSH

**Como fazer deploy sem SSH local**

---

## Opção 1: GCP Cloud Console (Mais Fácil)

### Passo 1: Abrir GCP Console

1. Acesse: https://console.cloud.google.com
2. Navegue para "Compute Engine" → "Instâncias de VM"
3. Localize a instância: **ruptur-saas** (ou a que estiver rodando em 34.176.34.240)
4. Clique no botão **"SSH"** (vai abrir um terminal no navegador)

### Passo 2: Copiar e Executar Script

Dentro do terminal SSH do GCP Console:

```bash
# 1. Navegar para diretório
cd /opt/ruptur/saas

# 2. Fazer pull da nova imagem
docker-compose pull

# 3. Parar containers antigos
docker-compose down

# 4. Iniciar containers novos
docker-compose up -d

# 5. Aguardar estabilização
sleep 5

# 6. Verificar logs
docker-compose logs saas-web | tail -30

# 7. Health check
curl http://localhost:3001/api/health | jq .
```

### Passo 3: Validar Deployment

```bash
# Verificar status dos containers
docker-compose ps

# Esperado: Todos os containers em "Up"
# saas-web        | Running | 3001->3001
# warmup-runtime  | Running | 8787->8787
```

---

## Opção 2: gcloud SSH (Via Terminal Local)

Se tiver gcloud CLI instalado:

```bash
# Conectar via gcloud
gcloud compute ssh ruptur-saas --project=ruptur-jarvis-v1-68358 --zone=southamerica-east1-a

# Dentro da VPS, executar:
cd /opt/ruptur/saas && docker-compose pull && docker-compose down && docker-compose up -d && sleep 5 && docker-compose logs saas-web
```

---

## Opção 3: Enviar Script e Executar

Se quiser usar o script criado:

```bash
# De local (seu computador), enviar script:
gcloud compute scp deploy-script.sh ruptur-saas:/opt/ruptur/saas/deploy-script.sh \
  --project=ruptur-jarvis-v1-68358 \
  --zone=southamerica-east1-a

# Depois conectar e executar:
gcloud compute ssh ruptur-saas --project=ruptur-jarvis-v1-68358 --zone=southamerica-east1-a

# Dentro da VPS:
cd /opt/ruptur/saas
chmod +x deploy-script.sh
./deploy-script.sh
```

---

## ✅ Checklist Pós-Deploy

- [ ] Todos os containers em "Up" (docker-compose ps)
- [ ] Health check retorna `"ok": true`
- [ ] Logs não mostram erros críticos
- [ ] Acessar https://saas.ruptur.cloud — deve carregar
- [ ] Testar `/api/health` — deve retornar 200
- [ ] Testar `/api/instances` (com JWT) — deve retornar lista (ou vazio)

---

## 🧪 Quick Smoke Tests (Após Deploy)

### 1. Health Check

```bash
curl http://localhost:3001/api/health | jq .
# Esperado:
# {
#   "ok": true,
#   "service": "ruptur-saas-gateway",
#   "supabase": true
# }
```

### 2. GET /api/instances (Sem Auth — deve dar 401)

```bash
curl http://localhost:3001/api/instances
# Esperado: 401 Não autenticado
```

### 3. Verificar Portas

```bash
# Verificar se porta 3001 está aberta
netstat -tlnp | grep 3001
# ou
ss -tlnp | grep 3001

# Esperado: LISTEN 0.0.0.0:3001
```

### 4. Verificar Variáveis de Ambiente

```bash
docker-compose exec saas-web printenv | grep -E "SUPABASE|VITE|PORT"
# Verificar se SUPABASE_URL e chaves estão setadas
```

---

## 🔧 Se Algo Der Errado

### Erro: "docker: command not found"

```bash
docker --version
# Se não funcionar, docker pode não estar instalado
# Ou você não está no usuário correto (precisa ser root ou estar em docker group)
```

### Erro: "Permission denied"

```bash
# Adicionar usuário ao grupo docker (se necessário)
sudo usermod -aG docker $USER
# Ou executar com sudo
sudo docker-compose ps
```

### Erro: "image pull rate limit"

```bash
# Esperar 30 minutos e tentar novamente
# Ou usar uma chave de login do Docker para aumentar limit
docker login
# Depois tentar pull novamente
```

### Container não inicia

```bash
# Ver logs completos
docker-compose logs -f saas-web

# Se mostrar erro de conexão com Supabase:
# - Verificar SUPABASE_URL em docker-compose.yml ou .env
# - Verificar SUPABASE_SERVICE_ROLE_KEY está setado

# Se mostrar erro de porta:
# - Verificar se porta 3001 já está em uso
lsof -i :3001
# Se estiver, matar o processo:
kill -9 <PID>
```

---

## 📞 Suporte

Se tiver dúvidas ou problemas:

1. Verificar logs: `docker-compose logs saas-web`
2. Testar health: `curl http://localhost:3001/api/health`
3. Verificar imagem: `docker images | grep ruptur-saas`
4. Verificar docker-compose.yml está atualizado

---

## 📋 Resumo Rápido (5 minutos)

```bash
cd /opt/ruptur/saas
docker-compose pull
docker-compose down
docker-compose up -d
sleep 5
curl http://localhost:3001/api/health
```

Se tudo retornar `"ok": true`, deployment foi bem-sucedido! 🚀
