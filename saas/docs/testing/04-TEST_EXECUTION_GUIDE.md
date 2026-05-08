# Guia de Execução de Testes

**Tempo Total Estimado**: 60-70 minutos  
**Agente Recomendado**: Claude for Chrome ou agente de testes automatizados

---

## Fase 0: Setup (10 minutos)

### Checklist Inicial

```bash
# 1. Verificar health check
curl https://app.ruptur.cloud/api/local/health

# Resposta esperada:
# {
#   "ok": true,
#   "service": "ruptur-saas-gateway",
#   "supabase": true,
#   "billingConfigured": true
# }

# 2. Verificar variáveis de ambiente críticas
echo $SUPABASE_SERVICE_ROLE_KEY  # Não deve estar vazio
echo $VITE_SUPABASE_URL          # Deve ser https://axrwlboyowoskdxeogba.supabase.co

# 3. Verificar conexão com Supabase
# No Supabase Dashboard → SQL Editor:
SELECT COUNT(*) FROM tenants;
SELECT COUNT(*) FROM users;

# 4. Limpar dados de teste anteriores (CUIDADO: só em dev/staging)
# DELETE FROM audit_logs WHERE created_at < now() - interval '1 hour';
# DELETE FROM user_tenant_roles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-%');
# Pular para agentes — apenas em sandbox.
```

### Validação de Conectividade

```javascript
// Abrir console em https://app.ruptur.cloud
console.log('Current domain:', window.location.origin);

// Validar Supabase connection
import { createClient } from '@supabase/supabase-js';
const testClient = createClient(
  'https://axrwlboyowoskdxeogba.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

const { data, error } = await testClient.auth.getSession();
console.log('Auth session:', data);
console.log('Connection OK?', !error);
```

---

## Fase 1: Testes Iniciais (30 minutos)

### Sequência de Execução

```
Duração: 30 minutos
Casos: 23 testes
Arquivo: 01-INITIAL_TESTS.md

Executar nesta ordem:
1. Seção 1: Autenticação & Signup (4 testes)
2. Seção 2: Auto-Provisioning (5 testes)
3. Seção 3: Admin Endpoints (10 testes)
4. Seção 4: RLS Policies & Segurança (3 testes)
5. Seção 5: Error Handling (1 teste)
```

### Execução em Tempo Real

```javascript
// Usar este template para rodar cada teste

async function runTest(testNumber, testName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[TEST ${testNumber}] ${testName}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  
  try {
    // ➜ Inserir código do teste aqui
    // ➜ Validar resultado
    
    console.log(`✅ PASSED`);
    return { test: testNumber, name: testName, status: 'PASSED', timestamp: new Date() };
  } catch (error) {
    console.error(`❌ FAILED:`, error.message);
    return { test: testNumber, name: testName, status: 'FAILED', error: error.message, timestamp: new Date() };
  }
}

// Coletar resultados
const results = [];
results.push(await runTest('1.1', 'Signup de Novo Usuário'));
results.push(await runTest('1.2', 'Login com Email Válido'));
// ... continuar para todos os 23 testes

// Salvar resultados
localStorage.setItem('testResults', JSON.stringify(results));
console.table(results);
```

### Critério de Parada

Se qualquer teste falhar:
1. **Pausar execução**
2. **Anotar qual teste falhou** (ex: 2.1)
3. **Ir para DEBUGGING_GUIDE.md**
4. **Debugar e corrigir**
5. **Re-executar o teste que falhou**
6. **Continuar a partir de onde parou**

✅ **Prosseguir para Fase 2 apenas se todos os 23 testes passarem**

---

## Fase 2: Testes de Regressão (20 minutos)

### Sequência de Execução

```
Duração: 20 minutos
Casos: 19 testes
Arquivo: 02-REGRESSION_TESTS.md

Executar nesta ordem:
1. Seção 1: Message Library (5 testes)
2. Seção 2: Campaigns (5 testes)
3. Seção 3: Inbox & Messages (4 testes)
4. Seção 4: Billing & Credits (3 testes)
5. Seção 5: Warmup (2 testes)
```

### Execução e Validação

```javascript
// Usar mesmo template da Fase 1
const regressionResults = [];

// Seção 1: Message Library
regressionResults.push(await runTest('R1.1', 'Listar Mensagens'));
regressionResults.push(await runTest('R1.2', 'Criar Nova Mensagem'));
// ... continuar para todos os 19 testes

localStorage.setItem('regressionResults', JSON.stringify(regressionResults));

// Resumo
const passed = regressionResults.filter(r => r.status === 'PASSED').length;
const failed = regressionResults.filter(r => r.status === 'FAILED').length;
console.log(`\n📊 Regressão: ${passed}/19 PASSARAM`);

if (failed > 0) {
  console.log(`❌ ${failed} FALHARAM - ROLLBACK RECOMENDADO`);
}
```

### Regra Crítica de Regressão

⚠️ **Se qualquer teste de regressão falhar**:
1. Isto indica que uma feature antiga foi quebrada
2. **Não prosseguir para testes de performance**
3. **Analisar root cause em DEBUGGING_GUIDE.md**
4. **Se for code issue**: fix, rebuild, restart, re-test
5. **Se for incompatibilidade com Phase 2**: contactar arquitetura
6. **Se problema não for resolvido**: **ROLLBACK para versão anterior**

✅ **Prosseguir para Fase 3 apenas se todos os 19 testes passarem**

---

## Fase 3: Testes de Performance (15 minutos)

### Sequência de Execução

```
Duração: 15 minutos
Métricas: 18 testes
Arquivo: 03-PERFORMANCE_TESTS.md

Executar nesta ordem:
1. Seção 1: Page Load Times (5 métricas)
2. Seção 2: API Response Times (5 métricas)
3. Seção 3: Throughput (2 métricas)
4. Seção 4: Memory Usage (3 métricas)
5. Seção 5: Database Query Performance (3 métricas)
```

### Execução com Performance API

```javascript
// Registrar tempos sistematicamente
const performanceResults = [];

async function measurePerformance(metricName, fn, threshold) {
  const start = performance.now();
  try {
    await fn();
    const duration = performance.now() - start;
    const passed = duration < threshold;
    
    const result = {
      metric: metricName,
      duration: duration.toFixed(2),
      threshold: threshold,
      passed: passed,
      timestamp: new Date()
    };
    
    console.log(`${passed ? '✅' : '❌'} ${metricName}: ${duration.toFixed(2)}ms / ${threshold}ms`);
    performanceResults.push(result);
    
    return result;
  } catch (error) {
    console.error(`❌ ${metricName}: ERROR -`, error.message);
    performanceResults.push({
      metric: metricName,
      error: error.message,
      passed: false,
      timestamp: new Date()
    });
  }
}

// Exemplo:
await measurePerformance('P1.1 - Login FCP', async () => {
  const response = await fetch('https://app.ruptur.cloud/login');
  await response.text();
}, 1500);

// Salvar resultados
localStorage.setItem('performanceResults', JSON.stringify(performanceResults));

// Resumo final
const passed = performanceResults.filter(r => r.passed === true).length;
const total = performanceResults.length;
const passRate = (passed / total * 100).toFixed(0);
console.log(`\n📊 Performance: ${passed}/${total} PASSARAM (${passRate}%)`);
console.log(`Critério: 80%+ → ${passRate >= 80 ? '✅ OK' : '❌ FALHOU'}`);
```

### Critério de Sucesso de Performance

✅ **80%+ das métricas dentro dos thresholds**

Se < 80% passarem:
1. Analisar quais métricas falharam
2. Verificar se é problema de:
   - **Network throttling**: desabilitar throttling, tentar novamente
   - **Carregamento do servidor**: esperar 5min, tentar novamente
   - **Código**: revisar índices de banco, N+1 queries
3. Se não resolver em 2 tentativas: escalar para arquitetura

---

## Fase 4: Deploy Checklist (5 minutos)

### Verificações Finais

```
Arquivo: DEPLOYMENT_CHECKLIST.md
Duração: 5 minutos
```

Após todos os testes passarem, executar:

```javascript
// Verificar que não há mudanças pendentes
console.log('Git status:', await (await fetch('/.git/status')).text());

// Confirmar commit hash em produção
fetch('https://app.ruptur.cloud/api/local/version').then(r => r.json()).then(console.log);

// Verificar que todas as validações foram executadas
const allResults = {
  initial: JSON.parse(localStorage.getItem('testResults') || '[]'),
  regression: JSON.parse(localStorage.getItem('regressionResults') || '[]'),
  performance: JSON.parse(localStorage.getItem('performanceResults') || '[]')
};

console.log('📊 Resumo Final:');
console.log(`Initial: ${allResults.initial.length}/23`);
console.log(`Regression: ${allResults.regression.length}/19`);
console.log(`Performance: ${allResults.performance.filter(r => r.passed).length}/18`);
```

---

## Timeline Recomendada

| Fase | Duração | Início | Fim | Checkpoint |
|------|---------|--------|-----|-----------|
| Setup | 10 min | T+0 | T+10 | Health check OK |
| Initial Tests | 30 min | T+10 | T+40 | 23/23 PASSED ✅ |
| Regression | 20 min | T+40 | T+60 | 19/19 PASSED ✅ |
| Performance | 15 min | T+60 | T+75 | 80%+ thresholds ✅ |
| Deploy | 5 min | T+75 | T+80 | Checklist done ✅ |

**Total: ~80 minutos**

---

## Documentação dos Resultados

Após cada fase, preencher `TEST_RESULTS_TEMPLATE.md`:

```markdown
# Testes de Phase 2 — 2026-05-08

## Setup
- [x] Health check respondendo
- [x] Variáveis de ambiente OK
- [x] Banco de dados acessível

## Initial Tests (23/23 ✅)
- [x] 1.1 - Signup
- [x] 1.2 - Login válido
- ... (listar todos)

## Regression Tests (19/19 ✅)
- [x] R1.1 - Message Library list
- ... (listar todos)

## Performance Tests (17/18 ✅ - 94%)
- [x] P1.1 - Login FCP: 1200ms < 1500ms ✅
- [x] P1.2 - Dashboard FCP: 1800ms < 2000ms ✅
- ❌ P3.1 - 10 concurrent: 2100ms > 2000ms (needs investigation)
- ... (listar todos)

## Issues Found
- P3.1 falhou — possível N+1 query em auto-provisioning

## Actions Taken
- Otimizadas queries em getOrCreateUserTenant
- Re-testado P3.1 — passou

## Sign-off
- Executor: Diego
- Data: 2026-05-08
- Resultado: ✅ APROVADO PARA DEPLOY
```

---

## Se Algo Der Errado

Referência rápida:

| Sintoma | Ação |
|---------|------|
| Health check falha | Verificar Docker, logs do container |
| Teste 1.x falha | Verificar auth/signup — DEBUGGING_GUIDE.md |
| Teste 2.x falha | Verificar auto-provisioning — tenant schema |
| Teste 3.x falha | Verificar user_tenant_roles — permissions |
| Teste R*.x falha | Regressão — analisar com GIT DIFF |
| Performance falha | Verificar índices, N+1 queries no Supabase |

---

## Próximos Passos Após Testes

1. ✅ Preencher TEST_RESULTS_TEMPLATE.md
2. ✅ Commitar resultados (opcional)
3. ✅ Ir para DEPLOYMENT_CHECKLIST.md
4. ✅ Deploy para produção (se tudo OK)
5. ✅ Monitoring pós-deploy (primeiras 30 min)
