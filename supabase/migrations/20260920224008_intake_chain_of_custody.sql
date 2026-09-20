-- Divinos: physical intake chain of custody.
-- Customer declarations never become inventory until staff verifies and finalizes them.

alter table public.intake_requests drop constraint if exists intake_requests_status_check;
alter table public.intake_requests
  add constraint intake_requests_status_check
  check (status in ('draft','submitted','reviewing','discrepancy','accepted','rejected'));

alter table public.intake_requests
  add column if not exists receipt_code text unique
    default ('DIV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  add column if not exists declared_total int not null default 0 check (declared_total >= 0),
  add column if not exists received_total int not null default 0 check (received_total >= 0),
  add column if not exists accepted_total int not null default 0 check (accepted_total >= 0),
  add column if not exists discrepancy_total int not null default 0 check (discrepancy_total >= 0),
  add column if not exists received_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists customer_acknowledgment_name text,
  add column if not exists customer_acknowledged_at timestamptz,
  add column if not exists evidence_id uuid not null default gen_random_uuid();

alter table public.intake_items
  add column if not exists received_quantity int not null default 0 check (received_quantity between 0 and 200),
  add column if not exists accepted_quantity int not null default 0 check (accepted_quantity between 0 and 200),
  add column if not exists condition text check (condition in ('good','label_damage','capsule_damage','low_fill','leak','other')),
  add column if not exists bottle_photo_path text,
  add column if not exists verification_notes text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles(id) on delete set null;

create table if not exists public.intake_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.intake_requests(id) on delete restrict,
  item_id uuid references public.intake_items(id) on delete restrict,
  action text not null check (action in ('receiving_started','item_verified','receipt_finalized','rejected')),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists intake_events_request_created_idx on public.intake_events(request_id, created_at);
create index if not exists intake_events_actor_idx on public.intake_events(actor_id);
create index if not exists intake_events_item_idx on public.intake_events(item_id) where item_id is not null;
create index if not exists intake_items_verified_by_idx on public.intake_items(verified_by) where verified_by is not null;
alter table public.intake_events enable row level security;

drop policy if exists intake_events_staff_read on public.intake_events;
create policy intake_events_staff_read on public.intake_events for select to authenticated
  using ((select private.is_staff()));
drop policy if exists intake_events_member_read on public.intake_events;
create policy intake_events_member_read on public.intake_events for select to authenticated
  using (exists (
    select 1 from public.intake_requests r
    where r.id = intake_events.request_id
      and r.client_id = (select private.current_client_id())
  ));
drop policy if exists intake_events_staff_insert on public.intake_events;
create policy intake_events_staff_insert on public.intake_events for insert to authenticated
  with check ((select private.is_staff()) and actor_id = (select auth.uid()));

grant select, insert on public.intake_events to authenticated;

create or replace function private.audit_intake_item_verification()
returns trigger language plpgsql security invoker set search_path = public, private as $$
begin
  if old.received_quantity is distinct from new.received_quantity
     or old.accepted_quantity is distinct from new.accepted_quantity
     or old.condition is distinct from new.condition
     or old.bottle_photo_path is distinct from new.bottle_photo_path then
    insert into public.intake_events(request_id, item_id, action, actor_id, snapshot)
    values(new.request_id, new.id, 'item_verified', (select auth.uid()), to_jsonb(new));
  end if;
  return new;
end;
$$;

drop trigger if exists intake_items_audit_verification on public.intake_items;
create trigger intake_items_audit_verification
  after update of received_quantity, accepted_quantity, condition, bottle_photo_path on public.intake_items
  for each row execute function private.audit_intake_item_verification();

create or replace function private.lock_finalized_intake_items()
returns trigger language plpgsql security invoker set search_path = public, private as $$
begin
  if exists (select 1 from public.intake_requests where id = old.request_id and status = 'accepted') then
    raise exception 'El recibo está finalizado y no puede modificarse.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists intake_items_lock_finalized on public.intake_items;
create trigger intake_items_lock_finalized
  before update or delete on public.intake_items
  for each row execute function private.lock_finalized_intake_items();

create or replace function private.lock_finalized_intake_request()
returns trigger language plpgsql security invoker set search_path = public, private as $$
begin
  if old.status = 'accepted' then raise exception 'El recibo está finalizado y no puede modificarse.'; end if;
  return new;
end;
$$;

drop trigger if exists intake_request_lock_finalized on public.intake_requests;
create trigger intake_request_lock_finalized
  before update on public.intake_requests
  for each row execute function private.lock_finalized_intake_request();

create or replace function public.finalize_intake_receipt(
  p_request_id uuid,
  p_customer_name text,
  p_acknowledged boolean
) returns table(receipt_code text, evidence_id uuid, declared_total int, received_total int, accepted_total int, discrepancy_total int)
language plpgsql security invoker set search_path = public, private as $$
declare
  v_request public.intake_requests%rowtype;
  v_item public.intake_items%rowtype;
  v_wine_id uuid;
  v_declared int;
  v_received int;
  v_accepted int;
  v_discrepancy int;
  i int;
begin
  if not (select private.is_staff()) then raise exception 'Solo el personal autorizado puede finalizar recepciones.'; end if;
  if p_acknowledged is not true or nullif(trim(p_customer_name), '') is null then
    raise exception 'La confirmación y el nombre del cliente son obligatorios.';
  end if;

  select * into v_request from public.intake_requests where id = p_request_id for update;
  if not found then raise exception 'Recepción no encontrada.'; end if;
  if v_request.status = 'accepted' then raise exception 'Esta recepción ya fue finalizada.'; end if;
  if v_request.status not in ('submitted','reviewing','discrepancy') then raise exception 'La recepción no está lista para finalizar.'; end if;
  if not exists (select 1 from public.intake_items where request_id = p_request_id) then raise exception 'Añade al menos una botella.'; end if;
  if exists (
    select 1 from public.intake_items
    where request_id = p_request_id
      and (condition is null or bottle_photo_path is null or received_quantity < accepted_quantity)
  ) then raise exception 'Verifica cantidad, condición y foto de cada artículo.'; end if;

  select coalesce(sum(quantity),0), coalesce(sum(received_quantity),0), coalesce(sum(accepted_quantity),0)
  into v_declared, v_received, v_accepted
  from public.intake_items where request_id = p_request_id;
  v_discrepancy := abs(v_declared - v_received) + (v_received - v_accepted);

  update public.intake_requests set
    status = 'accepted', declared_total = v_declared, received_total = v_received,
    accepted_total = v_accepted, discrepancy_total = v_discrepancy,
    received_at = coalesce(received_at, now()), accepted_at = now(), reviewed_at = now(),
    reviewed_by = (select auth.uid()), customer_acknowledgment_name = trim(p_customer_name),
    customer_acknowledged_at = now()
  where id = p_request_id returning * into v_request;

  for v_item in select * from public.intake_items where request_id = p_request_id and accepted_quantity > 0 loop
    select id into v_wine_id from public.wines
    where lower(name) = lower(v_item.name)
      and vintage is not distinct from v_item.vintage
      and lower(coalesce(producer,'')) = lower(coalesce(v_item.producer,''))
    order by created_at limit 1;
    if v_wine_id is null then
      insert into public.wines(name, producer, vintage, region, country, varietal, type, size_ml, label_photo_path, notes)
      values(v_item.name, v_item.producer, v_item.vintage, v_item.region, v_item.country, v_item.varietal,
        case when v_item.wine_type in ('red','white','rose','sparkling','dessert','fortified','other') then v_item.wine_type else 'other' end,
        v_item.size_ml, v_item.label_photo_path, 'Creado desde recepción ' || v_request.receipt_code)
      returning id into v_wine_id;
    end if;
    for i in 1..v_item.accepted_quantity loop
      insert into public.bottles(wine_id, client_id, purchase_price, sale_price, status, received_at, label_photo_path, notes)
      values(v_wine_id, v_request.client_id, coalesce(v_item.purchase_price,0), coalesce(v_item.purchase_price,0),
        'in_storage', current_date, coalesce(v_item.bottle_photo_path,v_item.label_photo_path),
        'Recepción verificada ' || v_request.receipt_code || ' · ' || coalesce(v_item.condition,'good'));
    end loop;
  end loop;

  insert into public.intake_events(request_id, action, actor_id, snapshot)
  values(p_request_id, 'receipt_finalized', (select auth.uid()), jsonb_build_object(
    'receipt_code', v_request.receipt_code, 'evidence_id', v_request.evidence_id,
    'declared_total', v_declared, 'received_total', v_received,
    'accepted_total', v_accepted, 'discrepancy_total', v_discrepancy,
    'customer_acknowledgment_name', trim(p_customer_name), 'accepted_at', v_request.accepted_at
  ));

  return query select v_request.receipt_code, v_request.evidence_id, v_declared, v_received, v_accepted, v_discrepancy;
end;
$$;

revoke all on function public.finalize_intake_receipt(uuid,text,boolean) from public, anon;
grant execute on function public.finalize_intake_receipt(uuid,text,boolean) to authenticated;
