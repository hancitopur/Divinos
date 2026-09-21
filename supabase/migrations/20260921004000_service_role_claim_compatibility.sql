-- Supabase now exposes JWT claims through auth.jwt(); use it for service-role RPC checks.
do $$
declare
  signature regprocedure;
  definition text;
begin
  foreach signature in array array[
    'public.reserve_wine_order(uuid,uuid,integer,text)'::regprocedure,
    'public.release_wine_order(uuid,text)'::regprocedure,
    'public.complete_wine_order(uuid,text,text)'::regprocedure
  ] loop
    select pg_get_functiondef(signature::oid) into definition;
    definition := replace(
      definition,
      'coalesce(current_setting(''request.jwt.claim.role''::text, true), ''''::text)',
      'coalesce(auth.jwt()->>''role'', '''')'
    );
    definition := replace(
      definition,
      'coalesce(current_setting(''request.jwt.claim.role'',true),'''')',
      'coalesce(auth.jwt()->>''role'','''')'
    );
    definition := replace(
      definition,
      'coalesce(current_setting(''request.jwt.claim.role'', true), '''')',
      'coalesce(auth.jwt()->>''role'', '''')'
    );
    execute definition;
  end loop;
end $$;

