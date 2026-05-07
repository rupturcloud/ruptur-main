-- Migration: Link all Superadmins to all Ruptur Tenants
-- Purpose: Ensure all superadmins have access to all Ruptur Cloud instances
-- Date: 2026-05-07

-- Link all superadmins to ALL Ruptur tenants (not just the main one)
INSERT INTO public.user_tenant_memberships (user_id, tenant_id, role, created_at)
SELECT
  u.id,
  t.id,
  'admin',
  NOW()
FROM auth.users u
CROSS JOIN public.tenants t
WHERE u.raw_user_meta_data->>'role' = 'superadmin'
AND t.name ILIKE '%ruptur%'
AND NOT EXISTS (
  SELECT 1
  FROM public.user_tenant_memberships utm
  WHERE utm.user_id = u.id
  AND utm.tenant_id = t.id
)
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Verify and report
DO $$
DECLARE
  v_ruptur_tenants INT;
  v_superadmins INT;
  v_linked INT;
BEGIN
  -- Count Ruptur tenants
  SELECT COUNT(*) INTO v_ruptur_tenants
  FROM public.tenants
  WHERE name ILIKE '%ruptur%';

  -- Count superadmins
  SELECT COUNT(*) INTO v_superadmins
  FROM auth.users
  WHERE raw_user_meta_data->>'role' = 'superadmin';

  -- Count links
  SELECT COUNT(*) INTO v_linked
  FROM public.user_tenant_memberships utm
  WHERE utm.user_id IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'role' = 'superadmin'
  )
  AND utm.tenant_id IN (
    SELECT id FROM public.tenants
    WHERE name ILIKE '%ruptur%'
  );

  RAISE NOTICE 'Migration Summary:
  - Ruptur tenants: %
  - Superadmins: %
  - Total links: %',
    v_ruptur_tenants, v_superadmins, v_linked;
END $$;

-- Final verification query
SELECT
  t.name as tenant,
  t.id,
  COUNT(DISTINCT utm.user_id) as superadmins_linked,
  STRING_AGG(DISTINCT u.email, ', ') as admin_emails
FROM public.tenants t
LEFT JOIN public.user_tenant_memberships utm ON t.id = utm.tenant_id
LEFT JOIN auth.users u ON utm.user_id = u.id AND u.raw_user_meta_data->>'role' = 'superadmin'
WHERE t.name ILIKE '%ruptur%'
GROUP BY t.id, t.name
ORDER BY t.created_at;
