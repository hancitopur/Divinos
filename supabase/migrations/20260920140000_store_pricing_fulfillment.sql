-- Rich storefront, member pricing and pickup/storage fulfillment.
alter table public.wines add column if not exists bottle_photo_path text;

alter table public.wine_orders alter column client_id drop not null;
alter table public.wine_orders
  add column if not exists fulfillment_type text not null default 'storage',
  add column if not exists pricing_tier text not null default 'member',
  add column if not exists member_unit_price numeric(10,2),
  add column if not exists regular_markup_rate numeric(7,4) not null default 15,
  add column if not exists pickup_status text not null default 'not_applicable';
alter table public.wine_orders drop constraint if exists wine_orders_fulfillment_type_check;
alter table public.wine_orders add constraint wine_orders_fulfillment_type_check check (fulfillment_type in ('storage','pickup'));
alter table public.wine_orders drop constraint if exists wine_orders_pricing_tier_check;
alter table public.wine_orders add constraint wine_orders_pricing_tier_check check (pricing_tier in ('member','regular'));
alter table public.wine_orders drop constraint if exists wine_orders_pickup_status_check;
alter table public.wine_orders add constraint wine_orders_pickup_status_check check (pickup_status in ('not_applicable','awaiting_pickup','picked_up','cancelled'));

-- Demo inventory is available to regular registered buyers now.
update public.wine_sale_offers set public_release_at=coalesce(public_release_at,now()) where description like '[DEMO]%';

drop policy if exists wine_sale_offers_member_read on public.wine_sale_offers;
create policy wine_sale_offers_store_read on public.wine_sale_offers for select to authenticated
using (
  (select private.is_staff()) or
  (
    active and
    (
      ((select private.is_active_member()) and member_release_at<=now())
      or (public_release_at is not null and public_release_at<=now())
    )
  )
);

drop policy if exists wines_store_read on public.wines;
create policy wines_store_read on public.wines for select to authenticated
using (
  exists (
    select 1 from public.wine_sale_offers o
    where o.wine_id=wines.id and o.active and o.public_release_at is not null and o.public_release_at<=now()
  )
);

create or replace function public.reserve_wine_order(p_user_id uuid,p_offer_id uuid,p_quantity int,p_fulfillment text)
returns public.wine_orders
language plpgsql security definer set search_path=public,private as $$
declare
  v_offer public.wine_sale_offers;
  v_membership public.memberships;
  v_is_member boolean:=false;
  v_client uuid;
  v_used int;
  v_pending int;
  v_unit numeric(10,2);
  v_subtotal numeric(10,2);
  v_fee numeric(10,2);
  v_order public.wine_orders;
  v_expired record;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'not authorized'; end if;
  if p_quantity<1 or p_quantity>12 then raise exception 'Cantidad inválida.'; end if;
  if p_fulfillment not in ('storage','pickup') then raise exception 'Selecciona guardar o recoger.'; end if;

  for v_expired in select id,offer_id,quantity from public.wine_orders where status in ('created','approved') and reserved_until<now() for update skip locked loop
    update public.wine_sale_offers set quantity_reserved=greatest(0,quantity_reserved-v_expired.quantity) where id=v_expired.offer_id;
    update public.wine_orders set status='expired' where id=v_expired.id;
  end loop;

  select * into v_membership from public.memberships where user_id=p_user_id and status='active' for update;
  if found then v_is_member:=true; v_client:=v_membership.client_id; end if;
  if p_fulfillment='storage' and (not v_is_member or v_membership.plan not in ('reserva','coleccion') or v_membership.bottle_limit is null) then
    raise exception 'Guardar en la cava requiere membresía Reserva o Colección.';
  end if;

  select * into v_offer from public.wine_sale_offers where id=p_offer_id for update;
  if not found or not v_offer.active then raise exception 'Oferta no disponible.'; end if;
  if v_is_member then
    if v_offer.member_release_at>now() then raise exception 'Oferta no disponible.'; end if;
  elsif v_offer.public_release_at is null or v_offer.public_release_at>now() then
    raise exception 'Esta llegada todavía es exclusiva para miembros.';
  end if;
  if v_offer.seller_user_id=p_user_id then raise exception 'No puedes comprar tu propia botella.'; end if;
  if v_offer.offer_source='member' then
    if p_quantity<>1 then raise exception 'Las botellas de miembros se venden individualmente.'; end if;
    if not exists(select 1 from public.bottles where id=v_offer.source_bottle_id and client_id=v_offer.seller_client_id and status='in_storage') then raise exception 'La botella ya no está disponible.'; end if;
  end if;
  if v_offer.quantity_available-v_offer.quantity_reserved-v_offer.quantity_sold<p_quantity then raise exception 'No quedan suficientes botellas.'; end if;

  if p_fulfillment='storage' then
    select count(*) into v_used from public.bottles where client_id=v_client and status='in_storage';
    select coalesce(sum(quantity),0) into v_pending from public.wine_orders where client_id=v_client and fulfillment_type='storage' and status in ('created','approved');
    if v_used+v_pending+p_quantity>v_membership.bottle_limit then raise exception 'No tienes capacidad disponible en tu plan.'; end if;
  end if;

  v_unit:=case when v_is_member then v_offer.price else round((v_offer.price*1.15)::numeric,2) end;
  v_subtotal:=v_unit*p_quantity;
  v_fee:=round((v_subtotal*0.075)::numeric,2);
  update public.wine_sale_offers set quantity_reserved=quantity_reserved+p_quantity where id=v_offer.id;
  insert into public.wine_orders(
    user_id,client_id,offer_id,quantity,unit_price,subtotal,service_fee_amount,total,age_confirmed_at,
    seller_user_id,seller_client_id,seller_proceeds_amount,seller_settlement_status,
    fulfillment_type,pricing_tier,member_unit_price,regular_markup_rate,pickup_status
  ) values (
    p_user_id,v_client,v_offer.id,p_quantity,v_unit,v_subtotal,v_fee,v_subtotal+v_fee,now(),
    v_offer.seller_user_id,v_offer.seller_client_id,
    case when v_offer.offer_source='member' then v_offer.price*p_quantity else 0 end,
    case when v_offer.offer_source='member' then 'pending' else 'not_applicable' end,
    p_fulfillment,case when v_is_member then 'member' else 'regular' end,v_offer.price,15,
    case when p_fulfillment='pickup' then 'awaiting_pickup' else 'not_applicable' end
  ) returning * into v_order;
  return v_order;
end $$;

create or replace function public.complete_wine_order(p_order_id uuid,p_paypal_order_id text,p_capture_id text)
returns table(order_id uuid,bottles_created int,rack_locations text[])
language plpgsql security definer set search_path=public as $$
declare
  v_order public.wine_orders;
  v_offer public.wine_sale_offers;
  v_slot record;
  v_bottle public.bottles;
  v_locations text[]:=array[]::text[];
  v_created int:=0;
  i int;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role' then raise exception 'not authorized'; end if;
  select * into v_order from public.wine_orders where id=p_order_id for update;
  if not found then raise exception 'Orden no encontrada.'; end if;
  if v_order.status='completed' then return query select v_order.id,0,array[]::text[]; return; end if;
  if v_order.status not in ('created','approved') then raise exception 'Orden no procesable.'; end if;
  select * into v_offer from public.wine_sale_offers where id=v_order.offer_id for update;

  if v_order.fulfillment_type='storage' then
    if v_order.client_id is null then raise exception 'Cuenta sin cava asignada.'; end if;
    if v_offer.offer_source='member' then
      select * into v_bottle from public.bottles where id=v_offer.source_bottle_id and client_id=v_offer.seller_client_id and status='in_storage' for update;
      if not found then raise exception 'La botella del vendedor ya no está disponible.'; end if;
      select r.name,s.shelf,s.position into v_slot from public.slots s join public.racks r on r.id=s.rack_id where s.id=v_bottle.slot_id;
      update public.bottles set client_id=v_order.client_id,purchase_price=v_order.unit_price,sale_price=v_order.unit_price,
        notes=concat_ws(' · ',nullif(notes,''),'Compra marketplace '||v_order.id) where id=v_bottle.id;
      v_created:=1;
      if v_slot.name is not null then v_locations:=array_append(v_locations,v_slot.name||' · S'||v_slot.shelf||' · P'||v_slot.position); end if;
    else
      for i in 1..v_order.quantity loop
        select s.id,r.name,s.shelf,s.position into v_slot from public.slots s join public.racks r on r.id=s.rack_id
        left join public.bottles b on b.slot_id=s.id and b.status='in_storage'
        where b.id is null order by r.name,s.shelf,s.position limit 1 for update of s skip locked;
        if not found then raise exception 'No hay espacios físicos disponibles.'; end if;
        insert into public.bottles(wine_id,client_id,slot_id,purchase_price,sale_price,status,notes)
        values(v_offer.wine_id,v_order.client_id,v_slot.id,v_order.unit_price,v_order.unit_price,'in_storage','Compra Cava Privada · '||v_order.id);
        v_created:=v_created+1;
        v_locations:=array_append(v_locations,v_slot.name||' · S'||v_slot.shelf||' · P'||v_slot.position);
      end loop;
    end if;
  end if;

  if v_offer.offer_source='member' then update public.member_sale_requests set status='sold',sold_at=now() where offer_id=v_offer.id; end if;
  update public.wine_sale_offers set quantity_reserved=greatest(0,quantity_reserved-v_order.quantity),quantity_sold=quantity_sold+v_order.quantity,
    active=case when v_offer.offer_source='member' then false else active end where id=v_offer.id;
  update public.wine_orders set status='completed',paypal_order_id=p_paypal_order_id,paypal_capture_id=p_capture_id,completed_at=now() where id=v_order.id;
  return query select v_order.id,v_created,v_locations;
end $$;

revoke all on function public.reserve_wine_order(uuid,uuid,int,text) from public,anon,authenticated;
grant execute on function public.reserve_wine_order(uuid,uuid,int,text) to service_role;
