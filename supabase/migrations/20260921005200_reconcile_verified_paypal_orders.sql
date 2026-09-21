-- A verified PayPal capture may be retried after an earlier conservative manual review.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.complete_wine_order(uuid,text,text)'::regprocedure::oid) into definition;
  definition := replace(
    definition,
    'v_order.status <> ALL (ARRAY[''created''::text, ''approved''::text])',
    'v_order.status <> ALL (ARRAY[''created''::text, ''approved''::text, ''manual_review''::text])'
  );
  definition := replace(
    definition,
    'v_order.status not in (''created'',''approved'')',
    'v_order.status not in (''created'',''approved'',''manual_review'')'
  );
  execute definition;
end $$;

