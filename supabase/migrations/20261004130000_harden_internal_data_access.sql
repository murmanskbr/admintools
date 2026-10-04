-- Keep application tables server-side only.
-- The web client talks to Supabase exclusively through Edge Functions.
REVOKE ALL ON TABLE
  public.admin_sessions,
  public.admins,
  public.audit_logs,
  public.google_script_config,
  public.normative_files,
  public.normative_marks,
  public.normative_submissions,
  public.notification_reads,
  public.notifications,
  public.server_connections
FROM anon, authenticated;

-- The Google Apps Script shared secret is stored in Vault and is exposed
-- only to the Edge Functions through this protected RPC.
CREATE OR REPLACE FUNCTION public.get_google_script_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $function$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'google_script_secret'
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.get_google_script_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_script_secret() TO service_role;

-- Pin the search path for the configuration writer as well.
CREATE OR REPLACE FUNCTION public.set_google_script_config_url(p_url text)
RETURNS public.google_script_config
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  result public.google_script_config;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN
    RAISE EXCEPTION 'URL_REQUIRED';
  END IF;

  INSERT INTO public.google_script_config (id, web_app_url, updated_at)
  VALUES (1, btrim(p_url), now())
  ON CONFLICT (id) DO UPDATE
    SET web_app_url = EXCLUDED.web_app_url,
        updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$function$;
