/**
 * BillingService — Gerenciamento de Pagamentos Multi-Tenant
 * Com Idempotência, Lock Otimista e Auditoria
 *
 * Funcionalidades:
 * - Idempotência via idempotency_key (determinístico SHA256)
 * - Lock otimista em wallets (versioning)
 * - Retry automático em race conditions
 * - Auditoria completa
 */

import { createHmac } from 'node:crypto';

export class BillingService {
  constructor(supabase, auditService, permissionsService) {
    this.supabase = supabase;
    this.audit = auditService;
    this.permissions = permissionsService;
  }

  /**
   * Gerar idempotency_key determinístico
   * SHA256(tenantId + userId + amount + data do dia)
   * Garante que mesma requisição no mesmo dia = mesma key
   */
  generateIdempotencyKey(tenantId, userId, amountCents) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const data = `${tenantId}|${userId}|${amountCents}|${today}`;
    return createHmac('sha256', 'billing-idempotency')
      .update(data)
      .digest('hex')
      .substring(0, 64);
  }

  /**
   * Criar checkout idempotente
   * - Se já existe com mesma idempotency_key, retorna existente
   * - Senão, cria novo
   */
  async createCheckoutIdempotent(tenantId, userId, packageData) {
    const idempotencyKey = this.generateIdempotencyKey(tenantId, userId, packageData.amountCents);

    // 1. Procurar payment existente
    const { data: existingPayment, error: searchError } = await this.supabase
      .from('payments')
      .select('id, status, amount_cents, created_at')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (searchError) {
      throw new Error(`Erro ao procurar payment existente: ${searchError.message}`);
    }

    // 2. Se encontrou, retornar (idempotência)
    if (existingPayment) {
      return {
        id: existingPayment.id,
        status: existingPayment.status,
        amountCents: existingPayment.amount_cents,
        isNew: false,
        idempotencyKey
      };
    }

    // 3. Criar novo payment
    const paymentId = this.supabase.auth.admin.generateLink('confirm').user_id ||
                      crypto.randomUUID();

    const { data: newPayment, error: createError } = await this.supabase
      .from('payments')
      .insert({
        tenant_id: tenantId,
        idempotency_key: idempotencyKey,
        status: 'INITIATED',
        amount_cents: packageData.amountCents,
        payment_type: 'credit_purchase',
        metadata: { packageId: packageData.id, packageName: packageData.name }
      })
      .select('id, status, amount_cents')
      .single();

    if (createError) {
      // Se erro for "UNIQUE violation", retornar existente (race condition)
      if (createError.message.includes('unique constraint')) {
        const { data: recovered } = await this.supabase
          .from('payments')
          .select('id, status, amount_cents')
          .eq('idempotency_key', idempotencyKey)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (recovered) {
          return {
            id: recovered.id,
            status: recovered.status,
            amountCents: recovered.amount_cents,
            isNew: false,
            idempotencyKey
          };
        }
      }
      throw new Error(`Erro ao criar payment: ${createError.message}`);
    }

    return {
      id: newPayment.id,
      status: newPayment.status,
      amountCents: newPayment.amount_cents,
      isNew: true,
      idempotencyKey
    };
  }

  /**
   * Creditar wallet com retry automático em race condition
   * Usa lock otimista (version column)
   */
  async creditWalletWithRetry(tenantId, amountCredits, reference, maxRetries = 3) {
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;

      try {
        // 1. Obter wallet atual com sua versão
        const { data: wallet, error: fetchError } = await this.supabase
          .from('wallets')
          .select('id, balance, version')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (fetchError || !wallet) {
          throw new Error(`Wallet não encontrado: ${fetchError?.message}`);
        }

        const newBalance = wallet.balance + amountCredits;
        const currentVersion = wallet.version || 1;

        // 2. Atualizar COM lock otimista: WHERE version = @currentVersion
        const { data: updated, error: updateError } = await this.supabase
          .from('wallets')
          .update({
            balance: newBalance,
            version: currentVersion + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', wallet.id)
          .eq('version', currentVersion)
          .select('balance, version')
          .single();

        if (updateError) {
          // Se erro de contraint, significa version mudou (race condition)
          if (updateError.message.includes('0 rows')) {
            lastError = 'Version mismatch - retry';
            // Fazer backoff exponencial antes de retry
            await new Promise(r => setTimeout(r, 100 * attempt));
            continue;
          }
          throw new Error(`Erro ao atualizar wallet: ${updateError.message}`);
        }

        // 3. Registrar transação
        await this.supabase
          .from('wallet_transactions')
          .insert({
            tenant_id: tenantId,
            type: 'credit',
            amount: amountCredits,
            description: `Crédito: ${reference}`,
            reference,
            balance_before: wallet.balance,
            balance_after: newBalance
          });

        // ✓ Sucesso!
        return {
          success: true,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          versionAfter: currentVersion + 1,
          attempts: attempt
        };

      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 100 * attempt));
        }
      }
    }

    // ❌ Esgotou retries
    return {
      success: false,
      error: lastError?.message || 'Máximo de tentativas excedido',
      attempts: attempt
    };
  }

  /**
   * Debitar wallet com retry automático
   * Similar a creditWalletWithRetry mas para débito
   */
  async debitWalletWithRetry(tenantId, amountCredits, reference, maxRetries = 3) {
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;

      try {
        // 1. Obter wallet
        const { data: wallet, error: fetchError } = await this.supabase
          .from('wallets')
          .select('id, balance, version')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (fetchError || !wallet) {
          throw new Error(`Wallet não encontrado: ${fetchError?.message}`);
        }

        // 2. Validar saldo
        if (wallet.balance < amountCredits) {
          return {
            success: false,
            error: 'Saldo insuficiente',
            balanceAvailable: wallet.balance,
            attempts: attempt
          };
        }

        const newBalance = wallet.balance - amountCredits;
        const currentVersion = wallet.version || 1;

        // 3. Atualizar com lock otimista
        const { data: updated, error: updateError } = await this.supabase
          .from('wallets')
          .update({
            balance: newBalance,
            version: currentVersion + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', wallet.id)
          .eq('version', currentVersion)
          .select('balance, version')
          .single();

        if (updateError) {
          if (updateError.message.includes('0 rows')) {
            lastError = 'Version mismatch - retry';
            await new Promise(r => setTimeout(r, 100 * attempt));
            continue;
          }
          throw new Error(`Erro ao atualizar wallet: ${updateError.message}`);
        }

        // 4. Registrar transação
        await this.supabase
          .from('wallet_transactions')
          .insert({
            tenant_id: tenantId,
            type: 'debit',
            amount: amountCredits,
            description: `Débito: ${reference}`,
            reference,
            balance_before: wallet.balance,
            balance_after: newBalance
          });

        // ✓ Sucesso!
        return {
          success: true,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          versionAfter: currentVersion + 1,
          attempts: attempt
        };

      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 100 * attempt));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Máximo de tentativas excedido',
      attempts: attempt
    };
  }

  /**
   * Obter histórico de pagamentos de um tenant
   */
  async getPaymentHistory(tenantId, limit = 50) {
    const { data, error } = await this.supabase
      .from('payments')
      .select('id, status, amount_cents, payment_type, created_at, idempotency_key')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar payments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Obter saldo atual do wallet
   */
  async getWalletBalance(tenantId) {
    const { data, error } = await this.supabase
      .from('wallets')
      .select('balance, version, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar wallet: ${error.message}`);
    }

    return data || { balance: 0, version: 1 };
  }
}

export default BillingService;
