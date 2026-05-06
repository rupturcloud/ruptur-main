import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
  }
  return supabase;
}

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const TEMPLATES = {
  campaign_launched: {
    subject: 'Campanha Disparada com Sucesso',
    getHtml: (payload) => `
      <h2>Campanha Disparada!</h2>
      <p>Olá ${payload.userName},</p>
      <p>Sua campanha <strong>${payload.campaignName}</strong> foi disparada com sucesso!</p>
      <p>Mensagens enviadas: <strong>${payload.count}</strong></p>
      <p>ID da campanha: ${payload.campaignId}</p>
    `,
  },
  credits_low: {
    subject: 'Aviso: Saldo de Créditos Baixo',
    getHtml: (payload) => `
      <h2>Saldo de Créditos Baixo</h2>
      <p>Olá ${payload.userName},</p>
      <p>Seu saldo de créditos está abaixo do limite: <strong>${payload.currentBalance} créditos</strong></p>
      <p>Limite: ${payload.threshold} créditos</p>
      <p><a href="${payload.topUpUrl}">Recarregar Créditos</a></p>
    `,
  },
  payment_failed: {
    subject: 'Falha no Pagamento',
    getHtml: (payload) => `
      <h2>Pagamento Rejeitado</h2>
      <p>Olá ${payload.userName},</p>
      <p>Sua tentativa de pagamento foi rejeitada.</p>
      <p>Motivo: ${payload.failureReason}</p>
      <p><a href="${payload.retryUrl}">Tentar Novamente</a></p>
    `,
  },
};

async function logNotification(payload, status, errorMessage = null) {
  try {
    const sb = getSupabase();
    await sb.from('notification_logs').insert({
      tenant_id: payload.tenantId,
      user_id: payload.userId,
      event_id: payload.eventId,
      event_type: payload.type,
      channel: 'email',
      payload: payload,
      status: status,
      error_message: errorMessage,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    });
  } catch (error) {
    console.error('[Logger] Error logging notification:', error.message);
  }
}

async function sendEmail(toEmail, templateKey, payload) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log('[Email] SendGrid not configured, skipping email');
    return null;
  }

  const template = TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Template not found: ${templateKey}`);
  }

  const msg = {
    to: toEmail,
    from: 'notifications@ruptur.cloud',
    subject: template.subject,
    html: template.getHtml(payload),
  };

  try {
    await sgMail.send(msg);
    console.log(`[Email] Sent to ${toEmail}`);
    return 'sent';
  } catch (error) {
    console.error('[Email] Error sending email:', error.message);
    throw error;
  }
}

export async function notificationDispatcher(pubsubMessage, context) {
  try {
    const eventData = JSON.parse(
      Buffer.from(pubsubMessage.data, 'base64').toString('utf-8')
    );

    const eventId = eventData.payload?.eventId || context.eventId || Date.now();
    console.log(`[Dispatcher] Processing: ${eventData.type}`);

    const sb = getSupabase();
    const user = await sb
      .from('auth.users')
      .select('id, email, user_metadata')
      .eq('id', eventData.payload.userId)
      .single();

    if (!user.data) {
      await logNotification(
        { ...eventData.payload, eventId, type: eventData.type },
        'skipped',
        'User not found'
      );
      return { status: 'skipped', reason: 'User not found' };
    }

    const userName = user.data.user_metadata?.name || 'Usuário';
    const toEmail = user.data.email;

    const payloadWithName = {
      ...eventData.payload,
      userName,
      eventId,
    };

    let status = 'sent';
    let error = null;

    try {
      await sendEmail(toEmail, eventData.type, payloadWithName);
    } catch (err) {
      status = 'failed';
      error = err.message;
      console.error(`[Dispatcher] Failed to send email: ${error}`);
    }

    await logNotification({ ...payloadWithName, type: eventData.type }, status, error);

    return { status, eventId };
  } catch (error) {
    console.error('[Dispatcher] Fatal error:', error);
    return { status: 'error', message: error.message };
  }
}
