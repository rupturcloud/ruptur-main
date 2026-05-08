# Deployment Checklist — Phase 2

**Executar após**: Todos os 23 testes iniciais + 19 regressão + 18 performance passarem  
**Duração**: 5 minutos  
**Responsável**: Arquiteto/DevOps

---

## Pré-Deploy Validações

### ✅ Code & Git

- [ ] Master branch limpo (nenhuma mudança uncommitted)
  ```bash
  git status
  # Deve retornar: "On branch master, working tree clean"
  ```

- [ ] Todos os 5 commits de Phase 2 estão em master
  ```bash
  git log --oneline -5
  # d5a083a fix: use service role key for tenant auto-provisioning
  # 8912a56 fix: adicionar transporte WebSocket para Supabase realtime
  # f30a2ea feat: módulo de configuração de tenants em admin
  # 8a880af feat: RLS policies para auto-provisioning de tenants
  # c374973 fix: auto-provisioning de tenants para novos usuários
  ```

- [ ] Nenhuma merge conflict pendente
  ```bash
  git merge --no-commit --no-ff origin/master
  git merge --abort
  ```

### ✅ Environment & Configuration

- [ ] `.env` em `/opt/ruptur/saas/` tem todas as variáveis críticas
  ```bash
  ssh deploy@vps.ruptur.cloud 'grep -E "SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_URL" /opt/ruptur/saas/.env'
  # Deve retornar ambas as variáveis (sem exibir valores)
  ```

- [ ] SUPABASE_SERVICE_ROLE_KEY não está expirado
  ```bash
  # No Supabase Dashboard → Settings → API Keys
  # Verificar que Service Role Secret não está marcado como "Revoked"
  ```

- [ ] NODE_ENV em produção = 'production'
  ```bash
  ssh deploy@vps.ruptur.cloud 'grep NODE_ENV /opt/ruptur/saas/.env'
  # NODE_ENV=production
  ```

### ✅ Database & Schema

- [ ] Tabelas críticas existem e têm dados
  ```sql
  -- Executar no Supabase SQL Editor:
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('users', 'tenants', 'user_tenant_roles', 'user_tenant_memberships', 'audit_logs');
  -- Deve retornar 5 registros
  ```

- [ ] Índices estão criados (performance)
  ```sql
  -- Verificar índices em tabelas críticas:
  SELECT indexname FROM pg_indexes 
  WHERE tablename IN ('user_tenant_roles', 'tenants', 'audit_logs')
  AND indexname LIKE '%user_id%' OR indexname LIKE '%tenant_id%';
  -- Deve retornar pelo menos 3 índices
  ```

- [ ] RLS policies estão habilitadas e configuradas
  ```sql
  SELECT * FROM pg_policies 
  WHERE tablename = 'tenants'
  AND policyname LIKE '%auto_provision%' OR policyname LIKE '%owner%';
  -- Deve retornar políticas de RLS
  ```

- [ ] Nenhuma migração pendente
  ```bash
  npm run migrations:status
  # Todos os migrations devem estar "APPLIED"
  ```

### ✅ Build & Deployment

- [ ] Build local passou em todos os checks
  ```bash
  npm run lint
  npm run build
  npm test -- --runInBand 2>&1 | tail -20
  # Todos devem retornar status 0 (sucesso)
  ```

- [ ] Docker image foi buildado sem erros
  ```bash
  docker build -t ruptur-saas:phase2 .
  docker run --rm -it ruptur-saas:phase2 npm run build
  # Deve completar sem erros
  ```

- [ ] Arquivo rsync preparado (se usando rsync)
  ```bash
  ls -lh /opt/ruptur/saas-new/
  # Deve conter: node_modules/, api/, modules/, public/, package.json, etc
  ```

### ✅ Supabase & Backend

- [ ] Supabase CLI autenticado
  ```bash
  supabase status
  # Deve retornar: "Linked project: ruptur (prod)"
  ```

- [ ] Health check respondendo na VPS
  ```bash
  ssh deploy@vps.ruptur.cloud 'curl -s http://localhost:3000/api/local/health | jq'
  # {
  #   "ok": true,
  #   "service": "ruptur-saas-gateway",
  #   "supabase": true,
  #   "billingConfigured": true
  # }
  ```

- [ ] Nenhum alerta em Sentry/monitoring
  ```bash
  # Verificar painel de monitoring
  # Deve estar verde (nenhum erro recente)
  ```

---

## Deployment Steps

### Fase 1: Backup (2 minutos)

```bash
# 1. Fazer snapshot do estado atual
ssh deploy@vps.ruptur.cloud 'cd /opt/ruptur && tar -czf saas-backup-$(date +%s).tar.gz saas/'

# 2. Exportar dados críticos (opcional)
ssh deploy@vps.ruptur.cloud 'pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > /tmp/backup-$(date +%s).sql'

# ✅ Confirmar que backup foi criado
ssh deploy@vps.ruptur.cloud 'ls -lh /opt/ruptur/saas-backup*.tar.gz | head -1'
```

### Fase 2: Transfer Files (3 minutos)

```bash
# Via rsync (mais eficiente)
rsync -avz --delete \
  /path/to/local/saas-new/ \
  deploy@vps.ruptur.cloud:/opt/ruptur/saas-new/

# OU via SCP (se rsync não disponível)
scp -r /path/to/local/saas-new/* deploy@vps.ruptur.cloud:/opt/ruptur/saas-new/

# ✅ Validar que arquivos foram transferidos
ssh deploy@vps.ruptur.cloud 'ls -la /opt/ruptur/saas-new/ | head -10'
```

### Fase 3: Build & Test (5 minutos)

```bash
# Conectar à VPS
ssh deploy@vps.ruptur.cloud

# Build image Docker
cd /opt/ruptur/saas-new
docker build -t ruptur-saas:phase2 .

# ✅ Verificar que build passou
docker images | grep ruptur-saas:phase2

# Test image (rodar em background, não iniciar full service ainda)
docker run --rm -it \
  -e VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  -e SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
  ruptur-saas:phase2 \
  npm run build

# ✅ Verificar que build passou dentro do container
```

### Fase 4: Stop Old Containers (2 minutos)

```bash
# Dentro da VPS
cd /opt/ruptur/saas

# Parar containers antigos
docker compose down

# ✅ Verificar que não há containers rodando
docker ps | grep ruptur
# (deve estar vazio)
```

### Fase 5: Swap & Start New Version (2 minutos)

```bash
# Dentro da VPS
cd /opt/ruptur

# Backup do diretório antigo (como referência)
mv saas saas-old-$(date +%s)

# Rename novo para saas
mv saas-new saas

# ✅ Verificar estrutura
ls -la saas/ | head -10

# Iniciar containers novos
cd saas
docker compose up -d

# ✅ Verificar que containers estão rodando
docker ps | grep ruptur
# Deve mostrar 2+ containers (web, db, redis, etc)
```

### Fase 6: Health Checks Pós-Deploy (2 minutos)

```bash
# Esperar 10 segundos para containers inicializarem
sleep 10

# 1. Verificar que containers estão healthy
docker ps --format "table {{.Names}}\t{{.Status}}" | grep ruptur

# 2. Fazer health check
curl -s http://localhost:3000/api/local/health | jq

# ✅ Resposta esperada:
# {
#   "ok": true,
#   "service": "ruptur-saas-gateway",
#   "supabase": true,
#   "billingConfigured": true,
#   "ts": "2026-05-08T..."
# }

# 3. Fazer login test (criar novo usuário)
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "deploy-test-'$(date +%s)'@test.com",
    "password": "TestPass123!@#"
  }' | jq

# ✅ Resposta deve ser 200-201 com session token

# 4. Fazer warmup/config test
curl -X GET http://localhost:3000/api/warmup/config \
  -H "Authorization: Bearer ${TOKEN_FROM_STEP_3}" | jq

# ✅ Resposta deve ser 200 com tenantId
```

### Fase 7: Monitoring (5 minutos)

```bash
# Após deploy, monitorar por 5 minutos
# Checklist:

- [ ] Nenhum erro 5xx nos logs
  ```bash
  docker logs -f ruptur-saas | grep -i error
  # (Ctrl+C após 30 segundos — deve estar vazio ou com erros leves apenas)
  ```

- [ ] Nenhum alerta em monitoring (Sentry, etc)
  ```bash
  # Verificar dashboard de monitoring
  # Deve estar verde
  ```

- [ ] Performance está normal
  ```bash
  # Fazer algumas requisições de teste
  for i in {1..5}; do
    time curl -s http://localhost:3000/api/warmup/config \
      -H "Authorization: Bearer ${TOKEN}" > /dev/null
  done
  # Tempos devem ser < 500ms
  ```

- [ ] Databases conectando normalmente
  ```sql
  -- No Supabase Dashboard → SQL Editor
  SELECT COUNT(*) FROM tenants;
  SELECT COUNT(*) FROM users;
  SELECT COUNT(*) FROM user_tenant_roles;
  -- Todos devem retornar resultados (não erro)
  ```
```

---

## Rollback Plan

Se qualquer coisa der errado durante deploy:

### Immediate Rollback (Menos de 10 min após deploy)

```bash
# SSH na VPS
cd /opt/ruptur

# Restaurar versão anterior
mv saas saas-failed-$(date +%s)
mv saas-old-* saas

# Reiniciar containers
cd saas
docker compose up -d

# Validar health check
curl http://localhost:3000/api/local/health

# ✅ Se sucesso → deploy anterior está online
# ❌ Se falhar → usar backup tar.gz
```

### Full Rollback (Usar backup)

```bash
# Se immediate rollback falhar
cd /opt/ruptur

# Restaurar do backup
tar -xzf saas-backup-TIMESTAMP.tar.gz

# Limpar arquivos quebrados
rm -rf saas saas-old-* saas-new

# Restart
docker compose -f saas/docker-compose.yml up -d

# Validar
curl http://localhost:3000/api/local/health
```

### Post-Rollback

1. Investigar qual teste falhou
2. Analisar logs: `docker logs ruptur-saas 2>&1 | tail -100`
3. Contatar arquitetura
4. **Não tentar deploy novamente até que issue seja resolvido**

---

## Sign-Off

### Checklist Final

- [ ] Todos os checks pré-deploy PASSARAM
- [ ] Build completou sem erros
- [ ] Containers iniciaram healthy
- [ ] Health check respondendo
- [ ] Teste de login funciona
- [ ] Teste de warmup/config funciona
- [ ] Nenhum erro em logs nos primeiros 5 min
- [ ] Nenhum alerta em monitoring

### Responsáveis

- **Executor**: [Nome do DevOps]
- **Revisor**: [Nome do Arquiteto]
- **Timestamp Início**: [Data/Hora]
- **Timestamp Fim**: [Data/Hora]
- **Resultado**: ✅ OK / ❌ ROLLBACK / ⚠️ ISSUES

### Log de Deploy

```
[2026-05-08T15:00:00Z] Iniciando deploy Phase 2
[2026-05-08T15:02:00Z] Backup criado: saas-backup-1715169720.tar.gz
[2026-05-08T15:05:00Z] Files transferidas via rsync
[2026-05-08T15:08:00Z] Docker build completado
[2026-05-08T15:10:00Z] Containers antigos parados
[2026-05-08T15:12:00Z] Swap realizado: saas-new → saas
[2026-05-08T15:13:00Z] Containers iniciados
[2026-05-08T15:13:30Z] Health check OK
[2026-05-08T15:14:00Z] Testes básicos passaram
[2026-05-08T15:19:00Z] Monitoramento por 5 min — OK
[2026-05-08T15:19:30Z] ✅ DEPLOY SUCESSO

Notas:
- Nenhuma issue encontrada
- Performance dentro dos esperado
- RLS policies funcionando
- Audit logs ativados
```

---

## Pós-Deploy (Primeiras 24 Horas)

### Hour 1 (Após Deploy)

- [ ] Monitorar logs a cada 5 min
- [ ] Fazer 5-10 logins de teste
- [ ] Testar admin endpoints
- [ ] Confirmar que novos usuários conseguem fazer auto-provisioning

### Hour 2-4

- [ ] Monitorar performance (latências estáveis)
- [ ] Verificar audit logs estão sendo registrados
- [ ] Confirmar que tenants estão isolados

### Hour 4-24

- [ ] Monitoramento contínuo
- [ ] Se houver issues: investigar com DEBUGGING_GUIDE.md
- [ ] Se houver performance issues: analisar queries

### Alertas para Monitorar

⚠️ **Critical** (rollback imediato):
- Health check retorna `false`
- Erro 5xx > 5% das requisições
- Timeout na conexão com Supabase

⚠️ **Warning** (investigar):
- Response time > 1s média
- Memory usage > 80% do limite
- Erro de RLS policy em logs

---

## Referências Rápidas

- [Código de Phase 2](../../modules/auth/index.js)
- [Admin Routes](../../api/routes-admin-tenants.mjs)
- [Tenant Service](../../modules/admin/tenant-config.service.js)
- [Deploy Script](../../scripts/deploy.sh)
- [Logs no Docker](docker logs -f ruptur-saas)
