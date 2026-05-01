/**
 * Tenant Service — Provisioning automático
 *
 * Cria tenant + user no Supabase quando um novo usuário se cadastra.
 * Chamado pelo endpoint POST /api/tenants/provision
 */

class TenantService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Gera slug URL-safe a partir do nome do negócio
   */
  generateSlug(name) {
    return name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  }

  /**
   * Garante que o slug seja único adicionando sufixo numérico se necessário
   */
  async ensureUniqueSlug(baseSlug) {
    let slug = baseSlug;
    let attempt = 0;

    while (true) {
      const { data } = await this.supabase
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .single();

      if (!data) return slug; // Slug disponível

      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }
  }

  /**
   * Provisiona um novo tenant completo
   * @param {string} userId - ID do auth.users
   * @param {string} email - Email do usuário
   * @param {string} tenantName - Nome do negócio
   * @returns {Object} tenant criado
   */
  async provision(userId, email, tenantName) {
    const baseSlug = this.generateSlug(tenantName || email.split('@')[0]);
    const slug = await this.ensureUniqueSlug(baseSlug);

    // 1. Criar o tenant
    const { data: tenant, error: tenantError } = await this.supabase
      .from('tenants')
      .insert({
        slug,
        name: tenantName || email.split('@')[0],
        email,
        plan: 'trial',
        credits_balance: 50,   // Trial grátis
        monthly_credits: 0,
        max_instances: 1,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (tenantError) {
      console.error('[TenantService] Erro ao criar tenant:', tenantError);
      throw tenantError;
    }

    // 2. Vincular user ao tenant
    const { error: userError } = await this.supabase
      .from('users')
      .insert({
        id: userId,
        tenant_id: tenant.id,
        email,
        role: 'owner',
      });

    if (userError) {
      console.error('[TenantService] Erro ao vincular user:', userError);
      // Rollback: deletar tenant
      await this.supabase.from('tenants').delete().eq('id', tenant.id);
      throw userError;
    }

    // 3. Criar membership
    await this.supabase.from('user_tenant_memberships').insert({
      user_id: userId,
      tenant_id: tenant.id,
      role: 'owner',
    });

    // 4. Registrar créditos de trial na wallet
    await this.supabase.from('wallet_transactions').insert({
      tenant_id: tenant.id,
      type: 'bonus',
      amount: 50,
      balance_after: 50,
      source: 'trial',
      description: 'Créditos de boas-vindas (trial)',
    });

    console.log(`[TenantService] Tenant provisionado: ${slug} (${tenant.id})`);
    return tenant;
  }

  /**
   * Buscar tenant do usuário logado
   */
  async getByUserId(userId) {
    const { data, error } = await this.supabase
      .from('users')
      .select('tenant_id, role, tenants(*)')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data?.tenants ? { ...data.tenants, userRole: data.role } : null;
  }

  /**
   * Buscar todos os tenants (admin)
   */
  async listAll(search = '') {
    let query = this.supabase
      .from('tenants')
      .select('*, users(email, role)')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    const { data } = await query;
    return data || [];
  }
}

export default TenantService;
