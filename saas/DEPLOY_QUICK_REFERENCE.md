# ⚡ Deploy Quick Reference — Phase 1 + Phase 2

**30 segundos para fazer deploy**

---

## 🔴 **FAZER AGORA**

### Via GCP Cloud Console (Melhor Opção)

1. Abra: https://console.cloud.google.com
2. Compute Engine → Instâncias de VM
3. Clique **SSH** na instância ruptur-saas

Dentro do SSH:

```bash
cd /opt/ruptur/saas && docker-compose pull && docker-compose down && docker-compose up -d && sleep 5 && docker-compose logs saas-web
```

Pressione Enter. Aguarde ~30 segundos.

---

## ✅ **VALIDAR**

Depois de executar o comando acima:

```bash
curl http://localhost:3001/api/health
```

Se retornar:
```json
{"ok":true,"service":"ruptur-saas-gateway","supabase":true}
```

✅ **Deploy bem-sucedido!**

---

## 📱 **TESTAR NO NAVEGADOR**

1. Acesse: https://saas.ruptur.cloud
2. Faça login
3. Vá para Dashboard → Instâncias
4. Clique "Criar e conectar"
5. Preencha nome e clique criar
6. QR code deve aparecer (Phase 2)

---

## 🐛 **SE ALGO FALHAR**

### Erro: "docker-compose: command not found"

```bash
which docker-compose
# Se não achar, usar:
docker compose pull  # (sem hífen)
docker compose down
docker compose up -d
```

### Erro: "Permission denied"

```bash
sudo su  # Virar root, depois rodar os comandos novamente
```

### Erro: "image pull rate limit"

```bash
# Esperar 30 minutos OU fazer login no Docker:
docker login
# Depois tentar novamente
```

### Ver logs completos

```bash
docker-compose logs -f saas-web | tail -50
```

---

## 📋 **COMANDOS ÚTEIS NA VPS**

```bash
# Verificar status dos containers
docker-compose ps

# Ver últimas linhas dos logs
docker-compose logs saas-web --tail 30

# Parar um container específico
docker-compose stop saas-web

# Reiniciar
docker-compose restart saas-web

# Remover tudo e começar do zero
docker-compose down -v
docker-compose pull
docker-compose up -d

# Verificar uso de memória
docker stats

# Verificar portas abertas
netstat -tlnp | grep 3001
```

---

## 🚀 **RESUMO FINAL**

| Ação | Comando |
|---|---|
| **Deploy** | `docker-compose pull && docker-compose up -d` |
| **Verificar** | `curl http://localhost:3001/api/health` |
| **Logs** | `docker-compose logs saas-web` |
| **Restart** | `docker-compose restart` |
| **Status** | `docker-compose ps` |

---

## 📞 **PRECISA DE AJUDA?**

1. Leia: `DEPLOYMENT_VIA_GCP_CONSOLE.md`
2. Leia: `DEPLOYMENT_INSTRUCTIONS.md`
3. Verifique logs: `docker-compose logs saas-web`

---

**Esperado após deploy**: 
- ✅ Health check retorna OK
- ✅ UI carrega em https://saas.ruptur.cloud
- ✅ Pode criar instâncias
- ✅ QR code aparece no modal

**Tempo estimado**: 5 minutos

🚀 Pronto!
