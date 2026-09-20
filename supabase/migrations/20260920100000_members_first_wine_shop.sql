-- Members-first wine sales. Prices and availability are server controlled.
create table if not exists public.wine_sale_offers (
  id uuid primary key default gen_random_uuid(),
  wine_id uuid not null references public.wines(id) on delete restrict,
  price numeric(10,2) not null check (price > 0),
  quantity_available int not null check (quantity_available >= 0),
  quantity_reserved int not null default 0 check (quantity_reserved >= 0),
  quantity_sold int not null default 0 check (quantity_sold >= 0),
  member_release_at timestamptz not null default now(),
  public_release_at timestamptz,
  description text,
  active boolean not null default true,
  featured boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_reserved + quantity_sold <= quantity_available)
);

create table if not exists public.wine_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  offer_id uuid not null references public.wine_sale_offers(id) on delete restrict,
  quantity int not null check (quantity between 1 and 12),
  unit_price numeric(10,2) not null check (unit_price > 0),
  subtotal numeric(10,2) not null check (subtotal > 0),
  service_fee_rate numeric(7,4) not null default 7.5,
  service_fee_amount numeric(10,2) not null check (service_fee_amount >= 0),
  total numeric(10,2) not null check (total > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'created' check (status in ('created','approved','completed','cancelled','expired','failed','refunded','manual_review')),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  age_confirmed_at timestamptz not null,
  reserved_until timestamptz not null default (now() + interval '20 minutes'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wine_sale_offers_release_idx on public.wine_sale_offers(active, member_release_at);
create index if not exists wine_orders_user_idx on public.wine_orders(user_id, created_at desc);
create index if not exists wine_orders_offer_idx on public.wine_orders(offer_id, status);

alter table public.wine_sale_offers enable row level security;
alter table public.wine_orders enable row level security;

create policy wine_sale_offers_member_read on public.wine_sale_offers for select to authenticated
  using (
    (select private.is_staff()) or
    ((select private.is_active_member()) and active and member_release_at <= now())
  );
create policy wine_sale_offers_staff_insert on public.wine_sale_offers for insert to authenticated
  with check ((select private.is_staff()));
create policy wine_sale_offers_staff_update on public.wine_sale_offers for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy wine_orders_self_read on public.wine_orders for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_staff()));

grant select on public.wine_sale_offers, public.wine_orders to authenticated;
grant insert, update on public.wine_sale_offers to authenticated;

drop trigger if exists wine_sale_offers_touch on public.wine_sale_offers;
create trigger wine_sale_offers_touch before update on public.wine_sale_offers
  for each row execute function public.touch_updated_at();
drop trigger if exists wine_orders_touch on public.wine_orders;
create trigger wine_orders_touch before update on public.wine_orders
  for each row execute function public.touch_updated_at();

-- Called only by service_role from the payment functions.
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
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'not authorized';
  end if;
  if p_quantity < 1 or p_quantity > 12 then raise exception 'Cantidad inválida.'; end if;

  -- Release abandoned carts before calculating stock.
  for v_expired in
    select id, offer_id, quantity from public.wine_orders
    where status in ('created','approved') and reserved_until < now()
    for update skip locked
  loop
    update public.wine_sale_offers set quantity_reserved = greatest(0, quantity_reserved - v_expired.quantity)
      where id = v_expired.offer_id;
    update public.wine_orders set status = 'expired' where id = v_expired.id;
  end loop;

  select * into v_membership from public.memberships where user_id=p_user_id and status='active' for update;
  if not found then raise exception 'Necesitas una membresía activa.'; end if;
  if v_membership.plan = 'digital' or v_membership.bottle_limit is null then
    raise exception 'El almacenamiento automático requiere Reserva o Colección.';
  end if;
  v_client := v_membership.client_id;

  select * into v_offer from public.wine_sale_offers where id=p_offer_id for update;
  if not found or not v_offer.active or v_offer.member_release_at > now() then raise exception 'Oferta no disponible.'; end if;
  if v_offer.quantity_available - v_offer.quantity_reserved - v_offer.quantity_sold < p_quantity then raise exception 'No quedan suficientes botellas.'; end if;

  select count(*) into v_used from public.bottles where client_id=v_client and status='in_storage';
  select coalesce(sum(quantity),0) into v_pending from public.wine_orders
    where client_id=v_client and status in ('created','approved');
  if v_used + v_pending + p_quantity > v_membership.bottle_limit then
    raise exception 'No tienes capacidad disponible en tu plan.';
  end if;

  v_fee := round((v_offer.price * p_quantity * 0.075)::numeric, 2);
  update public.wine_sale_offers set quantity_reserved=quantity_reserved+p_quantity where id=v_offer.id;
  insert into public.wine_orders(user_id,client_id,offer_id,quantity,unit_price,subtotal,service_fee_amount,total,age_confirmed_at)
  values(p_user_id,v_client,v_offer.id,p_quantity,v_offer.price,v_offer.price*p_quantity,v_fee,(v_offer.price*p_quantity)+v_fee,now())
  returning * into v_order;
  return v_order;
end $$;

create or replace function public.release_wine_order(p_order_id uuid, p_status text default 'failed')
returns void language plpgsql security definer set search_path = public as $$
declare v_order public.wine_orders;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then raise exception 'not authorized'; end if;
  select * into v_order from public.wine_orders where id=p_order_id for update;
  if not found or v_order.status not in ('created','approved') then return; end if;
  update public.wine_sale_offers set quantity_reserved=greatest(0,quantity_reserved-v_order.quantity) where id=v_order.offer_id;
  update public.wine_orders set status=case when p_status in ('cancelled','expired','failed') then p_status else 'failed' end where id=p_order_id;
end $$;

create or replace function public.complete_wine_order(p_order_id uuid, p_paypal_order_id text, p_capture_id text)
returns table(order_id uuid, bottles_created int, rack_locations text[])
language plpgsql security definer set search_path = public as $$
declare
  v_order public.wine_orders;
  v_offer public.wine_sale_offers;
  v_slot record;
  v_bottle uuid;
  v_locations text[] := array[]::text[];
  i int;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then raise exception 'not authorized'; end if;
  select * into v_order from public.wine_orders where id=p_order_id for update;
  if not found then raise exception 'Orden no encontrada.'; end if;
  if v_order.status='completed' then
    return query select v_order.id, v_order.quantity, array[]::text[]; return;
  end if;
  if v_order.status not in ('created','approved') then raise exception 'Orden no procesable.'; end if;
  select * into v_offer from public.wine_sale_offers where id=v_order.offer_id for update;

  for i in 1..v_order.quantity loop
    select s.id, r.name, s.shelf, s.position into v_slot
    from public.slots s join public.racks r on r.id=s.rack_id
    left join public.bottles b on b.slot_id=s.id and b.status='in_storage'
    where b.id is null order by r.name,s.shelf,s.position limit 1 for update of s skip locked;
    if not found then raise exception 'No hay espacios físicos disponibles.'; end if;
    insert into public.bottles(wine_id,client_id,slot_id,purchase_price,sale_price,status,notes)
    values(v_offer.wine_id,v_order.client_id,v_slot.id,v_order.unit_price,v_order.unit_price,'in_storage','Compra Cava Privada · '||v_order.id)
    returning id into v_bottle;
    v_locations := array_append(v_locations, v_slot.name||' · S'||v_slot.shelf||' · P'||v_slot.position);
  end loop;

  update public.wine_sale_offers set quantity_reserved=greatest(0,quantity_reserved-v_order.quantity), quantity_sold=quantity_sold+v_order.quantity where id=v_offer.id;
  update public.wine_orders set status='completed',paypal_order_id=p_paypal_order_id,paypal_capture_id=p_capture_id,completed_at=now() where id=v_order.id;
  return query select v_order.id, v_order.quantity, v_locations;
end $$;

revoke all on function public.reserve_wine_order(uuid,uuid,int) from public, anon, authenticated;
revoke all on function public.release_wine_order(uuid,text) from public, anon, authenticated;
revoke all on function public.complete_wine_order(uuid,text,text) from public, anon, authenticated;
grant execute on function public.reserve_wine_order(uuid,uuid,int) to service_role;
grant execute on function public.release_wine_order(uuid,text) to service_role;
grant execute on function public.complete_wine_order(uuid,text,text) to service_role;
