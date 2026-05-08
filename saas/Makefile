# Ruptur SaaS - Makefile de Automação Completa
# 
# Comandos centralizados para deploy, gestão e operação do SaaS
# Uso: make <comando>

.PHONY: help deploy-prod deploy-staging deploy-local build push clean logs status test-apis restart ci ci-lint ci-test ci-quality ci-coverage

# Variáveis de ambiente
ENV ?= production
PROJECT_ID ?= ruptur-jarvis-v1-68358
ZONE ?= southamerica-west1-a
INSTANCE_NAME ?= ruptur-shipyard-02
SSH_KEY ?= ~/.ssh/google_compute_engine
REGISTRY ?= gcr.io/$(PROJECT_ID)/saas

# Cores para output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

help: ## Exibe todos os comandos disponíveis
	@echo "$(BLUE)Ruptur SaaS - Automação Completa$(NC)"
	@echo ""
	@echo "$(YELLOW)🚨 CI/CD - Validação Local (execute ANTES de push):$(NC)"
	@echo "  make ci              - Pipeline completo de CI (lint + test + quality + coverage)"
	@echo "  make ci-lint         - Valida sintaxe de código"
	@echo "  make ci-test         - Executa testes unitários"
	@echo "  make ci-quality      - Quality gate (lint + test + build)"
	@echo "  make ci-coverage     - Gera relatório de cobertura"
	@echo "  make ci-audit        - Security audit"
	@echo ""
	@echo "$(GREEN)Deploy:$(NC)"
	@echo "  make deploy-prod     - Deploy completo em produção"
	@echo "  make deploy-staging  - Deploy em ambiente de staging"
	@echo "  make deploy-local    - Build e run local"
	@echo ""
	@echo "$(GREEN)Docker:$(NC)"
	@echo "  make build          - Build da imagem Docker"
	@echo "  make push           - Push da imagem para registry"
	@echo "  make clean          - Limpa containers e imagens"
	@echo ""
	@echo "$(GREEN)Operação:$(NC)"
	@echo "  make logs           - Exibe logs do container"
	@echo "  make status         - Status do serviço"
	@echo "  make restart        - Reinicia o container"
	@echo ""
	@echo "$(GREEN)Testes:$(NC)"
	@echo "  make test-apis      - Testa todas as APIs"
	@echo "  make test-health    - Testa saúde do sistema"
	@echo ""
	@echo "$(GREEN)Infra:$(NC)"
	@echo "  make infra-apply    - Aplica infraestrutura Terraform"
	@echo "  make infra-destroy  - Destroi infraestrutura"
	@echo "  make ansible-deploy  - Executa Ansible playbook"
	@echo ""

# Comandos de Deploy
deploy-prod: ## Deploy completo em produção
	@echo "$(BLUE)Iniciando deploy em produção...$(NC)"
	@make build
	@make deploy-docker
	@make test-health
	@echo "$(GREEN)Deploy em produção concluído!$(NC)"
	@echo "$(YELLOW)Acesse: https://app.ruptur.cloud$(NC)"

deploy-staging: ## Deploy em ambiente de staging
	@echo "$(BLUE)Iniciando deploy em staging...$(NC)"
	ENV=staging make build
	ENV=staging make deploy-docker
	@echo "$(GREEN)Deploy em staging concluído!$(NC)"

deploy-local: ## Build e run local
	@echo "$(BLUE)Iniciando ambiente local...$(NC)"
	@make build
	docker-compose -f docker-compose-fixed.yml up -d --build
	@echo "$(GREEN)Ambiente local rodando em http://localhost:4173$(NC)"

# Docker
build: ## Build da imagem Docker
	@echo "$(BLUE)Buildando imagem Docker...$(NC)"
	docker build -t saas-saas-web:latest .
	@echo "$(GREEN)Build concluído!$(NC)"

push: ## Push da imagem para registry
	@echo "$(BLUE)Fazendo push da imagem...$(NC)"
	docker tag saas-saas-web:latest $(REGISTRY):latest
	docker push $(REGISTRY):latest
	@echo "$(GREEN)Push concluído!$(NC)"

clean: ## Limpa containers e imagens
	@echo "$(BLUE)Limpando ambiente Docker...$(NC)"
	docker-compose -f docker-compose-fixed.yml down -v
	docker system prune -f
	@echo "$(GREEN)Limpeza concluída!$(NC)"

# Operação
deploy-docker: ## Deploy via Docker na instância GCP
	@echo "$(BLUE)Fazendo deploy via Docker...$(NC)"
	@scp -i $(SSH_KEY) -r . $(USER)@$(shell make get-ip):/opt/ruptur/saas-new/
	@ssh -i $(SSH_KEY) $(USER)@$(shell make get-ip) "cd /opt/ruptur && \
		docker compose -f saas/docker-compose-fixed.yml down && \
		mv saas saas-old && mv saas-new saas && \
		cd saas && docker compose -f docker-compose-fixed.yml up -d --build"
	@echo "$(GREEN)Deploy Docker concluído!$(NC)"

logs: ## Exibe logs do container
	@ssh -i $(SSH_KEY) $(USER)@$(shell make get-ip) "docker logs saas-web -f"

status: ## Status do serviço
	@echo "$(BLUE)Status do SaaS em produção:$(NC)"
	@ssh -i $(SSH_KEY) $(USER)@$(shell make get-ip) "docker ps | grep saas-web"
	@curl -s https://app.ruptur.cloud/api/inbox/summary | jq .

restart: ## Reinicia o container
	@echo "$(BLUE)Reiniciando container...$(NC)"
	@ssh -i $(SSH_KEY) $(USER)@$(shell make get-ip) "cd /opt/ruptur/saas && docker compose restart"

# Testes
test-apis: ## Testa todas as APIs
	@echo "$(BLUE)Testando APIs...$(NC)"
	@echo "$(YELLOW)Inbox API:$(NC)"
	@curl -s https://app.ruptur.cloud/api/inbox/summary | jq . || echo "❌ Inbox API falhou"
	@echo "$(YELLOW)Campaigns API:$(NC)"
	@curl -s https://app.ruptur.cloud/api/campaigns | jq . || echo "❌ Campaigns API falhou"
	@echo "$(YELLOW)Health API:$(NC)"
	@curl -s https://app.ruptur.cloud/api/local/health | jq . || echo "❌ Health API falhou"
	@echo "$(GREEN)Testes concluídos!$(NC)"

test-health: ## Testa saúde do sistema
	@echo "$(BLUE)Verificando saúde do sistema...$(NC)"
	@curl -f https://app.ruptur.cloud/api/local/health > /dev/null && \
		echo "$(GREEN)✅ Sistema saudável!$(NC)" || \
		echo "$(RED)❌ Sistema com problemas!$(NC)"

# Infraestrutura
infra-apply: ## Aplica infraestrutura Terraform
	@echo "$(BLUE)Aplicando infraestrutura...$(NC)"
	@cd infra/terraform && terraform init && terraform apply -auto-approve
	@echo "$(GREEN)Infraestrutura aplicada!$(NC)"

infra-destroy: ## Destroi infraestrutura
	@echo "$(RED)Destruindo infraestrutura...$(NC)"
	@cd infra/terraform && terraform destroy -auto-approve
	@echo "$(YELLOW)Infraestrutura destruída!$(NC)"

ansible-deploy: ## Executa Ansible playbook
	@echo "$(BLUE)Executando Ansible...$(NC)"
	@cd infra/ansible && ansible-playbook -i inventories/production playbooks/deploy_saas_production.yml
	@echo "$(GREEN)Ansible concluído!$(NC)"

# Utilitários
get-ip: ## Obtém IP da instância de produção
	@gcloud compute instances describe $(INSTANCE_NAME) \
		--zone=$(ZONE) \
		--project=$(PROJECT_ID) \
		--format='get(networkInterfaces[0].accessConfigs[0].natIP)'

ssh: ## Conecta via SSH à instância
	@ssh -i $(SSH_KEY) $(USER)@$(shell make get-ip)

backup: ## Backup completo da aplicação
	@echo "$(BLUE)Criando backup...$(NC)"
	@ssh -i $(SSH_KEY) $(USER)@$(shell make get-ip) "cd /opt/ruptur && \
		tar -czf saas-backup-$(shell date +%Y%m%d-%H%M%S).tar.gz saas/"
	@echo "$(GREEN)Backup criado!$(NC)"

restore-backup: ## Restaura backup (parâmetro: BACKUP_FILE)
	@if [ -z "$(BACKUP_FILE)" ]; then echo "$(RED)Especifique BACKUP_FILE=$(NC)"; exit 1; fi
	@echo "$(BLUE)Restaurando backup $(BACKUP_FILE)...$(NC)"
	@scp -i $(SSH_KEY) $(BACKUP_FILE) $(USER)@$(shell make get-ip):/tmp/
	@ssh -i $(SSH_KEY) $(USER)@$(shell make get-ip) "cd /opt/ruptur && \
		tar -xzf /tmp/$(shell basename $(BACKUP_FILE)) && \
		docker compose -f saas/docker-compose-fixed.yml up -d --build"
	@echo "$(GREEN)Backup restaurado!$(NC)"

# Monitoramento
monitor: ## Abre dashboard de monitoramento
	@echo "$(BLUE)Abrindo monitoramento...$(NC)"
	@open https://app.ruptur.cloud/warmup
	@open https://app.ruptur.cloud/api/local/health

# CI/CD - Validação Local
ci-lint: ## Valida sintaxe de código
	@echo "$(BLUE)Executando lint...$(NC)"
	@npm run lint
	@echo "$(GREEN)Lint OK!$(NC)"

ci-test: ## Executa testes unitários
	@echo "$(BLUE)Executando testes...$(NC)"
	@npm test -- --runInBand
	@echo "$(GREEN)Testes OK!$(NC)"

ci-quality: ## Valida qualidade (lint + test + build)
	@echo "$(BLUE)Executando quality gate...$(NC)"
	@npm run quality
	@echo "$(GREEN)Quality gate OK!$(NC)"

ci-coverage: ## Gera relatório de cobertura
	@echo "$(BLUE)Gerando cobertura...$(NC)"
	@npm run test:coverage
	@echo "$(YELLOW)Relatório em: coverage/lcov-report/index.html$(NC)"

ci: ci-lint ci-test ci-quality ci-coverage ## Pipeline completo de CI (local)
	@echo "$(GREEN)✅ Toda validação passou! Pronto para push.$(NC)"

ci-audit: ## Security audit
	@echo "$(BLUE)Executando security audit...$(NC)"
	@npm audit --audit-level moderate
	@echo "$(GREEN)Audit OK!$(NC)"

cd: ## Pipeline completo de CD
	@echo "$(BLUE)Executando pipeline CD...$(NC)"
	@make deploy-prod
	@make test-health
	@echo "$(GREEN)CD concluído!$(NC)"

# Setup inicial
setup: ## Configura ambiente inicial
	@echo "$(BLUE)Configurando ambiente...$(NC)"
	@mkdir -p infra/{terraform,ansible}
	@mkdir -p logs
	@mkdir -p backups
	@echo "$(GREEN)Ambiente configurado!$(NC)"
	@echo "$(YELLOW)Configure suas variáveis em .env$(NC)"

# Versionamento
version: ## Exibe versão atual
	@echo "$(BLUE)Ruptur SaaS v1.0.0$(NC)"
	@echo "$(YELLOW)Branch: $(shell git branch --show-current)$(NC)"
	@echo "$(YELLOW)Commit: $(shell git rev-parse --short HEAD)$(NC)"

# Segurança
security-scan: ## Escaneamento de segurança
	@echo "$(BLUE)Executando scan de segurança...$(NC)"
	@docker run --rm -v $(PWD):/app securecodewarrior/docker-security-scan /app
	@echo "$(GREEN)Scan concluído!$(NC)"
