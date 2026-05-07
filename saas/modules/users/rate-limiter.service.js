/**
 * RateLimiter
 * In-memory rate limiter com sliding window
 * Para usar com Redis em produção, estender esta classe
 */

class RateLimiter {
  constructor() {
    this.counters = new Map();
  }

  /**
   * Verificar se uma ação é permitida
   * @param {string} key - Identificador único (ex: "send_invite:tenant_id")
   * @param {number} limit - Número máximo de ações permitidas
   * @param {number} windowSeconds - Janela de tempo em segundos
   * @returns {boolean} true se permitido, false se limite excedido
   */
  allow(key, limit, windowSeconds) {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    if (!this.counters.has(key)) {
      this.counters.set(key, { requests: [now], expiresAt: now + windowMs });
      return true;
    }

    const record = this.counters.get(key);

    // Limpar requisições antigas (fora da janela)
    record.requests = record.requests.filter(timestamp => now - timestamp < windowMs);

    // Verificar se atingiu limite
    if (record.requests.length >= limit) {
      return false;
    }

    // Adicionar nova requisição
    record.requests.push(now);

    // Auto-cleanup: remover chave expirada
    if (now > record.expiresAt) {
      record.expiresAt = now + windowMs;
    }

    return true;
  }

  /**
   * Obter contador atual de uma chave
   */
  getCount(key) {
    const record = this.counters.get(key);
    if (!record) return 0;

    const now = Date.now();
    return record.requests.filter(timestamp => now - timestamp < 60000).length;
  }

  /**
   * Limpar contadores expirados (executar periodicamente)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.counters.entries()) {
      if (now > record.expiresAt + 3600000) { // 1h além da expiração
        this.counters.delete(key);
      }
    }
  }
}

export default RateLimiter;
