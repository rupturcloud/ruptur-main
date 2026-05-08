# 🎯 START HERE — Phase 2 Testing

**Você é um agente e quer começar a testar Phase 2?**  
**Leia esta página primeiro. Leva 2 minutos.**

---

## 🤔 O QUE VOCÊ PRECISA FAZER?

### **Opção A: Entender o Projeto** (10 min)
Você quer saber por que estamos fazendo testes e o que vai ser testado.
```
→ Ler: QUICK_START.md (2 min)
→ Ler: 00-TESTING_STRATEGY.md (5 min)
→ Ler: INDEX.md (3 min)
```

### **Opção B: Executar Testes Automaticamente** (60 min) ⚡ **RECOMENDADO**
Você tem capacidade JavaScript e quer rodar os testes rapidamente.
```
→ Ler: AGENT_INSTRUCTIONS.md (5 min)
→ Colar: CLAUDE_FOR_CHROME_PROMPT.md no seu chat
→ Executar: Script automático (45 min)
→ Documentar: Resultados em 07-TEST_RESULTS_TEMPLATE.md (10 min)
```

### **Opção C: Executar Testes Manualmente** (90 min)
Você quer máximo controle, passo-a-passo.
```
→ Ler: AGENT_INSTRUCTIONS.md (5 min)
→ Abrir: 01-INITIAL_TESTS.md
→ Colar: Cada teste no console (F12)
→ Documentar: Resultados (10 min por fase)
```

---

## 🚀 COMECE AGORA (Escolha uma)

```
┌─────────────────────────────────────┐
│ Opção A: ENTENDER (10 min)          │
│ ├─ QUICK_START.md                  │
│ ├─ 00-TESTING_STRATEGY.md           │
│ └─ INDEX.md                         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Opção B: AUTO (60 min) ⚡           │
│ ├─ AGENT_INSTRUCTIONS.md            │
│ ├─ CLAUDE_FOR_CHROME_PROMPT.md      │
│ └─ 07-TEST_RESULTS_TEMPLATE.md      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Opção C: MANUAL (90 min)            │
│ ├─ AGENT_INSTRUCTIONS.md            │
│ ├─ 01-INITIAL_TESTS.md              │
│ ├─ 02-REGRESSION_TESTS.md           │
│ ├─ 03-PERFORMANCE_TESTS.md          │
│ └─ 07-TEST_RESULTS_TEMPLATE.md      │
└─────────────────────────────────────┘
```

---

## 📋 O QUE SERÁ TESTADO?

### **23 Testes Iniciais** (30 min)
✅ Novo usuário consegue se registrar e fazer login  
✅ Tenant é criado automaticamente (auto-provisioning)  
✅ Admin consegue ver/editar settings do tenant  
✅ Segurança: sem acesso cross-tenant  
✅ Erros são tratados corretamente (401, 403, 404)  

### **19 Testes de Regressão** (20 min)
✅ Campanhas ainda funcionam  
✅ Inbox ainda funciona  
✅ Billing ainda funciona  
✅ Warmup/aquecimento ainda funciona  
✅ Message library ainda funciona  

### **18 Métricas de Performance** (15 min)
⏱️ Página carrega em < 1.5s  
⏱️ APIs respondem em < 500ms  
💾 Memória < 100MB  
🔄 10+ requests simultâneos em < 2s  

---

## ✅ CRITÉRIO DE SUCESSO

```
Para agente aprovar deployment:

✅ Todos 23 testes iniciais PASSARAM
✅ Todos 19 testes regressão PASSARAM
✅ 80%+ das métricas de performance OK

= Pronto para Deploy em Produção
```

---

## ⚠️ ATENÇÃO: REGRAS IMPORTANTES

1. **Se Initial Tests falhar:**
   - PARAR execução
   - Debugar com `06-DEBUGGING_GUIDE.md`
   - Corrigir
   - Retry
   - NÃO continue até que passe

2. **Se Regression Tests falhar:**
   - ROLLBACK imediatamente
   - Reverter código para versão anterior
   - Isso significa novo código quebrou feature antiga
   - Não faça deploy

3. **Se Performance falhar:**
   - Não bloqueia deployment
   - Mas documente observações
   - Investigar gargalo se possível

4. **Se Deployment falhar:**
   - ROLLBACK imediatamente
   - Volta para versão anterior
   - Não tente novamente sem fix

---

## 🎯 ESCOLHA SUA OPÇÃO AGORA

### **Opção A: Entender**
```
→ Abrir: QUICK_START.md
```

### **Opção B: Executar (Automático)** ⚡
```
→ Abrir: AGENT_INSTRUCTIONS.md
→ Depois: CLAUDE_FOR_CHROME_PROMPT.md
```

### **Opção C: Executar (Manual)**
```
→ Abrir: AGENT_INSTRUCTIONS.md
→ Depois: 01-INITIAL_TESTS.md
```

---

## 📊 ESTIMATIVA DE TEMPO

| Opção | Tempo | Dificuldade |
|-------|-------|------------|
| A (Entender) | 10 min | ⭐ Fácil |
| B (Auto) | 60 min | ⭐⭐ Médio |
| C (Manual) | 90 min | ⭐⭐⭐ Difícil |

---

## 🚨 PROBLEMA COMUM

Se vir erro: `403 violates row-level security`

**Solução**: Adicionar a `.env`:
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Depois retry os testes.

---

## 📚 TODOS OS ARQUIVOS DISPONÍVEIS

```
START_HERE.md ..................... Você está aqui (2 min read)
QUICK_START.md .................... Quick reference (5 min)
AGENT_INSTRUCTIONS.md ............ Instruções completas (10 min)
INDEX.md ......................... Mapa de navegação (5 min)
README.md ........................ Package overview (10 min)
00-TESTING_STRATEGY.md .......... Estratégia (10 min)
01-INITIAL_TESTS.md ............ 23 testes (30 min)
02-REGRESSION_TESTS.md ........ 19 testes (20 min)
03-PERFORMANCE_TESTS.md ...... 18 métricas (15 min)
04-TEST_EXECUTION_GUIDE.md ... How-to (10 min)
05-DEPLOYMENT_CHECKLIST.md .. Deploy (10 min)
06-DEBUGGING_GUIDE.md ........ Troubleshoot (reference)
07-TEST_RESULTS_TEMPLATE.md . Documentação (10 min)
CLAUDE_FOR_CHROME_PROMPT.md . Automático (reference)
```

---

## 🏁 PRÓXIMO PASSO

**Escolha uma opção acima e comece agora:**

- **Opção A** → Ler `QUICK_START.md`
- **Opção B** → Ler `AGENT_INSTRUCTIONS.md` + `CLAUDE_FOR_CHROME_PROMPT.md`
- **Opção C** → Ler `AGENT_INSTRUCTIONS.md` + `01-INITIAL_TESTS.md`

---

**Pronto? Clique no arquivo acima e comece!** ✅

---

**Versão**: 1.0  
**Data**: 2026-05-08  
**Status**: ✅ Pronto para Agentes
