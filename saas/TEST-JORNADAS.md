# 🚀 Ruptur Cloud - Jornadas de Usuário & Smoke Tests

## 📍 URLs de Acesso

### Produção (VPS)
- **Client Area:** https://app.ruptur.cloud/
- **Warmup Manager (Light):** https://app.ruptur.cloud/warmup/
- **Warmup Manager (Dark):** https://app.ruptur.cloud/warmup/dark/
- **API Health:** https://api.ruptur.cloud/api/local/health

### Local
- **Client Area:** http://localhost:5173/
- **Warmup Manager (Light):** http://localhost:4173/warmup/
- **Warmup Manager (Dark):** http://localhost:4173/warmup/dark/
- **API:** http://localhost:4173/api/

---

## 👤 Jornada 1: Cliente (Client-Area)

### Login → Dashboard → Campanhas
```
1. Acessar / → Redireciona para login
2. Login com ID da conta + Senha
3. Dashboard mostra:
   - Saldo Wallet
   - Envios Hoje
   - Instâncias
   - Fila de Espera
4. Menu lateral:
   - Dashboard ✓
   - Campanhas ✓
   - Carteira ✓
   - Inbox ✓
   - Configurações ✓
```

### Criar Campanha
```
1. Clicar "Campanhas" no menu
2. Botão "+ Nova Campanha" (gradiente purple/cyan)
3. Wizard:
   - Etapa 1: Nome da campanha
   - Etapa 2: Selecionar instâncias
   - Etapa 3: Compor mensagens (spintext, mídia)
   - Etapa 4: Configurar agendamento
4. Lançar campanha
```

### Comprar Créditos
```
1. Clicar "Carteira"
2. Botão "Adicionar Créditos" ou "Comprar Créditos"
3. Selecionar valor
4. Checkout Stripe
5. Créditos creditados automaticamente
```

---

## 🔧 Jornada 2: Admin/Gateway (Warmup Manager)

### Dashboard de Operações
```
1. Acessar /warmup/
2. Toggle Light/Dark no header
3. Dashboard mostra:
   - Status Warmup 24/7
   - Rondas ativas
   - Instâncias conectadas
   - Métricas de envio
```

### Gerenciar Rotinas Warmup
```
1. Menu lateral → "Warmup"
2. Lista de rotinas:
   - Warmup 24/7 Padrão (ativa)
   - Toggle on/off
   - Stats: mensagens, delay, total enviado
3. Ações:
   - Pausar/Parar/Reiniciar
   - Editar configurações
```

### Gerenciar Instâncias
```
1. Menu lateral → "Instâncias"
2. Lista mostra:
   - Nome da instância
   - Status (online/offline)
   - Número/WhatsApp
   - Última atividade
3. Ações:
   - Conectar nova instância
   - Desconectar
   - Ver QR Code
```

---

## 🧪 Smoke Tests Automatizados

### Testes de Health Check
```bash
# Testar API local
curl -s http://localhost:4173/api/local/health | jq .

# Testar API produção
curl -s https://api.ruptur.cloud/api/local/health | jq .
```

**Resposta Esperada:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-01T...",
  "scheduler": {
    "enabled": true,
    "status": "idle|running"
  }
}
```

### Testes de Rota
```bash
# Warmup Manager Light
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/warmup/
# Esperado: 200

# Warmup Manager Dark
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/warmup/dark/
# Esperado: 200

# API Inbox
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/api/inbox/
# Esperado: 200

# API Campaigns
curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/api/campaigns/
# Esperado: 200
```

---

## 🎨 Validação de Temas

### Tema Light (Original)
- Background: branco/claro
- Cards: cinza claro
- Botões: verde/cores padrão
- Sidebar: clara

### Tema Dark (Client-Area)
- Background: #0a0a0b (preto)
- Cards: glassmorphism com blur
- Botões: gradiente purple→cyan (#7000ff → #00f2ff)
- Sidebar: escura com hover cyan
- Fontes: Outfit (títulos), Inter (texto)
- Badges coloridas por status

---

## 🔒 Validação de Segurança

### Headers de Segurança
```bash
curl -I http://localhost:4173/api/local/health

# Esperado:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=...
```

### CORS
```bash
curl -H "Origin: https://app.ruptur.cloud" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:4173/api/inbox/
```

---

## 📊 Smoke Test Suite (Node.js/Playwright)

```javascript
// smoke-tests.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Ruptur Cloud - Smoke Tests', () => {
  
  test('Health check API', async ({ request }) => {
    const response = await request.get('/api/local/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('Warmup Manager Light', async ({ page }) => {
    await page.goto('/warmup/');
    await expect(page).toHaveTitle(/Warmup Manager/);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('Warmup Manager Dark', async ({ page }) => {
    await page.goto('/warmup/dark/');
    await expect(page).toHaveTitle(/Warmup Manager/);
    // Verificar tema dark aplicado
    const bg = await page.evaluate(() => 
      getComputedStyle(document.body).backgroundColor
    );
    expect(bg).toBe('rgb(10, 10, 11)'); // #0a0a0b
  });

  test('Client Area Login', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Bem-vindo')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('API Inbox endpoints', async ({ request }) => {
    const response = await request.get('/api/inbox/');
    expect(response.ok()).toBeTruthy();
  });

  test('API Campaigns endpoints', async ({ request }) => {
    const response = await request.get('/api/campaigns/');
    expect(response.ok()).toBeTruthy();
  });
});
```

---

## 🚀 Checklist de Deploy

### Pré-Deploy
- [ ] Todos os commits pushados
- [ ] `git status` limpo
- [ ] Testes locais passando
- [ ] Build do frontend sem erros

### Deploy na VPS
```bash
ssh ruptur@saas.ruptur.cloud
cd /opt/ruptur-main
git pull origin main
docker-compose down
docker-compose up -d
```

### Pós-Deploy (Smoke Tests)
- [ ] Health check passa: `/api/local/health`
- [ ] Warmup Manager Light: `/warmup/`
- [ ] Warmup Manager Dark: `/warmup/dark/`
- [ ] Client Area: `/`
- [ ] Nenhum erro nos logs: `docker-compose logs -f`

---

## 🐛 Troubleshooting

### Problema: CSS não carrega
```bash
# Verificar se arquivos existem
ls -la web/manager-dist/assets/*.css

# Reiniciar servidor
pkill -f warmup-core
PORT=4173 node modules/warmup-core/server.mjs &
```

### Problema: API retorna 404
```bash
# Verificar rotas no server.mjs
grep -n "api/local\|api/inbox\|api/campaigns" modules/warmup-core/server.mjs
```

### Problema: Tema dark não aplica
```bash
# Verificar se CSS está sendo carregado
curl -s http://localhost:4173/warmup/dark/ | grep -o "client-area-dark.css"
```

---

## 📈 Métricas de Sucesso

| Jornada | Critério de Sucesso |
|---------|---------------------|
| Client Login | < 2s load, login funciona |
| Dashboard | Cards renderizam, dados aparecem |
| Criar Campanha | Wizard completa sem erro |
| Warmup Toggle | Light/Dark switch < 1s |
| API Health | Response < 500ms, status: healthy |
| Deploy | Zero downtime, rollback disponível |
