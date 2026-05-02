/**
 * Rotas de Referral — Sistema de indicações com comissão em créditos
 *
 * GET  /api/referrals/my-link      → Obter/gerar link de referral do usuário
 * GET  /api/referrals/summary      → Resumo de referrals, comissões, amigos ativos
 * GET  /api/referrals/friends      → Lista detalhada de amigos indicados
 * POST /api/referrals/claim/:code  → Reivindicar referral via código compartilhado
 */

import { randomBytes } from 'node:crypto';

function generateRefCode(prefix) {
  const random = randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  return `${prefix}_${random}`;
}

export function registerReferralRoutes(app, { supabase, authMiddleware }) {

  // Gerar ou obter link de referral do usuário autenticado
  app.get('/api/referrals/my-link', authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      const tenantId = req.query.tenant_id || req.user?.default_tenant_id;

      if (!userId || !tenantId) {
        return res.status(400).json({ error: 'userId e tenantId obrigatórios' });
      }

      // Verificar que o usuário tem acesso ao tenant
      const { data: membership } = await supabase
        .from('user_tenant_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Acesso negado a este tenant' });
      }

      // Buscar link existente
      let { data: refLink } = await supabase
        .from('referral_links')
        .select('id, ref_code, status, created_at')
        .eq('referrer_tenant_id', tenantId)
        .eq('status', 'active')
        .single();

      // Se não existe, gerar novo
      if (!refLink) {
        const refCode = generateRefCode(tenantId.slice(0, 8));
        const { data: newLink, error } = await supabase
          .from('referral_links')
          .insert({
            referrer_tenant_id: tenantId,
            referee_tenant_id: null,  // Será preenchido quando o amigo se inscrever
            ref_code: refCode,
            status: 'active',
          })
          .select('id, ref_code, created_at')
          .single();

        if (error) {
          throw new Error(`Erro ao gerar link: ${error.message}`);
        }
        refLink = newLink;
      }

      res.json({
        refCode: refLink.ref_code,
        link: `${process.env.FRONTEND_URL || 'https://app.ruptur.cloud'}/ref/${refLink.ref_code}`,
        createdAt: refLink.created_at,
      });
    } catch (error) {
      console.error('Erro ao gerar link de referral:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resumo de referrals para o dashboard
  app.get('/api/referrals/summary', authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      const tenantId = req.query.tenant_id || req.user?.default_tenant_id;

      if (!userId || !tenantId) {
        return res.status(400).json({ error: 'userId e tenantId obrigatórios' });
      }

      // Usar VIEW referral_summary
      const { data: summary } = await supabase
        .from('referral_summary')
        .select('*')
        .eq('referrer_tenant_id', tenantId)
        .single();

      if (!summary) {
        return res.json({
          totalReferrals: 0,
          activeReferrals: 0,
          payingReferrals: 0,
          totalCommissionCents: 0,
          commission30dCents: 0,
          lastCommissionDate: null,
        });
      }

      res.json({
        totalReferrals: summary.total_referrals || 0,
        activeReferrals: summary.active_referrals || 0,
        payingReferrals: summary.paying_referrals || 0,
        totalCommissionCents: summary.total_commission_cents || 0,
        commission30dCents: summary.commission_30d_cents || 0,
        lastCommissionDate: summary.last_commission_date,
      });
    } catch (error) {
      console.error('Erro ao buscar resumo de referrals:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Lista detalhada de amigos indicados
  app.get('/api/referrals/friends', authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      const tenantId = req.query.tenant_id || req.user?.default_tenant_id;

      if (!userId || !tenantId) {
        return res.status(400).json({ error: 'userId e tenantId obrigatórios' });
      }

      // Buscar amigos indicados e suas comissões
      const { data: friends } = await supabase
        .from('referral_links')
        .select(`
          id,
          referee_tenant_id,
          ref_code,
          status,
          created_at,
          referral_commissions (
            id,
            commission_amount,
            status,
            credited_at
          )
        `)
        .eq('referrer_tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // Enriquecer com dados do tenant amigo (nome, email)
      const enrichedFriends = await Promise.all(
        (friends || []).map(async (friend) => {
          const { data: friendTenant } = await supabase
            .from('tenants')
            .select('name, email, plan, created_at')
            .eq('id', friend.referee_tenant_id)
            .single();

          const commissions = friend.referral_commissions || [];
          const totalEarned = commissions
            .filter(c => c.status === 'credited')
            .reduce((sum, c) => sum + c.commission_amount, 0);

          return {
            friendId: friend.referee_tenant_id,
            friendName: friendTenant?.name || 'Amigo',
            friendEmail: friendTenant?.email,
            friendPlan: friendTenant?.plan,
            friendJoinedAt: friendTenant?.created_at,
            refCode: friend.ref_code,
            status: friend.status,
            addedAt: friend.created_at,
            totalEarned: totalEarned,
            lastCommission: commissions
              .filter(c => c.status === 'credited')
              .sort((a, b) => new Date(b.credited_at) - new Date(a.credited_at))[0]?.credited_at || null,
          };
        })
      );

      res.json({ friends: enrichedFriends });
    } catch (error) {
      console.error('Erro ao buscar lista de amigos:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reivindicar referral via código (quando amigo se inscreve)
  app.post('/api/referrals/claim/:refCode', async (req, res) => {
    try {
      const { refCode } = req.params;
      const { newTenantId } = req.body;

      if (!refCode || !newTenantId) {
        return res.status(400).json({ error: 'refCode e newTenantId obrigatórios' });
      }

      // Buscar referral_link ativo
      const { data: refLink, error: findError } = await supabase
        .from('referral_links')
        .select('id, referrer_tenant_id, referee_tenant_id, status')
        .eq('ref_code', refCode)
        .single();

      if (findError || !refLink) {
        return res.status(404).json({ error: 'Código de referral inválido ou expirado' });
      }

      if (refLink.status !== 'active') {
        return res.status(400).json({ error: 'Este código de referral não está mais ativo' });
      }

      if (refLink.referee_tenant_id && refLink.referee_tenant_id !== newTenantId) {
        return res.status(400).json({ error: 'Este código já foi utilizado por outro usuário' });
      }

      // Atualizar referral_link com o novo tenant
      const { error: updateError } = await supabase
        .from('referral_links')
        .update({
          referee_tenant_id: newTenantId,
        })
        .eq('id', refLink.id);

      if (updateError) {
        throw new Error(`Erro ao reivindicar referral: ${updateError.message}`);
      }

      res.json({
        success: true,
        message: 'Referral ativado com sucesso',
        referrerTenantId: refLink.referrer_tenant_id,
      });
    } catch (error) {
      console.error('Erro ao reivindicar referral:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Registrar clique no link de referral
  app.post('/api/referrals/click/:refCode', async (req, res) => {
    try {
      const { refCode } = req.params;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;

      const { data: refLink } = await supabase
        .from('referral_links')
        .select('id')
        .eq('ref_code', refCode)
        .single();

      if (refLink) {
        await supabase.from('referral_clicks').insert({
          referral_link_id: refLink.id,
          ip_address: ipAddress,
          user_agent: userAgent,
        });
      }

      res.json({ ok: true });
    } catch (error) {
      // Não falha se não conseguir registrar clique
      console.log('Aviso: não foi possível registrar clique de referral:', error.message);
      res.json({ ok: true });
    }
  });
}

export default registerReferralRoutes;
