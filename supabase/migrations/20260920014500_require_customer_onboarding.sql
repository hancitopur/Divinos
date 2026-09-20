-- Require complete customer details and recorded legal/billing acceptance before payment.
create table if not exists public.customer_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_name text not null default '',
  phone text not null default '',
  address_line1 text not null default '',
  address_line2 text,
  city text not null default '',
  region text not null default 'PR',
  postal_code text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_agreements (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('digital','reserva','coleccion')),
  terms_version text not null,
  billing_version text not null,
  monthly_amount numeric(10,2) not null check (monthly_amount >= 0),
  currency text not null default 'USD',
  accepted_at timestamptz not null default now(),
  paypal_subscription_id text unique
);

create index if not exists service_agreements_user_idx on public.service_agreements(user_id);

alter table public.customer_onboarding enable row level security;
alter table public.service_agreements enable row level security;

drop policy if exists customer_onboarding_staff_all on public.customer_onboarding;
create policy customer_onboarding_staff_all on public.customer_onboarding for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
drop policy if exists customer_onboarding_self_read on public.customer_onboarding;
create policy customer_onboarding_self_read on public.customer_onboarding for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists customer_onboarding_self_insert on public.customer_onboarding;
create policy customer_onboarding_self_insert on public.customer_onboarding for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists customer_onboarding_self_update on public.customer_onboarding;
create policy customer_onboarding_self_update on public.customer_onboarding for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists service_agreements_staff_all on public.service_agreements;
create policy service_agreements_staff_all on public.service_agreements for all to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
drop policy if exists service_agreements_self_read on public.service_agreements;
create policy service_agreements_self_read on public.service_agreements for select to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update on public.customer_onboarding to authenticated;
grant select on public.service_agreements to authenticated;

drop trigger if exists customer_onboarding_touch on public.customer_onboarding;
create trigger customer_onboarding_touch before update on public.customer_onboarding
  for each row execute function public.touch_updated_at();

-- Capture initial details from sign-up metadata. These fields are business data,
-- never authorization claims; the payment function re-reads the database row.
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

  insert into public.customer_onboarding (
    user_id, legal_name, phone, address_line1, address_line2, city, region, postal_code
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'address_line1', ''),
    nullif(new.raw_user_meta_data->>'address_line2', ''),
    coalesce(new.raw_user_meta_data->>'city', ''),
    coalesce(nullif(new.raw_user_meta_data->>'region', ''), 'PR'),
    coalesce(new.raw_user_meta_data->>'postal_code', '')
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
