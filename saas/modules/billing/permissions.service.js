/**
 * PermissionsService — RBAC para Billing Multi-Tenant
 *
 * Gerencia:
 * - Verificação de permissões de billing por role
 * - Validação de limites de compra
 * - Obtenção de role do usuário
 *
 * Uso:
 * ```js
 * const permService = new PermissionsService(supabase);
 * await permService.requireBillingPermission(userId, tenantId, 'purchase');
 * ```
 */

export class PermissionsService {
  constructor(supabase) {
    this.db = supabase;
  }

  /**
   * Verificar se usuário tem permissão para ação de billing
   * @returns {Promise<boolean>}
   */
  async checkBillingPermission(userId, tenantId, action) {
    try {
      // Validar action
      const validActions = ['purchase', 'view', 'manage_subscription', 'refund'];
      if (!validActions.includes(action)) {
        throw new Error(`Invalid action: ${action}`);
      }

      // Buscar role do usuário
      const { data: userRole, error: roleError } = await this.db
        .from('user_tenant_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (roleError || !userRole) {
        console.warn(`User ${userId} has no role in tenant ${tenantId}`);
        return false;
      }

      // Buscar permissões do tenant
      const { data: permissions, error: permError } = await this.db
        .from('tenant_billing_permissions')
        .select(`${action}_allowed_roles`)
        .eq('tenant_id', tenantId)
        .single();

      if (permError || !permissions) {
        console.warn(`No billing permissions found for tenant ${tenantId}`);
        return false;
      }

      const allowedRoles = permissions[`${action}_allowed_roles`] || [];
      const hasPermission = allowedRoles.includes(userRole.role);

      return hasPermission;
    } catch (error) {
      console.error('Error checking billing permission:', error);
      return false;
    }
  }

  /**
   * Require permission, throw ForbiddenError se não autorizado
   * @throws {ForbiddenError}
   */
  async requireBillingPermission(userId, tenantId, action) {
    const hasPermission = await this.checkBillingPermission(userId, tenantId, action);

    if (!hasPermission) {
      const error = new Error(`User ${userId} not permitted to ${action} in tenant ${tenantId}`);
      error.name = 'ForbiddenError';
      error.statusCode = 403;
      throw error;
    }
  }

  /**
   * Obter role do usuário em um tenant
   * @returns {Promise<string|null>}
   */
  async getUserRole(userId, tenantId) {
    try {
      const { data, error } = await this.db
        .from('user_tenant_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.role;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  /**
   * Validar limites de compra
   * @returns {Promise<{allowed: boolean, requiresApproval: boolean, reason?: string}>}
   */
  async validatePurchaseLimit(tenantId, amountCents) {
    try {
      const { data, error } = await this.db
        .from('tenant_billing_permissions')
        .select('max_purchase_amount, require_approval_above')
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        // Sem configuração = permite, sem aprovação
        return { allowed: true, requiresApproval: false };
      }

      const amountBRL = amountCents / 100;
      const { max_purchase_amount, require_approval_above } = data;

      // Verificar limite máximo
      if (max_purchase_amount && amountBRL > max_purchase_amount) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Amount BRL ${amountBRL} exceeds max BRL ${max_purchase_amount}`
        };
      }

      // Verificar se requer aprovação
      const requiresApproval = require_approval_above && amountBRL > require_approval_above;

      return {
        allowed: true,
        requiresApproval,
        reason: requiresApproval ? `Amount BRL ${amountBRL} exceeds approval threshold BRL ${require_approval_above}` : undefined
      };
    } catch (error) {
      console.error('Error validating purchase limit:', error);
      return { allowed: true, requiresApproval: false };
    }
  }

  /**
   * Obter todas as permissões de billing de um tenant
   * @returns {Promise<Object>}
   */
  async getTenantBillingPermissions(tenantId) {
    try {
      const { data, error } = await this.db
        .from('tenant_billing_permissions')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        // Retornar defaults
        return {
          purchase_allowed_roles: ['owner', 'admin'],
          view_billing_allowed_roles: ['owner', 'admin', 'member'],
          manage_subscription_allowed_roles: ['owner', 'admin'],
          refund_allowed_roles: ['owner'],
          max_purchase_amount: null,
          require_approval_above: null
        };
      }

      return data;
    } catch (error) {
      console.error('Error getting tenant billing permissions:', error);
      return null;
    }
  }

  /**
   * Atualizar permissões de billing de um tenant (owner only)
   * @returns {Promise<Object>}
   */
  async updateTenantBillingPermissions(userId, tenantId, updates) {
    try {
      // Validar que é owner
      const role = await this.getUserRole(userId, tenantId);
      if (role !== 'owner') {
        throw new Error('Only tenant owner can update billing permissions');
      }

      const { data, error } = await this.db
        .from('tenant_billing_permissions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating tenant billing permissions:', error);
      throw error;
    }
  }
}

export default PermissionsService;
