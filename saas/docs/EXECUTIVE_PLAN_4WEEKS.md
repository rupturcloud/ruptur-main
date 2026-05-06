# 🔥 PLANO EXECUTIVO: 4 SEMANAS
**Se aposto MEU dinheiro nisso, faria assim.**

---

## ✅ PRÉ-REQUISITO (Dia 1 - 2h)

### Validação: 5 Calls com Customers Atuais

**Objetivo:** Entender o resultado REAL do produto

**Clientes para ligar:**
- Os 3 tenants atuais (se pagos) + qualquer customer bem-sucedido

**Pergunta única:**
```
"Desde que começou a usar Ruptur, quanto você vendeu, economizou 
ou ganhou com a ferramenta?"
```

**Esperado:** Número real em R$ ou % de resultado

**Por que:** Sem isso, tudo é teórico. Precisamos de PROOF para vender.

---

## SEMANA 1: ONE MESSAGE (Landing + Copy)

### Dia 1-3: Escolher Segmento + Posicionamento

**Escolha estratégica:** Qual público dá mais ROI fast?

```
OPÇÃO A: AFILIADOS
├─ Vantagem: Alto volume, ciclo curto (dias), fácil de vender
├─ Desvantagem: Margens menores, churn maior
└─ Tempo to first sale esperado: 3-7 dias

OPÇÃO B: EMPRESAS  
├─ Vantagem: LTV maior, fidelidade maior, menos churn
├─ Desvantagem: Ciclo de venda mais longo (semanas), menos volume
└─ Tempo to first sale esperado: 14-21 dias

OPÇÃO C: AGÊNCIAS
├─ Vantagem: LTV gigante (R$9.700+/mês por agência)
├─ Desvantagem: Ciclo muito longo (meses), poucos clientes
└─ Tempo to first sale esperado: 30+ dias
```

**Minha recomendação:** **AFILIADOS** (fast traction)

**Por que:** Em 30 dias você consegue dados reais de conversão. Com empresas, demoraria 3 meses.

---

### Dia 4-5: Escrever Copy

**Usar copy do documento `SALES_FUNNEL_AND_POSITIONING.md`, seção "Afiliados"**

**Headline:**
```
"Escale suas vendas 3x em 30 dias
(Ou seu dinheiro de volta)"
```

**Landing page simplificada (1 página):**
- Hero (headline + subheader + CTA)
- Problema (3 pain points)
- Solução (3 features)
- Social proof (caso real ou número R$)
- CTA duplicado (urgência)
- FAQ (3 perguntas)

**Ferramenta:** Use Figma/Webflow/Next.js (o que souber fazer rápido)

**Meta:** Entregar em 2 dias

---

### Dia 6-7: Testar com R$200 em Ads

**Canal:** Google Ads (keywords)

```
Keywords:
- "escalar vendas whatsapp"
- "automacao whatsapp disparo"
- "software whatsapp vendas"
- "campanha whatsapp massa"

Bid: R$15-20 por clique

Budget: R$200 (teste apenas)

Landing page: Sua landing nova
```

**Métrica de sucesso:**
- ≤ R$4 CAC (customer acquisition cost)
- ≥ 5% conversion (200 clicks → 10 signup)

**Se falha:** Volta pro copy,  muda headline

---

## SEMANA 2: WARM FUNNEL (Automação WhatsApp)

### Dia 8-10: Implementar 3 Mensagens WhatsApp

**Ferramentas:** Seu próprio Ruptur (meta-gaming!)

**Sequência automática:**

#### Mensagem 1: DAY 0 (imediato após signup)

```
"Oi [Name]! 👋

Bem-vindo à Ruptur.

Sua conta está pronta.

Você tem:
• 50 créditos grátis
• Acesso a inbox + campanhas
• Suporte no Discord

PRÓXIMO PASSO:
Conecte seu WhatsApp em 2 minutos:
[LINK - Setup WhatsApp]

Precisa ajuda?
Escreve aqui mesmo. 🙌"
```

**Objetivo:** Ativar usuário no mesmo dia

**Esperado:** 60% de clics no link

---

#### Mensagem 2: DAY 3 (se não conectou WhatsApp)

```
"Oi [Name], tudo bem?

Vi que você não conectou o WhatsApp ainda.

Não é complicado, prometo!

Aqui tem um vídeo de 90 segundos mostrando tudo:
[VIDEO LINK]

Ou, se preferir, é só:
1. Ir em Settings
2. Clicar "Conectar WhatsApp"
3. Escanear QR code

Qualquer dúvida, escreve aqui! 🙌"
```

**Objetivo:** Desbloquear primeiro teste

**Esperado:** 40% de conexão com WhatsApp

---

#### Mensagem 3: DAY 7 (expiry + oferta)

```
"[Name]! ⏰ Seu trial expira amanhã

Você tem 2 opções:

1️⃣ UPGRADE: R$97/mês, 2.000 créditos
→ Clique aqui: [STRIPE LINK]

2️⃣ ESTENDER: 14 dias grátis
→ Clique aqui: [EXTEND LINK]

Qual você escolhe?"
```

**Objetivo:** Forçar decisão

**Esperado:** 15-20% upgrade OR 30-40% extend

---

### Dia 11-14: Implementar no Código

**Backend:** Criar endpoint `/api/onboarding/send-messages`

**Triggers:**
- Day 0: Após auth.signUp confirmado
- Day 3: Se campaigns.count == 0
- Day 7: Se subscriptions.status != 'authorized'

**Executor:** Cron job ou webhook de email (usar SendGrid/Twilio)

**Alternativa rápida:** Fazer manual com seu Ruptur (enviar via painel para emails/phones)

---

## SEMANA 3: ONE SDR (Vendedor Freelancer)

### Dia 15-17: Recrutar SDR

**Perfil:**
- Experiência em vendas SaaS ou similar
- Fala português natural
- Pode ser 100% freelancer
- 2-4 horas/dia é o suficiente

**Onde encontrar:**
- Upwork: "SDR WhatsApp sales"
- LinkedIn: Búsca por "SDR Brasil"
- Freelancer: PostJob

**Custo esperado:** R$2-3k/mês

**Onboarding SDR (1 dia):**
- Dar acesso ao Ruptur
- Mostrar lista de warm leads
- Ensinar template de mensagem (do documento)
- 3 exemplos de pitch bem-sucedidos

---

### Dia 18-21: Playbook SDR

**Workflow simples:**

```
TRIGGER: Trial user que gastou 40+ créditos

ACTION: SDR manda mensagem no WhatsApp

MESSAGE (template):
"Oi [Name]! 👋

Vi que você testou bem o Ruptur 
(você já gastou [X] créditos).

Isso é bom sinal.

Quer bater uma papo comigo sobre como 
escalar isso? (15 min, sem venda)

Se sim, marca aqui:
[CALENDLY LINK]

Ou escreve sua dúvida aqui mesmo. 🙌

Abraço,
[SDR Name]"
```

**Métrica SDR:**
- 50 warm leads/mês
- 20% reply rate
- 50% agendamento de calls
- 30% conversão em calls (5 clientes/mês)
- Revenue: 5 × R$97 = R$485/mês
- Cost: R$2.5k/mês
- Payback: 2.5 meses (OK)

---

## SEMANA 4: TINY ADS (Google Ads Scale)

### Dia 22-26: Aumentar Ad Budget

**Dados da Semana 1:**
- Conversion rate validado? (5-10%+)
- Copy funciona? (headlines)
- Landing page boa? (UX OK)

**Se SIM → Scale:**

```
Semana 1:  R$200/dia  (teste)
Semana 4:  R$500/dia  (validado)

Keywords:
- Afiliado (2 ads, different copy)
- Whatsapp crm
- Automacao whatsapp
- Disparo em massa

Bid strategy: Maximize conversions (automated)
Budget: R$500/dia = R$3.500/semana

Expected:
- 500-750 clicks/dia
- 50 clicks/conversão (5-7% CTR → signup)
- 25-35 trialists/dia
- 3-5 conversões para pago/dia

Revenue: 5 × R$97 = R$485/dia = R$3.395/semana
Cost: R$3.500/semana
ROI: Break-even

IMPORTANT: Só escala se Week 1-3 deu resultado!
```

---

## 📊 RESULTADO ESPERADO (Fim das 4 Semanas)

```
TRIAL SIGNUPS:      200-300/mês
├─ Via ads:         100-150
├─ Via warm:        30-50
├─ Via referral:    20-30
└─ Organic:         20-70

TRIAL CONVERSION:   15-20% → 30-60 clientes/mês

REVENUE:            
├─ Starter (97):    30 × R$97   = R$2.910/mês
├─ Pro (197):       5 × R$197   = R$985/mês
└─ Total MRR:                    ≈ R$3.895/mês

COSTS:
├─ Ads (R$500/dia): R$15.000/mês
├─ SDR (1 FTE):     R$2.500/mês
├─ Tech (Stripe, etc): R$500/mês
└─ Total OpEx:      R$18.000/mês

BURN: R$18.000 - R$3.895 = -R$14.105/mês

BUT:
✅ Dados validados (proof of concept)
✅ Funnel otimizado (feedback real)
✅ Próximas 4 semanas: Scale com ROI positivo (mais SDRs, mais ads)
✅ Depois de validação: Pivot para Empresas (LTV 5x maior)
```

---

## 🎯 MÉTRICAS CRÍTICAS A RASTREAR (Semanas 1-4)

| Métrica | Semana 1 | Semana 2 | Semana 3 | Semana 4 | Target |
|---------|----------|----------|----------|----------|--------|
| Trial signups | 50 | 75 | 100 | 150 | 200+ |
| Trial conversion % | 8% | 12% | 15% | 18% | 20%+ |
| Pagos/mês | 4 | 9 | 15 | 27 | 30+ |
| CAC (R$) | 500 | 300 | 250 | 200 | <200 |
| LTV (R$) | 2.328 | 2.328 | 2.328 | 2.328 | >5.000 |
| LTV:CAC ratio | 4.6:1 | 7.7:1 | 9.3:1 | 11.6:1 | 10:1+ |

---

## ⚠️ PIVOTS (Se falhar nas semanas 1-2)

### Se Trial Conversion < 10% (Bad)

**Problema:** Produto não está claro, onboarding fraco, targeting errado

**Ação IMEDIATA:**
1. ❌ PARA ads (está queimando dinheiro)
2. ✅ Faz 5 calls com users: "Por que não converteu?"
3. ✅ Muda copy/landing page com feedback
4. ✅ Volta com ads (novo headline)

**Não perca > 2 semanas testando. Muda a narrativa.**

---

### Se Warm Funnel não funciona (< 10% reply rate)

**Problema:** Mensagem ruim, timing ruim, ou produto fraco

**Ação:**
1. Testa novo template
2. Testa enviar Day 1 instead of Day 3
3. Aumenta frequência (Day 0, Day 2, Day 5)

---

## 🎬 COMECE SEGUNDA-FEIRA

### Checklist Dia 1:

- [ ] Fazer 5 calls com customers (validar product-market fit)
- [ ] Decidir segmento (afiliados? sim/não?)
- [ ] Criar landing page simples em Figma
- [ ] Escrever headline (copiar do documento)
- [ ] Reserve R$200 de budget para ads
- [ ] Criar anúncio Google Ads simples
- [ ] Setup: Supabase webhook para Day 0 message
- [ ] Recrutar SDR no Upwork/LinkedIn

### Fim da Semana 1:

- [ ] Landing live
- [ ] Ads rodando
- [ ] 50+ trialists já chegaram
- [ ] 3-5 primeiras conversões

### Fim da Semana 2:

- [ ] Messages automated working (Day 0, 3, 7 enviadas)
- [ ] Trial conversion acima de 10%
- [ ] SDR recrutado e onboarded

### Fim da Semana 3:

- [ ] SDR fazendo primeiras calls
- [ ] Primeiros clientes do warm funnel

### Fim da Semana 4:

- [ ] 15-20 clientes pagos
- [ ] Métricas validadas
- [ ] Decisão: Scale ou pivot

---

## 💰 INVESTIMENTO TOTAL (4 semanas)

```
Ads:                 R$4.000
SDR (1 mês):         R$2.500
Tech/Tools:          R$500
Developer time:      R$2.000 (se contratar help)
─────────────────────────────
TOTAL:               R$9.000

Revenue esperado:    R$3-5k
Burn:                -R$4-6k

Aceitável. Depois você tem dados para escalar ou pivotar.
```

---

## 🎯 FIM DA SEMANA 4: DECISÃO CRÍTICA

**Com dados reais (20+ clientes pagos), você decide:**

### Opção 1: SCALE AGRESSIVO
- Aumenta ads para R$2-3k/dia
- Contrata 2-3 SDRs
- Foca em lead gen puro
- Meta: 100-150 clientes/mês em 8 semanas

### Opção 2: PIVOT PARA EMPRESAS
- Para ads de afiliados
- Começa cold outreach em empresas (LinkedIn)
- Ciclo mais longo, mas LTV 5x maior
- Meta: 10-15 clientes empresa/mês

### Opção 3: PRODUTO NÃO VALIDA
- Dados mostram que ninguém quer, ou churn é 70%+
- Volta aos 5 calls: aprender por que falhou
- Muda produto ou messaging radicalmente
- Retorna com hipótese novo

---

**Isso é o que eu faria com meu dinheiro.**

**Começa segunda-feira?**

