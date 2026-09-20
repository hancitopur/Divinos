-- Member marketplace: members request a sale; staff reviews and publishes it.
alter table public.wine_sale_offers
  add column if not exists offer_source text not null default 'divinos',
  add column if not exists seller_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists seller_client_id uuid references public.clients(id) on delete restrict,
  add column if not exists source_bottle_id uuid references public.bottles(id) on delete restrict;

alter table public.wine_sale_offers drop constraint if exists wine_sale_offers_source_check;
alter table public.wine_sale_offers add constraint wine_sale_offers_source_check check (
  (offer_source = 'divinos' and seller_user_id is null and seller_client_id is null and source_bottle_id is null)
  or
  (offer_source = 'member' and seller_user_id is not null and seller_client_id is not null and source_bottle_id is not null and quantity_available = 1)
);
create unique index if not exists wine_sale_offers_source_bottle_uidx
  on public.wine_sale_offers(source_bottle_id) where source_bottle_id is not null;

alter table public.wine_orders
  add column if not exists seller_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists seller_client_id uuid references public.clients(id) on delete restrict,
  add column if not exists seller_proceeds_amount numeric(10,2) not null default 0,
  add column if not exists seller_settlement_status text not null default 'not_applicable';
alter table public.wine_orders drop constraint if exists wine_orders_seller_settlement_status_check;
alter table public.wine_orders add constraint wine_orders_seller_settlement_status_check
  check (seller_settlement_status in ('not_applicable','pending','paid','held','reversed'));
alter table public.wine_orders drop constraint if exists wine_orders_seller_proceeds_amount_check;
alter table public.wine_orders add constraint wine_orders_seller_proceeds_amount_check check (seller_proceeds_amount >= 0);

create table if not exists public.member_sale_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  bottle_id uuid not null references public.bottles(id) on delete restrict,
  asking_price numeric(10,2) not null check (asking_price > 0),
  approved_price numeric(10,2) check (approved_price > 0),
  notes text,
  admin_notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','sold')),
  offer_id uuid unique references public.wine_sale_offers(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_sale_requests_owner_idx on public.member_sale_requests(user_id, created_at desc);
create index if not exists member_sale_requests_status_idx on public.member_sale_requests(status, created_at);
create unique index if not exists member_sale_requests_active_bottle_uidx
  on public.member_sale_requests(bottle_id) where status in ('pending','approved');

alter table public.member_sale_requests enable row level security;
drop policy if exists member_sale_requests_read on public.member_sale_requests;
create policy member_sale_requests_read on public.member_sale_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));
grant select on public.member_sale_requests to authenticated;
revoke insert, update, delete on public.member_sale_requests from authenticated;

drop trigger if exists member_sale_requests_touch on public.member_sale_requests;
create trigger member_sale_requests_touch before update on public.member_sale_requests
  for each row execute function public.touch_updated_at();

create or replace function public.submit_member_sale_request(p_bottle_id uuid, p_asking_price numeric, p_notes text default null)
returns public.member_sale_requests
language plpgsql security definer set search_path = public, private as $$
declare
  v_user uuid := (select auth.uid());
  v_client uuid;
  v_bottle public.bottles;
  v_request public.member_sale_requests;
begin
  if v_user is null or not (select private.is_active_member()) then
    raise exception 'Necesitas una membresía activa.';
  end if;
  if p_asking_price is null or p_asking_price <= 0 then raise exception 'Precio inválido.'; end if;
  v_client := (select private.current_client_id());
  select * into v_bottle from public.bottles
    where id = p_bottle_id and client_id = v_client and status = 'in_storage' and slot_id is not null
    for update;
  if not found then raise exception 'La botella no está disponible en tu cava.'; end if;
  if exists (select 1 from public.member_sale_requests where bottle_id=p_bottle_id and status in ('pending','approved')) then
    raise exception 'Esta botella ya tiene una solicitud activa.';
  end if;
  insert into public.member_sale_requests(user_id,client_id,bottle_id,asking_price,notes)
  values(v_user,v_client,p_bottle_id,round(p_asking_price,2),nullif(trim(p_notes),''))
  returning * into v_request;
  return v_request;
end $$;

create or replace function public.cancel_member_sale_request(p_request_id uuid)
returns public.member_sale_requests
language plpgsql security definer set search_path = public as $$
declare v_request public.member_sale_requests;
begin
  if (select auth.uid()) is null then raise exception 'Inicia sesión.'; end if;
  select * into v_request from public.member_sale_requests
    where id=p_request_id and user_id=(select auth.uid()) and status='pending' for update;
  if not found then raise exception 'La solicitud ya no se puede cancelar.'; end if;
  update public.member_sale_requests set status='cancelled' where id=v_request.id returning * into v_request;
  return v_request;
end $$;

create or replace function public.review_member_sale_request(
  p_request_id uuid, p_action text, p_approved_price numeric default null,
  p_description text default null, p_admin_notes text default null
)
returns public.member_sale_requests
language plpgsql security definer set search_path = public, private as $$
declare
  v_request public.member_sale_requests;
  v_bottle public.bottles;
  v_offer uuid;
begin
  if (select auth.uid()) is null or not (select private.is_staff()) then raise exception 'No autorizado.'; end if;
  if p_action not in ('approve','reject') then raise exception 'Acción inválida.'; end if;
  select * into v_request from public.member_sale_requests where id=p_request_id and status='pending' for update;
  if not found then raise exception 'Solicitud no disponible.'; end if;
  if p_action='reject' then
    update public.member_sale_requests set status='rejected',admin_notes=nullif(trim(p_admin_notes),''),reviewed_by=(select auth.uid()),reviewed_at=now()
      where id=v_request.id returning * into v_request;
    return v_request;
  end if;
  if p_approved_price is null or p_approved_price <= 0 then raise exception 'Precio aprobado inválido.'; end if;
  select * into v_bottle from public.bottles
    where id=v_request.bottle_id and client_id=v_request.client_id and status='in_storage' and slot_id is not null for update;
  if not found then raise exception 'La botella ya no está disponible.'; end if;
  insert into public.wine_sale_offers(
    wine_id,price,quantity_available,description,active,created_by,offer_source,
    seller_user_id,seller_client_id,source_bottle_id
  ) values (
    v_bottle.wine_id,round(p_approved_price,2),1,nullif(trim(p_description),''),true,(select auth.uid()),'member',
    v_request.user_id,v_request.client_id,v_request.bottle_id
  ) returning id into v_offer;
  update public.member_sale_requests set status='approved',approved_price=round(p_approved_price,2),offer_id=v_offer,
    admin_notes=nullif(trim(p_admin_notes),''),reviewed_by=(select auth.uid()),reviewed_at=now()
    where id=v_request.id returning * into v_request;
  return v_request;
end $$;

create or replace function public.reserve_wine_order(p_user_id uuid, p_offer_id uuid, p_quantity int)
returns public.wine_orders
language plpgsql security definer set search_path = public, private as $$
declare
  v_offer public.wine_sale_offers;
  v_membership public.memberships;
  v_client uuid;
  v_used int;
  v_pending int;
  v_fee numeric(10,2);
  v_order public.wine_orders;
  v_expired record;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then raise exception 'not authorized'; end if;
  if p_quantity < 1 or p_quantity > 12 then raise exception 'Cantidad inválida.'; end if;
  for v_expired in select id,offer_id,quantity from public.wine_orders where status in ('created','approved') and reserved_until < now() for update skip locked loop
    update public.wine_sale_offers set quantity_reserved=greatest(0,quantity_reserved-v_expired.quantity) where id=v_expired.offer_id;
    update public.wine_orders set status='expired' where id=v_expired.id;
  end loop;
  select * into v_membership from public.memberships where user_id=p_user_id and status='active' for update;
  if not found then raise exception 'Necesitas una membresía activa.'; end if;
  if v_membership.plan='digital' or v_membership.bottle_limit is null then raise exception 'El almacenamiento automático requiere Reserva o Colección.'; end if;
  v_client := v_membership.client_id;
  select * into v_offer from public.wine_sale_offers where id=p_offer_id for update;
  if not found or not v_offer.active or v_offer.member_release_at>now() then raise exception 'Oferta no disponible.'; end if;
  if v_offer.seller_user_id=p_user_id then raise exception 'No puedes comprar tu propia botella.'; end if;
  if v_offer.offer_source='member' then
    if p_quantity<>1 then raise exception 'Las botellas de miembros se venden individualmente.'; end if;
    if not exists(select 1 from public.bottles where id=v_offer.source_bottle_id and client_id=v_offer.seller_client_id and status='in_storage') then
      raise exception 'La botella ya no está disponible.';
    end if;
  end if;
  if v_offer.quantity_available-v_offer.quantity_reserved-v_offer.quantity_sold<p_quantity then raise exception 'No quedan suficientes botellas.'; end if;
  select count(*) into v_used from public.bottles where client_id=v_client and status='in_storage';
  select coalesce(sum(quantity),0) into v_pending from public.wine_orders where client_id=v_client and status in ('created','approved');
  if v_used+v_pending+p_quantity>v_membership.bottle_limit then raise exception 'No tienes capacidad disponible en tu plan.'; end if;
  v_fee := round((v_offer.price*p_quantity*0.075)::numeric,2);
  update public.wine_sale_offers set quantity_reserved=quantity_reserved+p_quantity where id=v_offer.id;
  insert into public.wine_orders(
    user_id,client_id,offer_id,quantity,unit_price,subtotal,service_fee_amount,total,age_confirmed_at,
    seller_user_id,seller_client_id,seller_proceeds_amount,seller_settlement_status
  ) values (
    p_user_id,v_client,v_offer.id,p_quantity,v_offer.price,v_offer.price*p_quantity,v_fee,(v_offer.price*p_quantity)+v_fee,now(),
    v_offer.seller_user_id,v_offer.seller_client_id,
    case when v_offer.offer_source='member' then v_offer.price*p_quantity else 0 end,
    case when v_offer.offer_source='member' then 'pending' else 'not_applicable' end
  ) returning * into v_order;
  return v_order;
end $$;

create or replace function public.complete_wine_order(p_order_id uuid, p_paypal_order_id text, p_capture_id text)
returns table(order_id uuid, bottles_created int, rack_locations text[])
language plpgsql security definer set search_path = public as $$
declare
  v_order public.wine_orders;
  v_offer public.wine_sale_offers;
  v_slot record;
  v_bottle public.bottles;
  v_locations text[] := array[]::text[];
  i int;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then raise exception 'not authorized'; end if;
  select * into v_order from public.wine_orders where id=p_order_id for update;
  if not found then raise exception 'Orden no encontrada.'; end if;
  if v_order.status='completed' then return query select v_order.id,v_order.quantity,array[]::text[]; return; end if;
  if v_order.status not in ('created','approved') then raise exception 'Orden no procesable.'; end if;
  select * into v_offer from public.wine_sale_offers where id=v_order.offer_id for update;
  if v_offer.offer_source='member' then
    select * into v_bottle from public.bottles where id=v_offer.source_bottle_id and client_id=v_offer.seller_client_id and status='in_storage' for update;
    if not found then raise exception 'La botella del vendedor ya no está disponible.'; end if;
    select r.name,s.shelf,s.position into v_slot from public.slots s join public.racks r on r.id=s.rack_id where s.id=v_bottle.slot_id;
    update public.bottles set client_id=v_order.client_id,purchase_price=v_order.unit_price,sale_price=v_order.unit_price,
      notes=concat_ws(' · ',nullif(notes,''),'Compra marketplace '||v_order.id) where id=v_bottle.id;
    if v_slot.name is not null then v_locations:=array_append(v_locations,v_slot.name||' · S'||v_slot.shelf||' · P'||v_slot.position); end if;
    update public.member_sale_requests set status='sold',sold_at=now() where offer_id=v_offer.id;
  else
    for i in 1..v_order.quantity loop
      select s.id,r.name,s.shelf,s.position into v_slot from public.slots s join public.racks r on r.id=s.rack_id
      left join public.bottles b on b.slot_id=s.id and b.status='in_storage'
      where b.id is null order by r.name,s.shelf,s.position limit 1 for update of s skip locked;
      if not found then raise exception 'No hay espacios físicos disponibles.'; end if;
      insert into public.bottles(wine_id,client_id,slot_id,purchase_price,sale_price,status,notes)
      values(v_offer.wine_id,v_order.client_id,v_slot.id,v_order.unit_price,v_order.unit_price,'in_storage','Compra Cava Privada · '||v_order.id);
      v_locations:=array_append(v_locations,v_slot.name||' · S'||v_slot.shelf||' · P'||v_slot.position);
    end loop;
  end if;
  update public.wine_sale_offers set quantity_reserved=greatest(0,quantity_reserved-v_order.quantity),quantity_sold=quantity_sold+v_order.quantity,active=false where id=v_offer.id and v_offer.offer_source='member';
  update public.wine_sale_offers set quantity_reserved=greatest(0,quantity_reserved-v_order.quantity),quantity_sold=quantity_sold+v_order.quantity where id=v_offer.id and v_offer.offer_source='divinos';
  update public.wine_orders set status='completed',paypal_order_id=p_paypal_order_id,paypal_capture_id=p_capture_id,completed_at=now() where id=v_order.id;
  return query select v_order.id,v_order.quantity,v_locations;
end $$;

drop policy if exists wine_orders_self_read on public.wine_orders;
create policy wine_orders_self_read on public.wine_orders for select to authenticated
  using (user_id=(select auth.uid()) or seller_user_id=(select auth.uid()) or (select private.is_staff()));

revoke all on function public.submit_member_sale_request(uuid,numeric,text) from public, anon;
revoke all on function public.cancel_member_sale_request(uuid) from public, anon;
revoke all on function public.review_member_sale_request(uuid,text,numeric,text,text) from public, anon;
grant execute on function public.submit_member_sale_request(uuid,numeric,text) to authenticated;
grant execute on function public.cancel_member_sale_request(uuid) to authenticated;
grant execute on function public.review_member_sale_request(uuid,text,numeric,text,text) to authenticated;
revoke all on function public.reserve_wine_order(uuid,uuid,int) from public,anon,authenticated;
revoke all on function public.complete_wine_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_wine_order(uuid,uuid,int) to service_role;
grant execute on function public.complete_wine_order(uuid,text,text) to service_role;
