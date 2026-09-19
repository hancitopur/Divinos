-- Cava · Wine storage inventory
-- Run this in Supabase → SQL Editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Staff (app users). Every authenticated user is a staff member;
-- role 'admin' can manage everything, 'staff' can operate inventory.
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'pending' check (role in ('admin','staff','pending')),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Clients (owners of the bottles in storage)
-- ---------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Wines (catalog: one row per label/vintage)
-- ---------------------------------------------------------------
create table if not exists public.wines (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  producer      text,
  vintage       int check (vintage is null or (vintage between 1800 and 2100)),
  region        text,
  country       text,
  varietal      text,
  type          text check (type in ('red','white','rose','sparkling','dessert','fortified','other')),
  size_ml       int not null default 750,
  label_photo_path text,          -- storage path in bucket 'labels'
  notes         text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Physical storage: rack → shelf → position (slot)
-- ---------------------------------------------------------------
create table if not exists public.racks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  shelves     int not null default 1 check (shelves > 0),
  positions_per_shelf int not null default 1 check (positions_per_shelf > 0),
  created_at  timestamptz not null default now()
);

-- Slots are generated from rack dimensions; one bottle max per slot.
create table if not exists public.slots (
  id        uuid primary key default gen_random_uuid(),
  rack_id   uuid not null references public.racks(id) on delete cascade,
  shelf     int not null check (shelf > 0),
  position  int not null check (position > 0),
  unique (rack_id, shelf, position)
);

create or replace function public.generate_slots()
returns trigger language plpgsql as $$
begin
  insert into public.slots (rack_id, shelf, position)
  select new.id, s, p
  from generate_series(1, new.shelves) s,
       generate_series(1, new.positions_per_shelf) p
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists racks_generate_slots on public.racks;
create trigger racks_generate_slots
  after insert or update of shelves, positions_per_shelf on public.racks
  for each row execute function public.generate_slots();

-- ---------------------------------------------------------------
-- Bottles (one row per physical bottle)
-- ---------------------------------------------------------------
create table if not exists public.bottles (
  id              uuid primary key default gen_random_uuid(),
  wine_id         uuid not null references public.wines(id) on delete restrict,
  client_id       uuid not null references public.clients(id) on delete restrict,
  slot_id         uuid unique references public.slots(id) on delete set null,
  purchase_price  numeric(12,2) not null default 0 check (purchase_price >= 0),
  sale_price      numeric(12,2) not null default 0 check (sale_price >= 0),
  status          text not null default 'in_storage'
                  check (status in ('in_storage','sold','consumed','removed')),
  received_at     date not null default current_date,
  released_at     date,
  label_photo_path text,          -- optional per-bottle photo (overrides wine photo)
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bottles_client_idx on public.bottles(client_id);
create index if not exists bottles_wine_idx   on public.bottles(wine_id);
create index if not exists bottles_status_idx on public.bottles(status);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists bottles_touch on public.bottles;
create trigger bottles_touch before update on public.bottles
  for each row execute function public.touch_updated_at();

-- A bottle that leaves storage frees its slot automatically.
create or replace function public.release_slot_on_exit()
returns trigger language plpgsql as $$
begin
  if new.status <> 'in_storage' then
    new.slot_id := null;
    if new.released_at is null then new.released_at := current_date; end if;
  end if;
  return new;
end $$;

drop trigger if exists bottles_release_slot on public.bottles;
create trigger bottles_release_slot before insert or update of status on public.bottles
  for each row execute function public.release_slot_on_exit();

-- Movement log (audit trail of slot changes / status changes)
create table if not exists public.movements (
  id          uuid primary key default gen_random_uuid(),
  bottle_id   uuid not null references public.bottles(id) on delete cascade,
  from_slot   uuid references public.slots(id) on delete set null,
  to_slot     uuid references public.slots(id) on delete set null,
  from_status text,
  to_status   text,
  moved_by    uuid references auth.users(id),
  moved_at    timestamptz not null default now()
);

create or replace function public.log_movement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into movements (bottle_id, to_slot, to_status, moved_by)
    values (new.id, new.slot_id, new.status, auth.uid());
  elsif new.slot_id is distinct from old.slot_id or new.status is distinct from old.status then
    insert into movements (bottle_id, from_slot, to_slot, from_status, to_status, moved_by)
    values (new.id, old.slot_id, new.slot_id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists bottles_log_movement on public.bottles;
create trigger bottles_log_movement after insert or update on public.bottles
  for each row execute function public.log_movement();

-- ---------------------------------------------------------------
-- Views: value roll-ups
-- ---------------------------------------------------------------
create or replace view public.bottle_details
with (security_invoker = true) as
select
  b.id, b.status, b.purchase_price, b.sale_price,
  (b.sale_price - b.purchase_price) as margin,
  b.received_at, b.released_at, b.notes,
  coalesce(b.label_photo_path, w.label_photo_path) as label_photo_path,
  b.wine_id, w.name as wine_name, w.producer, w.vintage, w.type, w.region, w.country, w.varietal, w.size_ml,
  b.client_id, c.name as client_name,
  b.slot_id, s.shelf, s.position, r.id as rack_id, r.name as rack_name,
  b.created_at, b.updated_at
from bottles b
join wines w   on w.id = b.wine_id
join clients c on c.id = b.client_id
left join slots s on s.id = b.slot_id
left join racks r on r.id = s.rack_id;

create or replace view public.client_values
with (security_invoker = true) as
select
  c.id as client_id, c.name as client_name, c.active,
  count(b.id) filter (where b.status = 'in_storage')            as bottles_in_storage,
  coalesce(sum(b.purchase_price) filter (where b.status='in_storage'),0) as purchase_value,
  coalesce(sum(b.sale_price)     filter (where b.status='in_storage'),0) as sale_value,
  coalesce(sum(b.sale_price - b.purchase_price) filter (where b.status='in_storage'),0) as margin
from clients c
left join bottles b on b.client_id = c.id
group by c.id, c.name, c.active;

create or replace view public.storage_summary
with (security_invoker = true) as
select
  count(*) filter (where status='in_storage')                 as bottles_in_storage,
  coalesce(sum(purchase_price) filter (where status='in_storage'),0) as purchase_value,
  coalesce(sum(sale_price)     filter (where status='in_storage'),0) as sale_value,
  (select count(*) from slots)                                as total_slots,
  (select count(*) from bottles where status='in_storage' and slot_id is not null) as used_slots
from bottles;

-- ---------------------------------------------------------------
-- Row Level Security: only authenticated staff can read/write.
-- ---------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.clients   enable row level security;
alter table public.wines     enable row level security;
alter table public.racks     enable row level security;
alter table public.slots     enable row level security;
alter table public.bottles   enable row level security;
alter table public.movements enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- SECURITY DEFINER helpers are used only by triggers/RLS, never as public RPCs.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_movement() from public, anon, authenticated;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['clients','wines','racks','slots','bottles','movements'] loop
    execute format('drop policy if exists "%s_staff_all" on public.%I', t, t);
    execute format('create policy "%s_staff_all" on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t, t);
  end loop;
end $$;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated using (public.is_staff());
drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Storage bucket for label photos
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('labels', 'labels', true)
on conflict (id) do nothing;

drop policy if exists "labels_public_read" on storage.objects;
create policy "labels_public_read" on storage.objects for select using (bucket_id = 'labels');
drop policy if exists "labels_staff_write" on storage.objects;
create policy "labels_staff_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'labels' and public.is_staff());
drop policy if exists "labels_staff_update" on storage.objects;
create policy "labels_staff_update" on storage.objects for update to authenticated
  using (bucket_id = 'labels' and public.is_staff());
drop policy if exists "labels_staff_delete" on storage.objects;
create policy "labels_staff_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'labels' and public.is_staff());

-- ---------------------------------------------------------------
-- First user becomes admin: run once after signing up.
--   update public.profiles set role='admin' where id = (select id from auth.users order by created_at limit 1);
-- ---------------------------------------------------------------
