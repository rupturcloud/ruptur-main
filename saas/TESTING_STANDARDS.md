# Testing Standards - Ruptur SaaS

## Visão Geral

Este documento define os padrões de testes e cobertura obrigatória para o projeto Ruptur SaaS.

## Thresholds Obrigatórios de Cobertura

Para garantir qualidade de código em produção, o projeto enforça os seguintes thresholds:

```javascript
coverageThreshold: {
  global: {
    branches: 60,      // Mínimo 60% de branches cobertos
    functions: 70,     // Mínimo 70% de funções testadas
    lines: 75,         // Mínimo 75% de linhas de código testadas
    statements: 75,    // Mínimo 75% de statements cobertos
  },
}
```

### Significado dos Thresholds

- **branches (60%)**: Garante que ramificações lógicas (if/else) são testadas
- **functions (70%)**: Garante que a maioria das funções tem cobertura
- **lines (75%)**: Garante que a maioria das linhas executáveis são testadas
- **statements (75%)**: Garante cobertura abrangente de código ativo

## Executando Testes

### Teste sem cobertura (mais rápido)
```bash
npm test
```

### Teste com cobertura (enforça thresholds)
```bash
npm test -- --coverage
```

### Rodar testes em modo watch
```bash
npm test -- --watch
```

## Estrutura de Testes

### Localização
- Testes devem estar em `tests/unit/` para testes unitários
- Testes de integração devem estar em `tests/integration/`

### Padrão de Nomes
- Nome do arquivo deve terminar com `.test.js`
- Exemplo: `user-management.service.test.js`

### Formato Recomendado
```javascript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import ServiceToTest from '../../path/to/service.js';

describe('ServiceName', () => {
  let service;

  beforeEach(() => {
    // Setup antes de cada teste
    service = new ServiceToTest(config);
  });

  describe('methodName', () => {
    test('deve fazer algo específico', async () => {
      // Arrange - Setup
      const input = { /* ... */ };
      
      // Act - Execução
      const result = await service.methodName(input);
      
      // Assert - Verificação
      expect(result).toBe(expected);
    });
  });
});
```

## Mocking Supabase

Para mockar corretamente as queries encadeadas do Supabase:

```javascript
// Criar um objeto totalmente chainável
const fromMock = jest.fn(() => {
  const chainable = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: jest.fn((cb) => cb({ data: mockData, error: null })),
  };
  return chainable;
});

jest.spyOn(service.client, 'from').mockImplementation(fromMock);
```

## Cobertura Obrigatória para Produção

Os thresholds enforçam que:
1. ✓ Nenhuma função em produção fica sem teste
2. ✓ Paths críticos são cobertos
3. ✓ Edge cases são testados
4. ✓ Tratamento de erros é validado

## Verificação de Cobertura

Para ver a cobertura detalhada:
```bash
npm test -- --coverage
```

Relatório HTML está disponível em: `coverage/lcov-report/index.html`

## Falha em Testes

Se a cobertura não atender aos thresholds:

```
FAIL: Coverage threshold not met
  Statements: 7.65% (required: 75%)
  Branches: 49.52% (required: 60%)
  Functions: 27.97% (required: 70%)
  Lines: 7.65% (required: 75%)
```

**Solução**: Adicionar testes ou aumentar incrementalmente a cobertura.

## Checklist de Novo Teste

- [ ] Arquivo em `tests/unit/`
- [ ] Nome termina com `.test.js`
- [ ] Imports corretos de `@jest/globals`
- [ ] Describe/test com nomes descritivos em pt-BR
- [ ] Mock de dependências externas (Supabase, etc)
- [ ] Cobertura de happy path
- [ ] Cobertura de error path
- [ ] Setup/teardown com beforeEach/afterEach se necessário
- [ ] Verificação do coverage após adicionar testes

## CI/CD Integration

O teste de cobertura é executado em CI/CD e falhará se:
- Qualquer threshold não for atendido
- Testes não passarem

Garantir que `npm test -- --coverage` passa antes de fazer push.

## Referências

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Coverage Thresholds](https://jestjs.io/docs/configuration#coveragethreshold-object)
- [Mocking Best Practices](https://jestjs.io/docs/manual-mocks)
