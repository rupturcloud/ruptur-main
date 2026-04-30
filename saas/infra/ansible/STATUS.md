# Status — Migração Operacional Jarvis

Atualizado em: 2026-04-12

## Estado real agora — pós-preservação e pós-rebuild da KVM2

> Nota de pivot: a KVM2 permanece documentada aqui como histórico/preservação. As novas frentes operacionais canônicas passam a mirar o Ruptur Cloud Lab / GCP dentro do Estaleiro.

### KVM2

A KVM2 **já não está mais na fase de risco pré-export** descrita abaixo. O estado atual validado é:

- legado preservado no cofre da `oracle-test`
- limpeza destrutiva já executada
- rebuild mínimo já concluído
- Ollama local ativo no host
- Jarvis novo no ar com provider `ollama`

Estado operacional confirmado:

- host com ~`72G` livres
- `ollama version 0.20.5`
- modelo local `qwen3:4b`
- `jarvis-agent` saudável
- porta publicada `3010 -> 3000`
- checks `healthz`, `readyz` e `statusz` positivos
- provider ativo:
  - `CORE_PROVIDER=ollama`
  - `ROUTER_PROVIDER=ollama`
  - `OLLAMA_BASE_URL=http://host.docker.internal:11434/v1`
  - `OLLAMA_MODEL=qwen3:4b`

### Preservação canônica fora da KVM2

No cofre da `oracle-test` permanecem preservados:

- `kvm2_ruptur_db_data_final`
- `kvm2_baileys_data_final`
- `jarvis_data_final`
- `n8n_n8n_data_consistent`
- `langfuse_langfuse_clickhouse_data_consistent`
- `langfuse_langfuse_postgres_data`
- `langfuse_langfuse_minio_data`
- `kvm2_traefik_letsencrypt`
- `kvm2_warmup_runtime_data`
- restore-kit de configs/envs

Capacidade observada no cofre:

- `raw` ≈ `1.5G`
- `restore-kit` ≈ `12K`

### Leitura canônica

Conclusão atual:

**a KVM2 foi preservada, abatida com segurança e reerguida com core mínimo local-first.**

O próximo trabalho deixou de ser “preservar antes de destruir” e passou a ser:

1. canonizar este estado em documentação permanente;
2. decidir quais camadas voltam em seguida;
3. tratar Oracle/Terraform e serviços adicionais em nova fase controlada.

## Decisão de ferramental

### Ansible
Usado para:

- inventário de hosts
- preflight de conectividade
- preparação das Oracle como staging bruto
- export da KVM2
- bootstrap futuro de KVM2/Mac/Oracle
- instalação e configuração de serviços

### Terraform
Usado para:

- provisionar/reprovisionar Oracle
- criar/destruir VMs e recursos cloud
- manter o estado declarativo da infraestrutura

## Estado confirmado até agora

### KVM2
Tem estado persistente fora do Git:

- `kvm2_ruptur_db_data` (~616M)
- `kvm2_baileys_data` (~32M)
- `kvm2_traefik_letsencrypt` (~56K)
- `kvm2_warmup_runtime_data` (~12K)
- `kvm2_whisper_models` (~4K)
- `n8n_n8n_data` (~179M)
- `langfuse_langfuse_postgres_data` (~44M)
- `langfuse_langfuse_clickhouse_data` (~2.0G)
- `langfuse_langfuse_minio_data` (~224K)
- `/root/J.A.R.V.I.S./data` (~236K)

Conclusão:

**não é seguro destruir a KVM2 sem exportar antes.**

### Oracle

- `oracle-prod`:
  - ~9.9G livres
  - contém estado Docker legado do host2
- `oracle-test`:
  - ~40G livres
  - escolhida como staging principal do bruto da KVM2

### Terraform Oracle

Plano atual observado:

- 1 instância já gerenciada em state: `oci_core_instance.vps_x86_1`
- plano propõe criar:
  - `vps_x86_2`
  - `vps_arm_high`

Conclusão:

**o Terraform está com drift parcial; não deve ser usado de forma destrutiva antes da preservação dos dados.**

## O que vai para o Git

Pode ir para o Git:

- playbooks Ansible
- inventários
- documentação de migração
- manifesto de export
- checksums
- scripts de restore/rebuild
- trilha de reconstrução

Não vai para o Git:

- dumps de banco
- volumes Docker
- certificados
- sessões do Baileys
- credenciais do n8n
- `.env`
- dados brutos de cliente
- bruto exportado da KVM2

## Ordem segura

1. Exportar KVM2 para `oracle-test`
2. Validar manifest/checksum
3. Exportar também o estado útil das Oracle, se necessário
4. Só então decidir destruição/reprovisionamento Oracle
5. Só então destruir/limpar KVM2
6. Reerguer KVM2 com Ollama + Jarvis Core mínimo
