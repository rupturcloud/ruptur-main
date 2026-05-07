/**
 * Middleware: Validação de Input com Zod
 *
 * CRÍTICO: Validar todos payloads contra schema antes de processar
 * Previne: SQL injection, XSS, type coercion attacks, etc
 *
 * Uso:
 * const schema = z.object({
 *   email: z.string().email(),
 *   amount: z.number().positive(),
 * });
 *
 * const body = await parseBodyWithValidation(req, schema);
 * if (!body.success) {
 *   return json(res, 400, { error: body.error });
 * }
 */

import { z } from 'zod';

/**
 * Parse e validar body com schema Zod
 *
 * @param {Object} req - Requisição HTTP
 * @param {z.ZodType} schema - Schema Zod para validação
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function parseBodyWithValidation(req, schema) {
  try {
    // Parse JSON
    let body = {};
    const chunks = [];
    const maxSize = 1_048_576; // 1MB
    let size = 0;

    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxSize) {
        return {
          success: false,
          error: 'Body excede limite de 1MB',
        };
      }
      chunks.push(chunk);
    }

    try {
      const raw = Buffer.concat(chunks).toString();
      body = JSON.parse(raw);
    } catch {
      return {
        success: false,
        error: 'JSON inválido',
      };
    }

    // Validar com Zod
    const result = await schema.parseAsync(body);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const formattedErrors = err.errors.map((e) => ({
        field: e.path.join('.') || 'root',
        message: e.message,
        code: e.code,
      }));

      return {
        success: false,
        error: 'Validação falhou',
        details: formattedErrors,
      };
    }

    return {
      success: false,
      error: err.message || 'Erro ao validar',
    };
  }
}

// ============================================================================
// SCHEMAS PREDEFINIDOS (reutilizáveis)
// ============================================================================

export const BillingSchemas = {
  checkout: z.object({
    tenantId: z.string().uuid('tenantId deve ser UUID válido'),
    packageId: z.string().min(1, 'packageId obrigatório'),
  }),

  subscribe: z.object({
    tenantId: z.string().uuid('tenantId deve ser UUID válido'),
    planId: z.string().min(1, 'planId obrigatório'),
  }),
};

export const ReferralSchemas = {
  claimCode: z.object({
    newTenantId: z.string().uuid('newTenantId deve ser UUID válido'),
  }),
};

export const TenantSchemas = {
  provision: z.object({
    userId: z.string().uuid().optional(),
    email: z.string().email('Email inválido'),
    tenantName: z.string().min(1, 'Nome obrigatório').max(100, 'Nome muito longo'),
  }),
};

export const WalletSchemas = {
  addCredits: z.object({
    tenantId: z.string().uuid('tenantId deve ser UUID válido'),
    amount: z.number().positive('Valor deve ser positivo').finite(),
    description: z.string().max(255, 'Descrição muito longa').optional(),
  }),

  addCreditsAuthenticated: z.object({
    amount: z.number().positive('Valor deve ser positivo').finite(),
    description: z.string().max(255, 'Descrição muito longa').optional(),
  }),

  deductCredits: z.object({
    tenantId: z.string().uuid('tenantId deve ser UUID válido'),
    amount: z.number().positive('Valor deve ser positivo').finite(),
    reason: z.string().max(255, 'Razão muito longa'),
  }),
};

export const AdminSchemas = {
  setAdminToken: z.object({
    adminToken: z.string().min(10, 'Token muito curto'),
  }),

  updateWarmupConfig: z.object({
    routines: z.array(
      z.object({
        id: z.string(),
        name: z.string().max(100),
        isActive: z.boolean().optional(),
        mode: z.enum(['warmup', 'send', 'pause']).optional(),
      })
    ).optional(),
    settings: z.record(z.any()).optional(),
  }),
};

export const InboxSchemas = {
  sendMessage: z.object({
    recipient: z.string().min(1, 'Destinatário obrigatório').max(255),
    content: z.string().min(1, 'Conteúdo obrigatório').max(4096),
    type: z.enum(['text', 'media', 'template']).optional(),
  }),

  initializeInstance: z.object({
    // No specific body required, uses path parameter
  }),

  markAsRead: z.object({
    // No specific body required, uses path parameters
  }),
};

export const PlatformAdminSchemas = {
  invite: z.object({
    email: z.string().email('Email inválido'),
  }),

  acceptInvite: z.object({
    token: z.string().min(1, 'Token obrigatório'),
    userId: z.string().uuid('userId deve ser UUID válido'),
    email: z.string().email('Email inválido'),
  }),

  remove: z.object({
    adminId: z.string().uuid('adminId deve ser UUID válido'),
  }),
};

/**
 * Middleware helper para endpoints
 *
 * Uso em gateway.mjs:
 * ```
 * const validation = await validateRequest(req, BillingSchemas.checkout);
 * if (!validation.success) {
 *   return json(res, 400, { error: validation.error, details: validation.details });
 * }
 * const { tenantId, packageId } = validation.data;
 * ```
 */
export async function validateRequest(req, schema) {
  return parseBodyWithValidation(req, schema);
}

export default {
  parseBodyWithValidation,
  validateRequest,
  BillingSchemas,
  ReferralSchemas,
  TenantSchemas,
  WalletSchemas,
  InboxSchemas,
  AdminSchemas,
  PlatformAdminSchemas,
};
