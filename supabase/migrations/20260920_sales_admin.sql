create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id), sold_by uuid not null references auth.users(id),
  status text not null default 'completed' check (status in ('completed','voided')), subtotal numeric not null check(subtotal>=0),
  tax numeric not null default 0 check(tax>=0), total numeric not null check(total>=0), payment_method text not null default 'cash', notes text, created_at timestamptz not null default now()
);
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id) on delete cascade,
  bottle_id uuid not null references public.bottles(id), description text not null, unit_price numeric not null check(unit_price>=0), quantity integer not null default 1 check(quantity>0), line_total numeric not null check(line_total>=0)
);
alter table public.sales enable row level security; alter table public.sale_items enable row level security;
create policy "staff read sales" on public.sales for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff')));
create policy "staff read sale items" on public.sale_items for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','staff')));
create or replace function public.complete_sale(p_bottle_ids uuid[], p_client_id uuid default null, p_payment_method text default 'cash', p_notes text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_sale uuid; v_subtotal numeric; v_count integer;
begin
  if not exists(select 1 from profiles where id=auth.uid() and role in ('admin','staff')) then raise exception 'Acceso denegado'; end if;
  select count(*),coalesce(sum(sale_price),0) into v_count,v_subtotal from bottles where id=any(p_bottle_ids) and status='in_storage' for update;
  if v_count<>cardinality(p_bottle_ids) then raise exception 'Uno o más productos ya no están disponibles'; end if;
  insert into sales(client_id,sold_by,subtotal,tax,total,payment_method,notes) values(p_client_id,auth.uid(),v_subtotal,round(v_subtotal*.115,2),v_subtotal+round(v_subtotal*.115,2),p_payment_method,p_notes) returning id into v_sale;
  insert into sale_items(sale_id,bottle_id,description,unit_price,quantity,line_total) select v_sale,b.id,w.name,b.sale_price,1,b.sale_price from bottles b join wines w on w.id=b.wine_id where b.id=any(p_bottle_ids);
  update bottles set status='sold',slot_id=null,released_at=current_date,updated_at=now() where id=any(p_bottle_ids);
  return v_sale;
end $$;
revoke all on function public.complete_sale(uuid[],uuid,text,text) from public, anon; grant execute on function public.complete_sale(uuid[],uuid,text,text) to authenticated;
create or replace function public.list_staff() returns table(id uuid,full_name text,role text,email text,created_at timestamptz) language sql security definer set search_path=public,auth as $$
 select p.id,p.full_name,p.role,u.email,p.created_at from public.profiles p join auth.users u on u.id=p.id where exists(select 1 from public.profiles me where me.id=auth.uid() and me.role='admin') order by p.created_at;
$$;
revoke all on function public.list_staff() from public, anon; grant execute on function public.list_staff() to authenticated;
create index if not exists sales_client_idx on public.sales(client_id);
create index if not exists sales_sold_by_idx on public.sales(sold_by);
create index if not exists sale_items_sale_idx on public.sale_items(sale_id);
create index if not exists sale_items_bottle_idx on public.sale_items(bottle_id);
