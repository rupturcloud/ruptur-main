/**
 * SecretsService — Gerenciar credenciais de forma segura
 *
 * CRÍTICO: Nunca armazenar secrets em plaintext em runtime-data/
 * Sempre usar Supabase com RLS + auditoria
 *
 * Uso:
 * const secretsService = new SecretsService(supabase);
 * const uazToken = await secretsService.getSecret(tenantId, 'uazapi');
 */

export class SecretsService {
  constructor(supabase) {
    if (!supabase) {
      throw new Error('SecretsService requer cliente Supabase');
    }
    this.supabase = supabase;
  }

  /**
   * Recuperar secret (com auditoria automática)
   *
   * @param {String} tenantId - ID do tenant
   * @param {String} providerName - Nome do provedor ('uazapi', 'getnet', etc)
   * @returns {Promise<String>} Valor do secret
   * @throws {Error} Se usuário não autorizado ou secret não existe
   */
  async getSecret(tenantId, providerName) {
    if (!tenantId || !providerName) {
      throw new Error('tenantId e providerName obrigatórios');
    }

    try {
      const { data, error } = await this.supabase
        .rpc('get_provider_secret', {
          p_tenant_id: tenantId,
          p_provider_name: providerName.toLowerCase(),
        });

      if (error) {
        console.error(`[Secrets] Erro ao recuperar secret: ${error.message}`);
        throw new Error('Falha ao recuperar credencial segura');
      }

      if (!data || data.length === 0) {
        throw new Error(`Secret ${providerName} não encontrado para tenant ${tenantId}`);
      }

      return data[0].secret_value;
    } catch (err) {
      console.error(`[Secrets] ${err.message}`);
      throw err;
    }
  }

  /**
   * Armazenar ou atualizar secret
   *
   * IMPORTANTE: Apenas owners podem fazer isso
   *
   * @param {String} tenantId - ID do tenant
   * @param {String} providerName - Nome do provedor
   * @param {String} secretValue - Valor do secret
   * @param {String} secretLabel - Label amigável (opcional)
   * @returns {Promise<Object>} Objeto do secret criado
   */
  async setSecret(tenantId, providerName, secretValue, secretLabel = null) {
    if (!tenantId || !providerName || !secretValue) {
      throw new Error('tenantId, providerName e secretValue obrigatórios');
    }

    try {
      const { data, error } = await this.supabase
        .from('provider_secrets')
        .upsert({
          tenant_id: tenantId,
          provider_name: providerName.toLowerCase(),
          secret_value: secretValue,
          secret_label: secretLabel,
          rotated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,provider_name',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Falha ao armazenar secret: ${error.message}`);
      }

      return data;
    } catch (err) {
      console.error(`[Secrets] ${err.message}`);
      throw err;
    }
  }

  /**
   * Listar todos os secrets de um tenant (apenas owners)
   *
   * @param {String} tenantId - ID do tenant
   * @returns {Promise<Array>} Lista de secrets (sem valores)
   */
  async listSecrets(tenantId) {
    if (!tenantId) {
      throw new Error('tenantId obrigatório');
    }

    try {
      const { data, error } = await this.supabase
        .from('provider_secrets')
        .select('id, provider_name, provider_type, secret_label, is_active, rotated_at')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (error) {
        throw new Error(`Falha ao listar secrets: ${error.message}`);
      }

      return data || [];
    } catch (err) {
      console.error(`[Secrets] ${err.message}`);
      throw err;
    }
  }

  /**
   * Revogar/desativar um secret
   *
   * @param {String} secretId - ID do secret
   * @returns {Promise<Object>} Secret atualizado
   */
  async revokeSecret(secretId) {
    if (!secretId) {
      throw new Error('secretId obrigatório');
    }

    try {
      const { data, error } = await this.supabase
        .from('provider_secrets')
        .update({
          is_active: false,
        })
        .eq('id', secretId)
        .select()
        .single();

      if (error) {
        throw new Error(`Falha ao revogar secret: ${error.message}`);
      }

      return data;
    } catch (err) {
      console.error(`[Secrets] ${err.message}`);
      throw err;
    }
  }

  /**
   * Obter logs de acesso a um secret
   *
   * @param {String} secretId - ID do secret
   * @param {Number} limit - Número de logs (padrão: 50)
   * @returns {Promise<Array>} Logs de acesso
   */
  async getAccessLogs(secretId, limit = 50) {
    if (!secretId) {
      throw new Error('secretId obrigatório');
    }

    try {
      const { data, error } = await this.supabase
        .from('secret_access_logs')
        .select('*')
        .eq('secret_id', secretId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Falha ao recuperar logs: ${error.message}`);
      }

      return data || [];
    } catch (err) {
      console.error(`[Secrets] ${err.message}`);
      throw err;
    }
  }
}

export default SecretsService;
