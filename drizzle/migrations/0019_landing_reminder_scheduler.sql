CREATE OR REPLACE FUNCTION public.schedule_landing_reminder(_secret text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RETURN cron.schedule(
    'landing-reminder-hourly',
    '0 * * * *',
    format(
      $c$select net.http_post(url:='https://project--5201532b-f596-40a8-be0d-78cd61c08188.lovable.app/api/public/hooks/landing-reminder', headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',%L), body:='{}'::jsonb) as request_id;$c$,
      _secret
    )
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.schedule_landing_reminder(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_landing_reminder(text) TO service_role;