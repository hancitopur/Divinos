alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('admin','staff','member','pending'));
alter table public.profiles alter column role set default 'pending';
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin insert into public.profiles(id,full_name,role) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email),'pending'); return new; end $$;

create table if not exists public.memberships(
 user_id uuid primary key references auth.users(id) on delete cascade,
 client_id uuid unique references public.clients(id) on delete set null,
 plan text not null check(plan in ('digital','reserva','coleccion')),
 status text not null default 'pending' check(status in ('pending','active','suspended','cancelled')),
 item_limit integer, monthly_price numeric not null check(monthly_price>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.intake_requests(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), client_id uuid references public.clients(id),
 name text not null, brand text, vitola text, country text, quantity integer not null check(quantity>0), notes text,
 status text not null default 'submitted' check(status in ('submitted','reviewing','accepted','rejected')), verified_quantity integer, admin_notes text,
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
alter table public.memberships enable row level security; alter table public.intake_requests enable row level security;
create policy memberships_own_read on public.memberships for select to authenticated using(user_id=(select auth.uid()) or private.is_staff());
create policy memberships_admin_update on public.memberships for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy intake_own_read on public.intake_requests for select to authenticated using(user_id=(select auth.uid()) or private.is_staff());
create policy intake_own_insert on public.intake_requests for insert to authenticated with check(user_id=(select auth.uid()));
create policy intake_staff_update on public.intake_requests for update to authenticated using(private.is_staff()) with check(private.is_staff());
create policy clients_member_read on public.clients for select to authenticated using(exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.client_id=clients.id));
create policy bottles_member_read on public.bottles for select to authenticated using(exists(select 1 from public.memberships m where m.user_id=(select auth.uid()) and m.client_id=bottles.client_id));
create policy wines_member_read on public.wines for select to authenticated using(exists(select 1 from public.bottles b join public.memberships m on m.client_id=b.client_id where b.wine_id=wines.id and m.user_id=(select auth.uid())));
create policy slots_member_read on public.slots for select to authenticated using(exists(select 1 from public.bottles b join public.memberships m on m.client_id=b.client_id where b.slot_id=slots.id and m.user_id=(select auth.uid())));
create policy racks_member_read on public.racks for select to authenticated using(exists(select 1 from public.slots s join public.bottles b on b.slot_id=s.id join public.memberships m on m.client_id=b.client_id where s.rack_id=racks.id and m.user_id=(select auth.uid())));
grant select on public.memberships to authenticated; grant select,insert on public.intake_requests to authenticated;

create or replace function public.request_membership(p_plan text) returns void language plpgsql security definer set search_path=public,auth as $$
declare v_client uuid; v_price numeric; v_limit integer; v_name text; v_email text;
begin
 if auth.uid() is null then raise exception 'Acceso requerido'; end if;
 if p_plan not in ('digital','reserva','coleccion') then raise exception 'Plan inválido'; end if;
 select full_name into v_name from public.profiles where id=auth.uid(); select email into v_email from auth.users where id=auth.uid();
 select client_id into v_client from public.memberships where user_id=auth.uid();
 if v_client is null then insert into public.clients(name,email) values(coalesce(v_name,v_email),v_email) returning id into v_client; end if;
 v_price:=case p_plan when 'digital' then 24.99 when 'reserva' then 120 else 175 end;
 v_limit:=case p_plan when 'reserva' then 40 when 'coleccion' then 100 else null end;
 insert into public.memberships(user_id,client_id,plan,status,item_limit,monthly_price) values(auth.uid(),v_client,p_plan,'pending',v_limit,v_price)
 on conflict(user_id) do update set plan=excluded.plan,status='pending',item_limit=excluded.item_limit,monthly_price=excluded.monthly_price,client_id=coalesce(memberships.client_id,excluded.client_id),updated_at=now();
 update public.profiles set role='pending' where id=auth.uid() and role not in ('admin','staff');
end $$;
revoke all on function public.request_membership(text) from public,anon; grant execute on function public.request_membership(text) to authenticated;

create or replace function public.admin_list_memberships() returns table(user_id uuid,full_name text,email text,plan text,status text,item_limit integer,monthly_price numeric,client_id uuid,created_at timestamptz) language sql security definer set search_path=public,auth as $$
 select m.user_id,p.full_name,u.email,m.plan,m.status,m.item_limit,m.monthly_price,m.client_id,m.created_at from public.memberships m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id where private.is_admin() order by m.created_at desc
$$;
revoke all on function public.admin_list_memberships() from public,anon; grant execute on function public.admin_list_memberships() to authenticated;
create or replace function public.admin_set_membership_status(p_user_id uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
begin if not private.is_admin() then raise exception 'Acceso denegado'; end if; if p_status not in ('pending','active','suspended','cancelled') then raise exception 'Estado inválido'; end if; update public.memberships set status=p_status,updated_at=now() where user_id=p_user_id; update public.profiles set role=case when p_status='active' then 'member' else 'pending' end where id=p_user_id; end $$;
revoke all on function public.admin_set_membership_status(uuid,text) from public,anon; grant execute on function public.admin_set_membership_status(uuid,text) to authenticated;
create index if not exists memberships_client_idx on public.memberships(client_id); create index if not exists intake_user_idx on public.intake_requests(user_id); create index if not exists intake_status_idx on public.intake_requests(status);
