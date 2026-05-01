/**
 * Wallet Module - Credit Management for Multi-tenancy
 * 
 * Handles balance checks, credit deductions, and transaction logging
 * Synchronizes with Bubble.io as the source of truth
 */

import BubbleClient from '../../integrations/bubble/client.js';

const bubbleClient = new BubbleClient();

export class WalletManager {
  constructor() {
    this.balanceCache = new Map(); // tenantId -> { balance, lastSync }
    this.CACHE_TTL = 30000; // 30 seconds cache for balance
  }

  /**
   * Get balance for a tenant
   * @param {string} tenantId 
   * @returns {Promise<number>}
   */
  async getBalance(tenantId) {
    try {
      const now = Date.now();
      const cached = this.balanceCache.get(tenantId);

      // Return cached balance if fresh
      if (cached && (now - cached.lastSync < this.CACHE_TTL)) {
        return cached.balance;
      }

      // Fetch from Bubble
      const response = await bubbleClient.getThings('Tenant', {
        constraints: [
          {
            key: 'tenant_id',
            constraint_type: 'equals',
            value: tenantId
          }
        ]
      });

      // Bubble returns results in a 'results' array or similar depending on the wrapper
      // Based on client.js, request returns the json response directly
      const tenants = response.response?.results || response.results || [];

      if (tenants.length === 0) {
        console.warn(`[Wallet] Tenant ${tenantId} not found in Bubble. Defaulting balance to 0.`);
        return 0;
      }

      const tenant = tenants[0];
      const balance = tenant.balance_credits || 0;
      
      this.balanceCache.set(tenantId, {
        balance,
        lastSync: now,
        bubbleId: tenant._id
      });

      return balance;
    } catch (error) {
      console.error(`[Wallet] Error getting balance for ${tenantId}:`, error.message);
      // Fallback to cache if available, even if stale
      return this.balanceCache.get(tenantId)?.balance || 0;
    }
  }

  /**
   * Check if tenant has enough credits
   * @param {string} tenantId 
   * @param {number} required 
   * @returns {Promise<boolean>}
   */
  async hasEnoughCredits(tenantId, required = 1) {
    const balance = await this.getBalance(tenantId);
    return balance >= required;
  }

  /**
   * Deduct credits from tenant
   * @param {string} tenantId 
   * @param {number} amount 
   * @param {Object} metadata Optional metadata (campaignId, etc)
   */
  async deductCredit(tenantId, amount = 1, metadata = {}) {
    try {
      // 1. Always verify current balance before deducting (ignore cache for security)
      const currentBalance = await this.getBalance(tenantId);
      
      if (currentBalance < amount) {
        throw new Error(`Insufficient credits for tenant ${tenantId}. Required: ${amount}, Available: ${currentBalance}`);
      }

      const cached = this.balanceCache.get(tenantId);
      const bubbleId = cached?.bubbleId;

      if (!bubbleId) {
        throw new Error(`Could not find Bubble ID for tenant ${tenantId}`);
      }

      // 2. Create transaction record in Bubble
      await bubbleClient.createThing('WalletTransaction', {
        tenant_id: tenantId,
        amount: -amount,
        type: 'debit',
        description: metadata.description || 'Campaign message send',
        campaign_id: metadata.campaignId,
        timestamp: new Date().toISOString()
      });

      // 3. Update Tenant balance in Bubble
      const newBalance = currentBalance - amount;
      await bubbleClient.updateThing('Tenant', bubbleId, {
        balance_credits: newBalance
      });

      // 4. Update local cache
      this.balanceCache.set(tenantId, {
        balance: newBalance,
        lastSync: Date.now(),
        bubbleId: bubbleId
      });

      return newBalance;
    } catch (error) {
      console.error(`[Wallet] Error deducting credit for ${tenantId}:`, error.message);
      throw error;
    }
  }

  /**
   * Add credits to tenant (e.g. from Admin or Payment)
   */
  async addCredits(tenantId, amount, description = 'Manual credit add') {
    try {
      const currentBalance = await this.getBalance(tenantId);
      const cached = this.balanceCache.get(tenantId);
      const bubbleId = cached?.bubbleId;

      if (!bubbleId) throw new Error(`Tenant ${tenantId} not found`);

      await bubbleClient.createThing('WalletTransaction', {
        tenant_id: tenantId,
        amount: amount,
        type: 'credit',
        description,
        timestamp: new Date().toISOString()
      });

      const newBalance = currentBalance + amount;
      await bubbleClient.updateThing('Tenant', bubbleId, {
        balance_credits: newBalance
      });

      this.balanceCache.set(tenantId, {
        balance: newBalance,
        lastSync: Date.now(),
        bubbleId: bubbleId
      });

      return newBalance;
    } catch (error) {
      console.error(`[Wallet] Error adding credits for ${tenantId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get transaction history for a tenant
   */
  async getTransactions(tenantId, limit = 50) {
    try {
      const response = await bubbleClient.getThings('WalletTransaction', {
        constraints: [
          {
            key: 'tenant_id',
            constraint_type: 'equals',
            value: tenantId
          }
        ],
        limit
      });
      return response.response?.results || response.results || [];
    } catch (error) {
      console.error(`[Wallet] Error getting transactions for ${tenantId}:`, error.message);
      return [];
    }
  }
}

export const walletManager = new WalletManager();
