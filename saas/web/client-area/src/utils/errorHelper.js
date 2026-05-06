/**
 * Error Helper — mapeie erros técnicos em mensagens amigáveis
 */

const ERROR_MESSAGES = {
  400: 'Verifique os dados fornecidos e tente novamente.',
  401: 'Sua sessão expirou. Faça login novamente.',
  403: 'Acesso negado. Você não possui permissão para essa ação.',
  404: 'Recurso não encontrado.',
  409: 'Conflito: esse recurso já existe ou está em uso.',
  413: 'Arquivo muito grande. Máximo 10MB.',
  422: 'Dados inválidos. Verifique e tente novamente.',
  429: 'Muitas requisições. Aguarde alguns segundos e tente novamente.',
  500: 'Erro no servidor. Tente novamente em alguns instantes.',
  502: 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.',
  503: 'Serviço em manutenção. Volte em poucos minutos.',
};

const CONTEXT_MESSAGES = {
  'campaign': {
    400: 'Verifique se o nome da campanha e a mensagem estão preenchidos.',
    422: 'A campanha não pode ser criada. Verifique os parâmetros.',
    insufficient_credits: 'Créditos insuficientes para disparar essa campanha. Recarregue sua carteira.',
  },
  'instance': {
    400: 'Informe um nome para a instância.',
    422: 'Não conseguimos conectar a instância. Verifique o QR code ou tente novamente.',
    connection_timeout: 'A conexão expirou. Tente escanear o QR code novamente.',
  },
  'wallet': {
    422: 'Erro ao processar o pagamento. Verifique seus dados bancários e tente novamente.',
    insufficient_balance: 'Saldo insuficiente. Recarregue sua carteira.',
  },
  'warmup': {
    422: 'Não conseguimos sincronizar as configurações. Tente novamente.',
    invalid_config: 'Configuração inválida. Verifique os parâmetros.',
  },
  'admin': {
    403: 'Apenas superadmins podem acessar esse recurso.',
    422: 'Erro ao salvar. Verifique todos os campos obrigatórios.',
  },
};

export function formatError(error, context = '') {
  // Se já é string, retorna
  if (typeof error === 'string') {
    return error;
  }

  // Extrair status HTTP do erro
  const status = error?.status || error?.response?.status;

  // Tentar usar mensagem específica do contexto primeiro
  if (context && CONTEXT_MESSAGES[context]) {
    const contextMsg = CONTEXT_MESSAGES[context][error?.code || status];
    if (contextMsg) return contextMsg;
  }

  // Fallback para status HTTP
  if (status && ERROR_MESSAGES[status]) {
    return ERROR_MESSAGES[status];
  }

  // Usar mensagem customizada do erro se houver
  if (error?.message) {
    return error.message;
  }

  // Último recurso
  return 'Algo deu errado. Tente novamente ou contate o suporte.';
}

export function showError(error, context = '') {
  const message = formatError(error, context);
  console.error('[Error]', { error, context, formatted: message });
  return message;
}
