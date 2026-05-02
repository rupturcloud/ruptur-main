-- ============================================================
-- SUPABASE SEED - Apenas dados (schema já existe)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Criar tenant de demonstração (se não existir)
INSERT INTO tenants (slug, name, email, plan, status, credits_balance, onboarding_completed)
VALUES ('ruptur-demo', 'Ruptur Cloud Demo', 'tiatendeai@gmail.com', 'trial', 'active', 1000, true)
ON CONFLICT (slug) DO NOTHING;

-- Vincular usuário ao tenant (usando o email diretamente)
DO $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Busca usuário pelo email
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'tiatendeai@gmail.com' LIMIT 1;
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'ruptur-demo';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário tiatendeai@gmail.com não encontrado em auth.users';
    END IF;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ruptur-demo não encontrado';
    END IF;
    
    -- Vincular usuário ao tenant
    INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
    VALUES (v_user_id, v_tenant_id, 'owner')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'owner';
    
    -- Criar registro na tabela users
    INSERT INTO users (id, tenant_id, email, full_name, role)
    VALUES (v_user_id, v_tenant_id, 'tiatendeai@gmail.com', 'Admin', 'owner')
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE '✅ Usuário vinculado com sucesso! Tenant: %, User: %', v_tenant_id, v_user_id;
END $$;

-- Verificação
SELECT t.slug, t.name, t.status, t.credits_balance, 
       m.user_id, m.role, u.email, u.full_name
FROM tenants t
LEFT JOIN user_tenant_memberships m ON m.tenant_id = t.id
LEFT JOIN users u ON u.id = m.user_id
WHERE t.slug = 'ruptur-demo';
