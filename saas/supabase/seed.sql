-- Seed local seguro para Supabase CLI.
-- Não depende de usuários em auth.users; cria apenas um tenant demo quando a tabela existir.

DO $$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE NOTICE 'Tabela public.tenants ainda não existe; seed ignorado.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'email'
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.tenants (slug, name, email, plan, status, credits_balance, onboarding_completed)
      VALUES ('ruptur-local', 'Ruptur Local', 'local@ruptur.cloud', 'trial', 'active', 1000, true)
      ON CONFLICT (slug) DO NOTHING
    $sql$;
  ELSE
    EXECUTE $sql$
      INSERT INTO public.tenants (slug, name, plan, status, credits_balance)
      VALUES ('ruptur-local', 'Ruptur Local', 'trial', 'active', 1000)
      ON CONFLICT (slug) DO NOTHING
    $sql$;
  END IF;
END $$;
