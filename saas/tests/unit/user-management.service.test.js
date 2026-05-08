/**
 * Unit Tests: UserManagementService
 * Jest - Testa cada método isoladamente com mocks
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import UserManagementService from '../../modules/users/user-management.service.js';

// Criar um builder de query mock que é chainável
function createMockQueryBuilder(responseData = { data: null, error: null }) {
  return {
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    then: jest.fn((onFulfill) => Promise.resolve(responseData).then(onFulfill)),
    catch: jest.fn().mockReturnThis(),
    [Symbol.toStringTag]: 'Promise',
  };
}

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table) => createMockQueryBuilder()),
  })),
}));

describe('UserManagementService', () => {
  let service;

  beforeEach(() => {
    service = new UserManagementService(
      'http://localhost:54321',
      'test-key'
    );
  });

  // ===== TESTS: addUserToTenant =====

  describe('addUserToTenant', () => {
    test('deve adicionar usuário com role=member', async () => {
      const mockData = {
        id: 'role-123',
        tenant_id: 'tenant-123',
        user_id: 'user-456',
        role: 'member',
        status: 'active',
      };

      jest
        .spyOn(service.client, 'from')
        .mockReturnValue({
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        });

      const result = await service.addUserToTenant('tenant-123', 'user-456', 'member');

      expect(result).toEqual(mockData);
      expect(result.status).toBe('active');
    });

    test('deve validar mínimo 1 admin', async () => {
      // Mock: nenhum admin ativo
      jest
        .spyOn(service, '_countActiveAdmins')
        .mockResolvedValue(0);

      await expect(
        service.addUserToTenant('tenant-123', 'user-456', 'admin')
      ).rejects.toThrow('Tenant must have at least one admin');
    });

    test('deve enforçar rate limit (máx 10/min)', async () => {
      const key = `add_user:tenant-123`;

      // Simular 10 requisições
      for (let i = 0; i < 10; i++) {
        service.rateLimiter.allow(key, 10, 60);
      }

      // 11ª deve falhar
      const allowed = service.rateLimiter.allow(key, 10, 60);
      expect(allowed).toBe(false);
    });
  });

  // ===== TESTS: removeUserFromTenant =====

  describe('removeUserFromTenant', () => {
    test('deve soft-delete usuário', async () => {
      const mockData = {
        id: 'role-123',
        status: 'inactive',
        deleted_at: '2026-05-07T12:00:00Z',
        deleted_by: 'admin-123',
      };

      jest
        .spyOn(service.client, 'from')
        .mockReturnValue({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        });

      const result = await service.removeUserFromTenant(
        'tenant-123',
        'user-456',
        'admin-123'
      );

      expect(result.status).toBe('inactive');
      expect(result.deleted_at).toBeDefined();
    });

    test('não deve permitir remover último admin', async () => {
      jest
        .spyOn(service, '_getUserRole')
        .mockResolvedValue('admin');

      jest
        .spyOn(service, '_countActiveAdmins')
        .mockResolvedValue(1);

      await expect(
        service.removeUserFromTenant('tenant-123', 'user-456', 'admin-123')
      ).rejects.toThrow('Cannot remove last admin from tenant');
    });

    test('deve enforçar rate limit (máx 5/min)', async () => {
      const key = `remove_user:tenant-123`;

      // Simular 5 requisições
      for (let i = 0; i < 5; i++) {
        service.rateLimiter.allow(key, 5, 60);
      }

      // 6ª deve falhar
      const allowed = service.rateLimiter.allow(key, 5, 60);
      expect(allowed).toBe(false);
    });
  });

  // ===== TESTS: changeUserRole =====

  describe('changeUserRole', () => {
    test('deve mudar role e invalidar token', async () => {
      const mockData = {
        id: 'role-123',
        role: 'admin',
        token_invalidated_at: '2026-05-07T12:00:00Z',
      };

      jest
        .spyOn(service.client, 'from')
        .mockReturnValue({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        });

      const result = await service.changeUserRole(
        'tenant-123',
        'user-456',
        'admin',
        'admin-123'
      );

      expect(result.role).toBe('admin');
      expect(result.token_invalidated_at).toBeDefined();
    });

    test('deve validar role válido', async () => {
      await expect(
        service.changeUserRole('tenant-123', 'user-456', 'superadmin', 'admin-123')
      ).rejects.toThrow('Invalid role');
    });

    test('deve validar mínimo 1 admin ao remover admin', async () => {
      // Mock para contar admins ativos
      jest
        .spyOn(service, '_countActiveAdmins')
        .mockResolvedValue(1);

      // Mock para obter role do usuário
      jest
        .spyOn(service, '_getUserRole')
        .mockResolvedValue('admin');

      await expect(
        service.changeUserRole('tenant-123', 'user-456', 'member', 'admin-123')
      ).rejects.toThrow('Cannot remove last admin from tenant');
    }, 10000);
  });

  // ===== TESTS: suspendUser =====

  describe('suspendUser', () => {
    test('deve suspender usuário (não deletar)', async () => {
      const mockData = {
        id: 'role-123',
        status: 'suspended',
        metadata: { suspended_reason: 'Performance issue' },
      };

      jest
        .spyOn(service.client, 'from')
        .mockReturnValue({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        });

      const result = await service.suspendUser('tenant-123', 'user-456', 'Performance issue');

      expect(result.status).toBe('suspended');
      expect(result.metadata.suspended_reason).toBe('Performance issue');
    });
  });

  // ===== TESTS: listTenantUsers =====

  describe('listTenantUsers', () => {
    test('deve listar apenas usuários ativos', async () => {
      const mockUsers = [
        { id: '1', user_id: 'user-1', status: 'active', role: 'admin' },
        { id: '2', user_id: 'user-2', status: 'active', role: 'member' },
      ];

      // Mock que retorna um objeto totalmente chainável
      const fromMock = jest.fn(() => {
        const chainable = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn((cb) => cb({ data: mockUsers, error: null })),
        };
        return chainable;
      });

      jest.spyOn(service.client, 'from').mockImplementation(fromMock);

      const result = await service.listTenantUsers('tenant-123');

      expect(result).toHaveLength(2);
      expect(result.every((u) => u.status === 'active')).toBe(true);
    });

    test('deve filtrar por role se especificado', async () => {
      const mockAdmins = [
        { id: '1', user_id: 'user-1', status: 'active', role: 'admin' },
      ];

      const fromMock = jest.fn(() => {
        const chainable = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn((cb) => cb({ data: mockAdmins, error: null })),
        };
        return chainable;
      });

      jest.spyOn(service.client, 'from').mockImplementation(fromMock);

      const result = await service.listTenantUsers('tenant-123', { role: 'admin' });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('admin');
    });

    test('deve incluir usuários inativos se solicitado', async () => {
      const allUsers = [
        { id: '1', user_id: 'user-1', status: 'active', role: 'admin' },
        { id: '2', user_id: 'user-2', status: 'inactive', role: 'member' },
      ];

      const fromMock = jest.fn(() => {
        const chainable = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: jest.fn((cb) => cb({ data: allUsers, error: null })),
        };
        return chainable;
      });

      jest.spyOn(service.client, 'from').mockImplementation(fromMock);

      const result = await service.listTenantUsers('tenant-123', { includeInactive: true });

      expect(result).toHaveLength(2);
      expect(result.some((u) => u.status === 'inactive')).toBe(true);
    });
  });

  // ===== TESTS: Rate Limiter =====

  describe('RateLimiter', () => {
    test('deve permitir requisições dentro do limite', () => {
      const key = 'test:123';
      const limit = 5;
      const window = 60;

      for (let i = 0; i < limit; i++) {
        expect(service.rateLimiter.allow(key, limit, window)).toBe(true);
      }
    });

    test('deve bloquear após exceder limite', () => {
      const key = 'test:456';
      const limit = 3;
      const window = 60;

      // Permitir 3
      for (let i = 0; i < limit; i++) {
        service.rateLimiter.allow(key, limit, window);
      }

      // 4ª deve ser bloqueada
      expect(service.rateLimiter.allow(key, limit, window)).toBe(false);
    });

    test('deve resetar após expiração da janela', (done) => {
      const key = 'test:789';
      const limit = 1;
      const window = 1; // 1 segundo

      // Primeira requisição deve passar
      expect(service.rateLimiter.allow(key, limit, window)).toBe(true);

      // Segunda deve falhar
      expect(service.rateLimiter.allow(key, limit, window)).toBe(false);

      // Após 1.1 segundos, deve resetar
      setTimeout(() => {
        expect(service.rateLimiter.allow(key, limit, window)).toBe(true);
        done();
      }, 1100);
    });
  });
});
