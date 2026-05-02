# 🔗 Sistema de Referral — Ruptur

**Comissão: 25% do pagamento do amigo em créditos (perpetual)**

## Visão Geral

Quando um usuário (referrer) indica um amigo (referee), o referrer recebe **25% de créditos** de cada pagamento/renovação mensal do amigo **enquanto a assinatura estiver ativa**.

### Características

✅ **Perpetual**: Continua creditando enquanto o amigo pagar  
✅ **Anti-parasita**: Free tier segmentado (Inbox XOR Warmup)  
✅ **Imutável**: Histórico completo em `referral_commissions` (auditoria)  
✅ **Webhook-safe**: UNIQUE constraint previne replay de eventos  
✅ **RLS isolado**: Usuários veem apenas seus próprios referrals  

## Arquitetura

### Tabelas

```sql
referral_links          -- Quem indicou quem
  ├─ referrer_tenant_id (quem indicou)
  ├─ referee_tenant_id  (quem foi indicado)
  ├─ ref_code           (diego_abc123)
  ├─ status             (active/paused/expired/cancelled)
  └─ utm_*              (source, medium, campaign para tracking)

referral_commissions    -- Histórico imutável de comissões
  ├─ referrer_tenant_id
  ├─ referee_tenant_id
  ├─ referral_link_id
  ├─ getnet_payment_id  (vincula ao pagamento)
  ├─ commission_amount  (em centavos)
  ├─ status             (credited/pending/reversed/cancelled)
  └─ credited_at        (quando foi creditada)

referral_clicks         -- Analytics de cliques
  ├─ referral_link_id
  ├─ ip_address
  └─ user_agent

referral_summary (VIEW) -- Agregações para dashboard
  ├─ total_referrals
  ├─ active_referrals
  ├─ paying_referrals
  ├─ total_commission_cents
  ├─ commission_30d_cents
  └─ last_commission_date
```

### Fluxo

```
1. Referrer gera link
   GET /api/referrals/my-link?tenant_id=...
   → ref_code: "diego_abc123"
   → link: https://app.ruptur.cloud/ref/diego_abc123

2. Referee clica e registra evento
   POST /api/referrals/click/diego_abc123
   → Armazena em referral_clicks (ip, user_agent)

3. Referee se inscreve (novo tenant criado)
   POST /api/referrals/claim/diego_abc123
   body: { newTenantId: "uuid" }
   → referral_links.referee_tenant_id atualizado

4. Referee realiza pagamento (PAYMENT_APPROVED webhook)
   → billing.handlePayhook() chama processReferralCommission()
   → Busca referral_links ativo
   → Calcula 25% do valor
   → Insere em referral_commissions (status=credited)
   → Credita referrer via addCreditsToTenant()
   → wallet_transactions registra (source=referral)

5. Se referee cancela assinatura
   → referral_links.status = 'expired'
   → Futuras cobranças não geram mais comissão
```

## API Endpoints

### 1. Obter/Gerar Link de Referral

```http
GET /api/referrals/my-link?tenant_id=<uuid>
Authorization: Bearer <token>
```

**Response:**
```json
{
  "refCode": "diego_abc123",
  "link": "https://app.ruptur.cloud/ref/diego_abc123",
  "createdAt": "2026-05-01T12:00:00Z"
}
```

### 2. Resumo de Referrals (Dashboard)

```http
GET /api/referrals/summary?tenant_id=<uuid>
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total_referrals": 5,
  "active_referrals": 3,
  "paying_referrals": 2,
  "total_commission_cents": 245000,
  "commission_30d_cents": 50000,
  "last_commission_date": "2026-05-01T10:30:00Z"
}
```

### 3. Reivindicar Referral (ao inscrever)

```http
POST /api/referrals/claim/diego_abc123
Content-Type: application/json

{
  "newTenantId": "<novo-tenant-uuid>"
}
```

**Response:**
```json
{
  "success": true,
  "referrerTenantId": "<uuid>"
}
```

### 4. Registrar Clique (tracking)

```http
POST /api/referrals/click/diego_abc123
```

**Response:**
```json
{
  "ok": true
}
```

## Integração Backend

### Webhook Getnet

O sistema **automaticamente** processa comissões quando:

- `PAYMENT_APPROVED` (compra única de créditos)
- `SUBSCRIPTION_PAYMENT` (renovação mensal)

**Fluxo automático:**

```javascript
// Em getnet.js → handlePaymentApproved()
async handlePaymentApproved(body) {
  // ... lógica existente ...
  
  // ✨ Nova: Processar comissão de referral
  await this.processReferralCommission(
    payment.tenant_id,        // quem pagou (referee)
    paymentId,
    paymentAmount
  );
}

// Método novo: processa comissão atomicamente
async processReferralCommission(refereeTenantId, paymentId, amountCents) {
  // 1. Busca referral_link ativo
  // 2. Valida (não duplica via UNIQUE constraint)
  // 3. Calcula 25%
  // 4. Insere referral_commissions
  // 5. Credita referrer via addCreditsToTenant(source: 'referral')
  // 6. Retorna resultado
}
```

## Integração Frontend

### Dashboard de Referral

```jsx
// Exemplo: componente React para dashboard

export function ReferralDashboard({ tenantId, token }) {
  const [refData, setRefData] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    // Carregar link e resumo
    Promise.all([
      fetch(`/api/referrals/my-link?tenant_id=${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()),
      fetch(`/api/referrals/summary?tenant_id=${tenantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json())
    ]).then(([ref, sum]) => {
      setRefData(ref);
      setSummary(sum);
    });
  }, [tenantId, token]);

  return (
    <div className="referral-dashboard">
      <h2>Ganhe 25% em Créditos</h2>

      {/* Seção: Seu Link */}
      <div className="ref-link">
        <h3>Seu Link de Referral</h3>
        <input 
          readOnly 
          value={refData?.link || ''} 
          onClick={(e) => e.target.select()}
        />
        <button onClick={() => {
          navigator.clipboard.writeText(refData.link);
          alert('Link copiado!');
        }}>
          📋 Copiar
        </button>
      </div>

      {/* Seção: Estatísticas */}
      <div className="ref-stats">
        <div className="stat">
          <div className="label">Amigos Indicados</div>
          <div className="value">{summary?.active_referrals || 0}</div>
        </div>
        <div className="stat">
          <div className="label">Pagando</div>
          <div className="value">{summary?.paying_referrals || 0}</div>
        </div>
        <div className="stat">
          <div className="label">Créditos Ganhos</div>
          <div className="value">
            R${(summary?.total_commission_cents / 100 || 0).toFixed(2)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Últimos 30 dias</div>
          <div className="value">
            R${(summary?.commission_30d_cents / 100 || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Botões de Share */}
      <div className="share-buttons">
        <button onClick={() => {
          const text = `Saiba mais sobre Ruptur. Use meu código: ${refData?.refCode}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }}>
          📱 Compartilhar no WhatsApp
        </button>
        <button onClick={() => {
          const text = `Ganhe 25% em créditos com meu link: ${refData?.link}`;
          window.open(`mailto:?subject=Ruptur&body=${encodeURIComponent(text)}`, '_blank');
        }}>
          ✉️ Compartilhar por Email
        </button>
      </div>
    </div>
  );
}
```

### Página de Signup com Referral

```jsx
// Exemplo: incorporar referral_code no signup

export function SignupPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const refCode = searchParams.get('ref') || null;

  return (
    <div>
      {refCode && (
        <div className="ref-banner">
          ✨ Você foi indicado! Ganhe bônus especiais.
        </div>
      )}

      {/* ... formulário de signup ... */}

      <button onClick={async () => {
        const newTenant = await createTenant();

        if (refCode) {
          // Reivindicar referral
          const result = await fetch(`/api/referrals/claim/${refCode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newTenantId: newTenant.id })
          }).then(r => r.json());

          if (result.success) {
            console.log('✅ Referral ativado!');
          }
        }
      }}>
        Criar Conta
      </button>
    </div>
  );
}
```

## Testes

### Teste de Integração

```bash
# Verificar se tudo está funcionando
node saas/tests/referral-integration.test.mjs
```

Simula:
- ✅ Criar tenants (referrer + referee)
- ✅ Gerar link de referral
- ✅ Reivindicar referral
- ✅ Processar comissão
- ✅ Validar créditos creditados
- ✅ Proteção contra replay de webhook

## Anti-Parasita

### Segmentação de Free Tier

A free tier é segmentada (usuário escolhe OU Inbox OU Warmup, não ambos):

```sql
-- tenants.free_tier_segment
-- VALUES: 'inbox', 'warmup', NULL (paid)

-- Usuário free tier vê apenas:
-- 'inbox'  → inbox, mas sem warmup
-- 'warmup' → warmup com 1 número, mas sem inbox
-- NULL     → tudo (pago)
```

### Requisito Mínimo para Comissão

Comissão **só é creditada** se o referee:
- Realizou pagamento/assinatura efetiva (status=APPROVED)
- Mantém assinatura ativa (SUBSCRIPTION_PAYMENT)
- Não fez chargeback/cancelamento (sem reversal)

### Detecção de Fraude (Opcional - Futuro)

```javascript
// Padrões suspeitos a monitorar:
// 1. Múltiplas contas mesmo IP → rate limit
// 2. Pagamento → cancelamento < 24h → marcar como suspended
// 3. Volume anomal (50+ referrals em 1h) → revisar manualmente
```

## Roadmap

- [ ] Dashboard visual com gráficos de comissão mensal
- [ ] Email automático quando comissão é creditada
- [ ] Leaderboard de top referrers
- [ ] Bônus progressivo (5+ referrals = 30%, 10+ = 40%)
- [ ] Integração com CRM (HubSpot) para tracking
- [ ] Webhook para notificação real-time (WebSocket)

## Troubleshooting

### "Código não encontrado"
- Verifique se `ref_code` foi gerado e está ativo
- Confirme que `referral_links.status = 'active'`

### "Comissão não foi creditada"
- Verifique se `PAYMENT_APPROVED` webhook foi recebido
- Confirme que `referral_links` existe para este referee
- Verifique logs em `wallet_transactions` (source='referral')

### "Múltiplas comissões para mesmo pagamento"
- Webhook foi processado 2x (replay)
- UNIQUE constraint protege: `(getnet_payment_id, referrer_tenant_id)`
- Rejeita duplicatas com `action: 'commission_duplicate'`

## Performance

- `referral_links`: índice `(referrer_tenant_id, status)`
- `referral_commissions`: índice `(referrer_tenant_id, status)`, `(credited_at DESC)`
- `referral_summary` VIEW: re-computada on-demand (rápida)

---

**Autor:** Claude + Diego  
**Data:** 2026-05-01  
**Status:** ✅ Implementado e pronto para produção
