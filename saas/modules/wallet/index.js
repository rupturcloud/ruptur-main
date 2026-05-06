/**
 * Wallet Module — Gestão de Créditos Multi-tenant
 *
 * Fonte de verdade: Supabase (tabelas tenants + wallet_transactions)
 * Funções: consultar saldo, debitar, creditar, histórico
 *
 * IMPORTANTE: Toda operação de débito faz verificação atômica
 * via RPC ou leitura + escrita no Supabase para evitar race conditions.
 */

import { EventPublisher } from '../notifications/event-publisher.js';

export class WalletManager {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} supabase
   */
  constructor(supabase) {
    this.supabase = supabase;
    // Cache leve em memória (read-only, invalidado em cada mutação)
    this._cache = new Map();
    this.CACHE_TTL = 15_000; // 15s
    this.LOW_BALANCE_THRESHOLD = 50; // Limiar para notificação de créditos baixos
    this.eventPublisher = new EventPublisher();
  }

  // ========================================================================
  //  Leitura
  // ========================================================================

  /**
   * Saldo atual do tenant
   * @param {string} tenantId
   * @returns {Promise<number>}
   */
  async getBalance(tenantId) {
    const cached = this._cache.get(tenantId);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) return cached.balance;

    const { data, error } = await this.supabase
      .from('tenants')
      .select('credits_balance')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error(`[Wallet] Erro ao consultar saldo de ${tenantId}:`, error.message);
      return cached?.balance ?? 0;
    }

    const balance = data.credits_balance ?? 0;
    this._cache.set(tenantId, { balance, ts: Date.now() });
    return balance;
  }

  /**
   * Verifica se o tenant tem créditos suficientes
   */
  async hasEnoughCredits(tenantId, required = 1) {
    const balance = await this.getBalance(tenantId);
    return balance >= required;
  }

  // ========================================================================
  //  Mutações (débito / crédito)
  // ========================================================================

  /**
   * Debitar créditos do tenant (ex: envio de mensagem)
   *
   * @param {string} tenantId
   * @param {number} amount - Quantidade de créditos a debitar
   * @param {Object} metadata - { description, campaignId, ... }
   * @returns {Promise<number>} Novo saldo
   */
  async deductCredit(tenantId, amount = 1, metadata = {}) {
    // 1. Leitura fresca (ignora cache) para garantir consistência
    const { data: tenant, error: readErr } = await this.supabase
      .from('tenants')
      .select('credits_balance')
      .eq('id', tenantId)
      .single();

    if (readErr || !tenant) {
      throw new Error(`Tenant ${tenantId} não encontrado`);
    }

    const currentBalance = tenant.credits_balance ?? 0;

    if (currentBalance < amount) {
      throw new Error(
        `Créditos insuficientes para tenant ${tenantId}. Necessário: ${amount}, Disponível: ${currentBalance}`
      );
    }

    const newBalance = currentBalance - amount;

    // 2. Atualizar saldo (condição otimista para evitar write stale)
    const { error: updateErr } = await this.supabase
      .from('tenants')
      .update({ credits_balance: newBalance })
      .eq('id', tenantId)
      .eq('credits_balance', currentBalance); // Otimistic lock

    if (updateErr) {
      throw new Error(`Falha ao debitar créditos: ${updateErr.message}`);
    }

    // 3. Registrar transação
    await this.supabase.from('wallet_transactions').insert({
      tenant_id: tenantId,
      type: 'debit',
      amount: -amount,
      balance_after: newBalance,
      source: metadata.source || 'campaign',
      description: metadata.description || 'Envio de mensagem',
      metadata: metadata.campaignId ? { campaign_id: metadata.campaignId } : undefined,
    });

    // Invalidar cache
    this._cache.delete(tenantId);

    console.log(`[Wallet] Débito: tenant=${tenantId} amount=${amount} newBalance=${newBalance}`);

    // Publicar notificação se saldo está baixo
    if (newBalance < this.LOW_BALANCE_THRESHOLD && newBalance + amount >= this.LOW_BALANCE_THRESHOLD) {
      await this._publishLowBalanceAlert(tenantId, newBalance);
    }

    return newBalance;
  }

  /**
   * Publicar alerta de saldo baixo
   * @private
   */
  async _publishLowBalanceAlert(tenantId, balance) {
    try {
      // Buscar informações do tenant para notificação
      const { data: tenant } = await this.supabase
        .from('tenants')
        .select('id, name')
        .eq('id', tenantId)
        .single();

      // Buscar primeiro admin do tenant para enviar notificação
      const { data: admin } = await this.supabase
        .from('tenants_users')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', 'owner')
        .limit(1)
        .single();

      if (admin) {
        const { data: user } = await this.supabase
          .from('auth.users')
          .select('id, email, user_metadata')
          .eq('id', admin.user_id)
          .single();

        if (user) {
          const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário';
          await this.eventPublisher.creditsLow(
            tenantId,
            { id: user.id, email: user.email, name: userName },
            balance,
            this.LOW_BALANCE_THRESHOLD
          );
        }
      }
    } catch (error) {
      console.warn(`[Wallet] Falha ao publicar alerta de saldo baixo: ${error.message}`);
      // Não falhar a operação de débito se a notificação falhar
    }
  }

  /**
   * Creditar créditos ao tenant (ex: compra, bonus, admin)
   *
   * @param {string} tenantId
   * @param {number} amount
   * @param {Object} opts - { source, description, paymentId }
   * @returns {Promise<number>} Novo saldo
   */
  async addCredits(tenantId, amount, opts = {}) {
    const { source = 'purchase', description = 'Recarga de créditos', paymentId } = opts;

    // 1. Ler saldo atual
    const { data: tenant, error: readErr } = await this.supabase
      .from('tenants')
      .select('credits_balance')
      .eq('id', tenantId)
      .single();

    if (readErr || !tenant) {
      throw new Error(`Tenant ${tenantId} não encontrado`);
    }

    const newBalance = (tenant.credits_balance ?? 0) + amount;

    // 2. Atualizar saldo
    const { error: updateErr } = await this.supabase
      .from('tenants')
      .update({ credits_balance: newBalance })
      .eq('id', tenantId);

    if (updateErr) {
      throw new Error(`Falha ao creditar: ${updateErr.message}`);
    }

    // 3. Registrar transação
    await this.supabase.from('wallet_transactions').insert({
      tenant_id: tenantId,
      type: 'credit',
      amount,
      balance_after: newBalance,
      source,
      description,
      metadata: paymentId ? { payment_id: paymentId } : undefined,
    });

    // Invalidar cache
    this._cache.delete(tenantId);

    console.log(`[Wallet] Crédito: tenant=${tenantId} amount=+${amount} newBalance=${newBalance}`);
    return newBalance;
  }

  // ========================================================================
  //  Histórico
  // ========================================================================

  /**
   * Histórico de transações do tenant
   */
  async getTransactions(tenantId, { limit = 50, offset = 0, type } = {}) {
    let query = this.supabase
      .from('wallet_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type && type !== 'ALL') {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`[Wallet] Erro ao buscar transações de ${tenantId}:`, error.message);
      return [];
    }

    return data || [];
  }

  // ========================================================================
  //  Stats agregadas
  // ========================================================================

  /**
   * Estatísticas de consumo (para dashboard)
   */
  async getStats(tenantId) {
    const balance = await this.getBalance(tenantId);

    // Total consumido (all-time)
    const { data: debits } = await this.supabase
      .from('wallet_transactions')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('type', 'debit');

    const totalConsumed = (debits || []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    // Consumo hoje
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayDebits } = await this.supabase
      .from('wallet_transactions')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('type', 'debit')
      .gte('created_at', todayStart.toISOString());

    const consumedToday = (todayDebits || []).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    return {
      balance,
      totalConsumed,
      consumedToday,
    };
  }
}

// Singleton — inicializado no gateway com supabase injetado
let _instance = null;

export function createWalletManager(supabase) {
  _instance = new WalletManager(supabase);
  return _instance;
}

export function getWalletManager() {
  if (!_instance) throw new Error('[Wallet] Manager não inicializado. Chame createWalletManager(supabase) primeiro.');
  return _instance;
}

export default WalletManager;
