-- Divinos: auditable bottle release / pickup chain of custody.

create table if not exists public.release_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'requested' check (status in ('requested','processing','completed','cancelled')),
  receipt_code text not null unique default ('OUT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  authorized_pickup_name text not null,
  scheduled_for timestamptz,
  notes text,
  pickup_id_type text,
  pickup_id_last4 text check (pickup_id_last4 is null or pickup_id_last4 ~ '^[A-Za-z0-9]{4}$'),
  pickup_photo_path text,
  bottles_photo_path text,
  customer_acknowledgment_name text,
  customer_acknowledged_at timestamptz,
  released_by uuid references public.profiles(id) on delete restrict,
  released_at timestamptz,
  evidence_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.release_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.release_requests(id) on delete restrict,
  bottle_id uuid not null references public.bottles(id) on delete restrict,
  status text not null default 'requested' check (status in ('requested','released','cancelled')),
  condition text,
  release_photo_path text,
  created_at timestamptz not null default now(),
  unique(request_id,bottle_id)
);

create table if not exists public.release_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.release_requests(id) on delete restrict,
  action text not null check (action in ('requested','processing_started','receipt_finalized','cancelled')),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists release_requests_client_created_idx on public.release_requests(client_id,created_at desc);
create index if not exists release_requests_status_created_idx on public.release_requests(status,created_at desc);
create index if not exists release_items_request_idx on public.release_items(request_id);
create index if not exists release_items_bottle_idx on public.release_items(bottle_id);
create index if not exists release_events_request_created_idx on public.release_events(request_id,created_at);

alter table public.release_requests enable row level security;
alter table public.release_items enable row level security;
alter table public.release_events enable row level security;

drop policy if exists release_requests_staff_all on public.release_requests;
create policy release_requests_staff_all on public.release_requests for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
drop policy if exists release_requests_member_read on public.release_requests;
create policy release_requests_member_read on public.release_requests for select to authenticated
  using (client_id = (select private.current_client_id()) and requested_by = (select auth.uid()));
drop policy if exists release_requests_member_insert on public.release_requests;
create policy release_requests_member_insert on public.release_requests for insert to authenticated
  with check (client_id = (select private.current_client_id()) and requested_by = (select auth.uid()) and status = 'requested');

drop policy if exists release_items_staff_all on public.release_items;
create policy release_items_staff_all on public.release_items for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
drop policy if exists release_items_member_read on public.release_items;
create policy release_items_member_read on public.release_items for select to authenticated
  using (exists (select 1 from public.release_requests r where r.id=release_items.request_id and r.client_id=(select private.current_client_id()) and r.requested_by=(select auth.uid())));
drop policy if exists release_items_member_insert on public.release_items;
create policy release_items_member_insert on public.release_items for insert to authenticated
  with check (
    exists (select 1 from public.release_requests r where r.id=release_items.request_id and r.client_id=(select private.current_client_id()) and r.requested_by=(select auth.uid()) and r.status='requested')
    and exists (select 1 from public.bottles b where b.id=release_items.bottle_id and b.client_id=(select private.current_client_id()) and b.status='in_storage')
  );

drop policy if exists release_events_staff_read on public.release_events;
create policy release_events_staff_read on public.release_events for select to authenticated using ((select private.is_staff()));
drop policy if exists release_events_member_read on public.release_events;
create policy release_events_member_read on public.release_events for select to authenticated
  using (exists (select 1 from public.release_requests r where r.id=release_events.request_id and r.client_id=(select private.current_client_id()) and r.requested_by=(select auth.uid())));
drop policy if exists release_events_staff_insert on public.release_events;
create policy release_events_staff_insert on public.release_events for insert to authenticated with check ((select private.is_staff()) and actor_id=(select auth.uid()));
drop policy if exists release_events_member_insert on public.release_events;
create policy release_events_member_insert on public.release_events for insert to authenticated
  with check (actor_id=(select auth.uid()) and action='requested' and exists (select 1 from public.release_requests r where r.id=release_events.request_id and r.requested_by=(select auth.uid())));

grant select, insert on public.release_requests, public.release_items, public.release_events to authenticated;
grant update on public.release_requests, public.release_items to authenticated;

create or replace function private.lock_completed_release()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.status='completed' then raise exception 'El recibo de salida ya fue finalizado y no puede modificarse.'; end if;
  return new;
end $$;
drop trigger if exists release_request_lock_completed on public.release_requests;
create trigger release_request_lock_completed before update or delete on public.release_requests
for each row execute function private.lock_completed_release();

create or replace function private.lock_completed_release_item()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.release_requests r where r.id=old.request_id and r.status='completed') then
    raise exception 'Las botellas de un recibo final no pueden modificarse.';
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists release_item_lock_completed on public.release_items;
create trigger release_item_lock_completed before update or delete on public.release_items
for each row execute function private.lock_completed_release_item();

create or replace function public.create_release_request(
  p_bottle_ids uuid[], p_authorized_pickup_name text, p_scheduled_for timestamptz default null, p_notes text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_client uuid; v_request uuid; v_count int;
begin
  v_client := private.current_client_id();
  if v_client is null then raise exception 'Tu cuenta no está vinculada a una colección.'; end if;
  if coalesce(array_length(p_bottle_ids,1),0)<1 then raise exception 'Selecciona al menos una botella.'; end if;
  if length(trim(coalesce(p_authorized_pickup_name,'')))<3 then raise exception 'Indica la persona autorizada.'; end if;
  select count(*) into v_count from public.bottles b where b.id=any(p_bottle_ids) and b.client_id=v_client and b.status='in_storage';
  if v_count<>array_length(p_bottle_ids,1) then raise exception 'Una o más botellas no están disponibles.'; end if;
  if exists(select 1 from public.release_items ri join public.release_requests rr on rr.id=ri.request_id where ri.bottle_id=any(p_bottle_ids) and rr.status in ('requested','processing')) then
    raise exception 'Una botella ya tiene una solicitud de salida activa.';
  end if;
  insert into public.release_requests(client_id,requested_by,authorized_pickup_name,scheduled_for,notes)
  values(v_client,(select auth.uid()),trim(p_authorized_pickup_name),p_scheduled_for,nullif(trim(coalesce(p_notes,'')),'')) returning id into v_request;
  insert into public.release_items(request_id,bottle_id) select v_request,x from unnest(p_bottle_ids) x;
  insert into public.release_events(request_id,action,actor_id,snapshot) values(v_request,'requested',(select auth.uid()),jsonb_build_object('bottle_count',v_count,'authorized_pickup_name',trim(p_authorized_pickup_name)));
  return v_request;
end $$;
revoke all on function public.create_release_request(uuid[],text,timestamptz,text) from public,anon;
grant execute on function public.create_release_request(uuid[],text,timestamptz,text) to authenticated;

create or replace function public.finalize_release_receipt(
  p_request_id uuid, p_id_type text, p_id_last4 text, p_customer_name text,
  p_pickup_photo_path text, p_bottles_photo_path text, p_acknowledged boolean
) returns table(receipt_code text,evidence_id uuid,released_total int)
language plpgsql security invoker set search_path='' as $$
declare v_request public.release_requests%rowtype; v_total int;
begin
  if not private.is_staff() then raise exception 'Solo el personal puede finalizar una salida.'; end if;
  if not p_acknowledged then raise exception 'La persona que recoge debe confirmar la entrega.'; end if;
  if length(trim(coalesce(p_customer_name,'')))<3 then raise exception 'Escribe el nombre de quien recibe.'; end if;
  if coalesce(p_id_last4,'') !~ '^[A-Za-z0-9]{4}$' then raise exception 'Escribe los últimos 4 caracteres de la identificación.'; end if;
  if coalesce(p_pickup_photo_path,'')='' or coalesce(p_bottles_photo_path,'')='' then raise exception 'Se requieren las dos fotografías de evidencia.'; end if;
  select * into v_request from public.release_requests where id=p_request_id for update;
  if not found then raise exception 'Solicitud no encontrada.'; end if;
  if v_request.status='completed' then raise exception 'Esta salida ya fue finalizada.'; end if;
  select count(*) into v_total from public.release_items ri join public.bottles b on b.id=ri.bottle_id
    where ri.request_id=p_request_id and b.client_id=v_request.client_id and b.status='in_storage';
  if v_total=0 or v_total<>(select count(*) from public.release_items where request_id=p_request_id) then raise exception 'El inventario cambió; revisa la solicitud.'; end if;
  update public.bottles b set status='removed',released_at=current_date,slot_id=null,updated_at=now()
    from public.release_items ri where ri.request_id=p_request_id and ri.bottle_id=b.id;
  update public.release_items set status='released',release_photo_path=p_bottles_photo_path where request_id=p_request_id;
  update public.release_requests set status='completed',pickup_id_type=trim(p_id_type),pickup_id_last4=upper(p_id_last4),
    pickup_photo_path=p_pickup_photo_path,bottles_photo_path=p_bottles_photo_path,
    customer_acknowledgment_name=trim(p_customer_name),customer_acknowledged_at=now(),
    released_by=(select auth.uid()),released_at=now(),updated_at=now() where id=p_request_id;
  insert into public.release_events(request_id,action,actor_id,snapshot) values(p_request_id,'receipt_finalized',(select auth.uid()),jsonb_build_object('receipt_code',v_request.receipt_code,'evidence_id',v_request.evidence_id,'released_total',v_total,'id_type',trim(p_id_type),'id_last4',upper(p_id_last4)));
  return query select v_request.receipt_code,v_request.evidence_id,v_total;
end $$;
revoke all on function public.finalize_release_receipt(uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.finalize_release_receipt(uuid,text,text,text,text,text,boolean) to authenticated;
