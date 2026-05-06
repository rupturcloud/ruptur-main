-- ============================================================
-- SUPABASE SEED - Dados iniciais para o usuário logado
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Criar tenant de demonstração (se não existir)
INSERT INTO tenants (slug, name, email, plan, status, credits_balance, onboarding_completed)
SELECT 'ruptur-demo', 'Ruptur Cloud Demo', 'admin@ruptur.cloud', 'trial', 'active', 1000, true
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = 'ruptur-demo');

-- 2. Obter o ID do tenant criado
DO $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    -- Pega o ID do tenant
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'ruptur-demo';
    
    -- Pega o ID do usuário autenticado (você precisa substituir pelo seu UUID)
    -- Para encontrar seu UUID: SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com';
    v_user_id := NULL; -- SUBSTITUA AQUI PELO SEU UUID
    
    IF v_user_id IS NOT NULL THEN
        -- 3. Vincular usuário ao tenant
        INSERT INTO user_tenant_memberships (user_id, tenant_id, role)
        SELECT v_user_id, v_tenant_id, 'owner'
        WHERE NOT EXISTS (
            SELECT 1 FROM user_tenant_memberships 
            WHERE user_id = v_user_id AND tenant_id = v_tenant_id
        );
        
        -- 4. Criar registro na tabela users
        INSERT INTO users (id, tenant_id, email, full_name, role)
        SELECT v_user_id, v_tenant_id, (SELECT email FROM auth.users WHERE id = v_user_id), 'Admin', 'owner'
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = v_user_id);
        
        RAISE NOTICE 'Usuário vinculado ao tenant com sucesso!';
    ELSE
        RAISE NOTICE 'ATENÇÃO: Defina o v_user_id com seu UUID do auth.users';
    END IF;
END $$;

-- 5. Criar cliente inicial (opcional)
INSERT INTO clients (user_id, name, phone, modalidade)
SELECT 
    (SELECT id FROM auth.users LIMIT 1),
    'Cliente Demo',
    '5511999999999',
    'PRE_PAGO'
WHERE NOT EXISTS (SELECT 1 FROM clients LIMIT 1);

-- Verificação
SELECT 'Setup completo!' as status;
SELECT * FROM tenants LIMIT 1;
SELECT * FROM user_tenant_memberships LIMIT 5;
