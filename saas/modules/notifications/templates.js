/**
 * Email Templates for Notifications
 * Markdown-based, renders to HTML
 */

export const TEMPLATES = {
  campaign_launched: {
    subject: '✅ Campanha disparada com sucesso',
    preview: 'Sua campanha foi enviada',
    render: (data) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; }
.container { max-width: 600px; margin: 0 auto; padding: 20px; }
.header { background: linear-gradient(135deg, #00ff88 0%, #00f2ff 100%); color: #000; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
.stat { display: inline-block; background: rgba(0,0,0,0.05); padding: 10px 15px; border-radius: 6px; margin: 5px; font-weight: bold; }
.button { background: #00f2ff; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 10px; }
.footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h2 style="margin: 0; font-size: 24px;">Campanha Disparada! 🚀</h2>
  </div>

  <p>Olá <strong>${data.userName}</strong>,</p>

  <p>Sua campanha <strong>"${data.campaignName}"</strong> foi disparada com sucesso!</p>

  <div>
    <span class="stat">${data.count} mensagens enviadas</span>
    <span class="stat">Horário: ${new Date().toLocaleString('pt-BR')}</span>
  </div>

  <p style="margin-top: 20px;">
    <a href="https://app.ruptur.cloud/campanhas" class="button">Ver Campanha</a>
  </p>

  <div class="footer">
    <p>© 2026 Ruptur Cloud. Automação de WhatsApp inteligente.</p>
    <p><a href="https://ruptur.cloud" style="color: #00f2ff; text-decoration: none;">ruptur.cloud</a></p>
  </div>
</div>
</body>
</html>
    `.trim(),
  },

  credits_low: {
    subject: '⚠️ Seus créditos estão baixos',
    preview: 'Você tem apenas alguns créditos restantes',
    render: (data) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; }
.container { max-width: 600px; margin: 0 auto; padding: 20px; }
.alert { background: rgba(255, 170, 0, 0.1); border-left: 4px solid #ffaa00; padding: 15px; border-radius: 4px; margin: 20px 0; }
.alert strong { color: #ff7a00; }
.button { background: #00f2ff; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 10px; }
.footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
</style></head>
<body>
<div class="container">
  <h2 style="color: #ffaa00;">Créditos Baixos</h2>

  <p>Olá <strong>${data.userName}</strong>,</p>

  <div class="alert">
    <p><strong>Atenção:</strong> Você tem apenas <strong>${data.balance} créditos</strong> restantes na sua conta.</p>
  </div>

  <p>Para continuar enviando campanhas, você precisa recarregar sua carteira.</p>

  <p style="margin-top: 20px;">
    <a href="https://app.ruptur.cloud/carteira" class="button">Recarregar Créditos</a>
  </p>

  <p style="color: #666; font-size: 14px;">Se você tiver dúvidas sobre preços ou precisar de um plano customizado, entre em contato conosco.</p>

  <div class="footer">
    <p>© 2026 Ruptur Cloud. Automação de WhatsApp inteligente.</p>
  </div>
</div>
</body>
</html>
    `.trim(),
  },

  payment_failed: {
    subject: '❌ Erro ao processar seu pagamento',
    preview: 'Não conseguimos processar seu pagamento',
    render: (data) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; }
.container { max-width: 600px; margin: 0 auto; padding: 20px; }
.error { background: rgba(255, 68, 102, 0.1); border-left: 4px solid #ff4466; padding: 15px; border-radius: 4px; margin: 20px 0; }
.button { background: #00f2ff; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 10px; }
.footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
</style></head>
<body>
<div class="container">
  <h2 style="color: #ff4466;">Erro no Pagamento</h2>

  <p>Olá <strong>${data.userName}</strong>,</p>

  <div class="error">
    <p><strong>Não conseguimos processar seu pagamento.</strong></p>
    <p>Motivo: <strong>${data.reason}</strong></p>
  </div>

  <p>Por favor, tente novamente ou use outro método de pagamento.</p>

  <p style="margin-top: 20px;">
    <a href="https://app.ruptur.cloud/carteira" class="button">Tentar Novamente</a>
  </p>

  <p style="color: #666; font-size: 14px;">Se o problema persistir, nossa equipe de suporte está aqui para ajudar.</p>

  <div class="footer">
    <p>© 2026 Ruptur Cloud. Automação de WhatsApp inteligente.</p>
  </div>
</div>
</body>
</html>
    `.trim(),
  },

  instance_disconnected: {
    subject: '⚠️ Sua instância desconectou',
    preview: 'Uma das suas instâncias perdeu a conexão',
    render: (data) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.6; }
.container { max-width: 600px; margin: 0 auto; padding: 20px; }
.warning { background: rgba(255, 170, 0, 0.1); border-left: 4px solid #ffaa00; padding: 15px; border-radius: 4px; margin: 20px 0; }
.button { background: #00f2ff; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 10px; }
.footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
</style></head>
<body>
<div class="container">
  <h2 style="color: #ffaa00;">Instância Desconectada</h2>

  <p>Olá <strong>${data.userName}</strong>,</p>

  <div class="warning">
    <p><strong>A instância "${data.instanceName}" desconectou</strong> da sua conta.</p>
    <p>Desconexão às: <strong>${new Date().toLocaleString('pt-BR')}</strong></p>
  </div>

  <p>Para reconectar sua instância, acesse o painel e digitalize o novo QR code.</p>

  <p style="margin-top: 20px;">
    <a href="https://app.ruptur.cloud/instancias" class="button">Reconectar Instância</a>
  </p>

  <p style="color: #666; font-size: 14px;">Enquanto a instância não for reconectada, seus disparos podem ser afetados.</p>

  <div class="footer">
    <p>© 2026 Ruptur Cloud. Automação de WhatsApp inteligente.</p>
  </div>
</div>
</body>
</html>
    `.trim(),
  },
};

export function getTemplate(type) {
  return TEMPLATES[type] || null;
}

export function renderTemplate(type, data) {
  const template = getTemplate(type);
  if (!template) throw new Error(`Template ${type} not found`);
  return {
    subject: template.subject,
    html: template.render(data),
  };
}
