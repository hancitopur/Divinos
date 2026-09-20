-- Divinos: separate staff authorization from customer plans and payment state.
-- Customers receive the same application features; plans only set capacity.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('superadmin','admin','member','pending'));

-- The existing owner/admin becomes the sole initial superadmin.
update public.profiles set role = 'superadmin' where role = 'admin';

alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

create table if not exists public.client_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists client_accounts_client_idx on public.client_accounts(client_id);

create table if not exists public.memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  plan text not null check (plan in ('digital','reserva','coleccion')),
  status text not null default 'pending'
    check (status in ('pending','approval_pending','active','suspended','past_due','cancelled','expired')),
  bottle_limit int check (bottle_limit is null or bottle_limit > 0),
  payment_provider text not null default 'paypal' check (payment_provider = 'paypal'),
  paypal_payer_id text,
  paypal_subscription_id text unique,
  paypal_plan_id text,
  current_period_end timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memberships_client_idx on public.memberships(client_id);
create index if not exists memberships_status_idx on public.memberships(status);

create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','submitted','reviewing','accepted','rejected')),
  notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists intake_requests_client_idx on public.intake_requests(client_id);
create index if not exists intake_requests_status_idx on public.intake_requests(status);

create table if not exists public.intake_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.intake_requests(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  producer text,
  vintage int check (vintage is null or vintage between 1800 and 2100),
  region text,
  country text,
  varietal text,
  wine_type text,
  size_ml int not null default 750,
  quantity int not null default 1 check (quantity between 1 and 200),
  purchase_price numeric(12,2) check (purchase_price is null or purchase_price >= 0),
  label_photo_path text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists intake_items_request_idx on public.intake_items(request_id);
create index if not exists intake_items_client_idx on public.intake_items(client_id);

alter table public.client_accounts enable row level security;
alter table public.memberships enable row level security;
alter table public.intake_requests enable row level security;
alter table public.intake_items enable row level security;

-- Authorization helpers live outside the exposed API schema.
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('superadmin','admin')
  );
$$;

create or replace function private.is_superadmin()
returns boolean language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'superadmin'
  );
$$;

create or replace function private.current_client_id()
returns uuid language sql stable security definer set search_path = public, private as $$
  select ca.client_id
  from public.client_accounts ca
  join public.memberships m on m.user_id = ca.user_id and m.client_id = ca.client_id
  join public.profiles p on p.id = ca.user_id
  where ca.user_id = (select auth.uid())
    and p.role = 'member'
    and m.status = 'active'
  limit 1;
$$;

create or replace function private.is_active_member()
returns boolean language sql stable security definer set search_path = public, private as $$
  select private.current_client_id() is not null;
$$;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_superadmin() from public, anon;
revoke all on function private.current_client_id() from public, anon;
revoke all on function private.is_active_member() from public, anon;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_superadmin() to authenticated;
grant execute on function private.current_client_id() to authenticated;
grant execute on function private.is_active_member() to authenticated;

-- Existing operational tables: staff may manage all; paid members see only their collection.
do $$
declare t text;
begin
  foreach t in array array['clients','wines','racks','slots','bottles','movements'] loop
    execute format('drop policy if exists "%s_staff_all" on public.%I', t, t);
    execute format(
      'create policy "%s_staff_all" on public.%I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))',
      t, t
    );
  end loop;
end $$;

drop policy if exists clients_member_read on public.clients;
create policy clients_member_read on public.clients for select to authenticated
  using (id = (select private.current_client_id()));

drop policy if exists wines_member_read on public.wines;
create policy wines_member_read on public.wines for select to authenticated
  using ((select private.is_active_member()));

drop policy if exists racks_member_read on public.racks;
create policy racks_member_read on public.racks for select to authenticated
  using ((select private.is_active_member()));

drop policy if exists slots_member_read on public.slots;
create policy slots_member_read on public.slots for select to authenticated
  using ((select private.is_active_member()));

drop policy if exists bottles_member_read on public.bottles;
create policy bottles_member_read on public.bottles for select to authenticated
  using (client_id = (select private.current_client_id()));

drop policy if exists movements_member_read on public.movements;
create policy movements_member_read on public.movements for select to authenticated
  using (exists (
    select 1 from public.bottles b
    where b.id = movements.bottle_id
      and b.client_id = (select private.current_client_id())
  ));

drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_superadmin_update on public.profiles for update to authenticated
  using ((select private.is_superadmin())) with check ((select private.is_superadmin()));

create policy client_accounts_staff_all on public.client_accounts for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy client_accounts_self_read on public.client_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create policy memberships_staff_all on public.memberships for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy memberships_self_read on public.memberships for select to authenticated
  using (user_id = (select auth.uid()));

create policy intake_requests_staff_all on public.intake_requests for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy intake_requests_member_read on public.intake_requests for select to authenticated
  using (client_id = (select private.current_client_id()) and submitted_by = (select auth.uid()));
create policy intake_requests_member_insert on public.intake_requests for insert to authenticated
  with check (client_id = (select private.current_client_id()) and submitted_by = (select auth.uid()) and status in ('draft','submitted'));
create policy intake_requests_member_update on public.intake_requests for update to authenticated
  using (client_id = (select private.current_client_id()) and submitted_by = (select auth.uid()) and status = 'draft')
  with check (client_id = (select private.current_client_id()) and submitted_by = (select auth.uid()) and status in ('draft','submitted'));

create policy intake_items_staff_all on public.intake_items for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy intake_items_member_read on public.intake_items for select to authenticated
  using (client_id = (select private.current_client_id()));
create policy intake_items_member_insert on public.intake_items for insert to authenticated
  with check (
    client_id = (select private.current_client_id()) and exists (
      select 1 from public.intake_requests r
      where r.id = intake_items.request_id and r.submitted_by = (select auth.uid()) and r.status = 'draft'
    )
  );
create policy intake_items_member_update on public.intake_items for update to authenticated
  using (client_id = (select private.current_client_id()) and exists (
    select 1 from public.intake_requests r
    where r.id = intake_items.request_id and r.submitted_by = (select auth.uid()) and r.status = 'draft'
  ))
  with check (client_id = (select private.current_client_id()));
create policy intake_items_member_delete on public.intake_items for delete to authenticated
  using (client_id = (select private.current_client_id()) and exists (
    select 1 from public.intake_requests r
    where r.id = intake_items.request_id and r.submitted_by = (select auth.uid()) and r.status = 'draft'
  ));

-- Capture the terms version accepted during registration. This is evidence, not authorization.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, terms_version, terms_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'pending',
    nullif(new.raw_user_meta_data->>'terms_version',''),
    case when new.raw_user_meta_data->>'terms_accepted' = 'true' then now() else null end
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists memberships_touch on public.memberships;
create trigger memberships_touch before update on public.memberships
  for each row execute function public.touch_updated_at();
drop trigger if exists intake_requests_touch on public.intake_requests;
create trigger intake_requests_touch before update on public.intake_requests
  for each row execute function public.touch_updated_at();

-- Label photos are private. Staff can manage catalog/bottle photos; members can
-- view catalog labels and manage only their own intake folder.
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
where id = 'labels';

drop policy if exists labels_public_read on storage.objects;
drop policy if exists labels_staff_write on storage.objects;
drop policy if exists labels_staff_update on storage.objects;
drop policy if exists labels_staff_delete on storage.objects;
drop policy if exists labels_staff_read on storage.objects;
drop policy if exists labels_member_read on storage.objects;
drop policy if exists labels_member_insert on storage.objects;
drop policy if exists labels_member_update on storage.objects;
drop policy if exists labels_member_delete on storage.objects;

create policy labels_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'labels' and (select private.is_staff()));
create policy labels_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'labels' and (select private.is_staff()));
create policy labels_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'labels' and (select private.is_staff()))
  with check (bucket_id = 'labels' and (select private.is_staff()));
create policy labels_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'labels' and (select private.is_staff()));

create policy labels_member_read on storage.objects for select to authenticated
  using (
    bucket_id = 'labels' and (select private.is_active_member()) and (
      (storage.foldername(name))[1] = 'wines' or
      ((storage.foldername(name))[1] = 'clients' and (storage.foldername(name))[2] = (select private.current_client_id())::text)
    )
  );
create policy labels_member_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'labels' and (select private.is_active_member()) and
    (storage.foldername(name))[1] = 'clients' and
    (storage.foldername(name))[2] = (select private.current_client_id())::text and
    (storage.foldername(name))[3] = 'intake'
  );
create policy labels_member_update on storage.objects for update to authenticated
  using (
    bucket_id = 'labels' and (select private.is_active_member()) and
    (storage.foldername(name))[1] = 'clients' and
    (storage.foldername(name))[2] = (select private.current_client_id())::text and
    (storage.foldername(name))[3] = 'intake'
  ) with check (
    bucket_id = 'labels' and
    (storage.foldername(name))[1] = 'clients' and
    (storage.foldername(name))[2] = (select private.current_client_id())::text and
    (storage.foldername(name))[3] = 'intake'
  );
create policy labels_member_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'labels' and (select private.is_active_member()) and
    (storage.foldername(name))[1] = 'clients' and
    (storage.foldername(name))[2] = (select private.current_client_id())::text and
    (storage.foldername(name))[3] = 'intake'
  );

grant select on public.client_accounts, public.memberships to authenticated;
grant select, insert, update on public.intake_requests to authenticated;
grant select, insert, update, delete on public.intake_items to authenticated;
