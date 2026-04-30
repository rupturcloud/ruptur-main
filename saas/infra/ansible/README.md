# Ansible

Camada de configuração do host Debian e renderização do runtime em containers.

## Escopo da fase 1

- preparar host Debian 11
- instalar Docker Engine
- criar diretórios e redes do runtime
- renderizar compose/configuração para:
  - Traefik
  - Portainer
  - Postgres
  - Redis
  - n8n
  - MinIO

## Escopo adicional — Paperclip no GCP

- instalar o Paperclip CLI no host GCP já registrado como `shipyard`
- configurar serviço systemd persistente para o control plane
- usar Node.js 20 via NodeSource e `paperclipai` na versão travada
- bootstrap em `authenticated` com bind `lan` e `NODE_ENV=development` para funcionar em HTTP até o TLS ficar pronto
- playbook dedicado: `playbooks/paperclip_gcp.yml`
- role dedicada: `roles/paperclip/`

Se o deploy receber TLS/domínio depois, basta ajustar as variáveis do role para `NODE_ENV=production` e o modo de exposição final.

## Escopo adicional — AIOX no GCP

- expor `aiox.ruptur.cloud` como ponte de observabilidade e teste para o AIOX
- instalar e bootstrapar o AIOX no workspace dedicado do host GCP
- conectar o serviço ao Hermes/Ollama local do estaleiro
- publicar via Traefik em container dedicado com compose próprio
- playbook dedicado: `playbooks/aiox_gcp.yml`
- role dedicada: `roles/aiox/`

## Escopo adicional — Jarvis ADK no GCP

- reconciliar o runtime já residente em `/opt/ruptur/jarvis-v1`
- manter o `jarvis-agent.service` via `systemd`
- instalar dependências Python faltantes no venv (`litellm`, `asyncpg`)
- materializar sessão persistente do ADK em Postgres dedicado local ao host
- validar saúde do serviço e persistência de sessão após restart
- playbook dedicado: `playbooks/jarvis_gcp.yml`
- role dedicada: `roles/jarvis/`

> Observação: nesta fase o role do Jarvis assume **runtime já existente no host**.
> A origem/sincronização do source tree do `jarvis-v1` ainda é um débito separado.

## Escopo adicional — MagicRouteer no GCP

- preparar o scaffold do `magicrouteer` no host GCP do Estaleiro
- manter o padrão **GCP First + Ollama local**
- usar **Terraform** para provisionamento e **Ansible** para convergência
- materializar diretórios e contrato operacional local do serviço
- playbook dedicado: `playbooks/magicrouteer_gcp.yml`
- role dedicada: `roles/magicrouteer/`

## Escopo adicional — stack VPS/KVM2 via `ruptur-forge`

- manter `Temporal` e `Infisical` rodando no VPS `hostinger-kvm2`
- adicionar `Langfuse` e `Uptime Kuma` no mesmo plano operacional
- expor todos os serviços por subdomínio na Cloudflare e consolidar os segredos em um cofre único
- usar o Infisical como chaveiro canônico do Shipyard para segredos operacionais, tokens e chaves
- usar `adapters/ruptur-forge/` como camada IaC operacional para esse runtime
- tratar o segredo canônico como fonte externa; este repositório guarda o contrato e o bootstrap, não a verdade viva dos valores

## Contrato operacional

- `site.yml` prepara o host inteiro
- `shipyard_compose_autostart` é `false` por padrão
- segredos reais entram por override local em `inventories/production/group_vars/secrets.yml` ou extra-vars externos
- o playbook carrega `secrets.yml` explicitamente antes de renderizar os templates
- exemplos rastreáveis ficam em `examples/production/`, nunca em `group_vars/`
- Uazapi permanece fora da VM
