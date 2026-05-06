# 🚀 Referral System — Quick Start

**Tempo estimado: 5 minutos para deploy**

## 1️⃣ Deploy da Migration (2 min)

### Via Supabase Console (RECOMENDADO)

```bash
1. Abra https://app.supabase.com → seu projeto
2. SQL Editor → New Query
3. Copie todo conteúdo de: migrations/007_referral_system.sql
4. Cole na query
5. Clique "Run"
6. ✅ Migration executada!
```

### Via CLI (Alternativa)

```bash
# Se tem DATABASE_URL
SUPABASE_SERVICE_ROLE_KEY=... \
VITE_SUPABASE_URL=... \
node scripts/init-referral-system.mjs

# Ou com psql
psql "$DATABASE_URL" < migrations/007_referral_system.sql
```

## 2️⃣ Verificar Schema (1 min)

**No Supabase Console → SQL Editor:**

```sql
-- Deve retornar 3 tabelas
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' AND table_name LIKE 'referral%'
ORDER BY table_name;

-- Esperado:
-- referral_clicks
-- referral_commissions  
-- referral_links
```

## 3️⃣ Testar Endpoints (2 min)

### Gerar Link de Referral

```bash
curl -X GET http://localhost:3001/api/referrals/my-link?tenant_id=<uuid> \
  -H "Authorization: Bearer <token>"

# Response:
# {
#   "refCode": "diego_abc123",
#   "link": "https://app.ruptur.cloud/ref/diego_abc123",
#   "createdAt": "2026-05-01T12:00:00Z"
# }
```

### Ver Resumo

```bash
curl -X GET http://localhost:3001/api/referrals/summary?tenant_id=<uuid> \
  -H "Authorization: Bearer <token>"

# Response:
# {
#   "total_referrals": 0,
#   "active_referrals": 0,
#   "paying_referrals": 0,
#   "total_commission_cents": 0,
#   "commission_30d_cents": 0,
#   "last_commission_date": null
# }
```

## 4️⃣ Rodar Testes (Opcional, 2 min)

```bash
# Testa fluxo completo
SUPABASE_SERVICE_ROLE_KEY=... \
VITE_SUPABASE_URL=... \
node tests/referral-integration.test.mjs

# Esperado: ✅ 10/10 PASS
```

## 5️⃣ Frontend — Integrar Endpoints

### React Component Simples

```jsx
import { useState, useEffect } from 'react';

export function ReferralWidget({ tenantId, token }) {
  const [ref, setRef] = useState(null);

  useEffect(() => {
    fetch(`/api/referrals/my-link?tenant_id=${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setRef);
  }, [tenantId, token]);

  if (!ref) return <div>Carregando...</div>;

  return (
    <div>
      <h3>Seu Link de Referral</h3>
      <input 
        readOnly 
        value={ref.link}
        onClick={(e) => e.target.select()}
      />
      <button onClick={() => navigator.clipboard.writeText(ref.link)}>
        📋 Copiar
      </button>
    </div>
  );
}
```

## 6️⃣ Dashboard — Mostrar Comissões

```jsx
export function ReferralDashboard({ tenantId, token }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    fetch(`/api/referrals/summary?tenant_id=${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setSummary);
  }, [tenantId, token]);

  return (
    <div>
      <h2>Ganhe 25% em Créditos</h2>
      <div className="stats">
        <div>
          <span>Amigos Indicados</span>
          <strong>{summary?.active_referrals || 0}</strong>
        </div>
        <div>
          <span>Pagando</span>
          <strong>{summary?.paying_referrals || 0}</strong>
        </div>
        <div>
          <span>Créditos Ganhos</span>
          <strong>R${(summary?.total_commission_cents / 100).toFixed(2)}</strong>
        </div>
      </div>
    </div>
  );
}
```

## ✅ Pronto!

Seu sistema de referral está operacional.

### Próximos passos:

- [ ] Deploy da migration ✅
- [ ] Testar endpoints
- [ ] Integrar no frontend
- [ ] Monitorar logs (24h pós-deploy)

### Mais informações:

- **Documentação técnica:** `REFERRAL_SYSTEM.md`
- **Deploy detalhado:** `DEPLOYMENT_CHECKLIST.md`
- **Testes:** `tests/referral-integration.test.mjs`

---

**Status:** ✅ **READY TO USE**
