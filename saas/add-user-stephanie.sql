-- ============================================================
-- ADICIONAR NOVO USUÁRIO: stephaniegabrielledefreitas@gmail.com
-- Execute no SQL Editor do Supabase
-- ============================================================

-- IMPORTANTE: Este usuário precisa ser criado primeiro no Auth do Supabase
-- (via Sign Up na interface ou pelo dashboard do Supabase)

-- Opção 1: Se o usuário JÁ EXISTE em auth.users, apenas vincula ao tenant
DO $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Busca usuário pelo email
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'stephaniegabrielledefreitas@gmail.com' LIMIT 1;
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'ruptur-demo';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário stephaniegabrielledefreitas@gmail.com não encontrado em auth.users. Crie o usuário primeiro via Sign Up ou no dashboard do Supabase.';
    END IF;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ruptur-demo não encontrado';
    END IF;
    
    -- Vincular usuário ao tenant (como member)
    INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
    VALUES (v_user_id, v_tenant_id, 'member')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'member';
    
    -- Criar registro na tabela users
    INSERT INTO users (id, tenant_id, email, full_name, role)
    VALUES (v_user_id, v_tenant_id, 'stephaniegabrielledefreitas@gmail.com', 'Stephanie', 'member')
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE '✅ Usuário Stephanie vinculado com sucesso! Tenant: %, User: %', v_tenant_id, v_user_id;
END $$;

-- Verificação
SELECT t.slug, t.name, u.email, u.full_name, m.role
FROM tenants t
LEFT JOIN user_tenant_memberships m ON m.tenant_id = t.id
LEFT JOIN users u ON u.id = m.user_id
WHERE t.slug = 'ruptur-demo';
