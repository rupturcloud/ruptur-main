# Estratégia de Testes — Fase 2: Auto-Provisioning

## Objetivo
Validar a implementação completa de auto-provisioning de tenants em produção, incluindo:
- Nova arquitetura de autenticação com service role key
- Endpoints de admin para configuração de tenants
- RLS policies e segurança
- Compatibilidade com sistema legado

## Estrutura de Testes (3 Camadas)

### 1️⃣ Testes Iniciais (`INITIAL_TESTS.md`)
**Quando**: Antes de qualquer validação de produção  
**O quê**: Happy path + auto-provisioning + admin endpoints  
**23 casos de teste**
- ✅ Signup e login de novo usuário
- ✅ Auto-provisioning de tenant
- ✅ Admin endpoints (GET/PATCH settings, members, billing, audit)
- ✅ Validação de RLS policies
- ✅ Tratamento de erros

**Aceitação**: Todos os 23 casos devem PASSAR antes de prosseguir

---

### 2️⃣ Testes de Regressão (`REGRESSION_TESTS.md`)
**Quando**: Após testes iniciais — validar que features antigas continuam funcionando  
**O quê**: Campaigns, inbox, billing, warmup, notifications  
**19 casos de teste**
- ✅ MessageLibrary (CRUD de mensagens)
- ✅ Campaigns (criar, editar, deletar)
- ✅ Warmup (endpoints de warmup)
- ✅ Billing (consulta de créditos, plano)
- ✅ Inbox (receber mensagens)

**Aceitação**: Todos os 19 casos devem PASSAR — regressão implica rollback

---

### 3️⃣ Testes de Performance (`PERFORMANCE_TESTS.md`)
**Quando**: Após testes iniciais + regressão — validar eficiência  
**O quê**: Latência, throughput, memória  
**18 métricas**
- ⏱️ Page load time < 3s
- ⏱️ API response time < 500ms
- 📊 Memory usage < 150MB
- 🔄 Throughput: 50+ requests/segundo

**Aceitação**: 80%+ das métricas dentro dos thresholds

---

## Fluxo de Execução Recomendado

```
1. Ambiente Setup (10 min)
   └─ Verificar variáveis de ambiente
   └─ Verificar conexão com banco
   └─ Verificar health check

2. Testes Iniciais (30 min)
   └─ INITIAL_TESTS.md
   └─ Se algum falhar → DEBUG_GUIDE.md
   └─ Todos devem passar para continuar

3. Testes de Regressão (20 min)
   └─ REGRESSION_TESTS.md
   └─ Se algum falhar → ROLLBACK

4. Testes de Performance (15 min)
   └─ PERFORMANCE_TESTS.md
   └─ Se falhar → Investigar gargalo

5. Deployment Checklist (5 min)
   └─ DEPLOYMENT_CHECKLIST.md
   └─ Deploy para produção
```

---

## Critérios de Sucesso (Fase 2 Completo)

✅ Todos os 23 testes iniciais PASSAM  
✅ Todos os 19 testes de regressão PASSAM  
✅ 80%+ das métricas de performance estão dentro dos limites  
✅ Console logs validam fluxos de auto-provisioning  
✅ RLS policies não permitir acesso não autorizado  
✅ Deployment checklist completado  

---

## Arquivos de Suporte

| Arquivo | Propósito |
|---------|-----------|
| `INITIAL_TESTS.md` | 23 casos de teste para happy path + auto-provisioning |
| `REGRESSION_TESTS.md` | 19 casos para validar features antigas |
| `PERFORMANCE_TESTS.md` | 18 métricas de latência, throughput, memória |
| `TEST_EXECUTION_GUIDE.md` | Instruções detalhadas de como rodar testes |
| `DEPLOYMENT_CHECKLIST.md` | Validações antes de deploy para produção |
| `DEBUGGING_GUIDE.md` | Diagnóstico de falhas comuns |
| `TEST_RESULTS_TEMPLATE.md` | Template para documentar resultados |

---

## Pré-requisitos

- ✅ Código de Phase 2 committed e merged para master
- ✅ `/opt/ruptur/saas-new` preparado na VPS GCP
- ✅ `.env` com SUPABASE_SERVICE_ROLE_KEY configurado
- ✅ Docker compose buildado e testado localmente
- ✅ JWT token válido para login (usuario@dominio.com)

---

## Contatos & Escalação

- **Erro de RLS**: Verificar SUPABASE_SERVICE_ROLE_KEY em `.env`
- **Auto-provisioning falha**: Verificar supabase connection + tenant schema
- **Admin endpoints 403**: Verificar user_tenant_roles (usuario deve ser owner)
- **Performance degradada**: Verificar índices no banco + logs de error

---

## Notas Importantes

1. **Service Role Key**: Crítico para auto-provisioning — não esquecer de configurar em `.env`
2. **RLS Policies**: Bloqueiam acesso de chave anônima — isso é esperado
3. **Backward Compatibility**: user_tenant_memberships mantém compatibilidade com sistema antigo
4. **Audit Logs**: Cada ação de admin é registrada em `audit_logs` para conformidade
