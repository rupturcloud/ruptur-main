/**
 * Status mapping centralizado — Ruptur SaaS
 * Único fonte de verdade para labels, cores e estilos de status
 */

export const STATUS_MAP = {
  // Tenants/Planos
  active: { label: 'Ativo', color: '#00ff88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)' },
  pending: { label: 'Pendente', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', border: 'rgba(255,170,0,0.3)' },
  suspended: { label: 'Suspenso', color: '#ff4466', bg: 'rgba(255,68,102,0.1)', border: 'rgba(255,68,102,0.3)' },
  cancelled: { label: 'Cancelado', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },

  // Instâncias/Conexões
  connected: { label: 'Conectada', color: '#00ff88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)' },
  disconnected: { label: 'Desconectada', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
  connecting: { label: 'Conectando', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', border: 'rgba(255,170,0,0.3)' },
  capacity_full: { label: 'Capacidade cheia', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', border: 'rgba(255,170,0,0.3)' },
  draining: { label: 'Drenando', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  disabled: { label: 'Desativada', color: '#ff4466', bg: 'rgba(255,68,102,0.1)', border: 'rgba(255,68,102,0.3)' },
  expired: { label: 'Expirada', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },

  // Campanhas/Aquecimento
  draft: { label: 'Rascunho', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
  paused: { label: 'Pausado', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', border: 'rgba(255,170,0,0.3)' },
  archived: { label: 'Arquivado', color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)' },

  // Rastreamento/Ads
  testing: { label: 'Em teste', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },

  // Suporte
  open: { label: 'Aberto', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  in_progress: { label: 'Em andamento', color: '#ffaa00', bg: 'rgba(255,170,0,0.1)', border: 'rgba(255,170,0,0.3)' },
  resolved: { label: 'Resolvido', color: '#00ff88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.3)' },
  closed: { label: 'Fechado', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
};

export function getStatusLabel(status) {
  return STATUS_MAP[status]?.label || status || 'Indefinido';
}

export function getStatusStyle(status) {
  return STATUS_MAP[status] || STATUS_MAP.pending;
}
